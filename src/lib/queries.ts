// Hooks SWR para el dashboard.
// Toda lectura va por endpoints server-side (createAdminClient + service_role)
// para que RLS no bloquee. Refresh 30s.

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { Asesora, Cierre, Lead, LeadEstado } from "./types";

const POLL: SWRConfiguration = {
  refreshInterval: 30_000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  errorRetryCount: 2,
  errorRetryInterval: 4_000,
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

// ── Tipo agregado del endpoint /api/dashboard/inicio ──
export type DashboardRange = "hoy" | "7d" | "30d" | "total";

type InicioResponse = {
  ok: boolean;
  error?: string;
  range: DashboardRange;
  days: number;
  leadsHoyKpi: { hoy: number; ayer: number; delta: number };
  efectividad: { pct: number; total: number; con: number };
  facturacion: { pedidos: number; facturacion: number; ticket: number };
  canales: { canal: string; total: number }[];
  alertasCount: number;
  embudo: {
    etapas: { key: string; label: string; count: number }[];
    cuello: { from: string; to: string; fuga_pp: number } | null;
    conversion: number;
  };
};

function useInicio(range: DashboardRange = "hoy") {
  return useSWR<InicioResponse>(
    `/api/dashboard/inicio?range=${range}`,
    fetcher,
    POLL,
  );
}

// Hooks de "Bloque A · B · C". Comparten una sola llamada al endpoint
// agregado para no machacar Supabase con 8 queries por refresh.
export function useLeadsHoyKpi(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.leadsHoyKpi : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useEfectividadKpi(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.efectividad : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useFacturacionKpi(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.facturacion : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useLeadsPorCanal(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.canales : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useAlertasActivas(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.alertasCount : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useEmbudoDia(range: DashboardRange = "hoy") {
  const { data, error, isLoading } = useInicio(range);
  return {
    data: data?.ok ? data.embudo : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}

// ── Tendencias diarias (últimos N días, default 30) ──
export type TendenciasDay = {
  date: string;
  leads: number;
  facturacion: number;
  pedidos: number;
  efectividad: number;
};

export function useTendencias(days: number = 30) {
  return useSWR<{ ok: boolean; days: number; series: TendenciasDay[]; error?: string }>(
    `/api/dashboard/tendencias?days=${days}`,
    fetcher,
    POLL,
  );
}

// ── Top anuncios (atribución) ──
export type AdRow = {
  anuncio_id: string;
  campaign_id: string | null;
  leads: number;
  pagados: number;
  facturacion: number;
  conversion_pct: number;
};

export function useTopAnuncios(days: number = 30) {
  return useSWR<{ ok: boolean; days: number; anuncios: AdRow[]; error?: string }>(
    `/api/dashboard/atribucion?days=${days}`,
    fetcher,
    POLL,
  );
}

// ── Pipeline ──
export function usePipelineLeads(canal: string | "all" = "all", asesora: string | "all" = "all") {
  const q = new URLSearchParams();
  if (canal !== "all") q.set("canal", canal);
  if (asesora !== "all") q.set("asesora", asesora);
  const url = "/api/dashboard/pipeline" + (q.toString() ? "?" + q.toString() : "");
  const swr = useSWR<{ ok: boolean; leads: Lead[]; error?: string }>(url, fetcher, POLL);
  return {
    data: swr.data?.ok ? swr.data.leads : undefined,
    error: swr.error ?? (swr.data && !swr.data.ok ? new Error(swr.data.error) : null),
    isLoading: swr.isLoading,
  };
}

// ── Equipo ──
type AsesorasResp = {
  ok: boolean;
  error?: string;
  asesoras: Asesora[];
  metricas: {
    asesora_id: string;
    pedidos_hoy: number;
    monto_hoy: number;
    alertas_activas: number;
    conversaciones_hoy: number;
    pct_cierre: number;
  }[];
};
function useEquipo() {
  return useSWR<AsesorasResp>("/api/dashboard/asesoras", fetcher, POLL);
}
export function useAsesoras() {
  const { data, error, isLoading } = useEquipo();
  return {
    data: data?.ok ? data.asesoras : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}
export function useMetricasEquipo() {
  const { data, error, isLoading } = useEquipo();
  return {
    data: data?.ok ? data.metricas : undefined,
    error: error ?? (data && !data.ok ? new Error(data.error) : null),
    isLoading,
  };
}

export function useCierresRecientes(limit = 8) {
  const swr = useSWR<{
    ok: boolean;
    cierres: (Cierre & { leads: { nombre: string | null; ciudad: string | null } | null })[];
    error?: string;
  }>(`/api/dashboard/cierres?limit=${limit}`, fetcher, POLL);
  return {
    data: swr.data?.ok ? swr.data.cierres : undefined,
    error: swr.error ?? (swr.data && !swr.data.ok ? new Error(swr.data.error) : null),
    isLoading: swr.isLoading,
  };
}

export async function buscarLeads(qry: string): Promise<Lead[]> {
  const term = qry.trim();
  if (term.length < 2) return [];
  const r = await fetch(`/api/dashboard/lead?q=${encodeURIComponent(term)}`, {
    cache: "no-store",
  });
  const d = (await r.json()) as { ok: boolean; leads: Lead[] };
  return d.ok ? d.leads : [];
}

export const STAGE_LABEL: Record<LeadEstado, string> = {
  lead_nueva: "Nuevas",
  calificada: "Calificada",
  esperando_pago: "Esperando pago",
  pagada: "Pagada",
  perdida: "Perdida",
};

// ── Playground: historial / recents ──
export type ConversacionMsg = {
  id: number;
  numero_whatsapp: string;
  timestamp: string;
  direccion: "entrante" | "saliente";
  texto: string | null;
  tipo_mensaje: string | null;
  media_url: string | null;
  intencion_detectada: string | null;
  rama_activada: string | null;
  tool_ejecutada: string | null;
};

export function useConversacionHistory(numero: string | null) {
  return useSWR<{ ok: boolean; mensajes: ConversacionMsg[]; error?: string }>(
    numero && numero.length >= 8
      ? `/api/playground/history?numero=${encodeURIComponent(numero)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 },
  );
}

export type RecentConv = {
  numero: string;
  last: string;
  lastText: string;
  lastDir: "entrante" | "saliente";
  nombre: string | null;
  etiquetas: string[];
  estado: LeadEstado | null;
};

export function useRecentConversations() {
  return useSWR<{ ok: boolean; recents: RecentConv[]; error?: string }>(
    "/api/playground/recents",
    fetcher,
    { refreshInterval: 30_000 },
  );
}
