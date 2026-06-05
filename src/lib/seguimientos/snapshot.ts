// Snapshot del contexto conversacional para personalizar seguimientos.
// Se guarda al PROGRAMAR el seguimiento (capturando dónde quedó la
// conversación) y también se reconstruye al ENVIAR (para incorporar
// datos frescos como días desde última interacción).

import type { SupabaseClient } from "@supabase/supabase-js";

export type SnapshotSeguimiento = {
  // del lead
  nombre: string | null;
  ciudad: string | null;
  canal_origen: string | null;
  tipo: string | null;
  estado: string | null;
  compras_totales: number;
  monto_acumulado: number;
  es_recurrente: boolean;
  fecha_ultima_compra: string | null;
  // del estado conversacional
  rama_activa: string | null;
  catalogo_visto: string | null;
  faqs_respondidas: number[];
  intencion_compra_detectada: boolean;
  objecion_detectada: string | null;
  requiere_handoff: boolean;
  grupo_invitado: boolean;
  // depósito
  deposito_dado: boolean;
  deposito_validado: boolean;
  // últimos intercambios
  ultimo_mensaje_clienta: string | null;
  ultimo_mensaje_sirena: string | null;
  horas_desde_ultima_interaccion: number | null;
  // meta del programado
  programado_en: string;
  contexto_libre: string | null;
};

const FAQ_LABELS: Record<number, string> = {
  1: "material",
  2: "mínimo de compra",
  3: "originalidad",
  4: "dinámica de compra",
  5: "tiempo de fabricación",
  15: "formas de pago",
  16: "pagos con tarjeta",
  17: "envíos",
  18: "envíos",
  23: "ubicación entre semana",
  24: "ubicación sábado",
  26: "horario de live",
};

export function ultimaFaqHumana(ids: number[] | null | undefined): string | null {
  if (!ids || ids.length === 0) return null;
  const ultimo = ids[ids.length - 1];
  return FAQ_LABELS[ultimo] ?? null;
}

export async function construirSnapshot(
  sb: SupabaseClient,
  numero_whatsapp: string,
  contexto_libre: string | null = null,
): Promise<SnapshotSeguimiento> {
  const { data: lead } = await sb
    .from("leads")
    .select(
      "nombre,ciudad,canal_origen,tipo,estado,compras_totales,monto_acumulado,fecha_ultima_compra,ultima_interaccion",
    )
    .eq("numero_whatsapp", numero_whatsapp)
    .maybeSingle();

  const { data: estado } = await sb
    .from("estado_conversacion_actual")
    .select(
      "rama_activa,catalogo_tipo,catalogo_enviado,faqs_respondidas,intencion_compra_detectada,objecion_detectada,requiere_handoff,grupo_invitado",
    )
    .eq("numero_whatsapp", numero_whatsapp)
    .maybeSingle();

  const { data: deposito } = await sb
    .from("depositos_primera_vez")
    .select("validado")
    .eq("numero_whatsapp", numero_whatsapp)
    .order("comprobante_recibido_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: mensajes } = await sb
    .from("conversaciones")
    .select("direccion,texto,timestamp")
    .eq("numero_whatsapp", numero_whatsapp)
    .order("timestamp", { ascending: false })
    .limit(8);

  const ultimaClienta = mensajes?.find((m) => m.direccion === "entrante");
  const ultimaSirena = mensajes?.find((m) => m.direccion === "saliente");

  const ultimaInteraccion = lead?.ultima_interaccion as string | undefined;
  const horas = ultimaInteraccion
    ? Math.round((Date.now() - new Date(ultimaInteraccion).getTime()) / 3_600_000)
    : null;

  const compras = Number(lead?.compras_totales ?? 0);

  return {
    nombre: (lead?.nombre as string) ?? null,
    ciudad: (lead?.ciudad as string) ?? null,
    canal_origen: (lead?.canal_origen as string) ?? null,
    tipo: (lead?.tipo as string) ?? null,
    estado: (lead?.estado as string) ?? null,
    compras_totales: compras,
    monto_acumulado: Number(lead?.monto_acumulado ?? 0),
    es_recurrente: compras > 0,
    fecha_ultima_compra: (lead?.fecha_ultima_compra as string) ?? null,

    rama_activa: (estado?.rama_activa as string) ?? null,
    catalogo_visto: (estado?.catalogo_tipo as string) ?? null,
    faqs_respondidas: (estado?.faqs_respondidas as number[]) ?? [],
    intencion_compra_detectada: !!estado?.intencion_compra_detectada,
    objecion_detectada: (estado?.objecion_detectada as string) ?? null,
    requiere_handoff: !!estado?.requiere_handoff,
    grupo_invitado: !!estado?.grupo_invitado,

    deposito_dado: !!deposito,
    deposito_validado: !!deposito?.validado,

    ultimo_mensaje_clienta: (ultimaClienta?.texto as string) ?? null,
    ultimo_mensaje_sirena: (ultimaSirena?.texto as string) ?? null,
    horas_desde_ultima_interaccion: horas,

    programado_en: new Date().toISOString(),
    contexto_libre,
  };
}
