// Consulta de live activo (CTE directo, CLAUDE.md §10 paso 9),
// llamada a obtener_contexto_lead (paso 10) y enriquecimiento JS (paso 11).

import { createAdminClient } from "@/lib/supabase/admin";

export type LiveInfo = {
  hay_live_ahora: boolean;
  hay_live_hoy: boolean;
  proximo_live: null | {
    id: number;
    fecha: string;
    fecha_fin: string;
    red: string;
    codigo: string | null;
    descripcion: string | null;
    link: string | null;
  };
};

export type SirenaUrls = {
  sitio_web_menudeo: string;
  ubicacion_taxco_maps: string;
  politicas_manual_pdf: string;
};

const URLS_DEFAULT: SirenaUrls = {
  sitio_web_menudeo: "https://www.mardeplatataxco.com",
  ubicacion_taxco_maps:
    "https://www.google.com/maps/search/?api=1&query=Plaza+San+Hip%C3%B3lito+Local+5%2C+Taxco+de+Alarc%C3%B3n%2C+40200",
  // Mar pasó este link de Canva como el oficial de políticas
  politicas_manual_pdf:
    "https://www.canva.com/design/DAHITaosuVw/gKkRE6FNj1YVAoV0WT7MXQ/view?utm_content=DAHITaosuVw&utm_campaign=designshare&utm_medium=link&utm_source=viewer",
};

export async function resolveSirenaUrls(): Promise<SirenaUrls> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("config_sistema")
    .select("clave,valor")
    .in("clave", [
      "sitio_web_menudeo",
      "ubicacion_taxco_maps",
      "politicas_manual_pdf",
    ]);
  const map = new Map((data ?? []).map((r) => [r.clave as string, (r.valor as string) ?? ""]));
  const pick = (k: keyof SirenaUrls) => (map.get(k)?.trim() || URLS_DEFAULT[k]);
  return {
    sitio_web_menudeo: pick("sitio_web_menudeo"),
    ubicacion_taxco_maps: pick("ubicacion_taxco_maps"),
    politicas_manual_pdf: pick("politicas_manual_pdf"),
  };
}

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
          fecha_fin: elegido.fecha_fin as string,
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
  urls: SirenaUrls;
  live_tiempo_restante_min: number | null;
};

export function enrichMetadata(live: LiveInfo, urls: SirenaUrls): EnrichedMetadata {
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
  let liveTiempoRestanteMin: number | null = null;
  if (live.hay_live_ahora && live.proximo_live?.fecha_fin) {
    const fin = new Date(live.proximo_live.fecha_fin).getTime();
    const ahora = now.getTime();
    if (fin > ahora) {
      liveTiempoRestanteMin = Math.round((fin - ahora) / 60000);
    }
  }
  return {
    hora_formateada: formatter.format(now),
    es_horario_habil: esDiaHabil && esHoraHabil,
    timestamp: now.toISOString(),
    live,
    urls,
    live_tiempo_restante_min: liveTiempoRestanteMin,
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
