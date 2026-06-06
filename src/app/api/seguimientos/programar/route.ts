// Programar un seguimiento desde la UI con tiempo flexible.
// Soporta minutos_offset, horas_offset o dias_offset (uno solo).
// Guarda snapshot del contexto al programar para que el executor
// pueda personalizar el texto cuando llegue la hora.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { construirSnapshot } from "@/lib/seguimientos/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      numero: string;
      tipo: string;
      minutos_offset?: number;
      horas_offset?: number;
      dias_offset?: number;
      contexto_adicional?: string;
    };
    if (!body.numero || !body.tipo) {
      return NextResponse.json(
        { ok: false, error: "Faltan parámetros: numero + tipo" },
        { status: 400 },
      );
    }
    const numero = body.numero.replace(/\D/g, "");
    if (!numero) {
      return NextResponse.json({ ok: false, error: "Número inválido" }, { status: 400 });
    }

    const minutos =
      body.minutos_offset != null
        ? body.minutos_offset
        : body.horas_offset != null
          ? body.horas_offset * 60
          : body.dias_offset != null
            ? body.dias_offset * 24 * 60
            : null;
    if (minutos == null || minutos < 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Especifica minutos_offset, horas_offset o dias_offset (≥ 0)",
        },
        { status: 400 },
      );
    }

    const sb = createAdminClient();
    const ejecutarEn = new Date(Date.now() + minutos * 60_000).toISOString();

    let snapshot: Record<string, unknown> | null = null;
    try {
      snapshot = (await construirSnapshot(
        sb,
        numero,
        body.contexto_adicional ?? null,
      )) as unknown as Record<string, unknown>;
    } catch {
      snapshot = null;
    }

    const { data, error } = await sb
      .from("seguimientos_programados")
      .insert({
        numero_whatsapp: numero,
        tipo: body.tipo,
        ejecutar_en: ejecutarEn,
        contexto: {
          contexto_adicional: body.contexto_adicional ?? "",
          snapshot,
          programado_desde: "dashboard",
          minutos_offset: minutos,
        },
      })
      .select("id,ejecutar_en")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `INSERT falló: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      ejecutar_en: data?.ejecutar_en,
      minutos,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
