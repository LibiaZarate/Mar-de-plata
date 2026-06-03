// Verificador (Haiku 4.5) — CLAUDE.md §10 paso 12 + §13.b.
// Fallback determinístico cuando OpenRouter no está configurado.

import { chat, isDemoMode, MODELS } from "./openrouter";
import { buildVerificadorPrompt } from "./prompts/verificador";

export type VerificadorOutput = {
  intencion_primaria: string;
  confianza: number;
  rama_sugerida: string;
  contexto_clave: {
    es_continuacion: boolean;
    ya_se_respondio_esto: boolean;
    senal_compra: "alta" | "media" | "baja" | "nula";
    senal_enfriamiento: "alta" | "media" | "baja" | "nula";
    objecion_detectada: string | null;
    menciona_live: boolean;
  };
  accion_recomendada: {
    tool_principal: string;
    parametros: Record<string, unknown>;
    seguimiento_post: string;
  };
  instrucciones_tono: {
    registro: string;
    incluir_nombre: boolean;
    longitud_maxima_palabras: number;
    mencionar_live_activo: boolean;
  };
  eventos_detectados: Array<{ tipo: string; detalle: string }>;
  alertas: { requiere_handoff: boolean; requiere_escalacion_mar: boolean };
  razonamiento_breve: string;
  _demo?: boolean;
};

const FALLBACK: VerificadorOutput = {
  intencion_primaria: "ambiguo",
  confianza: 0,
  rama_sugerida: "NULL",
  contexto_clave: {
    es_continuacion: false,
    ya_se_respondio_esto: false,
    senal_compra: "nula",
    senal_enfriamiento: "nula",
    objecion_detectada: null,
    menciona_live: false,
  },
  accion_recomendada: {
    tool_principal: "responder_texto_simple",
    parametros: {},
    seguimiento_post: "ninguno",
  },
  instrucciones_tono: {
    registro: "natural_breve",
    incluir_nombre: false,
    longitud_maxima_palabras: 40,
    mencionar_live_activo: false,
  },
  eventos_detectados: [],
  alertas: { requiere_handoff: false, requiere_escalacion_mar: false },
  razonamiento_breve: "Error parseo JSON — fallback default",
};

export async function runVerificador(input: {
  contextoLead: unknown;
  mensajeActual: string;
  metadata: unknown;
}): Promise<VerificadorOutput> {
  if (isDemoMode()) {
    return demoVerificador(input.mensajeActual, input.contextoLead, input.metadata);
  }

  const prompt = buildVerificadorPrompt(input);
  const resp = await chat({
    model: MODELS.verificador,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    maxTokens: 800,
    responseFormat: "json_object",
  });
  const raw = resp.choices[0]?.message?.content ?? "";
  return parseVerificador(raw);
}

export function parseVerificador(raw: string): VerificadorOutput {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<VerificadorOutput>;
    return { ...FALLBACK, ...parsed } as VerificadorOutput;
  } catch (e) {
    return {
      ...FALLBACK,
      razonamiento_breve: `Error parseo JSON: ${(e as Error).message}`,
    };
  }
}

