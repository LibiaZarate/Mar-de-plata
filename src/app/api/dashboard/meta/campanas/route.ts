/* eslint-disable @typescript-eslint/no-explicit-any */
// Trae las campañas del Ad Account con sus métricas agregadas.
// Cruza con la facturación del dashboard (leads.anuncio_id) para
// calcular ROAS real.

import { NextRequest, NextResponse } from "next/server";
import { metaGet, resolveAdAccountId, MetaApiError } from "@/lib/meta/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Insights = {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach?: string;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  insights?: { data: Insights[] };
};

type Ad = {
  id: string;
  name: string;
  campaign_id: string;
  effective_status: string;
  insights?: { data: Insights[] };
};

function presetFromDays(days: number): string {
  if (days <= 7) return "last_7d";
  if (days <= 14) return "last_14d";
  if (days <= 30) return "last_30d";
  if (days <= 90) return "last_90d";
  return "last_180d";
}

function dayBoundsMx(offsetDays = 0) {
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
    180,
  );
  const preset = presetFromDays(days);

  try {
    const adAccountId = await resolveAdAccountId();
    const insightsFields = "spend,impressions,clicks,ctr,cpc,cpm,reach";
    const fieldsCampaign = `id,name,objective,status,effective_status,insights.date_preset(${preset}){${insightsFields}}`;
    const fieldsAd = `id,name,campaign_id,effective_status,insights.date_preset(${preset}){${insightsFields}}`;

    const [campRes, adRes] = await Promise.all([
      metaGet<{ data: Campaign[] }>(`/${adAccountId}/campaigns`, {
        fields: fieldsCampaign,
        limit: "200",
      }),
      metaGet<{ data: Ad[] }>(`/${adAccountId}/ads`, {
        fields: fieldsAd,
        limit: "200",
      }),
    ]);

    // Cruzar con facturación del dashboard usando anuncio_id
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

    const facturadoPorLead = new Map<string, number>();
    for (const c of (cierresRes.data ?? []) as any[]) {
      const k = c.numero_whatsapp as string;
      facturadoPorLead.set(k, (facturadoPorLead.get(k) ?? 0) + Number(c.monto || 0));
    }

    // Métricas del dashboard por ad_id y campaign_id
    const dashByAd = new Map<string, { leads: number; pagados: number; facturacion: number }>();
    const dashByCampaign = new Map<
      string,
      { leads: number; pagados: number; facturacion: number }
    >();
    for (const l of (leadsRes.data ?? []) as any[]) {
      const adId = l.anuncio_id as string;
      const tags = (l.etiquetas as string[] | null) ?? [];
      const campId = tags.find((t) => t.startsWith("campaign:"))?.slice(9) ?? null;
      const fact = facturadoPorLead.get(l.numero_whatsapp as string) ?? 0;
      const pagado = fact > 0 || l.estado === "pagada";

      if (!dashByAd.has(adId)) dashByAd.set(adId, { leads: 0, pagados: 0, facturacion: 0 });
      const r1 = dashByAd.get(adId)!;
      r1.leads += 1;
      if (pagado) r1.pagados += 1;
      r1.facturacion += fact;

      if (campId) {
        if (!dashByCampaign.has(campId))
          dashByCampaign.set(campId, { leads: 0, pagados: 0, facturacion: 0 });
        const r2 = dashByCampaign.get(campId)!;
        r2.leads += 1;
        if (pagado) r2.pagados += 1;
        r2.facturacion += fact;
      }
    }

    const metric = (c: Campaign | Ad) => {
      const i = c.insights?.data?.[0];
      return {
        spend: Number(i?.spend ?? 0),
        impressions: Number(i?.impressions ?? 0),
        clicks: Number(i?.clicks ?? 0),
        ctr: Number(i?.ctr ?? 0),
        cpc: Number(i?.cpc ?? 0),
        cpm: Number(i?.cpm ?? 0),
        reach: Number(i?.reach ?? 0),
      };
    };

    const campaigns = campRes.data.map((c) => {
      const m = metric(c);
      const d = dashByCampaign.get(c.id) ?? { leads: 0, pagados: 0, facturacion: 0 };
      return {
        id: c.id,
        name: c.name,
        objective: c.objective,
        status: c.status,
        effective_status: c.effective_status,
        meta: m,
        dashboard: d,
        roas: m.spend === 0 ? null : d.facturacion / m.spend,
        cpl_dashboard: d.leads === 0 ? null : m.spend / d.leads,
      };
    });

    const ads = adRes.data.map((a) => {
      const m = metric(a);
      const d = dashByAd.get(a.id) ?? { leads: 0, pagados: 0, facturacion: 0 };
      return {
        id: a.id,
        name: a.name,
        campaign_id: a.campaign_id,
        effective_status: a.effective_status,
        meta: m,
        dashboard: d,
        roas: m.spend === 0 ? null : d.facturacion / m.spend,
        cpl_dashboard: d.leads === 0 ? null : m.spend / d.leads,
      };
    });

    // Ordena por gasto descendente para que las campañas grandes salgan arriba
    campaigns.sort((a, b) => b.meta.spend - a.meta.spend);
    ads.sort((a, b) => b.meta.spend - a.meta.spend);

    return NextResponse.json({
      ok: true,
      days,
      ad_account_id: adAccountId,
      campaigns,
      ads,
      totales: {
        spend: campaigns.reduce((s, c) => s + c.meta.spend, 0),
        impressions: campaigns.reduce((s, c) => s + c.meta.impressions, 0),
        clicks: campaigns.reduce((s, c) => s + c.meta.clicks, 0),
        leads_dashboard: Array.from(dashByCampaign.values()).reduce((s, r) => s + r.leads, 0),
        facturacion_dashboard: Array.from(dashByCampaign.values()).reduce(
          (s, r) => s + r.facturacion,
          0,
        ),
      },
    });
  } catch (e) {
    const err = e as MetaApiError;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        meta_code: err.metaCode,
        meta_type: err.metaType,
      },
      { status: 500 },
    );
  }
}
