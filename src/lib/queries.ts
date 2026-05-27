// Hooks SWR sobre Supabase para cada bloque del dashboard.
// Cada hook = una "query SQL" del spec, traducida al SDK de JS porque
// PostgREST no soporta CTEs directos. Refresh automático cada 30s.

import useSWR, { type SWRConfiguration } from "swr";
import { supabase, dayBoundsMx } from "./supabase";
import { markRefreshed } from "./refresh";
import type {
  Alerta,
  Asesora,
  Canal,
  Cierre,
  EstadoConversacion,
  EventoLive,
  Lead,
} from "./types";

const POLL: SWRConfiguration = {
  refreshInterval: 30_000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  errorRetryCount: 2,
  errorRetryInterval: 4_000,
  onSuccess: () => markRefreshed(),
};

function err(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) return new Error(String((e as { message: unknown }).message));
  return new Error("Error desconocido");
}

// ---------- KPI 1 · Leads hoy vs ayer ----------
export type LeadsHoyKpi = { hoy: number; ayer: number; delta: number };

export function useLeadsHoyKpi() {
  return useSWR<LeadsHoyKpi>(
    "kpi:leads_hoy",
    async () => {
      const hoyRange = dayBoundsMx(0);
      const ayerRange = dayBoundsMx(-1);

      const [hoy, ayer] = await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("primer_contacto", hoyRange.start)
          .lt("primer_contacto", hoyRange.end),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("primer_contacto", ayerRange.start)
          .lt("primer_contacto", ayerRange.end),
      ]);
      if (hoy.error) throw err(hoy.error);
      if (ayer.error) throw err(ayer.error);
      const h = hoy.count ?? 0;
      const a = ayer.count ?? 0;
      const delta = a === 0 ? (h === 0 ? 0 : 100) : Math.round(((h - a) / a) * 100);
      return { hoy: h, ayer: a, delta };
    },
    POLL
  );
}

// ---------- KPI 2 · Efectividad del bot ----------
export type EfectividadKpi = { pct: number; total_leads: number; con_handoff: number };

export function useEfectividadKpi() {
  return useSWR<EfectividadKpi>(
    "kpi:efectividad",
    async () => {
      const { start, end } = dayBoundsMx(0);
      const [{ data: leadsHoy, error: e1 }, { data: handoffs, error: e2 }] = await Promise.all([
        supabase
          .from("leads")
          .select("numero_whatsapp")
          .gte("primer_contacto", start)
          .lt("primer_contacto", end),
        supabase
          .from("alertas")
          .select("numero_whatsapp")
          .in("tipo", ["handoff_normal", "handoff_urgente", "guardrail_critico"])
          .gte("created_at", start)
          .lt("created_at", end),
      ]);
      if (e1) throw err(e1);
      if (e2) throw err(e2);
      const total = (leadsHoy ?? []).length;
      const handoffSet = new Set((handoffs ?? []).map((h) => h.numero_whatsapp));
      const conHandoff = (leadsHoy ?? []).filter((l) =>
        handoffSet.has(l.numero_whatsapp)
      ).length;
      const pct = total === 0 ? 0 : ((total - conHandoff) / total) * 100;
      return { pct, total_leads: total, con_handoff: conHandoff };
    },
    POLL
  );
}

// ---------- KPI 3 · Facturación + pedidos cerrados hoy ----------
export type FacturacionKpi = { pedidos: number; facturacion: number; ticket_promedio: number };

export function useFacturacionKpi() {
  return useSWR<FacturacionKpi>(
    "kpi:facturacion_hoy",
    async () => {
      const { start, end } = dayBoundsMx(0);
      const { data, error } = await supabase
        .from("cierres_diarios")
        .select("monto")
        .gte("fecha_cierre", start)
        .lt("fecha_cierre", end);
      if (error) throw err(error);
      const pedidos = (data ?? []).length;
      const facturacion = (data ?? []).reduce(
        (acc, row) => acc + Number(row.monto || 0),
        0
      );
      const ticket_promedio = pedidos === 0 ? 0 : facturacion / pedidos;
      return { pedidos, facturacion, ticket_promedio };
    },
    POLL
  );
}

// ---------- Bloque B · Leads por canal (hoy) ----------
export type CanalRow = { canal: Canal; total: number };

export function useLeadsPorCanal() {
  return useSWR<CanalRow[]>(
    "blocB:leads_por_canal",
    async () => {
      const { start, end } = dayBoundsMx(0);
      const { data, error } = await supabase
        .from("leads")
        .select("canal_origen")
        .gte("primer_contacto", start)
        .lt("primer_contacto", end);
      if (error) throw err(error);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const c = (row.canal_origen as string) ?? "—";
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([canal, total]) => ({ canal, total }))
        .sort((a, b) => b.total - a.total);
    },
    POLL
  );
}

