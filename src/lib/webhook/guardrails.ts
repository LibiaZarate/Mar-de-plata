// Guardrails de capa 1 · keywords críticas [OFICIAL]
// Ver CLAUDE.md §10 paso 6 y §12.
//
// Si una de estas keywords aparece en el userText (case-insensitive,
// substring), el flujo madre debe SALIR temprano hacia el sub-workflow
// handoff_directo_guardrail. NO se llama al Verificador ni al Agente.

export type GuardrailCategory = "humano" | "reclamo";

type GuardrailKeyword = {
  keyword: string;
  category: GuardrailCategory;
  // Razón humana — viaja al campo `motivo` del INSERT en `alertas`.
  motivo: string;
};

export const GUARDRAIL_KEYWORDS: readonly GuardrailKeyword[] = [
  // La clienta pide humano explícitamente.
  { keyword: "asesora",      category: "humano",  motivo: "solicita_asesora_humana" },
  { keyword: "humano",       category: "humano",  motivo: "solicita_humano" },
  { keyword: "persona real", category: "humano",  motivo: "solicita_persona_real" },
  // La clienta amenaza con denuncia / acusa fraude.
  { keyword: "profeco",      category: "reclamo", motivo: "menciona_profeco" },
  { keyword: "fraude",       category: "reclamo", motivo: "acusa_fraude" },
  { keyword: "denunciar",    category: "reclamo", motivo: "amenaza_denuncia" },
] as const;

export type GuardrailMatch = {
  keyword: string;
  category: GuardrailCategory;
  motivo: string;
  matchedAt: number;
};

export function checkGuardrails(text: string): GuardrailMatch | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Si hay AL MENOS un match de categoría 'reclamo', siempre gana (la
  // alerta más grave dispara el tipo correcto en la tabla `alertas`,
  // independientemente del orden en el mensaje). Dentro de la misma
  // categoría, ganan los matches más tempranos.
  let bestReclamo: GuardrailMatch | null = null;
  let bestHumano: GuardrailMatch | null = null;
  for (const k of GUARDRAIL_KEYWORDS) {
    const idx = lower.indexOf(k.keyword);
    if (idx === -1) continue;
    const candidate: GuardrailMatch = {
      keyword: k.keyword,
      category: k.category,
      motivo: k.motivo,
      matchedAt: idx,
    };
    if (k.category === "reclamo") {
      if (!bestReclamo || idx < bestReclamo.matchedAt) bestReclamo = candidate;
    } else {
      if (!bestHumano || idx < bestHumano.matchedAt) bestHumano = candidate;
    }
  }
  return bestReclamo ?? bestHumano;
}
