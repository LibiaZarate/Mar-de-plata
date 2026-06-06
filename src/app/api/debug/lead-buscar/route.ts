// Diagnóstico: lista todos los leads que coinciden por substring de
// número o por nombre, y dice si tienen subscriber_id de ManyChat
// guardado. Sirve para depurar casos donde el mismo contacto
// aparece bajo distintos formatos (con/sin el 1 después de 52).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { ok: false, error: "Pasa ?q=algo (substring de número o nombre)" },
        { status: 400 },
      );
    }
    const sb = createAdminClient();

    const soloDigitos = q.replace(/\D/g, "");

    // Buscar por número (substring) o por nombre (ilike)
    const filtros: string[] = [];
    if (soloDigitos.length >= 3) filtros.push(`numero_whatsapp.ilike.%${soloDigitos}%`);
    filtros.push(`nombre.ilike.%${q}%`);

    const { data: leads } = await sb
      .from("leads")
      .select(
        "numero_whatsapp,nombre,ciudad,canal_origen,estado,etiquetas,primer_contacto,ultima_interaccion,compras_totales",
      )
      .or(filtros.join(","))
      .limit(20);

    // Buscar subscriber_ids relacionados en config_sistema
    const numeros = (leads ?? []).map((l) => l.numero_whatsapp as string);
    let claves = numeros.map((n) => `subscriber_${n}`);
    if (soloDigitos.length >= 6) {
      claves.push(`subscriber_${soloDigitos}`);
      claves.push(`subscriber_52${soloDigitos.replace(/^52/, "")}`);
      claves.push(`subscriber_521${soloDigitos.replace(/^52/, "")}`);
    }
    claves = Array.from(new Set(claves));

    const { data: subs } = await sb
      .from("config_sistema")
      .select("clave,valor,actualizado_en")
      .in("clave", claves);

    // Cruzar
    const subsMap = new Map(
      (subs ?? []).map((s) => [(s.clave as string).replace("subscriber_", ""), s]),
    );

    const rows = (leads ?? []).map((l) => {
      const num = l.numero_whatsapp as string;
      const s = subsMap.get(num);
      return {
        ...l,
        subscriber_id: (s?.valor as string | null) ?? null,
        subscriber_actualizado_en: (s?.actualizado_en as string | null) ?? null,
      };
    });

    // Subscribers huérfanos (sin lead asociado encontrado)
    const huerfanos = (subs ?? []).filter((s) => {
      const n = (s.clave as string).replace("subscriber_", "");
      return !numeros.includes(n);
    });

    return NextResponse.json({
      ok: true,
      query: q,
      leads_encontrados: rows.length,
      leads: rows,
      subscribers_huerfanos: huerfanos.map((h) => ({
        numero_implicito: (h.clave as string).replace("subscriber_", ""),
        valor: h.valor,
        actualizado_en: h.actualizado_en,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
