// Asesoras con métricas del día.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayBoundsMx(): { start: string; end: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  local.setHours(0, 0, 0, 0);
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
    const { start, end } = dayBoundsMx();

    const [aRes, cRes, alRes] = await Promise.all([
      sb.from("asesoras").select("*").eq("activa", true)
        .order("en_onboarding", { ascending: true }).order("nombre_completo"),
      sb.from("cierres_diarios").select("asesora_id,monto")
        .gte("fecha_cierre", start).lt("fecha_cierre", end),
      sb.from("alertas").select("asesora_asignada_id,estado")
        .in("estado", ["activa", "vista"]),
    ]);
    if (aRes.error) throw new Error(aRes.error.message);

    const asesoras = aRes.data ?? [];
    const metricas = asesoras.map((x) => {
      const cierres = (cRes.data ?? []).filter((r) => r.asesora_id === x.id);
      const pedidos = cierres.length;
      const monto = cierres.reduce((s, r) => s + Number(r.monto || 0), 0);
      const aler = (alRes.data ?? []).filter((r) => r.asesora_asignada_id === x.id).length;
      const convs = Number(x.conversaciones_dia ?? 0);
      return {
        asesora_id: x.id as string,
        pedidos_hoy: pedidos,
        monto_hoy: monto,
        alertas_activas: aler,
        conversaciones_hoy: convs,
        pct_cierre: convs === 0 ? 0 : (pedidos / convs) * 100,
      };
    });

    return NextResponse.json({ ok: true, asesoras, metricas });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, asesoras: [], metricas: [] },
      { status: 500 },
    );
  }
}
