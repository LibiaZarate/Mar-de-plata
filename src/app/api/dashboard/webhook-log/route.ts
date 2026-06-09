// Lee webhook_log de Supabase con un análisis automático de qué
// campos de atribución traen los últimos N webhooks.
// Sirve para decidir, una vez en producción, si la atribución de
// Meta llega automática o no.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPOS_ATRIBUCION = [
  "referral",
  "ref",
  "ad_id",
  "fb_ad_id",
  "campaign_id",
  "fb_campaign_id",
  "adset_id",
  "fb_adset_id",
  "ctwa_clid",
  "source_url",
  "last_referrer",
  "referral_source",
];

const CAMPOS_IDENTIDAD = [
  "name",
  "first_name",
  "last_name",
  "email",
  "whatsapp_phone",
  "phone",
  "ig_id",
  "id",
];

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") ?? 30),
      100,
    );
    const numero = req.nextUrl.searchParams.get("numero");

    const sb = createAdminClient();
    let q = sb
      .from("webhook_log")
      .select(
        "id,received_at,source,numero_whatsapp,subscriber_id,tipo_mensaje,texto_corto,guardrail_hit,tool_ejecutada,flow_ok,flow_error,raw_body,cleaned,flow_resumen",
      )
      .order("received_at", { ascending: false })
      .limit(limit);
    if (numero) q = q.eq("numero_whatsapp", numero.replace(/\D/g, ""));

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const entries = data ?? [];

    // Análisis: qué campos de atribución vienen en los raw_body
    const cuentaAtribucion = Object.fromEntries(CAMPOS_ATRIBUCION.map((c) => [c, 0]));
    const cuentaIdentidad = Object.fromEntries(CAMPOS_IDENTIDAD.map((c) => [c, 0]));
    let conCualquierAtribucion = 0;
    let conNombre = 0;

    for (const e of entries) {
      const raw = (e.raw_body ?? {}) as Record<string, unknown>;
      let tieneAtrib = false;
      for (const c of CAMPOS_ATRIBUCION) {
        const v = raw[c];
        if (v != null && v !== "" && v !== "{{" + c + "}}") {
          cuentaAtribucion[c] += 1;
          tieneAtrib = true;
        }
      }
      if (tieneAtrib) conCualquierAtribucion += 1;
      for (const c of CAMPOS_IDENTIDAD) {
        const v = raw[c];
        if (v != null && v !== "" && v !== "{{" + c + "}}") {
          cuentaIdentidad[c] += 1;
        }
      }
      const tieneNombre =
        !!(raw.name as string) ||
        !!(raw.first_name as string) ||
        !!(raw.last_name as string);
      if (tieneNombre) conNombre += 1;
    }

    const total = entries.length;
    const veredicto =
      total === 0
        ? "Sin webhooks persistidos todavía"
        : conCualquierAtribucion / total > 0.5
          ? `Atribución llegando en ${conCualquierAtribucion}/${total} webhooks. ManyChat propaga.`
          : `Solo ${conCualquierAtribucion}/${total} webhooks traen atribución. ManyChat NO está propagando los campos clave.`;

    return NextResponse.json({
      ok: true,
      total_webhooks: total,
      veredicto,
      campos_atribucion_presentes: cuentaAtribucion,
      campos_identidad_presentes: cuentaIdentidad,
      con_cualquier_atribucion: conCualquierAtribucion,
      con_nombre: conNombre,
      entries: entries.map((e) => ({
        id: e.id,
        received_at: e.received_at,
        source: e.source,
        numero: e.numero_whatsapp,
        texto: e.texto_corto,
        tool: e.tool_ejecutada,
        flow_ok: e.flow_ok,
        flow_error: e.flow_error,
        // Campos crudos clave (los que importan para atribución)
        raw_claves: extraerClavesAtribucion(e.raw_body as Record<string, unknown>),
        // El raw_body completo lo dejamos accesible aparte
        raw_body: e.raw_body,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

function extraerClavesAtribucion(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of [...CAMPOS_ATRIBUCION, ...CAMPOS_IDENTIDAD]) {
    if (raw[c] != null && raw[c] !== "") out[c] = raw[c];
  }
  return out;
}
