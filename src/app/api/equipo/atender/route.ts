// Asesora marca que ya atendió a la clienta.
// Cierra la alerta, baja la carga, deja el estado conversacional limpio.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      alerta_id: number;
      asesora_id: string;
      notas?: string;
    };
    if (!body.alerta_id || !body.asesora_id) {
      return NextResponse.json(
        { ok: false, error: "alerta_id y asesora_id requeridos" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();

    const { data: alerta } = await sb
      .from("alertas")
      .select("id,asesora_asignada_id,numero_whatsapp,estado")
      .eq("id", body.alerta_id)
      .maybeSingle();
    if (!alerta) {
      return NextResponse.json({ ok: false, error: "Alerta no existe" }, { status: 404 });
    }
    if (alerta.estado !== "activa") {
      return NextResponse.json(
        { ok: false, error: "La alerta no está activa" },
        { status: 409 },
      );
    }

    const numero = alerta.numero_whatsapp as string;

    await sb
      .from("alertas")
      .update({
        estado: "resuelta",
        resuelta_en: new Date().toISOString(),
        resuelta_por_id: body.asesora_id,
        notas_resolucion: body.notas ?? null,
      })
      .eq("id", body.alerta_id);

    // Bajar carga de la asesora
    const { data: asesora } = await sb
      .from("asesoras")
      .select("conversaciones_abiertas")
      .eq("id", body.asesora_id)
      .maybeSingle();
    await sb
      .from("asesoras")
      .update({
        conversaciones_abiertas: Math.max(
          0,
          (asesora?.conversaciones_abiertas as number ?? 1) - 1,
        ),
      })
      .eq("id", body.asesora_id);

    // Resetear estado de la conversación
    await sb
      .from("estado_conversacion_actual")
      .update({
        requiere_handoff: false,
        rama_activa: null,
        paso_actual: "atendido",
        ultimo_timestamp: new Date().toISOString(),
      })
      .eq("numero_whatsapp", numero);

    return NextResponse.json({ ok: true, atendida: body.alerta_id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
