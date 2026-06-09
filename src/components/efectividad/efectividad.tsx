"use client";

import { useState } from "react";
import useSWR from "swr";
import { cn, formatMxn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type Range = "hoy" | "7d" | "30d" | "total";

type Resp = {
  ok: boolean;
  range: Range;
  hero: {
    conversaciones_atendidas: number;
    dormidos_recuperados: { recuperados: number; total: number };
    roas_promedio: number | null;
    facturacion_total: number;
  };
  metricas_7: {
    m01_conversaciones: number;
    m02_efectividad_pct: number;
    m03_cobertura_seguimiento_pct: number;
    m04_recuperacion_pct: number;
    m05_embudo: {
      etapas: { key: string; label: string; count: number }[];
      cuello: { from: string; to: string; fuga_pp: number } | null;
    };
    m06_pedidos_por_canal: {
      canal: string;
      leads: number;
      pagados: number;
      facturacion: number;
    }[];
    m07_primera_respuesta_segs: number | null;
  };
  seguimientos: {
    total_hechos: number;
    cobertura_pct: number;
    recuperacion_pct: number;
    por_tipo: { tipo: string; count: number }[];
  };
};

type CampaignsResp = {
  ok: boolean;
  ads?: Array<{
    id: string;
    name: string;
    meta: { spend: number };
    dashboard: { leads: number; pagados: number; facturacion: number };
    roas: number | null;
  }>;
};

export function EfectividadView() {
  const [range, setRange] = useState<Range>("30d");
  const { data, isLoading } = useSWR<Resp>(
    `/api/dashboard/efectividad?range=${range}`,
    fetcher,
    { refreshInterval: 60_000 },
  );
  const { data: meta } = useSWR<CampaignsResp>(
    "/api/dashboard/meta/campanas?days=30",
    fetcher,
    { refreshInterval: 5 * 60_000, revalidateOnFocus: false },
  );

  return (
    <div className="px-10 py-6 space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-xs">Inicio · efectividad</div>
          <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
            Lo que el sistema te está dando
          </h1>
          <div className="text-[13px] text-foreground/60 mt-2 max-w-2xl">
            Ver el beneficio, no solo el dato. Conversaciones atendidas, leads dormidos
            recuperados, anuncios que valen la pena y el cuello del embudo — todo
            sobre la data real, sin tags manuales.
          </div>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <HeroSection data={data} loading={isLoading} />

      <MetricasSiete data={data} loading={isLoading} />

      <SeguimientosBlock data={data} loading={isLoading} />

      <AnunciosBlock ads={meta?.ads} />

      <EmbudoBlock data={data?.metricas_7?.m05_embudo} />
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const opts: Range[] = ["hoy", "7d", "30d", "total"];
  const label: Record<Range, string> = {
    hoy: "Hoy",
    "7d": "7 días",
    "30d": "30 días",
    total: "Total",
  };
  return (
    <div className="flex items-center gap-1 border border-foreground/15 rounded-md p-0.5 bg-cream-50">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "text-[12px] px-3 py-1 rounded-md",
            value === o
              ? "bg-foreground text-cream-50"
              : "hover:bg-cream-100 text-foreground/65",
          )}
        >
          {label[o]}
        </button>
      ))}
    </div>
  );
}

function HeroSection({ data, loading }: { data?: Resp; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-cream-200 animate-pulse" />
        ))}
      </div>
    );
  }
  const h = data.hero;
  return (
    <div className="grid grid-cols-3 gap-4">
      <HeroCard
        big={`${h.conversaciones_atendidas.toLocaleString("es-MX")}`}
        label="conversaciones atendidas"
        sub="por Sirena · sin saturar a nadie"
        tone="sage"
      />
      <HeroCard
        big={`${h.dormidos_recuperados.recuperados} → ${h.dormidos_recuperados.total}`}
        label="leads dormidos recuperados"
        sub={
          h.dormidos_recuperados.total === 0
            ? "sin secuencias activadas aún"
            : "por seguimiento · llegaron a respuesta / pedido"
        }
        tone="rosey"
      />
      <HeroCard
        big={h.facturacion_total > 0 ? formatMxn(h.facturacion_total) : "$0"}
        label="facturación del periodo"
        sub={h.roas_promedio ? `ROAS ${h.roas_promedio.toFixed(1)}×` : "atribuida al sistema"}
        tone="ambr"
      />
    </div>
  );
}

function HeroCard({
  big,
  label,
  sub,
  tone,
}: {
  big: string;
  label: string;
  sub: string;
  tone: "sage" | "rosey" | "ambr";
}) {
  const cls: Record<typeof tone, string> = {
    sage: "border-sage-300 bg-sage-50/40",
    rosey: "border-rosey-300 bg-rosey-50/40",
    ambr: "border-ambr-300 bg-ambr-50/40",
  };
  return (
    <div className={cn("rounded-lg border px-5 py-4", cls[tone])}>
      <div className="font-serif-display text-[44px] leading-none mb-2">{big}</div>
      <div className="text-[13px] font-medium">{label}</div>
      <div className="text-[11px] text-foreground/55 italic mt-0.5">{sub}</div>
    </div>
  );
}

