// Análisis con IA del rendimiento de campañas de Meta Ads.
// Recibe los datos de /api/dashboard/meta/campanas (vía POST para
// evitar refetch del Meta API) y le pide a Haiku que diga qué
// funcionó, qué no, y cómo replicarlo.

import { NextRequest, NextResponse } from "next/server";
import { chat, isDemoMode, MODELS } from "@/lib/agent/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CampaignSummary = {
  id: string;
  name: string;
  objective?: string;
  effective_status?: string;
  meta: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    reach?: number;
  };
  dashboard: { leads: number; pagados: number; facturacion: number };
  roas: number | null;
  cpl_dashboard: number | null;
};

type Body = {
  days: number;
  campaigns: CampaignSummary[];
  totales: {
    spend: number;
    impressions: number;
    clicks: number;
    leads_dashboard: number;
    facturacion_dashboard: number;
  };
};

const SYSTEM_PROMPT = `Eres una analista de marketing experta en performance ads para PyMEs mexicanas (joyería de plata 925). Tu cliente es Mar de Plata Taxco. Tu trabajo es leer las métricas de campañas de Meta Ads cruzadas con las ventas reales del dashboard, y darle a Mar (no técnica) un resumen accionable.

Tono: cálido, directo, sin jerga innecesaria. Habla "a Mar", no "a un equipo". Usa pesos mexicanos (formato $X,XXX MXN). Responde SOLO en JSON con esta estructura:

{
  "resumen_ejecutivo": "1-2 frases sobre el estado general (¿estamos ganando, perdiendo, qué tan eficiente está siendo el gasto?)",
  "ganadora": { "campana": "nombre", "por_que": "explica en 1-2 frases por qué es la mejor — ROAS, leads, CPL, etc." },
  "perdedoras": [{ "campana": "nombre", "problema": "qué está mal", "accion": "qué hacer (pausar, optimizar, reducir presupuesto)" }],
  "hook_a_replicar": "¿Qué patrón se ve en los nombres/objetivos de las campañas que mejor convierten? Sugiere qué ángulo creativo replicar (ej. 'mensajes con énfasis en mayoreo + descuento explícito están funcionando 3x mejor que los genéricos').",
  "recomendaciones": ["3 acciones concretas, priorizadas, que Mar puede hacer esta semana"]
}

Reglas:
- Si una campaña tiene gasto pero 0 leads en el dashboard, marca como perdedora.
- Si ROAS < 1, marca como perdedora (gasta más de lo que trae).
- Si ROAS > 3, marca como ganadora.
- Si los datos son insuficientes (campañas muy nuevas, <$500 gastados), dilo en resumen_ejecutivo.
- NO inventes campañas. Solo habla de las que vienen en los datos.`;

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({
      ok: false,
      error: "Análisis con IA requiere OPENROUTER_API_KEY configurada.",
    });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body.campaigns || body.campaigns.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No hay campañas para analizar.",
      });
    }

    // Resumimos solo lo relevante para no quemar tokens.
    const compact = body.campaigns
      .filter((c) => c.meta.spend > 0)
      .slice(0, 25)
      .map((c) => ({
        nombre: c.name,
        objetivo: c.objective,
        estado: c.effective_status,
        gasto_mxn: Math.round(c.meta.spend),
        impresiones: c.meta.impressions,
        clicks: c.meta.clicks,
        ctr_pct: Number(c.meta.ctr.toFixed(2)),
        cpc_mxn: Number(c.meta.cpc.toFixed(2)),
        leads_atribuidos: c.dashboard.leads,
        cerrados: c.dashboard.pagados,
        facturacion_mxn: Math.round(c.dashboard.facturacion),
        roas: c.roas ? Number(c.roas.toFixed(2)) : null,
        cpl_real_mxn: c.cpl_dashboard ? Math.round(c.cpl_dashboard) : null,
      }));

    const userPrompt = `## Datos de Meta Ads · últimos ${body.days} días

**Totales:**
- Gasto total: $${Math.round(body.totales.spend).toLocaleString("es-MX")} MXN
- Impresiones: ${body.totales.impressions.toLocaleString("es-MX")}
- Clicks: ${body.totales.clicks.toLocaleString("es-MX")}
- Leads atribuidos: ${body.totales.leads_dashboard}
- Facturación de esos leads: $${Math.round(body.totales.facturacion_dashboard).toLocaleString("es-MX")} MXN
- ROAS general: ${body.totales.spend > 0 ? (body.totales.facturacion_dashboard / body.totales.spend).toFixed(2) : "—"}x

**Campañas con gasto:**
${JSON.stringify(compact, null, 2)}

Analiza y responde en JSON según el formato indicado.`;

    const resp = await chat({
      model: MODELS.verificador, // Haiku 4.5
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 1200,
      responseFormat: "json_object",
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    let insights: Record<string, unknown>;
    try {
      insights = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      insights = { resumen_ejecutivo: "Error parseando respuesta del modelo.", raw };
    }

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      insights,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
