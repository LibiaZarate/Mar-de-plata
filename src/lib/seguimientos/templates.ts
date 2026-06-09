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
  | "lead_frio_3d"
  | "lead_frio_6d"
  | "lead_frio_10d"
  | "post_compra_7d"
  | "post_compra_30d"
  | "deposito_pendiente_24h"
  | "deposito_pendiente_48h"
  | "reactivacion_30d"
  | "reactivacion_60d"
  | "restock_revendedora"
  | "disponibilidad_aviso"
  | "prueba_simulador";

export const SEGUIMIENTOS_DEFAULT: Record<
  TipoSeguimiento,
  { texto: string; descripcion: string; offset_dias: number }
> = {
  lead_frio_24h: {
    texto:
      "{nombre}, ¿pudiste ver el catálogo? {si:vio_catalogo}Quedó pendiente lo de {ultima_faq} — aquí ando por si tienes duda ✨{/si}{si:mayoreo} El mínimo de mayoreo es $1,500 y lo podemos armar surtido 💗{/si}",
    descripcion: "Paso 1 · +24h · pregunta + detalle",
    offset_dias: 1,
  },
  lead_frio_3d: {
    texto:
      "{nombre} 🌙 Te paso por aquí porque acaban de entrar piezas nuevas {si:vio_catalogo}de lo que ya viste{/si}. Sin compromiso, solo por si te lates a una. 💗",
    descripcion: "Paso 2 · +3d · valor puro, sin pedir nada",
    offset_dias: 3,
  },
  lead_frio_6d: {
    texto:
      "{nombre}, te quiero preguntar directo: ¿sigue interesándote? {si:objecion}Si fue por lo de {ultima_objecion} dime y vemos qué se puede hacer ✨{/si}{si:nuevo} Y si no era el momento, lo entiendo, no me ofendo 💗{/si}",
    descripcion: "Paso 3 · +6d · pregunta directa, cambio de ángulo",
    offset_dias: 6,
  },
  lead_frio_10d: {
    texto:
      "{nombre} 💗 Cierro tu apartado por aquí para no estar molestando. Cuando se te antoje algo, aquí ando — solo escríbeme y retomamos 🌙",
    descripcion: "Paso 4 · +10d · break-up amable",
    offset_dias: 10,
  },
  post_compra_7d: {
    texto:
      "{nombre} 💕 ¿Cómo te llegó tu pedido? Si te gustó y la quieres presumir, etiquétanos. {si:recurrente}Mil gracias por confiar otra vez 💎{/si}",
    descripcion: "Paso 1 · +7d · feedback + invitación a etiquetar",
    offset_dias: 7,
  },
  post_compra_30d: {
    texto:
      "{nombre}, ya pasó un mes 🌙 Acaban de entrar piezas nuevas de {ciudad} y pensé en ti. ¿Te muestro lo nuevo, sin compromiso?",
    descripcion: "Paso 2 · +30d · vuelve la conversación",
    offset_dias: 30,
  },
  deposito_pendiente_24h: {
    texto:
      "{nombre}, te tengo tu apartado ✨ Lo suelto mañana si no alcanzas a mandar el depósito de $300. No quiero que se te vaya — ¿te ayudo a apartarla bien?",
    descripcion: "Paso 1 · +24h · urgencia suave",
    offset_dias: 1,
  },
  deposito_pendiente_48h: {
    texto:
      "{nombre} 💗 Último aviso por aquí: si no me llega el depósito hoy, suelto tu pieza para alguien más. ¿La quieres apartar todavía?",
    descripcion: "Paso 2 · +48h · último aviso antes de soltar",
    offset_dias: 2,
  },
  reactivacion_30d: {
    texto:
      "{nombre}, hace tiempo no platicamos 🌙 Entraron piezas nuevas{si:vio_catalogo} de la línea que te gustó{/si} y varias clientas{si:ciudad} de {ciudad}{/si} ya pidieron. ¿Te muestro lo nuevo? Sin compromiso.",
    descripcion: "Reactivación · novedades con prueba social local",
    offset_dias: 30,
  },
  reactivacion_60d: {
    texto:
      "{nombre} 💎 Estamos en temporada — y de las piezas que viste{si:vio_catalogo}, varias salieron rapidísimo{/si}. ¿Te interesa que te ponga al día?",
    descripcion: "Paso 2 · +60d · ángulo temporada",
    offset_dias: 60,
  },
  restock_revendedora: {
    texto:
      "{nombre} 🌙 Por estas fechas normalmente resurtes. Acaba de entrar producto y pensé en ti porque es de lo que más te sale. ¿Te armo una lista surtida para que la veas?",
    descripcion: "Restock revendedora · su cadencia",
    offset_dias: 21,
  },
  disponibilidad_aviso: {
    texto:
      "{nombre}, ¿te acuerdas que te gustó {contexto_libre}? Hoy entró de nuevo a disponibilidad 🌙 Te avisé a ti primero porque sé que la andabas buscando. ¿Te la aparto antes de que se vuelva a ir?",
    descripcion: "Aviso · pieza agotada que regresa",
    offset_dias: 0,
  },
  prueba_simulador: {
    texto: "🧪 Seguimiento de prueba para {nombre} — si ves esto, la cola funciona ✅",
    descripcion: "Disparo manual desde el playground",
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
    mayoreo: snap.tipo === "mayoreo",
    menudeo: snap.tipo === "menudeo",
    ciudad: !!snap.ciudad,
    revendedora: snap.es_revendedora,
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
    ultima_objecion: snap.objecion_detectada,
    rama: snap.rama_activa,
    etapa: snap.estado ? ETAPA_LABEL[snap.estado] ?? snap.estado : null,
    compras_totales: snap.compras_totales,
    canal: snap.canal_origen ? CANAL_LABEL[snap.canal_origen] ?? snap.canal_origen : null,
    dias_desde_compra: diasCompra,
    horas_inactiva: snap.horas_desde_ultima_interaccion,
    dias: snap.horas_desde_ultima_interaccion
      ? Math.max(1, Math.round(snap.horas_desde_ultima_interaccion / 24))
      : null,
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
