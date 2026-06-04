// Diagnostico del pipeline de atribución: cuenta leads recientes
// segmentados por si tienen ad metadata o no. Ayuda a saber si el
// problema es (a) no hay tráfico, (b) hay tráfico pero sin referral,
// o (c) todo funciona y solo falta darle tiempo.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const days = 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const { count: totalLeads } = await sb
      .from("leads")
      .select("numero_whatsapp", { count: "exact", head: true })
      .gte("primer_contacto", since);

    const { count: conAnuncio } = await sb
      .from("leads")
      .select("numero_whatsapp", { count: "exact", head: true })
      .gte("primer_contacto", since)
      .not("anuncio_id", "is", null);

    const { count: canalMeta } = await sb
      .from("leads")
      .select("numero_whatsapp", { count: "exact", head: true })
      .gte("primer_contacto", since)
      .or("canal_origen.eq.meta_ctwa,canal_origen.eq.meta,canal_origen.ilike.facebook%,canal_origen.ilike.instagram%");

    const { data: ultimosConAd } = await sb
      .from("leads")
      .select("numero_whatsapp,nombre,canal_origen,anuncio_id,etiquetas,primer_contacto")
      .gte("primer_contacto", since)
      .not("anuncio_id", "is", null)
      .order("primer_contacto", { ascending: false })
      .limit(3);

    const { data: ultimosSinAd } = await sb
      .from("leads")
      .select("numero_whatsapp,nombre,canal_origen,primer_contacto")
      .gte("primer_contacto", since)
      .is("anuncio_id", null)
      .order("primer_contacto", { ascending: false })
      .limit(3);

    return NextResponse.json({
      ok: true,
      ventana_dias: days,
      total_leads: totalLeads ?? 0,
      con_anuncio_id: conAnuncio ?? 0,
      canal_meta_o_instagram: canalMeta ?? 0,
      muestra_con_ad: ultimosConAd ?? [],
      muestra_sin_ad: ultimosSinAd ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