function MetricasSiete({ data, loading }: { data?: Resp; loading: boolean }) {
  return (
    <section>
      <div className="label-xs mb-3">Las 7 métricas que mueven la aguja</div>
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
        <Metrica
          numero="01"
          titulo="Conversaciones"
          valor={loading ? "—" : data?.metricas_7.m01_conversaciones.toLocaleString("es-MX") ?? "0"}
          hint="demanda real que llegó"
        />
        <Metrica
          numero="02"
          titulo="Efectividad del bot"
          valor={loading ? "—" : `${data?.metricas_7.m02_efectividad_pct.toFixed(1) ?? 0}%`}
          hint="sin pasar a persona"
        />
        <Metrica
          numero="03"
          titulo="Cobertura de seguimiento"
          valor={loading ? "—" : `${data?.metricas_7.m03_cobertura_seguimiento_pct.toFixed(1) ?? 0}%`}
          hint="programados que sí salieron"
        />
        <Metrica
          numero="04"
          titulo="% de recuperación"
          valor={loading ? "—" : `${data?.metricas_7.m04_recuperacion_pct.toFixed(1) ?? 0}%`}
          hint="seguimientos que rescataron"
        />
        <Metrica
          numero="05"
          titulo="Conversión a pedido"
          valor={loading ? "—" : conversionAPedido(data?.metricas_7.m05_embudo.etapas)}
          hint="entró → pagada"
        />
        <Metrica
          numero="06"
          titulo="Pedidos por canal"
          valor={
            loading
              ? "—"
              : data?.metricas_7.m06_pedidos_por_canal?.[0]
                ? data.metricas_7.m06_pedidos_por_canal[0].canal
                : "—"
          }
          hint={
            data?.metricas_7.m06_pedidos_por_canal?.[0]
              ? `${data.metricas_7.m06_pedidos_por_canal[0].pagados} pedidos`
              : "sin pedidos atribuidos"
          }
        />
        <Metrica
          numero="07"
          titulo="Tiempo 1ª respuesta"
          valor={
            loading
              ? "—"
              : data?.metricas_7.m07_primera_respuesta_segs
                ? formatSecs(data.metricas_7.m07_primera_respuesta_segs)
                : "—"
          }
          hint="mediana"
        />
      </div>
    </section>
  );
}

function Metrica({
  numero,
  titulo,
  valor,
  hint,
}: {
  numero: string;
  titulo: string;
  valor: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-foreground/15 bg-cream-50 px-4 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] tracking-widest text-foreground/40">{numero}</span>
        <span className="font-serif-display text-[26px] leading-none">{valor}</span>
      </div>
      <div className="text-[12px] font-medium">{titulo}</div>
      <div className="text-[10px] text-foreground/50 italic mt-0.5">{hint}</div>
    </div>
  );
}

