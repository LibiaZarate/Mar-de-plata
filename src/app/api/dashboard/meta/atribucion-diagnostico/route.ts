// Diagnóstico profundo de la cadena de atribución Meta → ManyChat → webhook.
// Mira los últimos N leads que vinieron por Meta y busca señales de
// atribución en distintos sitios donde podrían haber quedado:
//   - leads.anuncio_id
//   - leads.canal_origen
//   - leads.etiquetas (campaign:X, adset:Y, ad:Z, ctwa:W)
//   - conversaciones.parametros_tool (por si el webhook dejó algo raw)
//   - eventos_negocio (por si hay rastro)
//
// Devuelve un veredicto humano + muestras concretas + estado de las
// credenciales de Meta. La idea es que abriéndolo en el navegador
// quede claro de un vistazo cuál es el camino a seguir.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaCreds, metaGet, MetaApiError } from "@/lib/meta/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

type LeadRow = {
  numero_whatsapp: string;
  nombre: string | null;
  canal_origen: string | null;
  anuncio_id: string | null;
  etiquetas: string[] | null;
  primer_contacto: string;
};

type Atribucion = {
  tiene_anuncio_id: boolean;
  tags_campaign: string[];
  tags_adset: string[];
  tags_ad: string[];
  tags_ctwa: string[];
  tags_src: string[];
  cualquier_atribucion: boolean;
};

function analizarLead(l: LeadRow): Atribucion {
  const tags = l.etiquetas ?? [];
  const tags_campaign = tags.filter((t) => t.startsWith("campaign:")).map((t) => t.slice(9));
  const tags_adset = tags.filter((t) => t.startsWith("adset:")).map((t) => t.slice(6));
  const tags_ad = tags.filter((t) => t.startsWith("ad:")).map((t) => t.slice(3));
  const tags_ctwa = tags.filter((t) => t.startsWith("ctwa:")).map((t) => t.slice(5));
  const tags_src = tags.filter((t) => t.startsWith("src:")).map((t) => t.slice(4));
  const tiene_anuncio_id = !!l.anuncio_id;
  const cualquier_atribucion =
    tiene_anuncio_id ||
    tags_campaign.length > 0 ||
    tags_adset.length > 0 ||
    tags_ad.length > 0 ||
    tags_ctwa.length > 0 ||
    tags_src.length > 0;
  return {
    tiene_anuncio_id,
    tags_campaign,
    tags_adset,
    tags_ad,
    tags_ctwa,
    tags_src,
    cualquier_atribucion,
  };
}

