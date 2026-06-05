// Envío manual de seguimiento desde /configuracion/seguimientos.
// Dos modos:
//   - { tipo, numero }       → renderiza plantilla con snapshot del lead
//   - { texto_libre, numero }→ envía el texto crudo (después de {nombre} eval)
//
// Siempre va por sendToClient. En simulator devuelve el preview sin mandar.
// Loguea en conversaciones con tool_ejecutada='seguimiento_manual'.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToClient } from "@/lib/agent/manychat";
import { defaultMode } from "@/lib/agent/mode";
import { resolverPlantilla, renderConSnapshot } from "@/lib/seguimientos/templates";
import { construirSnapshot } from "@/lib/seguimientos/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      numero: string;
      tipo?: string;
      texto_libre?: string;
      preview?: boolean;
    };
    if (!body.numero || (!body.tipo && !body.texto_libre)) {
      return NextResponse.json(
        { ok: false, error: "Faltan parámetros: numero + (tipo|texto_libre)" },
        { status: 400 },
      );
    }

    const sb = createAdminClient();
    const numero = body.numero.replace(/\D/g, "");
    if (!numero) {
      return NextResponse.json(
        { ok: false, error: "Número inválido" },
        { status: 400 },
      );
    }

    const snapshot = await construirSnapshot(sb, numero, null);

    let texto: string;
    if (body.tipo) {
      const plantilla = await resolverPlantilla(body.tipo);
      texto = renderConSnapshot(plantilla, snapshot);
    } else {
      texto = renderConSnapshot(body.texto_libre!, snapshot);
    }

    if (body.preview) {
      return NextResponse.json({ ok: true, preview: true, texto, snapshot });
    }

    // Buscar subscriber_id
    const mode = defaultMode();
    let subscriberId: string | null = null;
    if (mode === "production") {
      const { data: subRow } = await sb
        .from("config_sistema")
        .select("valor")
        .eq("clave", `subscriber_${numero}`)
        .maybeSingle();
      subscriberId = (subRow?.valor as string | null) ?? null;
    }

    const send = await sendToClient({
      subscriberId,
      kaizenSessionId: null,
      mode,
      messages: [{ type: "text", text: texto }],
    });

    await sb.from("conversaciones").insert({
      numero_whatsapp: numero,
      direccion: "saliente",
      texto,
      tipo_mensaje: "texto",
      tool_ejecutada: "seguimiento_manual",
      parametros_tool: {
        tipo: body.tipo ?? "texto_libre",
        via: send.via,
        disparado_desde: "dashboard",
      },
    });

    return NextResponse.json({
      ok: send.ok,
      texto,
      via: send.via,
      status: send.status,
      error: send.error,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
