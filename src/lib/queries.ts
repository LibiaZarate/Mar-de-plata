// Hooks SWR para las pantallas del dashboard.
// Refresh 30s, errorRetry corto.

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Asesora, Cierre, Lead, LeadEstado } from "./types";

const POLL: SWRConfiguration = {
  refreshInterval: 30_000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  errorRetryCount: 2,
  errorRetryInterval: 4_000,
};

function isoStartOfTodayMx(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  const local = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }),
  );
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + offsetDays);
  const tzMin = Math.round(
    (new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getTime()) /
      60000,
  );
  const start = new Date(local.getTime() + tzMin * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── KPI 1 · Leads hoy ──
export function useLeadsHoyKpi() {
  return useSWR(
    "kpi:leads_hoy",
    async () => {
      const sb = createClient();
      const hoyR = isoStartOfTodayMx(0);
      const ayerR = isoStartOfTodayMx(-1);
      const [hoy, ayer] = await Promise.all([
        sb.from("leads").select("*", { count: "exact", head: true })
          .gte("primer_contacto", hoyR.start).lt("primer_contacto", hoyR.end),
        sb.from("leads").select("*", { count: "exact", head: true })
          .gte("primer_contacto", ayerR.start).lt("primer_contacto", ayerR.end),
      ]);
      if (hoy.error) throw new Error(hoy.error.message);
      if (ayer.error) throw new Error(ayer.error.message);
      const h = hoy.count ?? 0;
      const a = ayer.count ?? 0;
      const delta = a === 0 ? (h === 0 ? 0 : 100) : Math.round(((h - a) / a) * 100);
      return { hoy: h, ayer: a, delta };
    },
    POLL,
  );
}

// ── KPI 2 · Efectividad del bot ──
export function useEfectividadKpi() {
  return useSWR(
    "kpi:efectividad",
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const [{ data: l, error: e1 }, { data: a, error: e2 }] = await Promise.all([
        sb.from("leads").select("numero_whatsapp")
          .gte("primer_contacto", start).lt("primer_contacto", end),
        sb.from("alertas").select("numero_whatsapp")
          .in("tipo", ["handoff_normal", "handoff_urgente", "guardrail_critico"])
          .gte("created_at", start).lt("created_at", end),
      ]);
      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      const total = (l ?? []).length;
      const handoffSet = new Set((a ?? []).map((x) => x.numero_whatsapp));
      const con = (l ?? []).filter((x) => handoffSet.has(x.numero_whatsapp)).length;
      const pct = total === 0 ? 0 : ((total - con) / total) * 100;
      return { pct, total, con };
    },
    POLL,
  );
}

// ── KPI 3 · Facturación hoy + pedidos ──
export function useFacturacionKpi() {
  return useSWR(
    "kpi:facturacion",
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const { data, error } = await sb
        .from("cierres_diarios")
        .select("monto")
        .gte("fecha_cierre", start).lt("fecha_cierre", end);
      if (error) throw new Error(error.message);
      const pedidos = (data ?? []).length;
      const facturacion = (data ?? []).reduce((s, r) => s + Number(r.monto || 0), 0);
      const ticket = pedidos === 0 ? 0 : facturacion / pedidos;
      return { pedidos, facturacion, ticket };
    },
    POLL,
  );
}

// ── Bloque B · Leads por canal hoy ──
export function useLeadsPorCanal() {
  return useSWR(
    "blocB:canales",
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const { data, error } = await sb
        .from("leads")
        .select("canal_origen")
        .gte("primer_contacto", start).lt("primer_contacto", end);
      if (error) throw new Error(error.message);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const c = (row.canal_origen as string) ?? "—";
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([canal, total]) => ({ canal, total }))
        .sort((a, b) => b.total - a.total);
    },
    POLL,
  );
}

