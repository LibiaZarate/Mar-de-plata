// Modo de operación del runtime de Sirena.
// "production" = envía mensajes reales a ManyChat (WhatsApp)
// "simulator"  = ejecuta todo el flujo (Supabase, OpenRouter, tools,
//                alertas, eventos) PERO no envía ningún mensaje a
//                WhatsApp. Los mensajes que se enviarían se capturan
//                y se devuelven para inspección.

export type FlowMode = "production" | "simulator";

/**
 * Modo por default cuando el webhook recibe un POST de ManyChat.
 * Por seguridad: solo es "production" si MODO_PRODUCCION="true" está
 * setado explícitamente en env vars. Cualquier otro valor = simulator.
 */
export function defaultMode(): FlowMode {
  return process.env.MODO_PRODUCCION === "true" ? "production" : "simulator";
}

export function isProduction(): boolean {
  return defaultMode() === "production";
}
