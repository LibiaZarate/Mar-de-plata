// Lives — GET lista completa, POST crear uno nuevo.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("eventos_live")
      .select("*")
      .order("fecha_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, lives: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, lives: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fecha_inicio: string;
      fecha_fin: string;
      red_social: string;
      link_evento?: string | null;
      codigo_descuento?: string | null;
      descripcion_promo?: string | null;
      activo?: boolean;
    };
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("eventos_live")
      .insert({
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        red_social: body.red_social,
        link_evento: body.link_evento || null,
        codigo_descuento: body.codigo_descuento || null,
        descripcion_promo: body.descripcion_promo || null,
        activo: body.activo ?? true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, live: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
