// Lista los últimos 15 números con conversaciones, enriquecidos con
// nombre + etiquetas + estado del lead.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data: msgs, error } = await sb
      .from("conversaciones")
      .select("numero_whatsapp,timestamp,direccion,texto")
      .order("timestamp", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);

    const seen = new Map<
      string,
      {
        numero: string;
        last: string;
        lastText: string;
        lastDir: "entrante" | "saliente";
      }
    >();
    for (const m of msgs ?? []) {
      if (!seen.has(m.numero_whatsapp as string)) {
        seen.set(m.numero_whatsapp as string, {
          numero: m.numero_whatsapp as string,
          last: m.timestamp as string,
          lastText: ((m.texto as string | null) ?? "").slice(0, 80),
          lastDir: m.direccion as "entrante" | "saliente",
        });
      }
    }
    const recents = Array.from(seen.values()).slice(0, 15);
    if (recents.length === 0) {
      return NextResponse.json({ ok: true, recents: [] });
    }

    const { data: leads } = await sb
      .from("leads")
      .select("numero_whatsapp,nombre,etiquetas,estado")
      .in(
        "numero_whatsapp",
        recents.map((r) => r.numero),
      );
    const leadMap = new Map(
      (leads ?? []).map((l) => [l.numero_whatsapp as string, l]),
    );

    return NextResponse.json({
      ok: true,
      recents: recents.map((r) => {
        const l = leadMap.get(r.numero);
        return {
          ...r,
          nombre: (l?.nombre as string | null) ?? null,
          etiquetas: (l?.etiquetas as string[] | null) ?? [],
          estado: (l?.estado as string | null) ?? null,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, recents: [] },
      { status: 500 },
    );
  }
}
