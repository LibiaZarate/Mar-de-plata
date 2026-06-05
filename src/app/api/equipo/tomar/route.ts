// Asesora elige una alerta de la cola y la "toma".
// Asigna la alerta a su id, sube su carga, marca el lead.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      alerta_id: number;
      asesora_id: string;
    };
    if (!body.alerta_id || !body.asesora_id) {
      return NextResponse.json(
        { ok: false, error: "alerta_id y asesora_id requeridos" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();

    // Lee la alerta y valida que esté libre
    const { data: alerta } = await sb
      .from("alertas")
      .select("id,asesora_asignada_id,numero_whatsapp,estado,contexto_json")
      .eq("id", body.alerta_id)
      .maybeSingle();
    if (!alerta) {
      return NextResponse.json(
        { ok: false, error: "Alerta no existe" },
        { status: 404 },
      );
    }
    if (alerta.asesora_asignada_id) {
      return NextResponse.json(
        { ok: false, error: "Ya la tomó otra asesora", tomada_por: alerta.asesora_asignada_id },
        { status: 409 },
      );
    }
    if (alerta.estado !== "activa") {
      return NextResponse.json(
        { ok: false, error: "La alerta ya no está activa" },
        { status: 409 },
      );
    }

    // Lee la asesora para el nombre + carga
    const { data: asesora } = await sb
      .from("asesoras")
      .select("id,nombre_completo,conversaciones_abiertas,conversaciones_dia")
      .eq("id", body.asesora_id)
      .maybeSingle();
    if (!asesora) {
      return NextResponse.json(
        { ok: false, error: "Asesora no existe" },
        { status: 404 },
      );
    }

    const numero = alerta.numero_whatsapp as string;

    // Asignar la alerta + el lead + bumpear carga
    await sb
      .from("alertas")
      .update({
        asesora_asignada_id: asesora.id,
        contexto_json: {
          ...((alerta.contexto_json as Record<string, unknown>) ?? {}),
          asesora_nombre: asesora.nombre_completo,
          tomada_en: new Date().toISOString(),
          tomada_por_pull: true,
        },
      })
      .eq("id", body.alerta_id);

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
        conversaciones_abiertas: (asesora.conversaciones_abiertas as number ?? 0) + 1,
        conversaciones_dia: (asesora.conversaciones_dia as number ?? 0) + 1,
        ultima_asignacion: new Date().toISOString(),
      })
      .eq("id", asesora.id);

    return NextResponse.json({
      ok: true,
      tomada: {
        alerta_id: body.alerta_id,
        numero_whatsapp: numero,
        asesora_nombre: asesora.nombre_completo,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
