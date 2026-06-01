// Webhook receptor de ManyChat — orquestador completo del flujo madre.
// Fases 2 + 3 + 4 + 5 + 6 + 7 conectadas (CLAUDE.md §10).

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cleanManychatBody } from "@/lib/webhook/clean";
import { runFlowMadre } from "@/lib/webhook/flow";
import {
  listWebhookLog,
  pushWebhookLog,
  type WebhookLogEntry,
} from "@/lib/webhook/recent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  let flow: Awaited<ReturnType<typeof runFlowMadre>> | null = null;
  let flowError: string | null = null;
  try {
    flow = await runFlowMadre({ cleaned, kaizenSessionId, source });
  } catch (e) {
    flowError = (e as Error).message;
    console.error("[webhook/manychat] flow error:", flowError);
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
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
    guardrail: flow?.earlyExit?.plan ?? null,
    flow: flow
      ? {
          mode: flow.mode,
          demo: flow.demo,
          leadCreated: flow.leadCreated,
          verificador: flow.verificador,
          toolResult: flow.toolResult,
          agenteTexto: flow.agenteTexto,
          fragmentos: flow.fragmentos,
          outbound: flow.outbound,
          deliveryNotes: flow.deliveryNotes,
          durationMs: flow.durationMs,
        }
      : null,
    error: flowError,
  };

  pushWebhookLog(entry);

  console.info(
    `[webhook/manychat] ${source} · ${cleaned.sessionId} · ${cleaned.tipoMensajeOriginal}` +
      (flow?.earlyExit
        ? ` · GUARDRAIL ${flow.earlyExit.plan.match.category}:${flow.earlyExit.plan.match.keyword}`
        : flow
          ? ` · tool=${flow.verificador.accion_recomendada?.tool_principal ?? "-"}`
          : "") +
      ` · "${cleaned.userText.slice(0, 80)}"`,
  );

  return NextResponse.json({
    ok: !flowError,
    phase: 13,
    received_at: entry.receivedAt,
    cleaned,
    source,
    kaizen: { session_id: kaizenSessionId, callback: kaizenCallback },
    guardrail: flow?.earlyExit
      ? {
          hit: true,
          category: flow.earlyExit.plan.match.category,
          keyword: flow.earlyExit.plan.match.keyword,
          motivo: flow.earlyExit.plan.match.motivo,
          action: "handoff_directo_guardrail",
        }
      : { hit: false },
    flow: flow
      ? {
          mode: flow.mode,
          demo: flow.demo,
          lead_created: flow.leadCreated,
          tool: flow.toolResult?.tool ?? null,
          tool_ok: flow.toolResult?.ok ?? null,
          fragmentos: flow.fragmentos.length,
          outbound: flow.outbound.length,
          duration_ms: flow.durationMs,
        }
      : null,
    error: flowError,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    count: listWebhookLog().length,
    entries: listWebhookLog(),
  });
}
