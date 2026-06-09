// Cierres del día — GET últimos N, POST nuevo cierre.
//
// El POST es el evento de negocio más importante del sistema: una
// venta cerrada. Además de insertar el cierre hace todo lo que la
// venta implica para que las métricas y seguimientos sean veraces:
//   1. Actualiza estadísticas del lead (compras_totales,
//      monto_acumulado, ticket_promedio, fechas de compra).
//      Sin esto, {si:recurrente} jamás se activa y los seguimientos
//      post-compra se saltan por "compras_totales=0".
//   2. Cancela las secuencias activas (ya compró — la cadencia de
//      lead frío o depósito ya no aplica).
//   3. Arranca la secuencia post_pedido (7d feedback, 30d novedades).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelarSecuenciasActivas,
  iniciarSecuencia,
} from "@/lib/seguimientos/secuencias";

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

    // 1. Estadísticas de compra del lead
    const { data: leadRow } = await sb
      .from("leads")
      .select("compras_totales,monto_acumulado,fecha_primera_compra")
      .eq("numero_whatsapp", body.numero_whatsapp)
      .maybeSingle();
    const comprasPrevias = Number(leadRow?.compras_totales ?? 0);
    const montoPrevio = Number(leadRow?.monto_acumulado ?? 0);
    const comprasNuevas = comprasPrevias + 1;
    const montoNuevo = montoPrevio + Number(body.monto || 0);
    await sb
      .from("leads")
      .update({
        estado: "pagada",
        ultima_interaccion: fecha,
        compras_totales: comprasNuevas,
        monto_acumulado: montoNuevo,
        ticket_promedio: montoNuevo / comprasNuevas,
        fecha_primera_compra: leadRow?.fecha_primera_compra ?? fecha,
        fecha_ultima_compra: fecha,
      })
      .eq("numero_whatsapp", body.numero_whatsapp);

    // 2. Cancelar secuencias activas (compró: lead_frio / depósito
    //    ya no aplican) y 3. arrancar post_pedido. Best-effort: si
    //    falla, el cierre ya quedó registrado y no rompemos el flujo
    //    de la asesora.
    try {
      await cancelarSecuenciasActivas(sb, body.numero_whatsapp, "compro");
      await iniciarSecuencia(sb, body.numero_whatsapp, "post_pedido", {
        cierre_monto: body.monto,
        cierre_canal: body.canal,
      });
    } catch (e) {
      console.warn("[cierres] secuencias post-cierre fallaron:", (e as Error).message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
