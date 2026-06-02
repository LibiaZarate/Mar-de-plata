// Endpoint único de la pantalla Inicio: Bloque A (KPIs) + Bloque B
// (operativos) + Bloque C (embudo). Usa service_role para saltar RLS.

import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const sb = createAdminClient();
    const hoy = dayBoundsMx(0);
    const ayer = dayBoundsMx(-1);

    const [
      leadsHoyRes,
      leadsAyerRes,
      leadsHoyList,
      handoffsList,
      cierresHoy,
      canalesData,
      alertasCount,
      todosHoy,
      conversacionesEnEstado,
      requierenHandoff,
    ] = await Promise.all([
      sb.from("leads").select("*", { count: "exact", head: true })
        .gte("primer_contacto", hoy.start).lt("primer_contacto", hoy.end),
      sb.from("leads").select("*", { count: "exact", head: true })
        .gte("primer_contacto", ayer.start).lt("primer_contacto", ayer.end),
      sb.from("leads").select("numero_whatsapp,estado,canal_origen,primer_contacto")
        .gte("primer_contacto", hoy.start).lt("primer_contacto", hoy.end),
      sb.from("alertas").select("numero_whatsapp")
        .in("tipo", ["handoff_normal", "handoff_urgente", "guardrail_critico"])
        .gte("created_at", hoy.start).lt("created_at", hoy.end),
      sb.from("cierres_diarios").select("monto")
        .gte("fecha_cierre", hoy.start).lt("fecha_cierre", hoy.end),
      sb.from("leads").select("canal_origen")
        .gte("primer_contacto", hoy.start).lt("primer_contacto", hoy.end),
      sb.from("alertas").select("*", { count: "exact", head: true })
        .in("estado", ["activa", "vista"]),
      sb.from("leads").select("numero_whatsapp,estado,primer_contacto")
        .gte("primer_contacto", hoy.start).lt("primer_contacto", hoy.end),
      sb.from("estado_conversacion_actual").select("numero_whatsapp,rama_activa,inicio_conversacion")
        .not("rama_activa", "is", null)
        .gte("inicio_conversacion", hoy.start).lt("inicio_conversacion", hoy.end),
      sb.from("estado_conversacion_actual").select("numero_whatsapp,requiere_handoff,inicio_conversacion")
        .eq("requiere_handoff", true)
        .gte("inicio_conversacion", hoy.start).lt("inicio_conversacion", hoy.end),
    ]);

    // KPI 1
    const h = leadsHoyRes.count ?? 0;
    const a = leadsAyerRes.count ?? 0;
    const delta = a === 0 ? (h === 0 ? 0 : 100) : Math.round(((h - a) / a) * 100);

    // KPI 2
    const total = (leadsHoyList.data ?? []).length;
    const handoffSet = new Set((handoffsList.data ?? []).map((x) => x.numero_whatsapp));
    const con = (leadsHoyList.data ?? []).filter((x) => handoffSet.has(x.numero_whatsapp)).length;
    const efectividad = total === 0 ? 0 : ((total - con) / total) * 100;

    // KPI 3 (facturación)
    const pedidos = (cierresHoy.data ?? []).length;
    const facturacion = (cierresHoy.data ?? []).reduce((s, r) => s + Number(r.monto || 0), 0);
    const ticket = pedidos === 0 ? 0 : facturacion / pedidos;

    // Canales
    const counts = new Map<string, number>();
    for (const row of canalesData.data ?? []) {
      const c = (row.canal_origen as string) ?? "—";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const canales = Array.from(counts.entries())
      .map(([canal, total]) => ({ canal, total }))
      .sort((a, b) => b.total - a.total);

    // Embudo (Bloque C)
    const ll = (todosHoy.data ?? []) as { numero_whatsapp: string; estado: string }[];
    const set = new Set(ll.map((x) => x.numero_whatsapp));
    const etapas = [
      { key: "entro", label: "Entró", count: ll.length },
      {
        key: "en_conversacion",
        label: "En conversación",
        count: (conversacionesEnEstado.data ?? []).filter((x) =>
          set.has(x.numero_whatsapp),
        ).length,
      },
      { key: "calificada", label: "Calificada", count: ll.filter((l) => l.estado === "calificada").length },
      {
        key: "equipo",
        label: "En manos del equipo",
        count: (requierenHandoff.data ?? []).filter((x) => set.has(x.numero_whatsapp)).length,
      },
      { key: "esperando_pago", label: "Esperando pago", count: ll.filter((l) => l.estado === "esperando_pago").length },
      { key: "pagada", label: "Pagada", count: ll.filter((l) => l.estado === "pagada").length },
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
      leadsHoyKpi: { hoy: h, ayer: a, delta },
      efectividad: { pct: efectividad, total, con },
      facturacion: { pedidos, facturacion, ticket },
      canales,
      alertasCount: alertasCount.count ?? 0,
      embudo: { etapas, cuello, conversion },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
