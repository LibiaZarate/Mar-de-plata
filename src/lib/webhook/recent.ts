// Ring buffer in-memory de los últimos webhooks recibidos.
// Sobrevive hot-reloads de Next.js usando globalThis.
// En producción cada cold start lo resetea — está bien, es para depurar.

import type { CleanedPayload } from "./clean";

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
