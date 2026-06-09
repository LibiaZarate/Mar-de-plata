// Máquina de secuencias de seguimiento.
// Implementa la cadencia decreciente del reporte: frecuencia baja,
// valor sube, ángulo cambia, no repite el mismo mensaje.
//
// Tipos de secuencia y sus pasos:
//
//   lead_frio
//     paso 1 · +24h   → "¿pudiste ver el catálogo?" + detalle
//     paso 2 · +3d    → valor puro, sin pedir nada
//     paso 3 · +6d    → pregunta directa, cambia ángulo
//     paso 4 · +10d   → break-up amable
//     paso 5 · +30d   → reactivación con novedades
//
//   deposito_pendiente
//     paso 1 · +24h   → urgencia suave "lo suelto mañana"
//     paso 2 · +48h   → último aviso antes de soltar
//
//   post_pedido
//     paso 1 · +7d    → ¿cómo te llegó? / etiquétanos
//     paso 2 · +30d   → ¿quieres ver lo nuevo?
//
//   reactivacion
//     paso 1 · +30d   → novedades + prueba social local
//     paso 2 · +60d   → temporada / razón concreta
//
//   restock_revendedora
//     se programa con cadencia propia según el ritmo histórico de
//     compra de la clienta. Default cada 21 días si no hay data.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoSecuencia =
  | "lead_frio"
  | "deposito_pendiente"
  | "post_pedido"
  | "reactivacion"
  | "restock_revendedora";

export type DefinicionPaso = {
  paso: number;
  offset_minutos: number;
  tipo_seguimiento: string; // se renderiza con plantilla de este tipo
  descripcion: string;
};

export const SECUENCIAS: Record<TipoSecuencia, DefinicionPaso[]> = {
  lead_frio: [
    { paso: 1, offset_minutos: 24 * 60, tipo_seguimiento: "lead_frio_24h", descripcion: "Pregunta + detalle" },
    { paso: 2, offset_minutos: 3 * 24 * 60, tipo_seguimiento: "lead_frio_3d", descripcion: "Valor puro" },
    { paso: 3, offset_minutos: 6 * 24 * 60, tipo_seguimiento: "lead_frio_6d", descripcion: "Pregunta directa + cambio ángulo" },
    { paso: 4, offset_minutos: 10 * 24 * 60, tipo_seguimiento: "lead_frio_10d", descripcion: "Break-up amable" },
    { paso: 5, offset_minutos: 30 * 24 * 60, tipo_seguimiento: "reactivacion_30d", descripcion: "Reactivación" },
  ],
  deposito_pendiente: [
    { paso: 1, offset_minutos: 24 * 60, tipo_seguimiento: "deposito_pendiente_24h", descripcion: "Lo suelto mañana" },
    { paso: 2, offset_minutos: 48 * 60, tipo_seguimiento: "deposito_pendiente_48h", descripcion: "Último aviso" },
  ],
  post_pedido: [
    { paso: 1, offset_minutos: 7 * 24 * 60, tipo_seguimiento: "post_compra_7d", descripcion: "¿Cómo te llegó?" },
    { paso: 2, offset_minutos: 30 * 24 * 60, tipo_seguimiento: "post_compra_30d", descripcion: "Lo nuevo" },
  ],
  reactivacion: [
    { paso: 1, offset_minutos: 30 * 24 * 60, tipo_seguimiento: "reactivacion_30d", descripcion: "Novedades" },
    { paso: 2, offset_minutos: 60 * 24 * 60, tipo_seguimiento: "reactivacion_60d", descripcion: "Temporada" },
  ],
  restock_revendedora: [
    { paso: 1, offset_minutos: 21 * 24 * 60, tipo_seguimiento: "restock_revendedora", descripcion: "Restock ritmo" },
  ],
};

