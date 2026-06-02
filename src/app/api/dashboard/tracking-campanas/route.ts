/* eslint-disable @typescript-eslint/no-explicit-any */
// CRUD de campañas custom. Guardamos en config_sistema con clave
// "tracking_campanas_json" como JSON serializado. Sin migración.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIG_KEY = "tracking_campanas_json";

export type Campana = {
  codigo: string; // "ad_dia_madres_2026"
  nombre: string; // "Anuncio · Día de las Madres 2026"
  texto: string; // "Hola, vi su anuncio del Día de las Madres 💗"
  tipo: "meta_ad" | "ig_post" | "fb_post" | "tiktok" | "otro";
  notas?: string;
  created_at: string;
  archivado: boolean;
};

async function leerCampanas(sb: any): Promise<Campana[]> {
  const { data } = await sb
    .from("config_sistema")
    .select("valor")
    .eq("clave", CONFIG_KEY)
    .maybeSingle();
  const raw = (data?.valor as string | null) ?? "[]";
  try {
    return JSON.parse(raw) as Campana[];
  } catch {
    return [];
  }
}

async function guardarCampanas(sb: any, campanas: Campana[]): Promise<void> {
  const raw = JSON.stringify(campanas);
  const { data: existing } = await sb
    .from("config_sistema")
    .select("clave")
    .eq("clave", CONFIG_KEY)
    .maybeSingle();
  const payload = {
    valor: raw,
    descripcion: "Campañas de tracking custom (auto)",
    actualizado_en: new Date().toISOString(),
  };
  if (existing) {
    await sb.from("config_sistema").update(payload).eq("clave", CONFIG_KEY);
  } else {
    await sb.from("config_sistema").insert({ clave: CONFIG_KEY, ...payload });
  }
}

function slugify(nombre: string, prefijo: string = "ad"): string {
  const slug = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${prefijo}_${slug}`;
}

export async function GET() {
  try {
    const sb = createAdminClient();
    const campanas = await leerCampanas(sb);
    return NextResponse.json({ ok: true, campanas: campanas.filter((c) => !c.archivado) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, campanas: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Campana>;
    if (!body.nombre || !body.tipo) {
      return NextResponse.json(
        { ok: false, error: "Falta nombre o tipo" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();
    const campanas = await leerCampanas(sb);
    const prefijo = body.tipo === "meta_ad" ? "ad" : body.tipo;
    let codigo = body.codigo?.trim() || slugify(body.nombre, prefijo);
    // dedup
    let suffix = 1;
    while (campanas.some((c) => c.codigo === codigo && !c.archivado)) {
      codigo = slugify(body.nombre, prefijo) + "_" + suffix++;
    }
    const nueva: Campana = {
      codigo,
      nombre: body.nombre,
      texto: body.texto?.trim() || `Hola, vi su ${body.nombre} 💗`,
      tipo: body.tipo as Campana["tipo"],
      notas: body.notas,
      created_at: new Date().toISOString(),
      archivado: false,
    };
    campanas.push(nueva);
    await guardarCampanas(sb, campanas);
    return NextResponse.json({ ok: true, campana: nueva });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const codigo = req.nextUrl.searchParams.get("codigo");
    if (!codigo) {
      return NextResponse.json({ ok: false, error: "Falta codigo" }, { status: 400 });
    }
    const sb = createAdminClient();
    const campanas = await leerCampanas(sb);
    const idx = campanas.findIndex((c) => c.codigo === codigo);
    if (idx >= 0) {
      campanas[idx].archivado = true;
      await guardarCampanas(sb, campanas);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
