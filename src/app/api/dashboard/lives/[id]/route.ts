// Toggle activo / borrar live individual.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) throw new Error("ID inválido");
    const body = (await req.json()) as Partial<{ activo: boolean }>;
    const sb = createAdminClient();
    const { error } = await sb
      .from("eventos_live")
      .update({ activo: body.activo })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) throw new Error("ID inválido");
    const sb = createAdminClient();
    const { error } = await sb.from("eventos_live").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