function SeguimientosBlock({ data, loading }: { data?: Resp; loading: boolean }) {
  if (loading || !data) return null;
  const s = data.seguimientos;
  return (
    <section className="rounded-lg border border-rosey-200 bg-rosey-50/30 px-5 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="label-xs">Seguimientos · §03.2</div>
          <h2 className="font-serif-display text-[24px] mt-1">
            Donde se gana o se pierde la mayoría
          </h2>
        </div>
        <div className="text-[11px] text-foreground/55 italic max-w-md text-right">
          Mide lo que el sistema sí controla: cuántos se hicieron, cuántos llegaron,
          y de ahí cuántos despertaron respuesta o pedido.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <BigStat
          numero="01"
          label="cuántos se hicieron"
          valor={s.total_hechos.toLocaleString("es-MX")}
          sub="seguimientos enviados"
        />
        <BigStat
          numero="02"
          label="cobertura"
          valor={`${s.cobertura_pct.toFixed(1)}%`}
          sub="de los que les tocaba"
        />
        <BigStat
          numero="03"
          label="% de recuperación"
          valor={`${s.recuperacion_pct.toFixed(1)}%`}
          sub="generaron respuesta o pedido"
        />
      </div>

      {s.por_tipo.length > 0 && (
        <div className="mt-4">
          <div className="label-xs mb-2">Distribución por tipo</div>
          <div className="flex flex-wrap gap-2">
            {s.por_tipo.map((t) => (
              <span
                key={t.tipo}
                className="text-[11px] px-2 py-1 rounded-md border border-foreground/15 bg-cream-50"
              >
                <span className="font-mono mr-1.5">{t.tipo}</span>
                <span className="font-medium">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BigStat({
  numero,
  label,
  valor,
  sub,
}: {
  numero: string;
  label: string;
  valor: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-foreground/15 bg-cream-50 px-4 py-3">
      <div className="text-[10px] tracking-widest text-foreground/40 mb-1">{numero}</div>
      <div className="font-serif-display text-[36px] leading-none mb-1">{valor}</div>
      <div className="text-[12px] font-medium">{label}</div>
      <div className="text-[11px] text-foreground/55 italic mt-0.5">{sub}</div>
    </div>
  );
}

function AnunciosBlock({ ads }: { ads?: CampaignsResp["ads"] }) {
  const lista = (ads ?? [])
    .filter((a) => (a.meta?.spend ?? 0) > 0)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
    .slice(0, 8);
  if (lista.length === 0) {
    return (
      <section>
        <div className="label-xs mb-3">ROAS por anuncio · 30 días</div>
        <div className="rounded-md border border-dashed border-foreground/15 bg-cream-50 px-4 py-8 text-center text-[12px] text-foreground/50 italic">
          Sin gasto atribuible en los últimos 30 días — o atribución todavía no llega.
        </div>
      </section>
    );
  }
  const maxRoas = Math.max(...lista.map((a) => Math.max(a.roas ?? 0, 1.5)));
  return (
    <section>
      <div className="label-xs mb-3">ROAS por anuncio · 30 días</div>
      <div className="rounded-md border border-foreground/15 bg-cream-50 p-4 space-y-2">
        {lista.map((ad) => {
          const roas = ad.roas ?? 0;
          const pct = Math.min(100, (roas / maxRoas) * 100);
          const color =
            roas >= 4
              ? "bg-sage-400"
              : roas >= 2
                ? "bg-skyy-400"
                : roas >= 1
                  ? "bg-ambr-400"
                  : "bg-rosey-400";
          return (
            <div key={ad.id} className="text-[12px]">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="truncate flex-1" title={ad.name}>{ad.name}</span>
                <span className="font-mono">
                  {roas.toFixed(1)}× · {formatMxn(ad.meta.spend)} spend ·{" "}
                  {formatMxn(ad.dashboard.facturacion)} facturado
                </span>
              </div>
              <div className="h-2.5 bg-cream-200 rounded">
                <div className={cn("h-full rounded", color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t border-foreground/10 text-[10px] text-foreground/50 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-sage-400" /> ≥4× · sube presupuesto
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-skyy-400" /> 2–4× · mantén
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-ambr-400" /> 1–2× · revisa
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-rosey-400" /> &lt;1× · apaga
          </span>
        </div>
      </div>
    </section>
  );
}

function EmbudoBlock({
  data,
}: {
  data?: { etapas: { key: string; label: string; count: number }[]; cuello: { from: string; to: string; fuga_pp: number } | null };
}) {
  if (!data) return null;
  const etapas = data.etapas;
  const max = etapas[0]?.count ?? 0;
  return (
    <section>
      <div className="label-xs mb-3">Embudo · con detección de cuello</div>
      <div className="rounded-md border border-foreground/15 bg-cream-50 p-4 space-y-2">
        {etapas.map((e, i) => {
          const pct = max === 0 ? 0 : (e.count / max) * 100;
          const esCuello = data.cuello && data.cuello.from === e.label;
          return (
            <div key={e.key} className="text-[12px]">
              <div className="flex items-baseline justify-between mb-1">
                <span className={cn("font-medium", esCuello && "text-rosey-600")}>
                  {e.label} {esCuello && <span className="text-[10px] uppercase ml-1">· cuello</span>}
                </span>
                <span className="font-mono">
                  {e.count}{" "}
                  {i > 0 && max > 0 && (
                    <span className="text-foreground/45">
                      ({pct.toFixed(0)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 bg-cream-200 rounded">
                <div
                  className={cn(
                    "h-full rounded",
                    esCuello ? "bg-rosey-300" : "bg-foreground/30",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.cuello && (
          <div className="pt-3 mt-2 border-t border-foreground/10 text-[11px] text-foreground/55">
            Cuello detectado · de cada 100 que entran, se cae {data.cuello.fuga_pp.toFixed(0)}{" "}
            puntos entre <span className="font-medium">{data.cuello.from}</span> y{" "}
            <span className="font-medium">{data.cuello.to}</span>.
          </div>
        )}
      </div>
    </section>
  );
}

function conversionAPedido(
  etapas?: { key: string; count: number }[],
): string {
  if (!etapas) return "—";
  const entro = etapas.find((e) => e.key === "entro")?.count ?? 0;
  const pagada = etapas.find((e) => e.key === "pagada")?.count ?? 0;
  if (entro === 0) return "0%";
  return `${((pagada / entro) * 100).toFixed(1)}%`;
}

function formatSecs(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${Math.round(s / 3600)}h`;
}
