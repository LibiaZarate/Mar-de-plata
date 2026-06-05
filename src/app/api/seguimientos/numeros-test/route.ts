// Devuelve la lista de leads marcados como prueba (etiqueta 'test').

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("leads")
      .select("numero_whatsapp,nombre,etiquetas")
      .contains("etiquetas", ["test"])
      .order("nombre");
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, numeros: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, numeros: [] },
      { status: 500 },
    );
  }
}
