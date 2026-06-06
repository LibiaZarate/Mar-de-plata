// Detalle de un lead específico para el panel lateral del pipeline.
// Devuelve: lead, estado conversacional, snapshot derivado, últimos
// mensajes, seguimientos pendientes, seguimientos ya enviados.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { construirSnapshot } from "@/lib/seguimientos/snapshot";
import { etiquetasParaUI } from "@/lib/lead-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: { numero: string } },
) {
  try {
    const numero = decodeURIComponent(ctx.params.numero).replace(/\D/g, "");
    if (!numero) {
      return NextResponse.json({ ok: false, error: "Número inválido" }, { status: 400 });
    }
    const sb = createAdminClient();

    const [leadRow, estadoRow, mensajesRow, seguimientosRow, depositoRow] =
      await Promise.all([
        sb.from("leads").select("*").eq("numero_whatsapp", numero).maybeSingle(),
        sb
          .from("estado_conversacion_actual")
          .select("*")
          .eq("numero_whatsapp", numero)
          .maybeSingle(),
        sb
          .from("conversaciones")
          .select("id,direccion,texto,tipo_mensaje,tool_ejecutada,timestamp,parametros_tool")
          .eq("numero_whatsapp", numero)
          .order("timestamp", { ascending: false })
          .limit(20),
        sb
          .from("seguimientos_programados")
          .select("id,tipo,ejecutar_en,ejecutado_en,resultado,mensaje_enviado,contexto,created_at")
          .eq("numero_whatsapp", numero)
          .order("ejecutar_en", { ascending: false })
          .limit(50),
        sb
          .from("depositos_primera_vez")
          .select("validado,comprobante_recibido_en")
          .eq("numero_whatsapp", numero)
          .order("comprobante_recibido_en", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (!leadRow.data) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const snapshot = await construirSnapshot(sb, numero, null);

    const chips = etiquetasParaUI(
      leadRow.data as Record<string, unknown>,
      estadoRow.data as Record<string, unknown> | null,
      depositoRow.data
        ? {
            hay_deposito: true,
            validado: !!depositoRow.data.validado,
          }
        : null,
    );

    const ahora = Date.now();
    const seguimientos = (seguimientosRow.data ?? []).map((s) => ({
      ...s,
      estado_render:
        s.ejecutado_en
          ? s.resultado?.startsWith("enviado")
            ? "enviado"
            : s.resultado?.startsWith("saltado")
              ? "saltado"
              : "error"
          : new Date(s.ejecutar_en).getTime() <= ahora
            ? "pendiente_atrasado"
            : "pendiente",
    }));

    return NextResponse.json({
      ok: true,
      lead: leadRow.data,
      estado: estadoRow.data,
      mensajes: (mensajesRow.data ?? []).reverse(),
      seguimientos,
      etiquetas: chips,
      snapshot,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
