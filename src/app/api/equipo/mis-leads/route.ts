// Lo que tiene en su pila la asesora actualmente.
// Alertas asignadas a ella y no resueltas.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const asesoraId = req.nextUrl.searchParams.get("asesora_id");
    if (!asesoraId) {
      return NextResponse.json(
        { ok: false, error: "asesora_id requerido" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();
    const { data: alertas, error } = await sb
      .from("alertas")
      .select(
        "id,tipo,prioridad,titulo,descripcion,numero_whatsapp,para_mar,contexto_json,created_at,estado",
      )
      .eq("asesora_asignada_id", asesoraId)
      .eq("estado", "activa")
      .order("prioridad", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    const numeros = (alertas ?? []).map((a) => a.numero_whatsapp as string);
    const { data: leads } = numeros.length
      ? await sb
          .from("leads")
          .select("numero_whatsapp,nombre,ciudad,canal_origen,tipo,etiquetas")
          .in("numero_whatsapp", numeros)
      : { data: [] as Record<string, unknown>[] };
    const leadsMap = new Map(
      (leads ?? []).map((l) => [l.numero_whatsapp as string, l]),
    );

    return NextResponse.json({
      ok: true,
      mis_leads: (alertas ?? []).map((a) => ({
        ...a,
        lead: leadsMap.get(a.numero_whatsapp as string) ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, mis_leads: [] },
      { status: 500 },
    );
  }
}