// Iniciar una secuencia para un lead. Si ya tiene una activa del
// mismo tipo, no la duplica (unique index lo bloquearía igual).
export async function iniciarSecuencia(
  sb: SupabaseClient,
  numero_whatsapp: string,
  tipo: TipoSecuencia,
  contextoInicial?: Record<string, unknown>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const pasos = SECUENCIAS[tipo];
  if (!pasos || pasos.length === 0) {
    return { ok: false, error: `tipo desconocido: ${tipo}` };
  }
  const primerPaso = pasos[0];
  const siguienteDisparo = new Date(
    Date.now() + primerPaso.offset_minutos * 60_000,
  ).toISOString();

  const { data, error } = await sb
    .from("secuencias_seguimiento")
    .insert({
      numero_whatsapp,
      tipo_secuencia: tipo,
      paso_actual: 0, // 0 = aún no disparó el paso 1
      siguiente_disparo: siguienteDisparo,
      contexto_inicial: contextoInicial ?? {},
    })
    .select("id")
    .single();

  if (error) {
    // El unique index bloquea duplicados activos
    if (error.code === "23505") {
      return { ok: false, error: "Ya hay una secuencia activa de ese tipo" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

// Avanzar al siguiente paso. Si no hay más, marca la secuencia como
// finalizada. Llamada después de ejecutar el paso actual.
export async function avanzarSecuencia(
  sb: SupabaseClient,
  secuenciaId: number,
): Promise<void> {
  const { data: sec } = await sb
    .from("secuencias_seguimiento")
    .select("tipo_secuencia,paso_actual")
    .eq("id", secuenciaId)
    .maybeSingle();
  if (!sec) return;

  const pasos = SECUENCIAS[sec.tipo_secuencia as TipoSecuencia];
  const siguientePaso = (sec.paso_actual as number) + 1;
  const defPaso = pasos.find((p) => p.paso === siguientePaso);

  if (!defPaso || siguientePaso > pasos.length) {
    await sb
      .from("secuencias_seguimiento")
      .update({
        finalizada_en: new Date().toISOString(),
        ultima_actualizacion: new Date().toISOString(),
      })
      .eq("id", secuenciaId);
    return;
  }

  const siguienteDisparo = new Date(
    Date.now() + defPaso.offset_minutos * 60_000,
  ).toISOString();

  await sb
    .from("secuencias_seguimiento")
    .update({
      paso_actual: siguientePaso,
      siguiente_disparo: siguienteDisparo,
      ultima_actualizacion: new Date().toISOString(),
    })
    .eq("id", secuenciaId);
}

// Cancela cualquier secuencia activa de un lead. Razón: response,
// compró, handoff, etc.
export async function cancelarSecuenciasActivas(
  sb: SupabaseClient,
  numero_whatsapp: string,
  motivo: string,
): Promise<number> {
  const { data, error } = await sb
    .from("secuencias_seguimiento")
    .update({
      cancelada_por: motivo,
      cancelada_en: new Date().toISOString(),
      ultima_actualizacion: new Date().toISOString(),
    })
    .eq("numero_whatsapp", numero_whatsapp)
    .is("cancelada_por", null)
    .is("finalizada_en", null)
    .select("id");
  if (error) return 0;
  return (data ?? []).length;
}

// Lee las secuencias listas para disparar (siguiente_disparo <= NOW()).
export async function leerSecuenciasListas(
  sb: SupabaseClient,
  batch = 50,
): Promise<Array<{
  id: number;
  numero_whatsapp: string;
  tipo_secuencia: TipoSecuencia;
  paso_actual: number;
}>> {
  const ahora = new Date().toISOString();
  const { data } = await sb
    .from("secuencias_seguimiento")
    .select("id,numero_whatsapp,tipo_secuencia,paso_actual")
    .lte("siguiente_disparo", ahora)
    .eq("pausada", false)
    .is("cancelada_por", null)
    .is("finalizada_en", null)
    .order("siguiente_disparo", { ascending: true })
    .limit(batch);
  return (data ?? []) as Array<{
    id: number;
    numero_whatsapp: string;
    tipo_secuencia: TipoSecuencia;
    paso_actual: number;
  }>;
}

// El paso del cron: para cada secuencia lista, ejecuta el SIGUIENTE
// paso (paso_actual + 1), inserta en seguimientos_programados con
// ejecutar_en = NOW() para que el executor lo mande, y avanza.
export async function procesarSecuenciasListas(
  sb: SupabaseClient,
): Promise<{ procesadas: number; detalles: Array<Record<string, unknown>> }> {
  const listas = await leerSecuenciasListas(sb);
  const detalles: Array<Record<string, unknown>> = [];

  for (const sec of listas) {
    const pasos = SECUENCIAS[sec.tipo_secuencia];
    const siguientePaso = sec.paso_actual + 1;
    const defPaso = pasos.find((p) => p.paso === siguientePaso);
    if (!defPaso) {
      await sb
        .from("secuencias_seguimiento")
        .update({ finalizada_en: new Date().toISOString() })
        .eq("id", sec.id);
      continue;
    }

    // Insertar en seguimientos_programados para que el cron de
    // seguimientos lo mande (con todas las skip rules y snapshot).
    const ahora = new Date().toISOString();
    const { data: segIns } = await sb
      .from("seguimientos_programados")
      .insert({
        numero_whatsapp: sec.numero_whatsapp,
        tipo: defPaso.tipo_seguimiento,
        ejecutar_en: ahora,
        contexto: {
          programado_desde: "secuencia",
          secuencia_id: sec.id,
          paso: defPaso.paso,
          tipo_secuencia: sec.tipo_secuencia,
        },
      })
      .select("id")
      .single();

    // Auditar el paso
    await sb.from("secuencia_pasos_ejecutados").insert({
      secuencia_id: sec.id,
      paso: defPaso.paso,
      resultado: segIns?.id
        ? `seguimientos_programados.id=${segIns.id}`
        : "no se pudo insertar",
    });

    // Avanzar la máquina
    await avanzarSecuencia(sb, sec.id);

    detalles.push({
      secuencia_id: sec.id,
      numero: sec.numero_whatsapp,
      paso: defPaso.paso,
      tipo_seguimiento: defPaso.tipo_seguimiento,
    });
  }

  return { procesadas: detalles.length, detalles };
}
