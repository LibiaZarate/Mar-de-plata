// Agente Madre Sirena (Opus 4.6 fast) — CLAUDE.md §10 paso 15.
// El Verificador ya decidió qué tool ejecutar; el Agente solo genera el
// texto de la respuesta natural a la clienta siguiendo el tono.

import { chat, isDemoMode, MODELS } from "./openrouter";
import {
  SIRENA_SYSTEM_PROMPT,
  buildAgenteUserMessage,
} from "./prompts/agente_sirena";
import type { VerificadorOutput } from "./verificador";

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
  if (isDemoMode()) {
    return { texto: demoAgenteText(input), _demo: true };
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
      { role: "system", content: SIRENA_SYSTEM_PROMPT },
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
}): string {
  const tool = input.verificador.accion_recomendada.tool_principal;
  switch (tool) {
    case "enviar_catalogo": {
      const c =
        (input.verificador.accion_recomendada.parametros.coleccion as string) ??
        "pandora";
      return `¡Qué padre que te interesa la línea ${c}, linda! ✨ Te paso el catálogo completo. Échale ojo y me dices si algo te llama 💗`;
    }
    case "enviar_imagen_faq":
      return `Te paso la info que necesitas, linda 💗 ¿Te quedó claro o tienes otra dudita?`;
    case "invitar_grupo":
      return `¡Qué padre que te animes! 💗 Aquí va el link del grupo de mayoreo. Cuando lo abras manda tu solicitud y Mar la acepta en cuanto la vea ✨`;
    case "handoff_asesora":
      return `Te paso con una asesora ahora mismo — ella te atiende en breve 💎`;
    case "responder_texto_simple":
    default:
      return `Cuéntame un poquito más, linda 💗 ¿Qué buscas exactamente? Así te ayudo mejor.`;
  }
}