export async function GET() {
  try {
    const sb = createAdminClient();

    // 1. Últimos 100 leads que llegaron por canales de Meta (o sin
    // canal definido, que típicamente son CTWA mal reportados).
    const desde = new Date(Date.now() - 60 * 86400_000).toISOString();
    const { data: leadsRaw } = await sb
      .from("leads")
      .select("numero_whatsapp,nombre,canal_origen,anuncio_id,etiquetas,primer_contacto")
      .gte("primer_contacto", desde)
      .or("canal_origen.eq.meta_ctwa,canal_origen.ilike.meta%,canal_origen.ilike.facebook%,canal_origen.ilike.instagram%,canal_origen.is.null")
      .order("primer_contacto", { ascending: false })
      .limit(100);
    const leads = (leadsRaw ?? []) as LeadRow[];

    // 2. Analizar cada lead
    const analisis = leads.map((l) => ({ lead: l, atrib: analizarLead(l) }));

    // 3. Buscar señales en parametros_tool de webhook (raras pero por si)
    const numeros = leads.map((l) => l.numero_whatsapp);
    let conversacionesConRefData = 0;
    if (numeros.length > 0) {
      const { data: convs } = await sb
        .from("conversaciones")
        .select("numero_whatsapp,parametros_tool")
        .in("numero_whatsapp", numeros)
        .not("parametros_tool", "is", null)
        .limit(200);
      for (const c of convs ?? []) {
        const p = c.parametros_tool as Record<string, unknown> | null;
        if (!p) continue;
        const raw = JSON.stringify(p).toLowerCase();
        if (raw.includes("ctwa") || raw.includes("referral") || raw.includes("campaign_id")) {
          conversacionesConRefData++;
        }
      }
    }

    // 4. Contar señales agregadas
    const total = analisis.length;
    const conAnuncioId = analisis.filter((a) => a.atrib.tiene_anuncio_id).length;
    const conCampaign = analisis.filter((a) => a.atrib.tags_campaign.length > 0).length;
    const conAdset = analisis.filter((a) => a.atrib.tags_adset.length > 0).length;
    const conAd = analisis.filter((a) => a.atrib.tags_ad.length > 0).length;
    const conCtwaClid = analisis.filter((a) => a.atrib.tags_ctwa.length > 0).length;
    const conSrcTag = analisis.filter((a) => a.atrib.tags_src.length > 0).length;
    const conCualquierAtrib = analisis.filter((a) => a.atrib.cualquier_atribucion).length;
    const sinNingunaAtrib = total - conCualquierAtrib;

    // 5. Veredicto humano
    let veredicto: string;
    let diagnostico: string;
    let siguiente_paso: string;
    if (total === 0) {
      veredicto = "Sin datos";
      diagnostico = "No hay leads recientes para analizar (últimos 60 días).";
      siguiente_paso = "Esperar tráfico real para hacer el diagnóstico.";
    } else if (conCtwaClid / total > 0.5) {
      veredicto = "Atribución automática FUNCIONANDO";
      diagnostico = `${conCtwaClid} de ${total} leads (${Math.round((conCtwaClid / total) * 100)}%) traen ctwa_clid de Meta. ManyChat está propagando bien.`;
      siguiente_paso = "Solo armar dashboard de atribución leyendo ctwa:* en etiquetas. No hace falta el camino A.";
    } else if (conCampaign / total > 0.3 || conAd / total > 0.3) {
      veredicto = "Atribución parcial";
      diagnostico = `Llegan algunos IDs de campaña/anuncio pero no ctwa_clid. Probablemente ManyChat propaga ad_id como custom field pero no el click ID.`;
      siguiente_paso = "Validar de qué anuncios viene esa atribución y replicar el setup en los anuncios que NO la propagan. Considerar también camino A para canales no-Meta.";
    } else if (conSrcTag / total > 0.3) {
      veredicto = "Atribución manual ya operativa";
      diagnostico = `${conSrcTag} de ${total} traen tags [src:xxx]. Alguien ya está usando el camino A.`;
      siguiente_paso = "Armar el dashboard de atribución y el generador formal de links para escalarlo.";
    } else {
      veredicto = "Sin atribución";
      diagnostico = `De ${total} leads recientes, ${sinNingunaAtrib} no tienen ningún rastro de atribución. ManyChat NO propaga ad_id/campaign_id/ctwa_clid al webhook.`;
      siguiente_paso = "Camino A (generador de links con [src:xxx]) es el único viable hasta que se configure ManyChat correctamente. Mientras: pedir a Mar que pegue el tag en los anuncios.";
    }

    // 6. Muestras concretas (los 5 más recientes, completos)
    const muestras = analisis.slice(0, 5).map(({ lead, atrib }) => ({
      numero: lead.numero_whatsapp,
      nombre: lead.nombre,
      canal: lead.canal_origen,
      anuncio_id: lead.anuncio_id,
      etiquetas: lead.etiquetas,
      atribucion_detectada: atrib.cualquier_atribucion ? "sí" : "no",
      primer_contacto: lead.primer_contacto,
    }));

    // 7. Estado de Meta API
    const creds = await getMetaCreds();
    type MetaEstado = {
      token_configurado: boolean;
      ad_account_id_configurado: boolean;
      conexion_ok: boolean;
      error?: string;
      campañas_activas_meta?: { id: string; name: string; status: string }[];
      info_account?: { name: string; account_status: string };
    };
    const metaEstado: MetaEstado = {
      token_configurado: !!creds.token,
      ad_account_id_configurado: !!creds.adAccountId,
      conexion_ok: false,
    };
    if (creds.token) {
      try {
        const adAccountId = creds.adAccountId
          ? (creds.adAccountId.startsWith("act_") ? creds.adAccountId : `act_${creds.adAccountId}`)
          : null;
        if (adAccountId) {
          const account = await metaGet<{ name: string; account_status: number }>(
            `/${adAccountId}`,
            { fields: "name,account_status" },
          );
          metaEstado.conexion_ok = true;
          metaEstado.info_account = {
            name: account.name,
            account_status: String(account.account_status),
          };
          const camps = await metaGet<{
            data: { id: string; name: string; status: string }[];
          }>(`/${adAccountId}/campaigns`, {
            fields: "id,name,status",
            limit: "10",
            effective_status: '["ACTIVE","PAUSED"]',
          });
          metaEstado.campañas_activas_meta = camps.data;
        }
      } catch (e) {
        const err = e as MetaApiError;
        metaEstado.error = `${err.status}: ${err.message}`;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        veredicto,
        diagnostico,
        siguiente_paso_recomendado: siguiente_paso,
        ventana_dias: 60,
        senales: {
          total_leads_analizados: total,
          con_anuncio_id: conAnuncioId,
          con_campaign_tag: conCampaign,
          con_adset_tag: conAdset,
          con_ad_tag: conAd,
          con_ctwa_clid_tag: conCtwaClid,
          con_src_tag_manual: conSrcTag,
          con_cualquier_atribucion: conCualquierAtrib,
          sin_ninguna_atribucion: sinNingunaAtrib,
          conversaciones_con_referral_raw: conversacionesConRefData,
        },
        muestras_5_recientes: muestras,
        meta_api: metaEstado,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500, headers: NO_STORE },
    );
  }
}
