// Extracción ligera de señales conversacionales — sin LLM.
// Mientras armamos el extractor con Haiku, aquí cubrimos las señales
// más obvias por regex sobre el texto del cliente. Es barato, rápido,
// y suficiente para banderas tipo "es revendedora".

import type { SupabaseClient } from "@supabase/supabase-js";

// Vocabulario de revendedora: frases que muestran que la persona
// no está comprando para sí misma sino para revender.
const REGEX_REVENDEDORA = [
  /\bpara\s+revend(er|edora|edor)\b/i,
  /\bpara\s+mi\s+tiend(a|ita)\b/i,
  /\bpara\s+mi\s+negoc(io|ito)\b/i,
  /\bmis\s+client(es|as)\b/i,
  /\bsurtid[oa]\b/i,
  /\bvolumen\b/i,
  /\brotaci[oó]n\b/i,
  /\brevend[eo]\b/i,
  /\bcat[aá]logo\s+(de\s+)?mayoreo\b/i,
  /\bquiero\s+(comprar|llevar)\s+(para|de)\s+vender\b/i,
  /\bya\s+les\s+vendo\b/i,
  /\bsoy\s+(distribuidora|vendedora)\b/i,
];

export function detectarSenalRevendedora(textoCliente: string): boolean {
  if (!textoCliente) return false;
  for (const r of REGEX_REVENDEDORA) {
    if (r.test(textoCliente)) return true;
  }
  return false;
}

// Si detectamos por primera vez la señal, marcamos el lead. Idempotente:
// no la desmarca y no actualiza la fecha si ya estaba marcada.
export async function persistirRevendedoraSiAplica(
  sb: SupabaseClient,
  numero_whatsapp: string,
  textoCliente: string,
): Promise<boolean> {
  if (!detectarSenalRevendedora(textoCliente)) return false;
  const { data: lead } = await sb
    .from("leads")
    .select("es_revendedora")
    .eq("numero_whatsapp", numero_whatsapp)
    .maybeSingle();
  if (lead?.es_revendedora) return false; // ya estaba
  await sb
    .from("leads")
    .update({
      es_revendedora: true,
      detectada_revendedora_en: new Date().toISOString(),
    })
    .eq("numero_whatsapp", numero_whatsapp);
  return true;
}

// Mapeo de tool ejecutada → etiqueta humana de "ultimo_envio"
export function ultimoEnvioParaTool(tool: string | null | undefined): string | null {
  if (!tool) return null;
  switch (tool) {
    case "enviar_catalogo":
      return "catalogo";
    case "invitar_grupo":
      return "grupos";
    case "enviar_sitio_menudeo":
      return "menudeo";
    case "agendar_visita_taxco":
      return "visita";
    case "enviar_imagen_faq":
      return "faq";
    case "handoff_asesora":
      return "handoff";
    case "programar_seguimiento":
      return "seguimiento_programado";
    case "responder_texto_simple":
    case "texto_simple":
      return "texto_simple";
    default:
      return tool;
  }
}
