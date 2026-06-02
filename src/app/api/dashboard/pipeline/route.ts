// Pipeline kanban — devuelve leads filtrados por canal y/o asesora.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, leads: [] },
      { status: 500 },
    );
  }
}
