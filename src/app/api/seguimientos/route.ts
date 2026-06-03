// GET: lista cola de seguimientos (pendientes + recientes ejecutados).
// POST: programa uno (para pruebas).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sb = createAdminClient();
    const numero = req.nextUrl.searchParams.get("numero");

    let pendQ = sb
      .from("seguimientos_programados")
      .select("id,numero_whatsapp,tipo,ejecutar_en,contexto,created_at")
      .is("ejecutado_en", null)
      .order("ejecutar_en", { ascending: true })
      .limit(50);
    let recQ = sb
      .from("seguimientos_programados")
      .select("id,numero_whatsapp,tipo,ejecutar_en,ejecutado_en,resultado,mensaje_enviado")
      .not("ejecutado_en", "is", null)
      .order("ejecutado_en", { ascending: false })
      .limit(20);
    if (numero) {
      pendQ = pendQ.eq("numero_whatsapp", numero);
      recQ = recQ.eq("numero_whatsapp", numero);
    }

    const [{ data: pendientes, error: e1 }, { data: recientes, error: e2 }] =
      await Promise.all([pendQ, recQ]);

    if (e1 || e2) {
      const msg = (e1?.message || e2?.message || "").includes("ejecutado_en")
        ? "Falta correr la migración (agregar columnas ejecutado_en, resultado, mensaje_enviado). Mira el comentario en src/lib/seguimientos/executor.ts."
        : e1?.message || e2?.message;
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pendientes: pendientes ?? [],
      recientes: recientes ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      numero_whatsapp: string;
      tipo: string;
      delay_min?: number;
      delay_dias?: number;
      contexto_adicional?: string;
    };
    if (!body.numero_whatsapp || !body.tipo) {
      return NextResponse.json(
        { ok: false, error: "numero_whatsapp y tipo son requeridos" },
        { status: 400 },
      );
    }

    const delayMs =
      (Number(body.delay_dias ?? 0) * 86400 + Number(body.delay_min ?? 0) * 60) *
      1000;
    const ejecutarEn = new Date(Date.now() + delayMs).toISOString();

    const sb = createAdminClient();
    const { data, error } = await sb
      .from("seguimientos_programados")
      .insert({
        numero_whatsapp: body.numero_whatsapp,
        tipo: body.tipo,
        ejecutar_en: ejecutarEn,
        contexto: { contexto_adicional: body.contexto_adicional ?? "" },
      })
      .select("id,ejecutar_en")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, programado: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    const sb = createAdminClient();
    const { error } = await sb.from("seguimientos_programados").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