// Modo demo: clasificación determinística por palabras clave para que la
// UI funcione sin OpenRouter. Cubre los escenarios principales.
function demoVerificador(
  mensaje: string,
  contextoLead?: unknown,
  metadata?: unknown,
): VerificadorOutput {
  const m = mensaje.toLowerCase();
  const live = (metadata as { live?: Record<string, unknown> } | undefined)?.live;
  const hayLiveAhora = !!live?.hay_live_ahora;

  // Helper que aplica mencionar_live_activo si hay live ahora,
  // salvo en casos donde distraería (reclamos, handoffs).
  const withLive = (
    out: VerificadorOutput,
    excluir = false,
  ): VerificadorOutput => {
    if (!hayLiveAhora || excluir) return out;
    return {
      ...out,
      contexto_clave: { ...out.contexto_clave, menciona_live: true },
      instrucciones_tono: { ...out.instrucciones_tono, mencionar_live_activo: true },
    };
  };

  // Si el lead ya está en handoff, no sugerir handoff otra vez ni
  // disparar tools de contenido — acompañar con texto natural.
  const estado = (contextoLead as { estado_actual?: Record<string, unknown> } | undefined)
    ?.estado_actual;
  const yaEnHandoff =
    !!estado && (estado.rama_activa === "handoff" || estado.requiere_handoff === true);
  if (yaEnHandoff) {
    // En handoff: NO mencionar live, no distraer del contexto.
    return {
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "conversacional_sin_accion",
      confianza: 0.85,
      rama_sugerida: "HANDOFF",
      contexto_clave: { ...FALLBACK.contexto_clave, es_continuacion: true },
      accion_recomendada: {
        tool_principal: "responder_texto_simple",
        parametros: {},
        seguimiento_post: "ninguno",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "natural_breve",
        longitud_maxima_palabras: 25,
      },
      razonamiento_breve:
        "[demo] Lead ya en handoff — acompañar con texto natural sin nuevas tools",
    };
  }

  if (/pandora/.test(m)) {
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "comprar_mayoreo_catalogo",
      confianza: 0.9,
      rama_sugerida: "R1",
      contexto_clave: {
        ...FALLBACK.contexto_clave,
        senal_compra: "alta",
      },
      accion_recomendada: {
        tool_principal: "enviar_catalogo",
        parametros: {
          coleccion: "pandora",
          texto_acompanante: "¡Qué padre que te interesa Pandora! Te paso el catálogo ✨",
        },
        seguimiento_post: "preguntar_listo_pedido",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
        longitud_maxima_palabras: 40,
      },
      razonamiento_breve: "[demo] Detección por keyword 'pandora'",
    });
  }

  // Tarjeta de crédito específicamente → FAQ #16 (NO mencionar live: muy específico)
  if (/tarjeta|\bvisa\b|mastercard|\bamex\b|american express/.test(m)) {
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "consultar_faq",
      confianza: 0.9,
      rama_sugerida: "R1",
      accion_recomendada: {
        tool_principal: "enviar_imagen_faq",
        parametros: {
          id_imagen: 16,
          texto_acompanante: "¡Claro linda! Aquí va la info de pagos con tarjeta 💗",
        },
        seguimiento_post: "preguntar_si_resolvio",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
      },
      razonamiento_breve: "[demo] Pregunta por tarjeta → FAQ #16",
    }, true);
  }

  // Formas de pago genéricas (sin mencionar tarjeta) → FAQ #15 (NO live)
  if (/(forma|m[eé]todo|manera).*pag|c[oó]mo (puedo )?pag|d[oó]nde pago|pagos|abonar/.test(m)) {
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "consultar_faq",
      confianza: 0.85,
      rama_sugerida: "R1",
      accion_recomendada: {
        tool_principal: "enviar_imagen_faq",
        parametros: {
          id_imagen: 15,
          texto_acompanante: "¡Va! Te paso las formas de pago, linda 💗",
        },
        seguimiento_post: "preguntar_si_resolvio",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
      },
      razonamiento_breve: "[demo] Pregunta formas de pago genéricas → FAQ #15",
    }, true);
  }

  // Referencias / redes sociales → texto con los 3 links
  if (
    /referencia|rese[nñ]a|redes( sociales)?|\binsta(gram)?\b|\bface(book)?\b|tiktok|\big\b|\bfb\b|\btt\b|han comprado|gente.*compr|m[aá]s piezas|d[oó]nde ver|p[aá]gina/.test(
      m,
    )
  ) {
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "consultar_faq",
      confianza: 0.88,
      rama_sugerida: "R1",
      accion_recomendada: {
        tool_principal: "responder_texto_simple",
        parametros: {},
        seguimiento_post: "ninguno",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
        longitud_maxima_palabras: 70,
      },
      razonamiento_breve:
        "[demo] Pregunta por referencias / redes → texto con links IG/FB/TikTok",
    });
  }
  if (/env[íi]o|envios|env[ií]a|mandan|mandas/.test(m)) {
    // ¿Mencionó origen? (ciudad MX, "nacional", "internacional", país)
    const mencionaInternacional = /internacional|extranjero|usa|estados unidos|espa[nñ]a|colombia|argentina|chile|per[uú]|brasil|francia|canad[áa]|alemania|italia/.test(
      m,
    );
    const mencionaNacional = /cdmx|m[eé]xico|guadalajara|monterrey|puebla|toluca|quer[eé]taro|le[oó]n|m[eé]rida|canc[uú]n|tijuana|veracruz|oaxaca|cuernavaca|morelia|aguascalientes|chihuahua|hermosillo|saltillo|culiac[aá]n|durango|mazatl[áa]n|nacional|rep[uú]blica/.test(
      m,
    );

    // Sin origen: preguntar primero (NO live — pregunta específica)
    if (!mencionaNacional && !mencionaInternacional) {
      return withLive({
        ...FALLBACK,
        _demo: true,
        intencion_primaria: "consultar_faq",
        confianza: 0.85,
        rama_sugerida: "R1",
        accion_recomendada: {
          tool_principal: "responder_texto_simple",
          parametros: {},
          seguimiento_post: "ninguno",
        },
        instrucciones_tono: {
          ...FALLBACK.instrucciones_tono,
          registro: "calido_nueva",
          longitud_maxima_palabras: 30,
        },
        razonamiento_breve:
          "[demo] Pregunta envíos sin origen — Sirena debe preguntar de dónde es (FAQ 17 vs 18)",
      }, true);
    }

    // Con origen: mandar FAQ correspondiente
    const idImagen = mencionaInternacional ? 18 : 17;
    const texto = mencionaInternacional
      ? "¡Va! 💕 Te paso la info de envíos internacionales ✨"
      : "¡Perfecto, linda! 🌊 Aquí te paso la info de envíos a México 💗";
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "consultar_faq",
      confianza: 0.9,
      rama_sugerida: "R1",
      accion_recomendada: {
        tool_principal: "enviar_imagen_faq",
        parametros: { id_imagen: idImagen, texto_acompanante: texto },
        seguimiento_post: "preguntar_si_resolvio",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
      },
      razonamiento_breve: `[demo] Envíos con origen ${mencionaInternacional ? "internacional" : "nacional"} → FAQ #${idImagen}`,
    }, true);
  }
  if (/grupo|comunidad/.test(m)) {
    return withLive({
      ...FALLBACK,
      _demo: true,
      intencion_primaria: "comprar_mayoreo_grupo",
      confianza: 0.85,
      rama_sugerida: "R2",
      accion_recomendada: {
        tool_principal: "invitar_grupo",
        parametros: { texto_acompanante: "¡Qué padre que te animes! 💗 Aquí va el link:" },
        seguimiento_post: "conducir_grupo",
      },
      instrucciones_tono: {
        ...FALLBACK.instrucciones_tono,
        registro: "calido_nueva",
      },
      razonamiento_breve: "[demo] Detección por keyword 'grupo'",
    });
  }
  return withLive({
    ...FALLBACK,
    _demo: true,
    intencion_primaria: "conversacional_sin_accion",
    confianza: 0.7,
    razonamiento_breve: "[demo] Sin clasificación específica — respuesta abierta",
  });
}
