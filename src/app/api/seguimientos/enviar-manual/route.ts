// Envío manual de seguimiento desde /configuracion/seguimientos.
// Dos modos:
//   - { tipo, numero }       → renderiza plantilla con snapshot del lead
//   - { texto_libre, numero }→ envía el texto crudo (después de {nombre} eval)
//
// IMPORTANTE: este endpoint SIEMPRE intenta envío real a ManyChat,
// ignorando MODO_PRODUCCION. Su único propósito es validar el camino
// completo a WhatsApp; si está en "simulator" sería inútil.
//
// Devuelve un diagnóstico completo (manychat_api_key_presente,
// subscriber_id_presente, http_status de ManyChat) para que el sandbox
// muestre por qué algo no llegó.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverPlantilla, renderConSnapshot } from "@/lib/seguimientos/templates";
import { construirSnapshot } from "@/lib/seguimientos/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANYCHAT_URL = "https://api.manychat.com/fb/sending/sendContent";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      numero: string;
      tipo?: string;
      texto_libre?: string;
      preview?: boolean;
      subscriber_id?: string;
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

    // Diagnóstico previo al envío
    const apiKey = process.env.MANYCHAT_API_KEY ?? null;
    let subscriberId: string | null = body.subscriber_id?.trim() || null;
    let subscriberSource: "body" | "config" | "ninguno" = subscriberId ? "body" : "ninguno";
    if (!subscriberId) {
      const { data: subRow } = await sb
        .from("config_sistema")
        .select("valor")
        .eq("clave", `subscriber_${numero}`)
        .maybeSingle();
      const v = (subRow?.valor as string | null) ?? null;
      if (v && v.trim()) {
        subscriberId = v.trim();
        subscriberSource = "config";
      }
    }

    const diagnostico = {
      numero,
      manychat_api_key_presente: !!apiKey,
      subscriber_id_presente: !!subscriberId,
      subscriber_id_origen: subscriberSource,
      texto_longitud: texto.length,
    };

    // Si faltan credenciales, no intentar el HTTP y devolver razón clara
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        via: "stub",
        error:
          "Falta la variable de entorno MANYCHAT_API_KEY. Configúrala en Vercel (Project Settings → Environment Variables) y redeploy.",
        texto,
        diagnostico,
      });
    }
    if (!subscriberId) {
      return NextResponse.json({
        ok: false,
        via: "stub",
        error:
          "No hay subscriber_id de ManyChat para este número. ManyChat envía por ID interno, no por número. Guarda el subscriber_id de Libia en config_sistema con clave 'subscriber_" +
          numero +
          "' o pásalo en el campo subscriber_id del sandbox.",
        texto,
        diagnostico,
      });
    }

    // Llamar a ManyChat directo — ignorando defaultMode() a propósito
    let status = 0;
    let respText = "";
    try {
      const r = await fetch(MANYCHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          data: {
            version: "v2",
            content: { type: "whatsapp", messages: [{ type: "text", text: texto }] },
          },
        }),
      });
      status = r.status;
      respText = await r.text();
    } catch (e) {
      return NextResponse.json({
        ok: false,
        via: "manychat",
        error: `Fetch a ManyChat falló: ${(e as Error).message}`,
        texto,
        diagnostico,
      });
    }

    const ok = status >= 200 && status < 300;

    // Loguear el envío manual independientemente del resultado
    await sb.from("conversaciones").insert({
      numero_whatsapp: numero,
      direccion: "saliente",
      texto,
      tipo_mensaje: "texto",
      tool_ejecutada: "seguimiento_manual",
      parametros_tool: {
        tipo: body.tipo ?? "texto_libre",
        via: "manychat",
        http_status: status,
        ok,
        disparado_desde: "dashboard",
      },
    });

    return NextResponse.json({
      ok,
      via: "manychat",
      status,
      respuesta_manychat: respText.slice(0, 500),
      texto,
      diagnostico,
      error: ok ? undefined : `ManyChat respondió ${status}: ${respText.slice(0, 200)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