// ---------- Bloque B · Alertas activas ("en tu cancha") ----------
export function useAlertasActivasCount() {
  return useSWR<number>(
    "blocB:alertas_activas",
    async () => {
      const { count, error } = await supabase
        .from("alertas")
        .select("*", { count: "exact", head: true })
        .in("estado", ["activa", "vista"]);
      if (error) throw err(error);
      return count ?? 0;
    },
    POLL
  );
}

export function useAlertasActivas() {
  return useSWR<Alerta[]>(
    "blocB:alertas_activas_list",
    async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("*")
        .in("estado", ["activa", "vista"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw err(error);
      return (data ?? []) as Alerta[];
    },
    POLL
  );
}

// ---------- Bloque C · Embudo de conversión del día ----------
export type EmbudoEtapa = {
  key:
    | "entro"
    | "en_conversacion"
    | "calificada"
    | "equipo"
    | "esperando_pago"
    | "pagada";
  label: string;
  count: number;
};

export type EmbudoResult = {
  etapas: EmbudoEtapa[];
  cuello_de_botella: { from: string; to: string; fuga_pp: number } | null;
  conversion_total: number;
};

export function useEmbudoDia() {
  return useSWR<EmbudoResult>(
    "blocC:embudo_dia",
    async () => {
      const { start, end } = dayBoundsMx(0);

      const [leadsHoy, conversaciones, requierenHandoff] = await Promise.all([
        supabase
          .from("leads")
          .select("numero_whatsapp,estado,primer_contacto")
          .gte("primer_contacto", start)
          .lt("primer_contacto", end),
        supabase
          .from("estado_conversacion_actual")
          .select("numero_whatsapp,rama_activa,inicio_conversacion,requiere_handoff")
          .not("rama_activa", "is", null)
          .gte("inicio_conversacion", start)
          .lt("inicio_conversacion", end),
        supabase
          .from("estado_conversacion_actual")
          .select("numero_whatsapp,requiere_handoff,inicio_conversacion")
          .eq("requiere_handoff", true)
          .gte("inicio_conversacion", start)
          .lt("inicio_conversacion", end),
      ]);
      if (leadsHoy.error) throw err(leadsHoy.error);
      if (conversaciones.error) throw err(conversaciones.error);
      if (requierenHandoff.error) throw err(requierenHandoff.error);

      const leads = (leadsHoy.data ?? []) as Lead[];
      const numsHoy = new Set(leads.map((l) => l.numero_whatsapp));

      const entro = leads.length;
      const enConv = (conversaciones.data ?? []).filter((c) =>
        numsHoy.has(c.numero_whatsapp)
      ).length;
      const calificada = leads.filter((l) => l.estado === "calificada").length;
      const equipo = (requierenHandoff.data ?? []).filter((c) =>
        numsHoy.has(c.numero_whatsapp)
      ).length;
      const esperandoPago = leads.filter((l) => l.estado === "esperando_pago")
        .length;
      const pagada = leads.filter((l) => l.estado === "pagada").length;

      const etapas: EmbudoEtapa[] = [
        { key: "entro", label: "Entró", count: entro },
        { key: "en_conversacion", label: "En conversación", count: enConv },
        { key: "calificada", label: "Calificada", count: calificada },
        { key: "equipo", label: "En manos del equipo", count: equipo },
        { key: "esperando_pago", label: "Esperando pago", count: esperandoPago },
        { key: "pagada", label: "Pagada", count: pagada },
      ];

      // Detectar cuello de botella: mayor caída de % entre etapas consecutivas.
      let cuello: { from: string; to: string; fuga_pp: number } | null = null;
      for (let i = 0; i < etapas.length - 1; i++) {
        if (entro === 0) break;
        const a = (etapas[i].count / entro) * 100;
        const b = (etapas[i + 1].count / entro) * 100;
        const fuga = a - b;
        if (!cuello || fuga > cuello.fuga_pp) {
          cuello = { from: etapas[i].label, to: etapas[i + 1].label, fuga_pp: fuga };
        }
      }

      const conversion_total = entro === 0 ? 0 : (pagada / entro) * 100;

      return { etapas, cuello_de_botella: cuello, conversion_total };
    },
    POLL
  );
}

// ---------- Pantalla Equipo ----------

export function useAsesoras() {
  return useSWR<Asesora[]>(
    "equipo:asesoras",
    async () => {
      const { data, error } = await supabase
        .from("asesoras")
        .select("*")
        .eq("activa", true)
        .order("en_onboarding", { ascending: true })
        .order("nombre_completo");
      if (error) throw err(error);
      return (data ?? []) as Asesora[];
    },
    POLL
  );
}

export type MetricaAsesora = {
  asesora_id: string;
  pedidos_hoy: number;
  monto_hoy: number;
  alertas_activas: number;
  conversaciones_hoy: number;
  pct_cierre: number;
};

export function useMetricasEquipo() {
  return useSWR<MetricaAsesora[]>(
    "equipo:metricas",
    async () => {
      const { start, end } = dayBoundsMx(0);
      const [asesoras, cierres, alertas] = await Promise.all([
        supabase.from("asesoras").select("id,conversaciones_dia").eq("activa", true),
        supabase
          .from("cierres_diarios")
          .select("asesora_id,monto")
          .gte("fecha_cierre", start)
          .lt("fecha_cierre", end),
        supabase
          .from("alertas")
          .select("asesora_asignada_id,estado")
          .in("estado", ["activa", "vista"]),
      ]);
      if (asesoras.error) throw err(asesoras.error);
      if (cierres.error) throw err(cierres.error);
      if (alertas.error) throw err(alertas.error);

      return (asesoras.data ?? []).map((a) => {
        const cierresA = (cierres.data ?? []).filter((c) => c.asesora_id === a.id);
        const pedidos = cierresA.length;
        const monto = cierresA.reduce((s, c) => s + Number(c.monto || 0), 0);
        const alertasA = (alertas.data ?? []).filter(
          (al) => al.asesora_asignada_id === a.id
        ).length;
        const convs = Number(a.conversaciones_dia ?? 0);
        return {
          asesora_id: a.id,
          pedidos_hoy: pedidos,
          monto_hoy: monto,
          alertas_activas: alertasA,
          conversaciones_hoy: convs,
          pct_cierre: convs === 0 ? 0 : (pedidos / convs) * 100,
        };
      });
    },
    POLL
  );
}

// ---------- Cierres del día (últimos N) ----------
export function useCierresRecientes(limit = 8) {
  return useSWR<(Cierre & { lead?: Pick<Lead, "nombre" | "ciudad"> })[]>(
    ["cierres:recientes", limit],
    async () => {
      const { start, end } = dayBoundsMx(0);
      const { data, error } = await supabase
        .from("cierres_diarios")
        .select("*, leads:numero_whatsapp(nombre,ciudad)")
        .gte("fecha_cierre", start)
        .lt("fecha_cierre", end)
        .order("fecha_cierre", { ascending: false })
        .limit(limit);
      if (error) throw err(error);
      return (data ?? []).map((row) => ({
        ...(row as Cierre),
        lead: (row as { leads: { nombre: string | null; ciudad: string | null } | null }).leads ?? undefined,
      }));
    },
    POLL
  );
}

// ---------- Pipeline (todas las etapas) ----------
export function usePipelineLeads(filtroCanal: string | "all" = "all", filtroAsesora: string | "all" = "all") {
  return useSWR<Lead[]>(
    ["pipeline:leads", filtroCanal, filtroAsesora],
    async () => {
      let q = supabase
        .from("leads")
        .select("*")
        .neq("estado", "perdida")
        .order("ultima_interaccion", { ascending: false, nullsFirst: false })
        .limit(200);
      if (filtroCanal !== "all") q = q.eq("canal_origen", filtroCanal);
      if (filtroAsesora !== "all") q = q.eq("asesora_asignada", filtroAsesora);
      const { data, error } = await q;
      if (error) throw err(error);
      return (data ?? []) as Lead[];
    },
    POLL
  );
}

// ---------- Búsqueda de leads (autocomplete para Cierres) ----------
export async function buscarLeads(qry: string): Promise<Lead[]> {
  const term = qry.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .or(`nombre.ilike.%${term}%,numero_whatsapp.ilike.%${term}%`)
    .limit(8);
  if (error) throw err(error);
  return (data ?? []) as Lead[];
}

// ---------- Eventos live activos ----------
export function useEventosLive() {
  return useSWR<EventoLive[]>(
    "eventos:live",
    async () => {
      const { data, error } = await supabase
        .from("eventos_live")
        .select("*")
        .eq("activo", true)
        .order("fecha_inicio", { ascending: true });
      if (error) throw err(error);
      return (data ?? []) as EventoLive[];
    },
    POLL
  );
}

// ---------- Estado de conversación (para barra "en tu cancha") ----------
export function useConversacionesAbiertas() {
  return useSWR<EstadoConversacion[]>(
    "ops:conversaciones_abiertas",
    async () => {
      const { data, error } = await supabase
        .from("estado_conversacion_actual")
        .select("*")
        .eq("conversacion_cerrada", false)
        .limit(100);
      if (error) throw err(error);
      return (data ?? []) as EstadoConversacion[];
    },
    POLL
  );
}
