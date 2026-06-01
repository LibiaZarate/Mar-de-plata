// Limpieza del payload de ManyChat — código real del nodo "Limpieza"
// del workflow de n8n. Ver CLAUDE.md §10 paso 3.

export type CleanedPayload = {
  channel: "manychat";
  sessionId: string;
  userText: string;
  whatsappPhone: string | null;
  email: string | null;
  timezone: string;
  tipoMensajeOriginal: "texto" | "audio";
  canalOrigen: string;
  anuncioId: string | null;
  subscriberId: string | null;
};

function clean<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function cleanManychatBody(body: Record<string, unknown>): CleanedPayload {
  const whatsappPhone = clean(body.whatsapp_phone as string);
  const phone = clean(body.phone as string);
  const igId = clean(body.ig_id as string);
  const subscriberId = clean(body.id as string) ?? clean(body.subscriber_id as string);

  const sessionId = "mc_" + (whatsappPhone || phone || igId || "unknown");

  const lastInput = clean(body.last_input_text as string) || "";
  // Detectamos audio por extensión .ogg — Whisper viene en fase posterior.
  const declared = clean(body.tipo_mensaje_original as string);
  const tipoMensajeOriginal: "texto" | "audio" =
    declared === "audio" || /\.ogg(\b|\?|$)/i.test(lastInput) ? "audio" : "texto";

  return {
    channel: "manychat",
    sessionId,
    userText: lastInput,
    whatsappPhone,
    email: clean(body.email as string),
    timezone: clean(body.timezone as string) || "America/Mexico_City",
    tipoMensajeOriginal,
    canalOrigen: clean(body.canal_origen as string) || "meta_ctwa",
    anuncioId: clean(body.anuncio_id as string),
    subscriberId,
  };
}
