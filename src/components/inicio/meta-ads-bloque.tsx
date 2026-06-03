"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/utils";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

type Campaign = {
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
  };
  dashboard: { leads: number; pagados: number; facturacion: number };
  roas: number | null;
  cpl_dashboard: number | null;
};

type CampanasResp = {
  ok: boolean;
  error?: string;
  campaigns?: Campaign[];
  totales?: {
    spend: number;
    impressions: number;
    clicks: number;
    leads_dashboard: number;
    facturacion_dashboard: number;
  };
};

type Insights = {
  resumen_ejecutivo?: string;
  ganadora?: { campana?: string; por_que?: string };
  perdedoras?: { campana?: string; problema?: string; accion?: string }[];
  hook_a_replicar?: string;
  recomendaciones?: string[];
};

export function MetaAdsBloque() {
  const days = 30;
  const { data, isLoading } = useSWR<CampanasResp>(
    `/api/dashboard/meta/campanas?days=${days}`,
    fetcher,
    { refreshInterval: 5 * 60_000 },
  );

  const ok = data?.ok === true;
  const campaigns = data?.campaigns ?? [];
  const totales = data?.totales;
  const conGasto = campaigns.filter((c) => c.meta.spend > 0);
  const top5 = conGasto.slice(0, 5);
  const roasGeneral =
    totales && totales.spend > 0
      ? totales.facturacion_dashboard / totales.spend
      : null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="label-xs">Anuncios de Meta · últimos 30 días</div>
          <div className="font-serif-display text-3xl leading-none mt-1">
            Performance de campañas
          </div>
        </div>
        <a
          href="/configuracion/meta-ads"
          className="text-[12px] text-foreground/55 hover:text-foreground inline-flex items-center gap-1"
        >
          ver todo <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {!ok && !isLoading && (
        <div className="border border-ambr-300 bg-ambr-50 rounded-lg px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-ambr-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-foreground text-sm">
              Meta Ads no está conectado
            </div>
            <div className="text-[12px] text-foreground/70 mt-1">
              {data?.error ?? "Conecta tu cuenta de Meta para ver el desempeño de tus campañas aquí."}{" "}
              <a href="/configuracion/meta-ads" className="text-rosey-500 underline">
                Conectar ahora
              </a>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="h-32 rounded-lg bg-cream-200 animate-pulse" />}

      {ok && totales && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard
              label="Gasto total"
              value={formatMxn(totales.spend)}
              sublabel={`${totales.impressions.toLocaleString("es-MX")} impresiones`}
            />
            <KpiCard
              label="Facturación atribuida"
              value={formatMxn(totales.facturacion_dashboard)}
              sublabel={`${totales.leads_dashboard} leads cerrados`}
            />
            <KpiCard
              label="ROAS general"
              value={roasGeneral !== null ? `${roasGeneral.toFixed(2)}x` : "—"}
              sublabel={
                roasGeneral === null
                  ? "sin datos"
                  : roasGeneral >= 3
                    ? "muy bien"
                    : roasGeneral >= 1
                      ? "rentable"
                      : "perdiendo"
              }
              tone={
                roasGeneral === null
                  ? "neutral"
                  : roasGeneral >= 3
                    ? "good"
                    : roasGeneral >= 1
                      ? "warn"
                      : "bad"
              }
            />
            <KpiCard
              label="Campañas activas"
              value={String(conGasto.length)}
              sublabel={`de ${campaigns.length} totales`}
            />
          </div>

          {top5.length > 0 && (
            <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
              <div className="grid grid-cols-[1.5fr_90px_90px_90px_90px_70px] text-[10px] tracking-wider uppercase text-foreground/55 px-5 py-3 border-b border-foreground/10">
                <div>Campaña</div>
                <div className="text-right">Gasto</div>
                <div className="text-right">Leads</div>
                <div className="text-right">Cerrados</div>
                <div className="text-right">Facturó</div>
                <div className="text-right">ROAS</div>
              </div>
              {top5.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1.5fr_90px_90px_90px_90px_70px] items-center px-5 py-3 border-b border-foreground/10 last:border-0 text-sm hover:bg-cream-100/40"
                >
                  <div className="truncate" title={c.name}>
                    {c.name}
                  </div>
                  <div className="text-right tabular-nums">
                    {formatMxn(c.meta.spend)}
                  </div>
                  <div className="text-right tabular-nums">{c.dashboard.leads}</div>
                  <div className="text-right tabular-nums">
                    {c.dashboard.pagados}
                  </div>
                  <div className="text-right tabular-nums">
                    {c.dashboard.facturacion > 0
                      ? formatMxn(c.dashboard.facturacion)
                      : <span className="text-foreground/40">—</span>}
                  </div>
                  <div className="text-right tabular-nums">
                    <RoasBadge value={c.roas} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <InsightsBlock data={data} />
        </>
      )}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-cream-50 px-4 py-3",
        tone === "good" && "border-sage-300 bg-sage-50/40",
        tone === "warn" && "border-ambr-300 bg-ambr-50/40",
        tone === "bad" && "border-rosey-300 bg-rosey-50/30",
        tone === "neutral" && "border-foreground/15",
      )}
    >
      <div className="text-[10px] tracking-wider uppercase text-foreground/55">
        {label}
      </div>
      <div className="font-serif-display text-2xl leading-none mt-2">{value}</div>
      <div className="text-[11px] text-foreground/55 mt-1">{sublabel}</div>
    </div>
  );
}

