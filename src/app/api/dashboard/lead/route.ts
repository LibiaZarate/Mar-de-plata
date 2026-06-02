// Buscar leads (autocomplete del widget de cierres) + actualizar estado.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ ok: true, leads: [] });
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .or(`nombre.ilike.%${q}%,numero_whatsapp.ilike.%${q}%`)
      .limit(8);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, leads: [] }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { numero: string; estado: string };
    if (!body.numero || !body.estado) throw new Error("Faltan numero/estado");
    const sb = createAdminClient();
    const { error } = await sb
      .from("leads")
      .update({ estado: body.estado, ultima_interaccion: new Date().toISOString() })
      .eq("numero_whatsapp", body.numero);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
