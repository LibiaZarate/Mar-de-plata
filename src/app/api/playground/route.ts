// Endpoint del Playground: simula un webhook de ManyChat con el
// mensaje que escribe Mar y devuelve el flow completo (incluyendo
// brief del Verificador, tool ejecutada y respuesta del Agente).

import { NextRequest, NextResponse } from "next/server";
import { cleanManychatBody } from "@/lib/webhook/clean";
import { runFlowMadre } from "@/lib/webhook/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text: string; numero?: string };
  const cleaned = cleanManychatBody({
    last_input_text: body.text,
    whatsapp_phone: body.numero ?? "5215550000000",
    id: "playground_" + Date.now(),
    canal_origen: "playground",
  });

  try {
    const flow = await runFlowMadre({ cleaned, source: "manychat" });
    return NextResponse.json({ ok: true, cleaned, flow });
  } catch (e) {
    return NextResponse.json(
      { ok: false, cleaned, error: (e as Error).message },
      { status: 500 },
    );
  }
}
