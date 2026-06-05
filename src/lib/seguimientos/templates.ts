// Plantillas de seguimientos.
//
// Variables soportadas (todas opcionales — si no hay valor, se usa el
// fallback razonable):
//   {nombre}            → nombre del lead, default "linda"
//   {ciudad}            → ciudad si la tenemos
//   {catalogo_visto}    → "pandora" | "taxco" | "tows"
//   {ultima_faq}        → "envíos", "material", etc. (humanizado)
//   {rama}              → R1..R5
//   {etapa}             → "Lead nueva", "Calificada", ...
//   {compras_totales}   → número
//   {canal}             → "Meta CTWA", "Instagram", ...
//   {dias_desde_compra} → entero
//   {horas_inactiva}    → entero
//   {contexto_libre}    → texto libre que el agente o asesora dejó
//
// Bloques condicionales (no anidados):
//   {si:recurrente}…{/si}   → solo si compras_totales > 0
//   {si:nuevo}…{/si}        → solo si compras_totales === 0
//   {si:vio_catalogo}…{/si} → solo si catalogo_visto != null
//   {si:deposito}…{/si}     → solo si deposito_dado
//   {si:objecion}…{/si}     → solo si objecion_detectada != null
//
// Mar y Libi pueden editar el texto en /configuracion/seguimientos.

import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapshotSeguimiento } from "./snapshot";
import { ultimaFaqHumana } from "./snapshot";

export type TipoSeguimiento =
  | "lead_frio_24h"
  | "post_compra_7d"
  | "deposito_pendiente_24h"
  | "reactivacion_30d"
  | "prueba_simulador";

export const SEGUIMIENTOS_DEFAULT: Record<
  TipoSeguimiento,
  { texto: string; descripcion: string; offset_dias: number }
> = {
  lead_frio_24h: {
    texto:
      "¡Hola {nombre}! 💗 {si:vio_catalogo}¿Pudiste ver el catálogo de {catalogo_visto}? Quedó pendiente lo de {ultima_faq} ✨{/si}{si:nuevo}Te paso de vuelta por aquí 💗 ¿Sigues interesada o tienes alguna duda?{/si}{si:recurrente}¿Sigues por aquí, linda? Sé que ya conoces nuestras piezas — ¿te dejo el catálogo nuevo?{/si}",
    descripcion: "Lead recibió catálogo y no respondió en 24h",
    offset_dias: 1,
  },
  post_compra_7d: {
    texto:
      "¡Hola {nombre}! 💕 Pasaron unos días desde tu pedido — ¿cómo te fueron tus piezas? Nos encantaría ver una foto si gustas etiquetarnos 💗{si:recurrente} Mil gracias por confiar otra vez 💎{/si}",
    descripcion: "Cliente compró, 7 días después",
    offset_dias: 7,
  },
  deposito_pendiente_24h: {
    texto:
      "¡Hola {nombre}! 💗 ¿Pudiste hacer el depósito de las piezas que apartamos? Aviso para no soltarlas a alguien más ✨{si:objecion} Si tienes alguna duda dime y la resolvemos 💗{/si}",
    descripcion: "Pidió apartar pero no mandó depósito en 24h",
    offset_dias: 1,
  },
  reactivacion_30d: {
    texto:
      "¡Hola {nombre}! 💎 {si:recurrente}Hace tiempo no nos vemos 💗 Tenemos piezas nuevas que te encantarían — ¿quieres que te pase el catálogo de novedades?{/si}{si:nuevo}Te recordamos que aún tenemos piezas hermosas esperándote 💗 ¿Te paso el catálogo de novedades?{/si}",
    descripcion: "Cliente sin contacto en 30 días",
    offset_dias: 30,
  },
  prueba_simulador: {
    texto: "🧪 Seguimiento de prueba para {nombre} — si ves esto, la cola funciona ✅",
    descripcion: "Disparo manual desde el playground para validar el cron",
    offset_dias: 0,
  },
};

