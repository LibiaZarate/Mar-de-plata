// Cron de la máquina de secuencias.
// Cada 15 min revisa qué secuencias tienen siguiente_disparo <= NOW(),
// las dispara (creando filas en seguimientos_programados) y avanza
// el paso_actual. El cron de seguimientos ya existente se encarga
// del envío real, con todas las skip rules.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarSecuenciasListas } from "@/lib/seguimientos/secuencias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const sb = createAdminClient();
    const res = await procesarSecuenciasListas(sb);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
