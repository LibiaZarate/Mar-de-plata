// Limpieza del payload de ManyChat — código real del nodo "Limpieza"
// del workflow de n8n. Ver CLAUDE.md §10 paso 3.

export type Attribution = {
  ad_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ctwa_clid: string | null;
  source_url: string | null;
  ref_raw: string | null;
};

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
  attribution: Attribution;
};

function clean<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// Parsea string tipo "campaign_id=123&ad_id=456&adset_id=789" o "?campaign_id=..."
// o un objeto JSON con esas keys.
function parseRef(raw: unknown): Partial<Attribution> {
  if (!raw) return {};
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      ad_id: (obj.ad_id as string) ?? null,
      campaign_id: (obj.campaign_id as string) ?? null,
      adset_id: (obj.adset_id as string) ?? null,
      ctwa_clid: (obj.ctwa_clid as string) ?? null,
      source_url: (obj.source_url as string) ?? null,
    };
  }
  if (typeof raw === "string") {
    try {
      // Intenta parsear como JSON primero
      if (raw.trim().startsWith("{")) {
        return parseRef(JSON.parse(raw));
      }
      // Luego como query string
      const params = new URLSearchParams(raw.replace(/^[?&]/, ""));
      return {
        ad_id: params.get("ad_id"),
        campaign_id: params.get("campaign_id"),
        adset_id: params.get("adset_id"),
        ctwa_clid: params.get("ctwa_clid"),
      };
    } catch {
      // No-op
    }
  }
  return {};
}

function extractAttribution(body: Record<string, unknown>): Attribution {
  // ManyChat puede mandar los datos de atribución en varios formatos.
  // Los normalizamos todos.
  const directos = {
    ad_id: clean(body.ad_id as string) ?? clean(body.fb_ad_id as string),
    campaign_id:
      clean(body.campaign_id as string) ?? clean(body.fb_campaign_id as string),
    adset_id:
      clean(body.adset_id as string) ?? clean(body.fb_adset_id as string),
    ctwa_clid: clean(body.ctwa_clid as string),
    source_url:
      clean(body.source_url as string) ??
      clean(body.last_referrer as string) ??
      clean(body.referral_source as string),
  };

  // Si vino un objeto/string de referral, intentar parsearlo y mezclar
  const refRaw =
    clean(body.referral as string | Record<string, unknown>) ??
    clean(body.ref as string | Record<string, unknown>);
  const refParsed = parseRef(refRaw);

  return {
    ad_id: directos.ad_id ?? refParsed.ad_id ?? null,
    campaign_id: directos.campaign_id ?? refParsed.campaign_id ?? null,
    adset_id: directos.adset_id ?? refParsed.adset_id ?? null,
    ctwa_clid: directos.ctwa_clid ?? refParsed.ctwa_clid ?? null,
    source_url: directos.source_url ?? null,
    ref_raw: typeof refRaw === "string" ? refRaw : refRaw ? JSON.stringify(refRaw) : null,
  };
}

export function cleanManychatBody(body: Record<string, unknown>): CleanedPayload {
  const whatsappPhone = clean(body.whatsapp_phone as string);
  const phone = clean(body.phone as string);
  const igId = clean(body.ig_id as string);
  const subscriberId =
    clean(body.id as string) ?? clean(body.subscriber_id as string);

  const sessionId = "mc_" + (whatsappPhone || phone || igId || "unknown");

  const lastInput = clean(body.last_input_text as string) || "";
  const declared = clean(body.tipo_mensaje_original as string);
  const tipoMensajeOriginal: "texto" | "audio" =
    declared === "audio" || /\.ogg(\b|\?|$)/i.test(lastInput) ? "audio" : "texto";

  const attribution = extractAttribution(body);

  return {
    channel: "manychat",
    sessionId,
    userText: lastInput,
    whatsappPhone,
    email: clean(body.email as string),
    timezone: clean(body.timezone as string) || "America/Mexico_City",
    tipoMensajeOriginal,
    canalOrigen: clean(body.canal_origen as string) || "meta_ctwa",
    anuncioId: clean(body.anuncio_id as string) ?? attribution.ad_id,
    subscriberId,
    attribution,
  };
}
