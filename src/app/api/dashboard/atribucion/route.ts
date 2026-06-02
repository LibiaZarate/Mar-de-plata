/* eslint-disable @typescript-eslint/no-explicit-any */
// Top anuncios por leads y facturación. Agrupa leads por anuncio_id
// y cruza con cierres_diarios para calcular conversion y revenue.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayBoundsMx(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  const local = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }),
  );
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + offsetDays);
  const tzMin = Math.round(
    (new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getTime()) /
      60000,
  );
  const start = new Date(local.getTime() + tzMin * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type AdRow = {
  anuncio_id: string;
  campaign_id: string | null;
  leads: number;
  pagados: number;
  facturacion: number;
  conversion_pct: number;
};

export async function GET(req: NextRequest) {
  const days = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30), 7),
    365,
  );

  try {
    const sb = createAdminClient();
    const start = dayBoundsMx(-(days - 1)).start;
    const end = dayBoundsMx(0).end;

    const [leadsRes, cierresRes] = await Promise.all([
      sb
        .from("leads")
        .select("numero_whatsapp,anuncio_id,etiquetas,estado")
        .gte("primer_contacto", start)
        .lt("primer_contacto", end)
        .not("anuncio_id", "is", null),
      sb
        .from("cierres_diarios")
        .select("numero_whatsapp,monto,fecha_cierre")
        .gte("fecha_cierre", start)
        .lt("fecha_cierre", end),
    ]);

    if (leadsRes.error) throw new Error(leadsRes.error.message);

    const leads = (leadsRes.data ?? []) as any[];
    const cierres = (cierresRes.data ?? []) as any[];

    // Mapa numero → total facturado en periodo
    const facturadoPorLead = new Map<string, number>();
    for (const c of cierres) {
      const k = c.numero_whatsapp as string;
      facturadoPorLead.set(k, (facturadoPorLead.get(k) ?? 0) + Number(c.monto || 0));
    }

    // Agrupar leads por anuncio_id
    const byAd = new Map<string, AdRow>();
    for (const l of leads) {
      const adId = (l.anuncio_id as string | null) ?? null;
      if (!adId) continue;
      const tags = (l.etiquetas as string[] | null) ?? [];
      const campaign = tags.find((t) => t.startsWith("campaign:"))?.slice(9) ?? null;
      if (!byAd.has(adId)) {
        byAd.set(adId, {
          anuncio_id: adId,
          campaign_id: campaign,
          leads: 0,
          pagados: 0,
          facturacion: 0,
          conversion_pct: 0,
        });
      }
      const row = byAd.get(adId)!;
      row.leads += 1;
      const fact = facturadoPorLead.get(l.numero_whatsapp as string) ?? 0;
      if (fact > 0 || l.estado === "pagada") row.pagados += 1;
      row.facturacion += fact;
    }

    const out: AdRow[] = Array.from(byAd.values())
      .map((r) => ({
        ...r,
        conversion_pct: r.leads === 0 ? 0 : (r.pagados / r.leads) * 100,
      }))
      .sort((a, b) => b.facturacion - a.facturacion || b.leads - a.leads);

    return NextResponse.json({
      ok: true,
      days,
      anuncios: out,
      total_leads_con_atribucion: leads.length,
      total_leads_sin_atribucion: 0, // calculado en el cliente si hace falta
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, anuncios: [] },
      { status: 500 },
    );
  }
}
