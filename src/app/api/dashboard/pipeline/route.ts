// Pipeline kanban — devuelve leads filtrados por canal y/o asesora.
// Incluye flags de seguimiento por lead para que el board pueda
// clasificarlos en la columna virtual "Seguimiento".

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function GET(req: NextRequest) {
  try {
    const canal = req.nextUrl.searchParams.get("canal") ?? "all";
    const asesora = req.nextUrl.searchParams.get("asesora") ?? "all";
    const sb = createAdminClient();

    let q = sb
      .from("leads")
      .select("*")
      .neq("estado", "perdida")
      .order("ultima_interaccion", { ascending: false })
      .limit(200);
    if (canal !== "all") q = q.eq("canal_origen", canal);
    if (asesora !== "all") q = q.eq("asesora_asignada", asesora);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // En el pipeline SÍ mostramos los leads de prueba (Libia, etc) para
    // que se vea moverse la tarjeta y se prueben los flujos completos.
    // El filtro test sigue aplicado en /api/dashboard/inicio y otros
    // endpoints de métricas agregadas.
    const leads = (data ?? []) as { numero_whatsapp?: string }[];

    // Para cada lead, contar seguimientos pendientes y mirar último enviado.
    const numeros = leads
      .map((l) => (l as { numero_whatsapp?: string }).numero_whatsapp ?? "")
      .filter((n) => n.length > 0);
    let seguimientosPorLead = new Map<
      string,
      { pendientes: number; ultimo_enviado_en: string | null; total_enviados: number }
    >();
    if (numeros.length > 0) {
      const { data: rows } = await sb
        .from("seguimientos_programados")
        .select("numero_whatsapp,ejecutar_en,ejecutado_en,resultado")
        .in("numero_whatsapp", numeros);
      const map = new Map<string, { pendientes: number; ultimo_enviado_en: string | null; total_enviados: number }>();
      for (const r of (rows ?? []) as Array<{
        numero_whatsapp: string;
        ejecutar_en: string;
        ejecutado_en: string | null;
        resultado: string | null;
      }>) {
        const prev = map.get(r.numero_whatsapp) ?? {
          pendientes: 0,
          ultimo_enviado_en: null,
          total_enviados: 0,
        };
        if (!r.ejecutado_en) {
          prev.pendientes += 1;
        } else if (r.resultado?.startsWith("enviado")) {
          prev.total_enviados += 1;
          if (
            !prev.ultimo_enviado_en ||
            new Date(r.ejecutado_en).getTime() > new Date(prev.ultimo_enviado_en).getTime()
          ) {
            prev.ultimo_enviado_en = r.ejecutado_en;
          }
        }
        map.set(r.numero_whatsapp, prev);
      }
      seguimientosPorLead = map;
    }

    // Secuencias activas: un lead con cadencia programada que aún no
    // dispara su primer paso (ej. las primeras 24h del lead_frio) debe
    // contar como "en seguimiento" en el kanban, aunque todavía no
    // exista fila en seguimientos_programados.
    const secuenciasActivasPorLead = new Set<string>();
    if (numeros.length > 0) {
      const { data: secs } = await sb
        .from("secuencias_seguimiento")
        .select("numero_whatsapp")
        .in("numero_whatsapp", numeros)
        .eq("pausada", false)
        .is("cancelada_por", null)
        .is("finalizada_en", null);
      for (const s of secs ?? []) {
        secuenciasActivasPorLead.add(s.numero_whatsapp as string);
      }
    }

    const leadsEnriquecidos = leads.map((l) => {
      const numero = (l as { numero_whatsapp?: string }).numero_whatsapp ?? "";
      const s = seguimientosPorLead.get(numero) ?? {
        pendientes: 0,
        ultimo_enviado_en: null,
        total_enviados: 0,
      };
      const enSecuencia = secuenciasActivasPorLead.has(numero);
      return {
        ...l,
        seguimientos_pendientes: s.pendientes + (enSecuencia && s.pendientes === 0 ? 1 : 0),
        seguimientos_enviados: s.total_enviados,
        ultimo_seguimiento_en: s.ultimo_enviado_en,
        en_secuencia_activa: enSecuencia,
      };
    });

    return NextResponse.json({ ok: true, leads: leadsEnriquecidos }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, leads: [] },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
