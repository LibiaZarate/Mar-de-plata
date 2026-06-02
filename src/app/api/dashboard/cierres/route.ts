// Cierres del día — GET últimos N, POST nuevo cierre.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayBoundsMx(): { start: string; end: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  local.setHours(0, 0, 0, 0);
  const tzMin = Math.round(
    (new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getTime()) /
      60000,
  );
  const start = new Date(local.getTime() + tzMin * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
    const sb = createAdminClient();
    const { start, end } = dayBoundsMx();
    const { data, error } = await sb
      .from("cierres_diarios")
      .select("*, leads:numero_whatsapp(nombre,ciudad)")
      .gte("fecha_cierre", start)
      .lt("fecha_cierre", end)
      .order("fecha_cierre", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, cierres: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, cierres: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      numero_whatsapp: string;
      asesora_id: string;
      monto: number;
      canal: string;
      notas?: string;
      comprobante_url?: string;
    };
    const sb = createAdminClient();
    const fecha = new Date().toISOString();
    const { error: insErr } = await sb.from("cierres_diarios").insert({
      numero_whatsapp: body.numero_whatsapp,
      asesora_id: body.asesora_id,
      monto: body.monto,
      canal: body.canal,
      notas: body.notas ?? null,
      comprobante_url: body.comprobante_url ?? null,
      fecha_cierre: fecha,
    });
    if (insErr) throw new Error(insErr.message);
    await sb
      .from("leads")
      .update({ estado: "pagada", ultima_interaccion: fecha })
      .eq("numero_whatsapp", body.numero_whatsapp);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
