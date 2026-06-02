// Endpoint único de la pantalla Inicio: Bloque A (KPIs) + Bloque B
// (operativos) + Bloque C (embudo). Usa service_role para saltar RLS.
// Soporta query param ?range=hoy|7d|30d|total.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Range = "hoy" | "7d" | "30d" | "total";
type Bounds = { start: string | null; end: string };

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

function rangeBounds(range: Range): {
  current: Bounds;
  previous: Bounds;
  days: number;
} {
  if (range === "total") {
    const end = new Date().toISOString();
    return { current: { start: null, end }, previous: { start: null, end }, days: 0 };
  }
  if (range === "hoy") {
    return { current: dayBoundsMx(0), previous: dayBoundsMx(-1), days: 1 };
  }
  const days = range === "7d" ? 7 : 30;
  return {
    current: { start: dayBoundsMx(-(days - 1)).start, end: dayBoundsMx(0).end },
    previous: { start: dayBoundsMx(-(days * 2 - 1)).start, end: dayBoundsMx(-days).start },
    days,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function countByDate(
  sb: SupabaseClient,
  table: string,
  col: string,
  bounds: Bounds,
): Promise<number> {
  let q: any = sb.from(table).select("*", { count: "exact", head: true });
  if (bounds.start) q = q.gte(col, bounds.start).lt(col, bounds.end);
  const { count } = await q;
  return count ?? 0;
}

async function selectByDate(
  sb: SupabaseClient,
  table: string,
  cols: string,
  col: string,
  bounds: Bounds,
  extra?: (q: any) => any,
): Promise<Record<string, unknown>[]> {
  let q: any = sb.from(table).select(cols);
  if (extra) q = extra(q);
  if (bounds.start) q = q.gte(col, bounds.start).lt(col, bounds.end);
  const { data } = await q;
  return (data ?? []) as Record<string, unknown>[];
}

export async function GET(req: NextRequest) {
  const range = (req.nextUrl.searchParams.get("range") ?? "hoy") as Range;
  if (!["hoy", "7d", "30d", "total"].includes(range)) {
    return NextResponse.json(
      { ok: false, error: `range inválido: ${range}` },
      { status: 400 },
    );
  }
  const { current, previous, days } = rangeBounds(range);

  try {
    const sb = createAdminClient();

    const [
      hCount,
      aCount,
      leadsCurList,
      handoffsList,
      cierresCur,
      canalesData,
      alertasCountObj,
      conversacionesEnEstado,
      requierenHandoff,
    ] = await Promise.all([
      countByDate(sb, "leads", "primer_contacto", current),
      countByDate(sb, "leads", "primer_contacto", previous),
      selectByDate(sb, "leads", "numero_whatsapp,estado,canal_origen,primer_contacto", "primer_contacto", current),
      selectByDate(sb, "alertas", "numero_whatsapp", "created_at", current, (q) =>
        q.in("tipo", ["handoff_normal", "handoff_urgente", "guardrail_critico"]),
      ),
      selectByDate(sb, "cierres_diarios", "monto", "fecha_cierre", current),
      selectByDate(sb, "leads", "canal_origen", "primer_contacto", current),
      sb.from("alertas").select("*", { count: "exact", head: true })
        .in("estado", ["activa", "vista"]),
      selectByDate(
        sb,
        "estado_conversacion_actual",
        "numero_whatsapp,rama_activa,inicio_conversacion",
        "inicio_conversacion",
        current,
        (q) => q.not("rama_activa", "is", null),
      ),
      selectByDate(
        sb,
        "estado_conversacion_actual",
        "numero_whatsapp,requiere_handoff,inicio_conversacion",
        "inicio_conversacion",
        current,
        (q) => q.eq("requiere_handoff", true),
      ),
    ]);

    // KPI 1 leads
    const delta =
      aCount === 0 ? (hCount === 0 ? 0 : 100) : Math.round(((hCount - aCount) / aCount) * 100);

    // KPI 2 efectividad
    const totalLeads = leadsCurList.length;
    const handoffSet = new Set(handoffsList.map((x) => x.numero_whatsapp as string));
    const conHandoff = leadsCurList.filter((x) =>
      handoffSet.has(x.numero_whatsapp as string),
    ).length;
    const efectividad =
      totalLeads === 0 ? 0 : ((totalLeads - conHandoff) / totalLeads) * 100;

    // KPI 3 facturación
    const pedidos = cierresCur.length;
    const facturacion = cierresCur.reduce((s, r) => s + Number(r.monto || 0), 0);
    const ticket = pedidos === 0 ? 0 : facturacion / pedidos;

    // Canales
    const counts = new Map<string, number>();
    for (const row of canalesData) {
      const c = (row.canal_origen as string | null) ?? "—";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const canales = Array.from(counts.entries())
      .map(([canal, total]) => ({ canal, total }))
      .sort((a, b) => b.total - a.total);

    // Embudo
    const set = new Set(leadsCurList.map((x) => x.numero_whatsapp as string));
    const etapas = [
      { key: "entro", label: "Entró", count: leadsCurList.length },
      {
        key: "en_conversacion",
        label: "En conversación",
        count: conversacionesEnEstado.filter((x) => set.has(x.numero_whatsapp as string)).length,
      },
      {
        key: "calificada",
        label: "Calificada",
        count: leadsCurList.filter((l) => l.estado === "calificada").length,
      },
      {
        key: "equipo",
        label: "En manos del equipo",
        count: requierenHandoff.filter((x) => set.has(x.numero_whatsapp as string)).length,
      },
      {
        key: "esperando_pago",
        label: "Esperando pago",
        count: leadsCurList.filter((l) => l.estado === "esperando_pago").length,
      },
      {
        key: "pagada",
        label: "Pagada",
        count: leadsCurList.filter((l) => l.estado === "pagada").length,
      },
    ];
    let cuello: { from: string; to: string; fuga_pp: number } | null = null;
    const totalE = etapas[0].count;
    for (let i = 0; i < etapas.length - 1; i++) {
      if (totalE === 0) break;
      const ap = (etapas[i].count / totalE) * 100;
      const bp = (etapas[i + 1].count / totalE) * 100;
      const f = ap - bp;
      if (!cuello || f > cuello.fuga_pp)
        cuello = { from: etapas[i].label, to: etapas[i + 1].label, fuga_pp: f };
    }
    const conversion = totalE === 0 ? 0 : (etapas[etapas.length - 1].count / totalE) * 100;

    return NextResponse.json({
      ok: true,
      range,
      days,
      leadsHoyKpi: { hoy: hCount, ayer: aCount, delta },
      efectividad: { pct: efectividad, total: totalLeads, con: conHandoff },
      facturacion: { pedidos, facturacion, ticket },
      canales,
      alertasCount: alertasCountObj.count ?? 0,
      embudo: { etapas, cuello, conversion },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
