import type { CleanedPayload } from "./clean";
import type { HandoffGuardrailPlan } from "./handoff-guardrail";
import type { VerificadorOutput } from "@/lib/agent/verificador";
import type { ToolResult } from "@/lib/agent/tools";
import type { FlowMode } from "@/lib/agent/mode";

export type WebhookFlowSummary = {
  mode: FlowMode;
  demo: boolean;
  leadCreated: boolean;
  verificador: VerificadorOutput;
  toolResult: ToolResult | null;
  agenteTexto: string;
  fragmentos: string[];
  outbound: Array<{
    source: "tool" | "agente";
    type: "text" | "image";
    text?: string;
    url?: string;
  }>;
  deliveryNotes: string[];
  durationMs: number;
};

export type WebhookLogEntry = {
  id: string;
  receivedAt: string;
  durationMs: number;
  source: "manychat" | "kaizen";
  kaizenSessionId: string | null;
  kaizenCallback: string | null;
  cleaned: CleanedPayload;
  rawBody: Record<string, unknown>;
  headers: Record<string, string>;
  guardrail: HandoffGuardrailPlan | null;
  flow: WebhookFlowSummary | null;
  error: string | null;
};

const MAX_ENTRIES = 50;

declare global {
  // eslint-disable-next-line no-var
  var __mar_webhook_log__: WebhookLogEntry[] | undefined;
}

function bucket(): WebhookLogEntry[] {
  if (!globalThis.__mar_webhook_log__) {
    globalThis.__mar_webhook_log__ = [];
  }
  return globalThis.__mar_webhook_log__;
}

export function pushWebhookLog(entry: WebhookLogEntry) {
  const log = bucket();
  log.unshift(entry);
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
}

export function listWebhookLog(): WebhookLogEntry[] {
  return [...bucket()];
}

export function clearWebhookLog() {
  bucket().length = 0;
}
