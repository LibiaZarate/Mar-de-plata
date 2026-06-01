// Consulta de live activo (CTE directo, CLAUDE.md §10 paso 9),
// llamada a obtener_contexto_lead (paso 10) y enriquecimiento JS (paso 11).

import { createAdminClient } from "@/lib/supabase/admin";

export type LiveInfo = {
  hay_live_ahora: boolean;
  hay_live_hoy: boolean;
  proximo_live: null | {
    id: number;
    fecha: string;
    red: string;
    codigo: string | null;
    descripcion: string | null;
    link: string | null;
  };
};

export async function consultarLiveActivo(): Promise<LiveInfo> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Capa 1: live activo (ahora dentro de fecha_inicio/fecha_fin)
  const { data: ahora } = await supabase
    .from("eventos_live")
    .select("*")
    .eq("activo", true)
    .lte("fecha_inicio", nowIso)
    .gte("fecha_fin", nowIso)
    .order("fecha_inicio", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Capa 2: live hoy futuro (mismo día CDMX, todavía no empieza)
  const startOfToday = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }),
  );
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const { data: hoy } = await supabase
    .from("eventos_live")
    .select("*")
    .eq("activo", true)
    .gte("fecha_inicio", startOfToday.toISOString())
    .lt("fecha_inicio", endOfToday.toISOString())
    .gt("fecha_inicio", nowIso)
    .order("fecha_inicio", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Capa 3: cualquier live futuro
  const { data: futuro } = await supabase
    .from("eventos_live")
    .select("*")
    .eq("activo", true)
    .gt("fecha_inicio", nowIso)
    .order("fecha_inicio", { ascending: true })
    .limit(1)
    .maybeSingle();

  const elegido = ahora ?? hoy ?? futuro ?? null;
  return {
    hay_live_ahora: !!ahora,
    hay_live_hoy: !!hoy,
    proximo_live: elegido
      ? {
          id: elegido.id as number,
          fecha: elegido.fecha_inicio as string,
          red: elegido.red_social as string,
          codigo: (elegido.codigo_descuento as string | null) ?? null,
          descripcion: (elegido.descripcion_promo as string | null) ?? null,
          link: (elegido.link_evento as string | null) ?? null,
        }
      : null,
  };
}

export async function obtenerContextoLead(
  numero: string,
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("obtener_contexto_lead", {
    p_numero: numero,
  });
  if (error) throw new Error(`obtener_contexto_lead falló: ${error.message}`);
  return (data ?? {}) as Record<string, unknown>;
}

export type EnrichedMetadata = {
  hora_formateada: string;
  es_horario_habil: boolean;
  timestamp: string;
  live: LiveInfo;
};

export function enrichMetadata(live: LiveInfo): EnrichedMetadata {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dow = now.toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
  });
  const hour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      hour12: false,
    }),
    10,
  );
  const esDiaHabil = !["Sat", "Sun"].includes(dow);
  const esHoraHabil = hour >= 10 && hour < 18;
  return {
    hora_formateada: formatter.format(now),
    es_horario_habil: esDiaHabil && esHoraHabil,
    timestamp: now.toISOString(),
    live,
  };
}

export async function yaPagoDeposito(numero: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("depositos_primera_vez")
    .select("id")
    .eq("numero_whatsapp", numero)
    .eq("validado", true)
    .limit(1)
    .maybeSingle();
  return !!data;
}
