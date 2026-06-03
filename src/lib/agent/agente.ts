// Agente Madre Sirena (Opus 4.6 fast) — CLAUDE.md §10 paso 15.
// El Verificador ya decidió qué tool ejecutar; el Agente solo genera el
// texto de la respuesta natural a la clienta siguiendo el tono.

import { chat, isDemoMode, MODELS } from "./openrouter";
import {
  buildSirenaSystemPrompt,
  buildAgenteUserMessage,
  SIRENA_REDES_DEFAULT,
} from "./prompts/agente_sirena";
import type { VerificadorOutput } from "./verificador";
import { getSecret } from "@/lib/secrets";

async function resolveRedes() {
  const [instagram, facebook, tiktok] = await Promise.all([
    getSecret("redes_instagram_url"),
    getSecret("redes_facebook_url"),
    getSecret("redes_tiktok_url"),
  ]);
  return {
    instagram: instagram || SIRENA_REDES_DEFAULT.instagram,
    facebook: facebook || SIRENA_REDES_DEFAULT.facebook,
    tiktok: tiktok || SIRENA_REDES_DEFAULT.tiktok,
  };
}

export type AgenteOutput = {
  texto: string;
  _demo?: boolean;
};

export async function runAgenteMadre(input: {
  verificador: VerificadorOutput;
  mensajeActual: string;
  contextoLead: Record<string, unknown>;
  metadata: Record<string, unknown>;
  yaPagoDeposito: boolean;
}): Promise<AgenteOutput> {
  const redes = await resolveRedes();

  if (isDemoMode()) {
    return {
      texto: demoAgenteText({
        verificador: input.verificador,
        mensajeActual: input.mensajeActual,
        contextoLead: input.contextoLead,
        redes,
      }),
      _demo: true,
    };
  }

  const userMsg = buildAgenteUserMessage({
    verificador: input.verificador as unknown as Record<string, unknown>,
    mensajeActual: input.mensajeActual,
    contextoLead: input.contextoLead,
    metadata: input.metadata,
    yaPagoDeposito: input.yaPagoDeposito,
  });

  const resp = await chat({
    model: MODELS.agente,
    messages: [
      { role: "system", content: buildSirenaSystemPrompt(redes) },
      { role: "user", content: userMsg },
    ],
    temperature: 0.4,
    maxTokens: 1024,
  });

  const texto = resp.choices[0]?.message?.content ?? "";
  return { texto };
}

function demoAgenteText(input: {
  verificador: VerificadorOutput;
  mensajeActual: string;
  contextoLead: Record<string, unknown>;
  redes: typeof SIRENA_REDES_DEFAULT;
}): string {
  const tool = input.verificador.accion_recomendada.tool_principal;
  const estado = input.contextoLead.estado_actual as Record<string, unknown> | undefined;
  const yaEnHandoff =
    !!estado && (estado.rama_activa === "handoff" || estado.requiere_handoff === true);
  const asesora =
    ((input.contextoLead.lead as Record<string, unknown> | undefined)
      ?.asesora_asignada as string) || "tu asesora";

  // Si ya hay handoff activo, NO repetir el "te paso con X" ni disparar
  // tools. Acompañar mientras espera.
  if (yaEnHandoff) {
    const m = input.mensajeActual.toLowerCase().trim();
    if (/^(hola|holaa|buenas|buenos|ey|hey)/.test(m)) {
      return `¡Hola linda! ${asesora} ya viene en un momentito 💗 ¿Te ayudo con algo mientras?`;
    }
    if (/cuanto|cuánto|tardas|tarda|espera|esperar/.test(m)) {
      return `Ya casi llega ${asesora}, querida 💕 No tarda, te lo prometo.`;
    }
    return `Para esa info te ayuda mejor ${asesora} cuando llegue 💗 ya viene en camino ✨`;
  }

  const mLower = input.mensajeActual.toLowerCase();

  // Si la clienta preguntó por envíos pero falta origen, pregúntale
  const preguntaEnvios = /env[íi]o|envios|env[ií]a|mandan|mandas/.test(mLower);
  if (preguntaEnvios && tool === "responder_texto_simple") {
    return `¡Claro que sí, linda! 💗 Cuéntame, ¿de dónde nos escribes? Para darte la info exacta del envío ✨`;
  }

  // Si la clienta preguntó por referencias / redes sociales → texto con links
  const preguntaRedes =
    /referencia|rese[nñ]a|redes( sociales)?|\binsta(gram)?\b|\bface(book)?\b|tiktok|\big\b|\bfb\b|han comprado|gente.*compr|m[aá]s piezas|d[oó]nde ver|p[aá]gina/.test(
      mLower,
    );
  if (preguntaRedes && tool === "responder_texto_simple") {
    return `¡Claro linda! Échale ojo a nuestras redes, ahí ves muchas piezas y clientas felices 💗✨

Instagram: ${input.redes.instagram}
Facebook: ${input.redes.facebook}
TikTok: ${input.redes.tiktok}

Cuéntame qué te gustó cuando te des una vuelta 💕`;
  }

  switch (tool) {
    case "enviar_catalogo": {
      const c =
        (input.verificador.accion_recomendada.parametros.coleccion as string) ??
        "pandora";
      return `¡Qué padre que te interesa la línea ${c}, linda! ✨ Te paso el catálogo completo. Échale ojo y me dices si algo te llama 💗`;
    }
    case "enviar_imagen_faq": {
      const idImg = Number(
        input.verificador.accion_recomendada.parametros.id_imagen ?? 0,
      );
      if (idImg === 15)
        return `¡Va! Te paso las formas de pago, linda 💗 Échale ojo y me dices cuál te late`;
      if (idImg === 16)
        return `¡Claro linda! Aquí va la info de pagos con tarjeta 💗`;
      if (idImg === 17)
        return `¡Perfecto, linda! 🌊 Aquí te paso la info de envíos a México 💗`;
      if (idImg === 18)
        return `¡Va! 💕 Te paso la info de envíos internacionales ✨`;
      return `Te paso la info que necesitas, linda 💗 ¿Te quedó claro o tienes otra dudita?`;
    }
    case "invitar_grupo":
      return `¡Qué padre que te animes! 💗 Aquí va el link del grupo de mayoreo. Cuando lo abras manda tu solicitud y Mar la acepta en cuanto la vea ✨`;
    case "handoff_asesora":
      return `Te paso con una asesora ahora mismo — ella te atiende en breve 💎`;
    case "responder_texto_simple":
    default:
      return `Cuéntame un poquito más, linda 💗 ¿Qué buscas exactamente? Así te ayudo mejor.`;
  }
}
