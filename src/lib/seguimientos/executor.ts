// Ejecutor de seguimientos programados.
// Pesca filas con ejecutar_en <= NOW() AND ejecutado_en IS NULL,
// las manda por ManyChat (o las omite en simulador), y marca
// ejecutado_en + resultado.
//
// Skip rules (anti-spam y anti-stale):
// - Si el lead ya está en handoff activo, saltar (la asesora se encarga).
// - Si tipo='post_compra_7d' y compras_totales=0, saltar.
// - Si tipo='deposito_pendiente_24h' y depósito ya fue recibido, saltar.
// - Si el lead respondió DESPUÉS de cuando se programó este seguimiento,
//   saltar (ya no está "frío").
//
// MIGRACIÓN REQUERIDA en Supabase:
//
//   ALTER TABLE seguimientos_programados
//   ADD COLUMN IF NOT EXISTS ejecutado_en TIMESTAMPTZ,
//   ADD COLUMN IF NOT EXISTS resultado TEXT,
//   ADD COLUMN IF NOT EXISTS mensaje_enviado TEXT;
//
//   CREATE INDEX IF NOT EXISTS idx_seguimientos_pendientes
//   ON seguimientos_programados (ejecutar_en)
//   WHERE ejecutado_en IS NULL;

import { createAdminClient } from "@/lib/supabase/admin";
import { sendToClient } from "@/lib/agent/manychat";
import type { FlowMode } from "@/lib/agent/mode";
import { resolverPlantilla, renderConSnapshot, renderPlantilla } from "./templates";
import { construirSnapshot, type SnapshotSeguimiento } from "./snapshot";

export type EjecutorOptions = {
  mode: FlowMode;
  numero_whatsapp?: string;
  lookahead_min?: number;
  max_batch?: number;
};

export type EjecutorResultadoFila = {
  id: number;
  numero_whatsapp: string;
  tipo: string;
  ejecutar_en: string;
  resultado: "enviado" | "saltado" | "error";
  motivo?: string;
  mensaje?: string;
};

export type EjecutorResultado = {
  ok: boolean;
  procesados: EjecutorResultadoFila[];
  total_pendientes: number;
};

type SeguimientoRow = {
  id: number;
  numero_whatsapp: string;
  tipo: string;
  ejecutar_en: string;
  contexto: Record<string, unknown> | null;
};

export async function ejecutarSeguimientos(
  opts: EjecutorOptions,
): Promise<EjecutorResultado> {
  const sb = createAdminClient();
  const lookahead = opts.lookahead_min ?? 0;
  const cutoff = new Date(Date.now() + lookahead * 60_000).toISOString();
  const batch = opts.max_batch ?? 50;

  let q = sb
    .from("seguimientos_programados")
    .select("id,numero_whatsapp,tipo,ejecutar_en,contexto")
    .is("ejecutado_en", null)
    .lte("ejecutar_en", cutoff)
    .order("ejecutar_en", { ascending: true })
    .limit(batch);

  if (opts.numero_whatsapp) {
    q = q.eq("numero_whatsapp", opts.numero_whatsapp);
  }

  const { data: rows, error } = await q;
  if (error) {
    return {
      ok: false,
      procesados: [
        {
          id: 0,
          numero_whatsapp: "",
          tipo: "",
          ejecutar_en: "",
          resultado: "error",
          motivo: `SELECT seguimientos_programados falló: ${error.message}. ¿Corriste la migración para agregar la columna ejecutado_en?`,
        },
      ],
      total_pendientes: 0,
    };
  }

  const pendientes = (rows ?? []) as SeguimientoRow[];
  const procesados: EjecutorResultadoFila[] = [];

  for (const row of pendientes) {
    try {
      const fila = await procesarUno(row, opts.mode);
      procesados.push(fila);
    } catch (e) {
      procesados.push({
        id: row.id,
        numero_whatsapp: row.numero_whatsapp,
        tipo: row.tipo,
        ejecutar_en: row.ejecutar_en,
        resultado: "error",
        motivo: (e as Error).message,
      });
    }
  }

  return { ok: true, procesados, total_pendientes: pendientes.length };
}

