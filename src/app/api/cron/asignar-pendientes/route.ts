// Fallback de 5 minutos para handoffs en cola.
// Si nadie tomó la alerta en ese tiempo, asignamos por round-robin
// (la asesora con menos carga + asignación más antigua).
//
// Configurado en vercel.json como */5 * * * * (cada 5 min).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FALLBACK_MINUTOS = 5;

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const sb = createAdminClient();
    const cutoff = new Date(Date.now() - FALLBACK_MINUTOS * 60_000).toISOString();

    const { data: pendientes, error } = await sb
      .from("alertas")
      .select("id,numero_whatsapp,contexto_json,created_at")
      .is("asesora_asignada_id", null)
      .eq("estado", "activa")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);

    const procesadas: Array<{ id: number; asesora: string; numero: string }> = [];

    for (const alerta of pendientes ?? []) {
      // Round-robin: la asesora activa con menos conversaciones abiertas
      // y asignación más antigua
      const { data: asesora } = await sb
        .from("asesoras")
        .select("id,nombre_completo,conversaciones_abiertas,conversaciones_dia")
        .eq("activa", true)
        .order("en_onboarding", { ascending: false })
        .order("conversaciones_abiertas", { ascending: true })
        .order("ultima_asignacion", { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle();
      if (!asesora) continue;

      const numero = alerta.numero_whatsapp as string;

      await sb
        .from("alertas")
        .update({
          asesora_asignada_id: asesora.id,
          contexto_json: {
            ...((alerta.contexto_json as Record<string, unknown>) ?? {}),
            asesora_nombre: asesora.nombre_completo,
            asignada_por_fallback: true,
            asignada_en: new Date().toISOString(),
          },
        })
        .eq("id", alerta.id);

      await sb
        .from("leads")
        .update({
          asesora_asignada: asesora.id,
          fecha_asignacion: new Date().toISOString(),
        })
        .eq("numero_whatsapp", numero);

      await sb
        .from("estado_conversacion_actual")
        .update({ paso_actual: "atendiendo" })
        .eq("numero_whatsapp", numero);

      await sb
        .from("asesoras")
        .update({
          conversaciones_abiertas:
            (asesora.conversaciones_abiertas as number ?? 0) + 1,
          conversaciones_dia: (asesora.conversaciones_dia as number ?? 0) + 1,
          ultima_asignacion: new Date().toISOString(),
        })
        .eq("id", asesora.id);

      procesadas.push({
        id: alerta.id as number,
        asesora: asesora.nombre_completo as string,
        numero,
      });
    }

    return NextResponse.json({
      ok: true,
      asignadas: procesadas.length,
      cutoff,
      procesadas,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