function RoasBadge({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-foreground/40 text-[11px]">—</span>;
  const tone =
    value >= 3
      ? "bg-sage-100 text-sage-600"
      : value >= 1
        ? "bg-ambr-100 text-ambr-600"
        : "bg-rosey-100 text-rosey-500";
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-medium", tone)}>
      {value.toFixed(2)}x
    </span>
  );
}

function InsightsBlock({ data }: { data: CampanasResp }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [generadoEn, setGeneradoEn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/meta/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: 30,
          campaigns: data.campaigns,
          totales: data.totales,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Error desconocido");
        return;
      }
      setInsights(d.insights);
      setGeneradoEn(d.generated_at);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-rosey-200 bg-rosey-50/20 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rosey-500" />
          <div className="font-serif-display text-xl leading-none">
            Análisis con IA
          </div>
          {generadoEn && (
            <span className="text-[10px] text-foreground/55">
              generado {new Date(generadoEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <button
          onClick={generar}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {loading ? "Analizando…" : insights ? "Regenerar" : "Analizar campañas"}
        </button>
      </div>

      {!insights && !loading && !error && (
        <div className="text-[12px] text-foreground/65">
          Dale a &ldquo;Analizar campañas&rdquo; para que Claude lea tus métricas y te diga
          cuál fue la ganadora, qué pausar, y qué replicar.
        </div>
      )}

      {error && (
        <div className="text-[12px] text-rosey-500 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="h-3 rounded bg-cream-200 animate-pulse w-3/4" />
          <div className="h-3 rounded bg-cream-200 animate-pulse w-1/2" />
          <div className="h-3 rounded bg-cream-200 animate-pulse w-5/6" />
        </div>
      )}

      {insights && (
        <div className="space-y-4 pt-2">
          {insights.resumen_ejecutivo && (
            <div>
              <div className="label-xs mb-1">Resumen</div>
              <div className="text-[13px] leading-snug">
                {insights.resumen_ejecutivo}
              </div>
            </div>
          )}

          {insights.ganadora?.campana && (
            <div className="rounded border border-sage-300 bg-sage-50/50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase text-sage-600">
                <TrendingUp className="h-3 w-3" /> Ganadora
              </div>
              <div className="font-medium text-sm mt-1">
                {insights.ganadora.campana}
              </div>
              {insights.ganadora.por_que && (
                <div className="text-[12px] text-foreground/70 mt-0.5">
                  {insights.ganadora.por_que}
                </div>
              )}
            </div>
          )}

          {Array.isArray(insights.perdedoras) && insights.perdedoras.length > 0 && (
            <div>
              <div className="label-xs mb-2 flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3 text-rosey-500" />
                A revisar
              </div>
              <div className="space-y-2">
                {insights.perdedoras.map((p, i) => (
                  <div
                    key={i}
                    className="rounded border border-rosey-200 bg-rosey-50/30 px-3 py-2"
                  >
                    <div className="font-medium text-sm">{p.campana}</div>
                    {p.problema && (
                      <div className="text-[12px] text-foreground/70 mt-0.5">
                        Problema: {p.problema}
                      </div>
                    )}
                    {p.accion && (
                      <div className="text-[12px] text-rosey-500 mt-0.5">
                        → {p.accion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.hook_a_replicar && (
            <div>
              <div className="label-xs mb-1">Hook que está jalando</div>
              <div className="text-[13px] leading-snug bg-cream-100 rounded px-3 py-2">
                {insights.hook_a_replicar}
              </div>
            </div>
          )}

          {Array.isArray(insights.recomendaciones) && insights.recomendaciones.length > 0 && (
            <div>
              <div className="label-xs mb-2">Por hacer esta semana</div>
              <ol className="space-y-1.5 list-decimal list-inside text-[13px]">
                {insights.recomendaciones.map((r, i) => (
                  <li key={i} className="leading-snug">
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
