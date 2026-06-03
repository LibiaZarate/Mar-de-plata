// Plantillas de seguimientos · GET (efectivos) y PUT (sobreescribir).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEGUIMIENTOS_DEFAULT } from "@/lib/seguimientos/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const tipos = Object.keys(SEGUIMIENTOS_DEFAULT);
    const claves = tipos.map((t) => `seguimiento_${t}_template`);
    const { data } = await sb
      .from("config_sistema")
      .select("clave,valor")
      .in("clave", claves);
    const overrides = new Map(
      ((data ?? []) as { clave: string; valor: string }[]).map((r) => [r.clave, r.valor]),
    );
    const items = tipos.map((t) => {
      const def = SEGUIMIENTOS_DEFAULT[t as keyof typeof SEGUIMIENTOS_DEFAULT];
      const override = (overrides.get(`seguimiento_${t}_template`) ?? "").trim();
      return {
        tipo: t,
        descripcion: def.descripcion,
        offset_dias_default: def.offset_dias,
        texto_default: def.texto,
        texto_override: override || null,
        texto_efectivo: override || def.texto,
      };
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { tipo: string; texto: string };
    if (!body.tipo) {
      return NextResponse.json({ ok: false, error: "tipo requerido" }, { status: 400 });
    }
    const clave = `seguimiento_${body.tipo}_template`;
    const sb = createAdminClient();
    const { data: existing } = await sb
      .from("config_sistema")
      .select("clave")
      .eq("clave", clave)
      .maybeSingle();
    const payload = {
      valor: body.texto,
      descripcion: `Plantilla seguimiento · ${body.tipo}`,
      actualizado_en: new Date().toISOString(),
    };
    const op = existing
      ? sb.from("config_sistema").update(payload).eq("clave", clave)
      : sb.from("config_sistema").insert({ clave, ...payload });
    const { error } = await op;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