export async function resolverPlantilla(tipo: string): Promise<string> {
  const t = tipo as TipoSeguimiento;
  const def = SEGUIMIENTOS_DEFAULT[t]?.texto ?? `Seguimiento (${tipo})`;
  const sb = createAdminClient();
  const { data } = await sb
    .from("config_sistema")
    .select("valor")
    .eq("clave", `seguimiento_${tipo}_template`)
    .maybeSingle();
  const v = ((data?.valor as string | null) ?? "").trim();
  return v || def;
}

// Reemplazos legacy (cuando no hay snapshot completo). Mantiene
// compatibilidad con plantillas viejas que solo usen {nombre}.
export function renderPlantilla(
  texto: string,
  vars: { nombre?: string | null; min_restantes?: number | null },
): string {
  let out = texto;
  const nombre = (vars.nombre ?? "").trim() || "linda";
  out = out.replace(/\{nombre\}/g, nombre);
  out = out.replace(/\{min_restantes\}/g, String(vars.min_restantes ?? "?"));
  // Sin snapshot, los bloques condicionales se eliminan y vars se vacían
  out = limpiarBloquesCondicionales(out, {});
  out = limpiarVariablesSinValor(out);
  return out;
}

const CANAL_LABEL: Record<string, string> = {
  meta_ctwa: "Meta CTWA",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp_directo: "WhatsApp directo",
  grupo: "Grupo abierto",
  referido: "Referido",
};

const ETAPA_LABEL: Record<string, string> = {
  lead_nueva: "Lead nueva",
  calificada: "Calificada",
  esperando_pago: "Esperando pago",
  pagada: "Pagada",
  perdida: "Perdida",
};

// Render con snapshot completo — el camino "rico".
export function renderConSnapshot(
  texto: string,
  snap: SnapshotSeguimiento,
): string {
  const banderas = {
    recurrente: snap.es_recurrente,
    nuevo: !snap.es_recurrente,
    vio_catalogo: !!snap.catalogo_visto,
    deposito: snap.deposito_dado,
    objecion: !!snap.objecion_detectada,
    handoff: snap.requiere_handoff,
  };

  let out = limpiarBloquesCondicionales(texto, banderas);

  const ultimaFaq = ultimaFaqHumana(snap.faqs_respondidas);
  const diasCompra = snap.fecha_ultima_compra
    ? Math.round(
        (Date.now() - new Date(snap.fecha_ultima_compra).getTime()) / 86_400_000,
      )
    : null;

  const sustituciones: Record<string, string | number | null> = {
    nombre: (snap.nombre ?? "").trim() || "linda",
    ciudad: snap.ciudad,
    catalogo_visto: snap.catalogo_visto,
    ultima_faq: ultimaFaq,
    rama: snap.rama_activa,
    etapa: snap.estado ? ETAPA_LABEL[snap.estado] ?? snap.estado : null,
    compras_totales: snap.compras_totales,
    canal: snap.canal_origen ? CANAL_LABEL[snap.canal_origen] ?? snap.canal_origen : null,
    dias_desde_compra: diasCompra,
    horas_inactiva: snap.horas_desde_ultima_interaccion,
    contexto_libre: snap.contexto_libre,
  };

  for (const [k, v] of Object.entries(sustituciones)) {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, v == null || v === "" ? "" : String(v));
  }

  out = limpiarVariablesSinValor(out);
  // Limpieza estética: doble espacio, espacios antes de signos
  out = out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,!?¡¿])/g, "$1").trim();
  return out;
}

// Procesa los {si:flag}…{/si}. No soporta anidación intencionalmente.
function limpiarBloquesCondicionales(
  texto: string,
  banderas: Record<string, boolean>,
): string {
  const re = /\{si:([a-z_]+)\}([\s\S]*?)\{\/si\}/g;
  return texto.replace(re, (_full, flag: string, contenido: string) => {
    return banderas[flag] ? contenido : "";
  });
}

// Si una variable no se reemplazó (no estaba en el snapshot), quitarla
// para que la clienta no vea "{ciudad}".
function limpiarVariablesSinValor(texto: string): string {
  return texto.replace(/\{[a-z_]+\}/g, "");
}
