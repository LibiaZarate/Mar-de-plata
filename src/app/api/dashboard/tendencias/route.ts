/* eslint-disable @typescript-eslint/no-explicit-any */
// Tendencias diarias para gráficas: leads, facturación, pedidos,
// efectividad — agrupado por día (zona horaria CDMX).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/Mexico_City";

function ymd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayBoundsMx(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + offsetDays);
  const tzMin = Math.round(
    (new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(now.toLocaleString("en-US", { timeZone: TZ })).getTime()) /
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

  try {
    const sb = createAdminClient();
    const startOfWindow = dayBoundsMx(-(days - 1)).start;
    const endOfWindow = dayBoundsMx(0).end;

    const [leadsRes, cierresRes, handoffsRes] = await Promise.all([
      sb
        .from("leads")
        .select("numero_whatsapp,primer_contacto")
        .gte("primer_contacto", startOfWindow)
        .lt("primer_contacto", endOfWindow),
      sb
        .from("cierres_diarios")
        .select("monto,fecha_cierre")
        .gte("fecha_cierre", startOfWindow)
        .lt("fecha_cierre", endOfWindow),
      sb
        .from("alertas")
        .select("numero_whatsapp,created_at")
        .in("tipo", ["handoff_normal", "handoff_urgente", "guardrail_critico"])
        .gte("created_at", startOfWindow)
        .lt("created_at", endOfWindow),
    ]);

    const series = new Map<
      string,
      { date: string; leads: number; facturacion: number; pedidos: number; con_handoff: Set<string> }
    >();
    for (let i = days - 1; i >= 0; i--) {
      const d = dayBoundsMx(-i);
      const key = ymd(new Date(d.start));
      series.set(key, {
        date: key,
        leads: 0,
        facturacion: 0,
        pedidos: 0,
        con_handoff: new Set<string>(),
      });
    }

    const leadDayMap = new Map<string, string>();
    for (const row of (leadsRes.data ?? []) as any[]) {
      const ts = new Date(row.primer_contacto as string);
      const key = ymd(ts);
      if (series.has(key)) {
        series.get(key)!.leads += 1;
        leadDayMap.set(row.numero_whatsapp as string, key);
      }
    }
    for (const row of (cierresRes.data ?? []) as any[]) {
      const ts = new Date(row.fecha_cierre as string);
      const key = ymd(ts);
      if (series.has(key)) {
        series.get(key)!.facturacion += Number(row.monto || 0);
        series.get(key)!.pedidos += 1;
      }
    }
    for (const row of (handoffsRes.data ?? []) as any[]) {
      const numero = row.numero_whatsapp as string;
      const fecha = leadDayMap.get(numero);
      if (fecha && series.has(fecha)) {
        series.get(fecha)!.con_handoff.add(numero);
      }
    }

    const out = Array.from(series.values()).map((s) => ({
      date: s.date,
      leads: s.leads,
      facturacion: s.facturacion,
      pedidos: s.pedidos,
      efectividad:
        s.leads === 0 ? 0 : ((s.leads - s.con_handoff.size) / s.leads) * 100,
    }));

    return NextResponse.json({ ok: true, days, series: out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, series: [] },
      { status: 500 },
    );
  }
}
