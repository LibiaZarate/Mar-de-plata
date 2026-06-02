// config_sistema — GET lista, PUT upsert.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("config_sistema")
      .select("*")
      .order("clave");
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, items: [] }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      clave: string;
      valor: string;
      descripcion?: string | null;
    };
    if (!body.clave) throw new Error("Falta clave");
    const sb = createAdminClient();
    const { data: existing } = await sb
      .from("config_sistema")
      .select("clave")
      .eq("clave", body.clave)
      .maybeSingle();
    const payload = {
      valor: body.valor,
      descripcion: body.descripcion ?? null,
      actualizado_en: new Date().toISOString(),
    };
    const op = existing
      ? sb.from("config_sistema").update(payload).eq("clave", body.clave)
      : sb.from("config_sistema").insert({ clave: body.clave, ...payload });
    const { error } = await op;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
