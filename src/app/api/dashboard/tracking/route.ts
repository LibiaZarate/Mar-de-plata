/* eslint-disable @typescript-eslint/no-explicit-any */
// Métricas por origen + lectura del número de WhatsApp del negocio
// para generar links de tracking.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayBoundsMx(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
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

export async function GET(req: NextRequest) {
  const days = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30), 7),
    365,
  );

  try {
    const sb = createAdminClient();
    const start = dayBoundsMx(-(days - 1)).start;
    const end = dayBoundsMx(0).end;

    const [whatsappRes, leadsRes, cierresRes] = await Promise.all([
      sb
        .from("config_sistema")
        .select("valor")
        .eq("clave", "whatsapp_negocio")
        .maybeSingle(),
      sb
        .from("leads")
        .select("numero_whatsapp,canal_origen,anuncio_id,estado")
        .gte("primer_contacto", start)
        .lt("primer_contacto", end),
      sb
        .from("cierres_diarios")
        .select("numero_whatsapp,monto,fecha_cierre")
        .gte("fecha_cierre", start)
        .lt("fecha_cierre", end),
    ]);

    const whatsappNegocio = (whatsappRes.data?.valor as string | null) ?? null;

    const leads = (leadsRes.data ?? []) as any[];
    const cierres = (cierresRes.data ?? []) as any[];

    const facturadoPorLead = new Map<string, number>();
    for (const c of cierres) {
      const k = c.numero_whatsapp as string;
      facturadoPorLead.set(k, (facturadoPorLead.get(k) ?? 0) + Number(c.monto || 0));
    }

    const byOrigen = new Map<string, { leads: number; pagados: number; facturacion: number }>();
    const byCodigo = new Map<string, { leads: number; pagados: number; facturacion: number }>();
    for (const l of leads) {
      const origen = (l.canal_origen as string | null) ?? "Sin atribución";
      if (!byOrigen.has(origen)) byOrigen.set(origen, { leads: 0, pagados: 0, facturacion: 0 });
      const row = byOrigen.get(origen)!;
      row.leads += 1;
      const fact = facturadoPorLead.get(l.numero_whatsapp as string) ?? 0;
      const pagado = fact > 0 || l.estado === "pagada";
      if (pagado) row.pagados += 1;
      row.facturacion += fact;

      // También agrupamos por anuncio_id para que cada campaña custom
      // (ad_dia_madres_2026 etc.) tenga sus métricas
      const codigo = (l.anuncio_id as string | null) ?? null;
      if (codigo) {
        if (!byCodigo.has(codigo)) byCodigo.set(codigo, { leads: 0, pagados: 0, facturacion: 0 });
        const rowC = byCodigo.get(codigo)!;
        rowC.leads += 1;
        if (pagado) rowC.pagados += 1;
        rowC.facturacion += fact;
      }
    }

    const porOrigen = Array.from(byOrigen.entries())
      .map(([origen, m]) => ({
        origen,
        ...m,
        conversion_pct: m.leads === 0 ? 0 : (m.pagados / m.leads) * 100,
      }))
      .sort((a, b) => b.leads - a.leads);

    const porCodigo = Array.from(byCodigo.entries())
      .map(([codigo, m]) => ({
        codigo,
        ...m,
        conversion_pct: m.leads === 0 ? 0 : (m.pagados / m.leads) * 100,
      }))
      .sort((a, b) => b.leads - a.leads);

    return NextResponse.json({
      ok: true,
      days,
      whatsappNegocio,
      porOrigen,
      porCodigo,
      totalLeads: leads.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, porOrigen: [], whatsappNegocio: null },
      { status: 500 },
    );
  }
}
