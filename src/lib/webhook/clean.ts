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
  nombre: string | null;
  timezone: string;
  tipoMensajeOriginal: "texto" | "audio";
  canalOrigen: string;
  anuncioId: string | null;
  subscriberId: string | null;
  attribution: Attribution;
};

// ManyChat envía el nombre del contacto cuando lo conoce. Lo arma con
// los campos estándar de Meta (first_name / last_name) o el name plano.
// Si todos vienen vacíos, devolvemos null y el lead queda sin nombre
// hasta que el agente lo pregunte o lo deduzca.
function extraerNombre(body: Record<string, unknown>): string | null {
  const directo = clean(body.name as string)?.trim();
  if (directo) return directo;
  const first = clean(body.first_name as string)?.trim() ?? "";
  const last = clean(body.last_name as string)?.trim() ?? "";
  const combinado = `${first} ${last}`.trim();
  return combinado.length > 0 ? combinado : null;
}

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

// Detecta el origen del lead leyendo el primer mensaje del cliente.
// El dashboard genera links con textos pre-llenados específicos por origen
// (ver /configuracion/tracking). Cuando el cliente abre WhatsApp y manda
// el mensaje tal cual, nosotros lo reconocemos.
//
// Formato preferido (más confiable): [src:codigo] al final del mensaje.
//   ej. "Hola, me interesa la joyería ✨ [src:ig_bio]"
// Detectamos eso primero. Si no, hacemos un best-effort buscando keywords
// de redes sociales / anuncios mencionados en texto natural.
export function detectarOrigenDelMensaje(texto: string): {
  canal: string | null;
  codigo: string | null;
  textoLimpio: string;
} {
  if (!texto) return { canal: null, codigo: null, textoLimpio: "" };

  // 1) Tag explícito [src:codigo]
  const tagMatch = texto.match(/\[src:([a-z0-9_-]+)\]/i);
  if (tagMatch) {
    const codigo = tagMatch[1].toLowerCase();
    const textoLimpio = texto.replace(tagMatch[0], "").trim();
    return { canal: mapearCodigoACanal(codigo), codigo, textoLimpio };
  }

  // 2) Best-effort por keywords en texto natural
  const lower = texto.toLowerCase();
  if (/\binstagram\b|\big\b/.test(lower)) return { canal: "Instagram", codigo: "instagram", textoLimpio: texto };
  if (/\bfacebook\b|\bfb\b/.test(lower)) return { canal: "Facebook", codigo: "facebook", textoLimpio: texto };
  if (/\btiktok\b|\btt\b/.test(lower)) return { canal: "TikTok", codigo: "tiktok", textoLimpio: texto };
  if (/sitio web|p[áa]gina web|tu web/.test(lower)) return { canal: "Web", codigo: "web", textoLimpio: texto };
  if (/anuncio|publicidad|ads?\b/.test(lower)) return { canal: "Meta", codigo: "anuncio", textoLimpio: texto };
  if (/tarjeta de presentaci[óo]n|business card/.test(lower)) return { canal: "Tarjeta", codigo: "tarjeta", textoLimpio: texto };
  if (/recomendaci[óo]n|me recomend/.test(lower)) return { canal: "Recurrente", codigo: "referido", textoLimpio: texto };

  return { canal: null, codigo: null, textoLimpio: texto };
}

function mapearCodigoACanal(codigo: string): string {
  // Cualquier código que empiece con "ad_" o "meta_" → Meta (los anuncios
  // de campañas custom de Mar caen aquí, ej. ad_dia_madres_2026)
  if (codigo.startsWith("ad_") || codigo.startsWith("meta_") || codigo === "anuncio")
    return "Meta";
  if (codigo.startsWith("ig") || codigo.includes("instagram")) return "Instagram";
  if (codigo.startsWith("fb") || codigo.includes("facebook")) return "Facebook";
  if (codigo.startsWith("tt") || codigo.includes("tiktok")) return "TikTok";
  if (codigo.startsWith("web") || codigo.includes("sitio")) return "Web";
  if (codigo.includes("tarjeta") || codigo.includes("card")) return "Tarjeta";
  if (codigo.includes("grupo") || codigo.includes("wsp_group")) return "Grupo";
  if (codigo.includes("recomend") || codigo.includes("referi")) return "Recurrente";
  return "Orgánico";
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

  // Detección de origen leyendo el mensaje del cliente. Si el link de
  // WhatsApp generado por Mar incluye [src:codigo] al final del texto
  // pre-llenado, lo detectamos y limpiamos. Si no, mejor-esfuerzo por
  // keywords ("instagram", "anuncio", etc.).
  const origenDetectado = detectarOrigenDelMensaje(lastInput);
  const userTextLimpio = origenDetectado.textoLimpio || lastInput;

  // Prioridad para canal_origen:
  //   1. canal_origen explícito del body (si vino del proveedor)
  //   2. el detectado en el mensaje
  //   3. default meta_ctwa
  const canalOrigen =
    clean(body.canal_origen as string) || origenDetectado.canal || "meta_ctwa";

  return {
    channel: "manychat",
    sessionId,
    userText: userTextLimpio,
    whatsappPhone,
    email: clean(body.email as string),
    nombre: extraerNombre(body),
    timezone: clean(body.timezone as string) || "America/Mexico_City",
    tipoMensajeOriginal,
    canalOrigen,
    anuncioId: clean(body.anuncio_id as string) ?? attribution.ad_id ?? origenDetectado.codigo,
    subscriberId,
    attribution,
  };
}
