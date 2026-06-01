// Webhook receptor de ManyChat.
//
// Fase 2 del roadmap: solo recibe, limpia, loguea y devuelve 200.
// Las siguientes capas (guardrails, lookup, Verificador, Agente, tools)
// se montan en fases posteriores.
//
// Acepta también modo testing de Kaizen vía headers x-kaizen-session-id
// y x-kaizen-callback (ver CLAUDE.md §10 paso 1).

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cleanManychatBody } from "@/lib/webhook/clean";
import { checkGuardrails } from "@/lib/webhook/guardrails";
import {
  executeHandoffGuardrail,
  planHandoffGuardrail,
  type HandoffGuardrailPlan,
} from "@/lib/webhook/handoff-guardrail";
import {
  listWebhookLog,
  pushWebhookLog,
  type WebhookLogEntry,
} from "@/lib/webhook/recent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const start = Date.now();

  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Body no es JSON válido", detail: String(e) },
      { status: 400 },
    );
  }

  const kaizenSessionId = req.headers.get("x-kaizen-session-id");
  const kaizenCallback = req.headers.get("x-kaizen-callback");
  const source: "manychat" | "kaizen" = kaizenSessionId ? "kaizen" : "manychat";

  const cleaned = cleanManychatBody(rawBody);

  // Guardrails de capa 1 — corre ANTES que cualquier otra cosa.
  // Si hay match, planeamos el handoff_directo_guardrail y salimos del
  // pipeline normal (no Verificador, no Agente).
  const match = checkGuardrails(cleaned.userText);
  let guardrailPlan: HandoffGuardrailPlan | null = null;
  if (match) {
    guardrailPlan = planHandoffGuardrail(cleaned, match);
    await executeHandoffGuardrail(guardrailPlan);
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Evitamos meter cabeceras hop-by-hop y cookies sensibles en el log.
    if (
      key === "cookie" ||
      key === "authorization" ||
      key.startsWith("x-vercel-") ||
      key.startsWith("cf-")
    ) {
      return;
    }
    headers[key] = value;
  });

  const entry: WebhookLogEntry = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    source,
    kaizenSessionId,
    kaizenCallback,
    cleaned,
    rawBody,
    headers,
    guardrail: guardrailPlan,
  };

  pushWebhookLog(entry);

  // Útil para `vercel logs` o terminal local
  console.info(
    `[webhook/manychat] ${source} · ${cleaned.sessionId} · ${cleaned.tipoMensajeOriginal}` +
      (guardrailPlan
        ? ` · GUARDRAIL ${guardrailPlan.match.category}:${guardrailPlan.match.keyword}`
        : "") +
      ` · "${cleaned.userText.slice(0, 80)}"`,
  );

  return NextResponse.json({
    ok: true,
    phase: 3,
    received_at: entry.receivedAt,
    cleaned,
    source,
    kaizen: {
      session_id: kaizenSessionId,
      callback: kaizenCallback,
    },
    guardrail: guardrailPlan
      ? {
          hit: true,
          category: guardrailPlan.match.category,
          keyword: guardrailPlan.match.keyword,
          motivo: guardrailPlan.match.motivo,
          action: "handoff_directo_guardrail",
          steps_pending: guardrailPlan.steps.length,
        }
      : { hit: false },
  });
}

// Inspector: GET devuelve el ring buffer en memoria.
export async function GET() {
  return NextResponse.json({
    ok: true,
    count: listWebhookLog().length,
    entries: listWebhookLog(),
  });
}