// ── Bloque B · Alertas en cancha ──
export function useAlertasActivas() {
  return useSWR(
    "blocB:alertas",
    async () => {
      const sb = createClient();
      const { count, error } = await sb
        .from("alertas")
        .select("*", { count: "exact", head: true })
        .in("estado", ["activa", "vista"]);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    POLL,
  );
}

// ── Bloque C · Embudo del día ──
export function useEmbudoDia() {
  return useSWR(
    "blocC:embudo",
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const [leads, conv, hand] = await Promise.all([
        sb.from("leads").select("numero_whatsapp,estado")
          .gte("primer_contacto", start).lt("primer_contacto", end),
        sb.from("estado_conversacion_actual").select("numero_whatsapp,rama_activa,inicio_conversacion")
          .not("rama_activa", "is", null)
          .gte("inicio_conversacion", start).lt("inicio_conversacion", end),
        sb.from("estado_conversacion_actual").select("numero_whatsapp,requiere_handoff,inicio_conversacion")
          .eq("requiere_handoff", true)
          .gte("inicio_conversacion", start).lt("inicio_conversacion", end),
      ]);
      if (leads.error) throw new Error(leads.error.message);
      const ll = (leads.data ?? []) as Lead[];
      const set = new Set(ll.map((x) => x.numero_whatsapp));
      const etapas = [
        { key: "entro", label: "Entró", count: ll.length },
        { key: "en_conversacion", label: "En conversación", count: (conv.data ?? []).filter((x) => set.has(x.numero_whatsapp)).length },
        { key: "calificada", label: "Calificada", count: ll.filter((l) => l.estado === "calificada").length },
        { key: "equipo", label: "En manos del equipo", count: (hand.data ?? []).filter((x) => set.has(x.numero_whatsapp)).length },
        { key: "esperando_pago", label: "Esperando pago", count: ll.filter((l) => l.estado === "esperando_pago").length },
        { key: "pagada", label: "Pagada", count: ll.filter((l) => l.estado === "pagada").length },
      ];
      let cuello: { from: string; to: string; fuga_pp: number } | null = null;
      const total = etapas[0].count;
      for (let i = 0; i < etapas.length - 1; i++) {
        if (total === 0) break;
        const a = (etapas[i].count / total) * 100;
        const b = (etapas[i + 1].count / total) * 100;
        const f = a - b;
        if (!cuello || f > cuello.fuga_pp)
          cuello = { from: etapas[i].label, to: etapas[i + 1].label, fuga_pp: f };
      }
      const conversion = total === 0 ? 0 : (etapas[etapas.length - 1].count / total) * 100;
      return { etapas, cuello, conversion };
    },
    POLL,
  );
}

// ── Pipeline kanban ──
export function usePipelineLeads(canal: string | "all" = "all", asesora: string | "all" = "all") {
  return useSWR(
    ["pipeline", canal, asesora],
    async () => {
      const sb = createClient();
      let q = sb.from("leads").select("*").neq("estado", "perdida").order("ultima_interaccion", { ascending: false }).limit(200);
      if (canal !== "all") q = q.eq("canal_origen", canal);
      if (asesora !== "all") q = q.eq("asesora_asignada", asesora);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Lead[];
    },
    POLL,
  );
}

// ── Equipo ──
export function useAsesoras() {
  return useSWR(
    "asesoras",
    async () => {
      const sb = createClient();
      const { data, error } = await sb.from("asesoras").select("*").eq("activa", true)
        .order("en_onboarding", { ascending: true }).order("nombre_completo");
      if (error) throw new Error(error.message);
      return (data ?? []) as Asesora[];
    },
    POLL,
  );
}

export function useMetricasEquipo() {
  return useSWR(
    "equipo:metricas",
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const [a, c, al] = await Promise.all([
        sb.from("asesoras").select("id,conversaciones_dia").eq("activa", true),
        sb.from("cierres_diarios").select("asesora_id,monto").gte("fecha_cierre", start).lt("fecha_cierre", end),
        sb.from("alertas").select("asesora_asignada_id,estado").in("estado", ["activa", "vista"]),
      ]);
      if (a.error) throw new Error(a.error.message);
      return (a.data ?? []).map((x) => {
        const cierres = (c.data ?? []).filter((r) => r.asesora_id === x.id);
        const pedidos = cierres.length;
        const monto = cierres.reduce((s, r) => s + Number(r.monto || 0), 0);
        const aler = (al.data ?? []).filter((r) => r.asesora_asignada_id === x.id).length;
        const convs = Number(x.conversaciones_dia ?? 0);
        return {
          asesora_id: x.id as string,
          pedidos_hoy: pedidos,
          monto_hoy: monto,
          alertas_activas: aler,
          conversaciones_hoy: convs,
          pct_cierre: convs === 0 ? 0 : (pedidos / convs) * 100,
        };
      });
    },
    POLL,
  );
}

export function useCierresRecientes(limit = 8) {
  return useSWR(
    ["cierres", limit],
    async () => {
      const sb = createClient();
      const { start, end } = isoStartOfTodayMx(0);
      const { data, error } = await sb
        .from("cierres_diarios")
        .select("*,leads:numero_whatsapp(nombre,ciudad)")
        .gte("fecha_cierre", start).lt("fecha_cierre", end)
        .order("fecha_cierre", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as (Cierre & { leads: { nombre: string | null; ciudad: string | null } | null })[];
    },
    POLL,
  );
}

export async function buscarLeads(qry: string): Promise<Lead[]> {
  const term = qry.trim();
  if (term.length < 2) return [];
  const sb = createClient();
  const { data } = await sb
    .from("leads").select("*")
    .or(`nombre.ilike.%${term}%,numero_whatsapp.ilike.%${term}%`)
    .limit(8);
  return (data ?? []) as Lead[];
}

export const STAGE_LABEL: Record<LeadEstado, string> = {
  lead_nueva: "Nuevas",
  calificada: "Calificada",
  esperando_pago: "Esperando pago",
  pagada: "Pagada",
  perdida: "Perdida",
};
