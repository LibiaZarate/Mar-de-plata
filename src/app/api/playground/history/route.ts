// Lee el historial de conversaciones para un número específico.
// Usa createAdminClient() porque la tabla `conversaciones` puede tener
// RLS que bloquee el SELECT desde el browser con anon key.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const numero = req.nextUrl.searchParams.get("numero");
  if (!numero || numero.length < 8) {
    return NextResponse.json({ ok: true, mensajes: [], lead: null });
  }

  try {
    const sb = createAdminClient();
    const [conv, lead] = await Promise.all([
      sb
        .from("conversaciones")
        .select("*")
        .eq("numero_whatsapp", numero)
        .order("timestamp", { ascending: true })
        .limit(200),
      sb
        .from("leads")
        .select("*")
        .eq("numero_whatsapp", numero)
        .maybeSingle(),
    ]);
    if (conv.error) throw new Error(conv.error.message);

    return NextResponse.json({
      ok: true,
      mensajes: conv.data ?? [],
      lead: lead.data ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, mensajes: [], lead: null },
      { status: 500 },
    );
  }
}
