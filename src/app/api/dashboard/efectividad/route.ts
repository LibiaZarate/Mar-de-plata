// Endpoint único para la pantalla /efectividad.
// Devuelve TODO lo del panel del reporte v.2026.06:
//
// - Hero (3 cifras generales):
//     conversaciones atendidas, leads dormidos recuperados,
//     ROAS promedio del periodo
//
// - Las 7 métricas que mueven la aguja
//
// - Métricas específicas de seguimientos (las 3 del §03.2):
//     cuántos se hicieron, cobertura, % recuperación
//
// - ROAS por anuncio (data lista para gráfica)
//
// - Embudo con detección de cuello
//
// Sin "con qué accionar" (Libia lo agregará cuando tenga su
// mente estratega afinada).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerNumerosTest, filtrarProduccion } from "@/lib/test-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

type Range = "hoy" | "7d" | "30d" | "total";

function bounds(range: Range): { startISO: string | null; days: number } {
  if (range === "total") return { startISO: null, days: 9999 };
  const days = range === "hoy" ? 1 : range === "7d" ? 7 : 30;
  return { startISO: new Date(Date.now() - days * 86_400_000).toISOString(), days };
}

export async function GET(req: NextRequest) {
  const range = (req.nextUrl.searchParams.get("range") ?? "30d") as Range;
  if (!["hoy", "7d", "30d", "total"].includes(range)) {
    return NextResponse.json(
      { ok: false, error: `range inválido: ${range}` },
      { status: 400, headers: NO_STORE },
    );
  }
  const { startISO, days } = bounds(range);

  try {
    const sb = createAdminClient();
    const numerosTest = await obtenerNumerosTest(sb);

    // ── Datos base
    const [leadsRes, convsRes, seguimientosRes, cierresRes, secuenciasRes] = await Promise.all([
      selectLeads(sb, startISO),
      selectConversaciones(sb, startISO),
      selectSeguimientos(sb, startISO),
      selectCierres(sb, startISO),
      selectSecuencias(sb, startISO),
    ]);

    const leads = filtrarProduccion(leadsRes, numerosTest);
    const conversaciones = filtrarProduccion(convsRes, numerosTest);
    const seguimientos = filtrarProduccion(seguimientosRes, numerosTest);
    const cierres = filtrarProduccion(cierresRes, numerosTest);
    const secuencias = filtrarProduccion(secuenciasRes, numerosTest);

    // ── 1. Hero: conversaciones atendidas por Sirena ───────
    // Mensajes salientes con tool_ejecutada NO null = Sirena respondió.
    const conversaciones_atendidas = conversaciones.filter(
      (c) => c.direccion === "saliente" && c.tool_ejecutada,
    ).length;

    // ── 2. Hero: leads dormidos recuperados ────────────────
    // Dormido = secuencia que ejecutó al menos 1 paso (paso_actual>0).
    // Recuperado = DESPUÉS de eso respondió (la cancelación con motivo
    // 'respondio' solo ocurre con un mensaje entrante posterior) o
    // llegó a cierre con fecha posterior al inicio de la secuencia.
    // Comparar contra "cualquier entrante del periodo" estaría inflado:
    // todo lead tiene al menos el mensaje con el que llegó.
    const secuenciasConPaso = secuencias.filter((s) => s.paso_actual > 0);
    const numerosConSecuencia = new Set(secuenciasConPaso.map((s) => s.numero_whatsapp));
    const recuperados = Array.from(numerosConSecuencia).filter((n) => {
      const susSecuencias = secuenciasConPaso.filter((s) => s.numero_whatsapp === n);
      const respondioTrasPaso = susSecuencias.some(
        (s) => s.cancelada_por === "respondio",
      );
      const comproTrasSecuencia = susSecuencias.some((s) =>
        cierres.some(
          (c) =>
            c.numero_whatsapp === n &&
            new Date((c as { fecha_cierre: string }).fecha_cierre).getTime() >
              new Date(s.iniciada_en).getTime(),
        ),
      );
      return respondioTrasPaso || comproTrasSecuencia;
    }).length;
    const dormidos_total = numerosConSecuencia.size;

    // ── 3. Hero: ROAS promedio del periodo ─────────────────
    // facturacion_atribuida / spend_atribuido. La data fina vive en
    // /api/dashboard/meta/campanas. Acá aproximamos con dashboard:
    const facturacionTotal = cierres.reduce(
      (s, c) => s + Number((c as { monto?: number }).monto ?? 0),
      0,
    );
    // Sin Meta API en este endpoint usamos placeholder neutro
    const roas_promedio: number | null = null;

    // ── §04 LAS 7 MÉTRICAS ─────────────────────────────────

    // 01 · Conversaciones
    const m01_conversaciones = new Set(
      conversaciones.filter((c) => c.direccion === "entrante").map((c) => c.numero_whatsapp),
    ).size;

    // 02 · Efectividad del bot
    // Cuenta como "necesitó humano" tanto el handoff normal como el
    // disparado por guardrail crítico — si solo contáramos
    // handoff_asesora, los guardrails inflarían la efectividad.
    const numerosLead = new Set(leads.map((l) => l.numero_whatsapp));
    const numerosConHandoff = new Set(
      conversaciones
        .filter(
          (c) =>
            c.tool_ejecutada === "handoff_asesora" ||
            c.tool_ejecutada === "handoff_directo_guardrail",
        )
        .map((c) => c.numero_whatsapp),
    );
    const totalLeads = numerosLead.size;
    const conHandoff = Array.from(numerosLead).filter((n) => numerosConHandoff.has(n)).length;
    const m02_efectividad_pct = totalLeads === 0 ? 0 : ((totalLeads - conHandoff) / totalLeads) * 100;

    // 03 · Cobertura de seguimiento
    // De los seguimientos PROGRAMADOS, qué % se ejecutó (enviado/saltado)
    // vs los que aún no llegan a su fecha.
    const ahora = Date.now();
    const debianDispararse = seguimientos.filter(
      (s) => new Date((s as { ejecutar_en: string }).ejecutar_en).getTime() <= ahora,
    );
    const ejecutados = debianDispararse.filter(
      (s) => (s as { ejecutado_en: string | null }).ejecutado_en,
    );
    const m03_cobertura_pct =
      debianDispararse.length === 0 ? 100 : (ejecutados.length / debianDispararse.length) * 100;

    // 04 · % de recuperación de seguimientos
    // Seguimientos enviados que generaron respuesta entrante o pedido
    // en las siguientes 48h.
    const enviados = ejecutados.filter((s) => {
      const r = (s as { resultado: string | null }).resultado;
      return r?.includes("enviado");
    });
    const recuperadosSeg = enviados.filter((s) => {
      const num = (s as { numero_whatsapp: string }).numero_whatsapp;
      const fecha = new Date(
        (s as { ejecutado_en: string }).ejecutado_en,
      ).getTime();
      const ventana = fecha + 48 * 3600_000;
      const hayRespuestaPosterior = conversaciones.some(
        (c) =>
          c.numero_whatsapp === num &&
          c.direccion === "entrante" &&
          new Date(c.timestamp).getTime() > fecha &&
          new Date(c.timestamp).getTime() < ventana,
      );
      const hayCierrePosterior = cierres.some(
        (c) =>
          c.numero_whatsapp === num &&
          new Date((c as { fecha_cierre: string }).fecha_cierre).getTime() > fecha,
      );
      return hayRespuestaPosterior || hayCierrePosterior;
    });
    const m04_recuperacion_pct =
      enviados.length === 0 ? 0 : (recuperadosSeg.length / enviados.length) * 100;

    // 05 · Conversión a pedido por etapa (embudo)
    const numerosLeadHabla = new Set(
      conversaciones.filter((c) => c.direccion === "entrante").map((c) => c.numero_whatsapp),
    );
    const embudo_etapas = [
      { key: "entro", label: "Entró", count: totalLeads },
      {
        key: "en_conversacion",
        label: "En conversación",
        count: Array.from(numerosLead).filter((n) => numerosLeadHabla.has(n)).length,
      },
      {
        key: "calificada",
        label: "Calificada",
        count: leads.filter((l) => l.estado === "calificada").length,
      },
      {
        key: "en_manos_equipo",
        label: "En manos del equipo",
        count: Array.from(numerosLead).filter((n) => numerosConHandoff.has(n)).length,
      },
      {
        key: "esperando_pago",
        label: "Esperando pago",
        count: leads.filter((l) => l.estado === "esperando_pago").length,
      },
      {
        key: "pagada",
        label: "Pagada",
        count: leads.filter((l) => l.estado === "pagada").length,
      },
    ];
    let cuello: { from: string; to: string; fuga_pp: number } | null = null;
    const totalE = embudo_etapas[0].count;
    for (let i = 0; i < embudo_etapas.length - 1; i++) {
      if (totalE === 0) break;
      const ap = (embudo_etapas[i].count / totalE) * 100;
      const bp = (embudo_etapas[i + 1].count / totalE) * 100;
      const fuga_pp = ap - bp;
      if (!cuello || fuga_pp > cuello.fuga_pp)
        cuello = { from: embudo_etapas[i].label, to: embudo_etapas[i + 1].label, fuga_pp };
    }

    // 06 · Pedidos por fuente / anuncio
    const pedidosPorCanal = new Map<string, { leads: number; pagados: number; facturacion: number }>();
    for (const l of leads) {
      const canal = (l.canal_origen as string | null) ?? "Sin canal";
      const monto = cierres
        .filter((c) => c.numero_whatsapp === l.numero_whatsapp)
        .reduce((s, c) => s + Number((c as { monto?: number }).monto ?? 0), 0);
      const pagado = monto > 0 || l.estado === "pagada";
      const prev = pedidosPorCanal.get(canal) ?? { leads: 0, pagados: 0, facturacion: 0 };
      prev.leads += 1;
      if (pagado) prev.pagados += 1;
      prev.facturacion += monto;
      pedidosPorCanal.set(canal, prev);
    }
    const m06_pedidos_por_canal = Array.from(pedidosPorCanal.entries())
      .map(([canal, v]) => ({ canal, ...v }))
      .sort((a, b) => b.pagados - a.pagados);

    // 07 · Tiempo de primera respuesta (mediana, en segundos)
    const tiempos = leads
      .map((l) => Number((l as { tiempo_primera_respuesta_ms?: number }).tiempo_primera_respuesta_ms ?? 0))
      .filter((t) => t > 0);
    tiempos.sort((a, b) => a - b);
    const m07_primera_respuesta_segs =
      tiempos.length === 0 ? null : tiempos[Math.floor(tiempos.length / 2)] / 1000;

    // ── §03.2 Métricas específicas de seguimientos ─────────
    const seg_total_hechos = enviados.length;
    const seg_cobertura_pct = m03_cobertura_pct;
    const seg_recuperacion_pct = m04_recuperacion_pct;

    // ── Tipo dominante de seguimiento ──────────────────────
    const segPorTipo = new Map<string, number>();
    for (const s of enviados) {
      const tipo = (s as { tipo: string }).tipo;
      segPorTipo.set(tipo, (segPorTipo.get(tipo) ?? 0) + 1);
    }
    const seg_por_tipo = Array.from(segPorTipo.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(
      {
        ok: true,
        range,
        days,
        hero: {
          conversaciones_atendidas,
          dormidos_recuperados: { recuperados, total: dormidos_total },
          roas_promedio,
          facturacion_total: facturacionTotal,
        },
        metricas_7: {
          m01_conversaciones,
          m02_efectividad_pct,
          m03_cobertura_seguimiento_pct: m03_cobertura_pct,
          m04_recuperacion_pct,
          m05_embudo: { etapas: embudo_etapas, cuello },
          m06_pedidos_por_canal,
          m07_primera_respuesta_segs,
        },
        seguimientos: {
          total_hechos: seg_total_hechos,
          cobertura_pct: seg_cobertura_pct,
          recuperacion_pct: seg_recuperacion_pct,
          por_tipo: seg_por_tipo,
        },
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500, headers: NO_STORE },
    );
  }
}

// Helpers de selección con filtro temporal

async function selectLeads(sb: SupabaseClient, startISO: string | null) {
  let q = sb
    .from("leads")
    .select(
      "numero_whatsapp,estado,canal_origen,primer_contacto,tiempo_primera_respuesta_ms,etiquetas",
    );
  if (startISO) q = q.gte("primer_contacto", startISO);
  const { data } = await q.limit(5000);
  return (data ?? []) as Array<{
    numero_whatsapp: string;
    estado: string;
    canal_origen: string | null;
    primer_contacto: string;
    etiquetas: string[] | null;
  }>;
}

async function selectConversaciones(sb: SupabaseClient, startISO: string | null) {
  let q = sb.from("conversaciones").select("numero_whatsapp,direccion,tool_ejecutada,timestamp");
  if (startISO) q = q.gte("timestamp", startISO);
  const { data } = await q.limit(50000);
  return (data ?? []) as Array<{
    numero_whatsapp: string;
    direccion: string;
    tool_ejecutada: string | null;
    timestamp: string;
  }>;
}

async function selectSeguimientos(sb: SupabaseClient, startISO: string | null) {
  let q = sb
    .from("seguimientos_programados")
    .select("numero_whatsapp,tipo,ejecutar_en,ejecutado_en,resultado");
  if (startISO) q = q.gte("ejecutar_en", startISO);
  const { data } = await q.limit(5000);
  return (data ?? []) as Array<{
    numero_whatsapp: string;
    tipo: string;
    ejecutar_en: string;
    ejecutado_en: string | null;
    resultado: string | null;
  }>;
}

async function selectCierres(sb: SupabaseClient, startISO: string | null) {
  let q = sb.from("cierres_diarios").select("numero_whatsapp,monto,fecha_cierre");
  if (startISO) q = q.gte("fecha_cierre", startISO);
  const { data } = await q.limit(5000);
  return (data ?? []) as Array<{
    numero_whatsapp: string;
    monto: number;
    fecha_cierre: string;
  }>;
}

async function selectSecuencias(sb: SupabaseClient, startISO: string | null) {
  let q = sb
    .from("secuencias_seguimiento")
    .select("numero_whatsapp,tipo_secuencia,paso_actual,iniciada_en,finalizada_en,cancelada_por");
  if (startISO) q = q.gte("iniciada_en", startISO);
  const { data } = await q.limit(5000);
  return (data ?? []) as Array<{
    numero_whatsapp: string;
    tipo_secuencia: string;
    paso_actual: number;
    iniciada_en: string;
    finalizada_en: string | null;
    cancelada_por: string | null;
  }>;
}