async function procesarUno(
  row: SeguimientoRow,
  mode: FlowMode,
): Promise<EjecutorResultadoFila> {
  const sb = createAdminClient();

  // 1. Leer el lead + estado para aplicar skip rules
  const { data: lead } = await sb
    .from("leads")
    .select("nombre,estado,compras_totales,asesora_asignada,ultima_interaccion")
    .eq("numero_whatsapp", row.numero_whatsapp)
    .maybeSingle();
  const { data: estado } = await sb
    .from("estado_conversacion_actual")
    .select("rama_activa,requiere_handoff")
    .eq("numero_whatsapp", row.numero_whatsapp)
    .maybeSingle();

  const skip = await determinarSkip(row, lead, estado);
  if (skip) {
    await sb
      .from("seguimientos_programados")
      .update({
        ejecutado_en: new Date().toISOString(),
        resultado: `saltado: ${skip}`,
      })
      .eq("id", row.id);
    return {
      id: row.id,
      numero_whatsapp: row.numero_whatsapp,
      tipo: row.tipo,
      ejecutar_en: row.ejecutar_en,
      resultado: "saltado",
      motivo: skip,
    };
  }

  // 2. Construir snapshot fresco (mezcla lo que se guardó al programar
  // con el estado actual). Si el row tiene contexto guardado al programar,
  // lo usamos como base; si no, reconstruimos en vivo.
  const ctxRow = (row.contexto ?? {}) as Record<string, unknown>;
  const contextoLibre =
    (ctxRow.contexto_adicional as string) ||
    (ctxRow.contexto_libre as string) ||
    null;

  let snapshot: SnapshotSeguimiento;
  try {
    snapshot = await construirSnapshot(sb, row.numero_whatsapp, contextoLibre);
  } catch {
    snapshot = {
      nombre: (lead?.nombre as string) ?? null,
      ciudad: null, canal_origen: null, tipo: null, estado: null,
      compras_totales: 0, monto_acumulado: 0, es_recurrente: false,
      es_revendedora: false,
      fecha_ultima_compra: null,
      rama_activa: null, catalogo_visto: null, faqs_respondidas: [],
      intencion_compra_detectada: false, objecion_detectada: null,
      requiere_handoff: false, grupo_invitado: false,
      deposito_dado: false, deposito_validado: false,
      ultimo_mensaje_clienta: null, ultimo_mensaje_sirena: null,
      horas_desde_ultima_interaccion: null,
      programado_en: row.ejecutar_en, contexto_libre: contextoLibre,
    };
  }

  // 3. Resolver plantilla y renderizar con snapshot. Si la plantilla no
  // tiene tokens nuevos, renderConSnapshot sigue funcionando porque
  // {nombre} es el mínimo común.
  const plantilla = await resolverPlantilla(row.tipo);
  const texto = renderConSnapshot(plantilla, snapshot);
  // renderPlantilla queda como utilidad legacy
  void renderPlantilla;

  // 3. Buscar subscriber_id si existe (necesario para ManyChat).
  // Si no tenemos, mode='production' con MANYCHAT_API_KEY hará stub.
  let subscriberId: string | null = null;
  if (mode === "production") {
    const { data: subRow } = await sb
      .from("config_sistema")
      .select("valor")
      .eq("clave", `subscriber_${row.numero_whatsapp}`)
      .maybeSingle();
    subscriberId = (subRow?.valor as string | null) ?? null;
  }

  // 4. Mandar
  const send = await sendToClient({
    subscriberId,
    kaizenSessionId: null,
    mode,
    messages: [{ type: "text", text: texto }],
  });

  // 5. Loguear como conversación saliente
  await sb.from("conversaciones").insert({
    numero_whatsapp: row.numero_whatsapp,
    direccion: "saliente",
    texto,
    tipo_mensaje: "texto",
    tool_ejecutada: "seguimiento_automatico",
    parametros_tool: {
      tipo: row.tipo,
      seguimiento_id: row.id,
      via: send.via,
    },
  });

  // 6. Marcar como ejecutado
  await sb
    .from("seguimientos_programados")
    .update({
      ejecutado_en: new Date().toISOString(),
      resultado: send.ok ? `enviado · ${send.via}` : `error · ${send.error ?? "unknown"}`,
      mensaje_enviado: texto,
    })
    .eq("id", row.id);

  return {
    id: row.id,
    numero_whatsapp: row.numero_whatsapp,
    tipo: row.tipo,
    ejecutar_en: row.ejecutar_en,
    resultado: send.ok ? "enviado" : "error",
    motivo: send.ok ? `via ${send.via}` : send.error,
    mensaje: texto,
  };
}

async function determinarSkip(
  row: SeguimientoRow,
  lead: Record<string, unknown> | null,
  estado: Record<string, unknown> | null,
): Promise<string | null> {
  // Lead en handoff: la asesora se encarga
  if (
    estado?.rama_activa === "handoff" ||
    estado?.requiere_handoff === true
  ) {
    return "lead en handoff activo";
  }

  // post_compra_7d sin compra registrada
  if (
    row.tipo === "post_compra_7d" &&
    Number(lead?.compras_totales ?? 0) === 0
  ) {
    return "tipo=post_compra pero compras_totales=0";
  }

  // Si la clienta respondió DESPUÉS de cuando se programó este,
  // ya no está fría → saltar (excepto post_compra y prueba)
  const skipPorActividad =
    row.tipo === "lead_frio_24h" ||
    row.tipo === "reactivacion_30d" ||
    row.tipo === "deposito_pendiente_24h";
  if (skipPorActividad && lead?.ultima_interaccion) {
    const interaccion = new Date(lead.ultima_interaccion as string).getTime();
    const programado = new Date(row.ejecutar_en).getTime();
    // Si interactuó DESPUÉS de cuando este seguimiento debía dispararse
    // (más reciente que la fecha programada), la clienta ya respondió.
    if (interaccion > programado) {
      return "lead respondió después de programado";
    }
  }

  return null;
}
