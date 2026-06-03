// Endpoint que dispara los seguimientos pendientes.
// Llamar desde Vercel Cron, n8n, o un botón manual.
//
// Auth opcional: si CRON_SECRET está set, requiere header
// Authorization: Bearer <secret>. Si no, abierto (Vercel Cron por
// default sigue siendo solo invocable internamente).
//
// Body (opcional, JSON):
// {
//   "mode": "production" | "simulator",  // default "production"
//   "numero_whatsapp": "521...",         // opcional, filtra a este lead
//   "lookahead_min": 0,                  // opcional, ejecuta también
//                                        // los que vencen en N min
//   "max_batch": 50
// }

import { NextRequest, NextResponse } from "next/server";
import { ejecutarSeguimientos } from "@/lib/seguimientos/executor";

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

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch {
    body = {};
  }

  const result = await ejecutarSeguimientos({
    mode: (body.mode as "production" | "simulator") ?? "production",
    numero_whatsapp: body.numero_whatsapp as string | undefined,
    lookahead_min: Number(body.lookahead_min ?? 0),
    max_batch: Number(body.max_batch ?? 50),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
