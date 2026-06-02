"use client";

import { useState } from "react";
import { useTendencias, type TendenciasDay } from "@/lib/queries";
import { cn, formatMxn } from "@/lib/utils";

type Days = 7 | 30 | 90;

export function Tendencias() {
  const [days, setDays] = useState<Days>(30);
  const { data, isLoading } = useTendencias(days);
  const series = data?.series ?? [];
  const error = data && !data.ok ? data.error : null;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="label-xs">Bloque D · cómo va el bot con el tiempo</div>
          <div className="text-[12px] text-foreground/55 mt-1">
            Acumulado por día · el pipeline y los leads no se borran nunca.
          </div>
        </div>
        <DaysSelector value={days} onChange={setDays} />
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <MiniChart
          title="Leads por día"
          series={series}
          loading={isLoading}
          valueKey="leads"
          color="#88A6C8"
          formatValue={(v) => String(Math.round(v))}
          formatTotal={(t) => `${t} leads en ${days} días`}
        />
        <MiniChart
          title="Facturación por día"
          series={series}
          loading={isLoading}
          valueKey="facturacion"
          color="#8FAE82"
          formatValue={(v) => formatMxn(v)}
          formatTotal={(t) => `${formatMxn(t)} MXN en ${days} días`}
        />
        <MiniChart
          title="Efectividad del bot"
          series={series}
          loading={isLoading}
          valueKey="efectividad"
          color="#C97A8B"
          formatValue={(v) => `${v.toFixed(0)}%`}
          formatTotal={(_t, avg) => `prom. ${avg.toFixed(1)}% sin handoff`}
          asPercent
        />
      </div>
    </section>
  );
}

function DaysSelector({ value, onChange }: { value: Days; onChange: (d: Days) => void }) {
  const opts: Days[] = [7, 30, 90];
  return (
    <div className="inline-flex gap-1 border border-foreground/30 rounded-md p-0.5 bg-cream-50">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "px-3 py-1 text-sm rounded-[5px] transition-colors",
            value === o
              ? "bg-rosey-100 text-foreground border border-rosey-300"
              : "text-foreground/65 hover:bg-cream-100",
          )}
        >
          {o}d
        </button>
      ))}
    </div>
  );
}

function MiniChart({
  title,
  series,
  loading,
  valueKey,
  color,
  formatValue,
  formatTotal,
  asPercent = false,
}: {
  title: string;
  series: TendenciasDay[];
  loading?: boolean;
  valueKey: "leads" | "facturacion" | "efectividad";
  color: string;
  formatValue: (v: number) => string;
  formatTotal: (total: number, avg: number) => string;
  asPercent?: boolean;
}) {
  const values = series.map((s) => s[valueKey]);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length === 0 ? 0 : total / values.length;
  const last = values.length === 0 ? 0 : values[values.length - 1];

  return (
    <div className="rounded-lg border border-foreground/15 bg-cream-50 p-5">
      <div className="label-xs mb-3">{title}</div>
      <div className="flex items-baseline gap-2 mb-1">
        <div className="font-serif-display text-[36px] leading-none">
          {asPercent ? formatValue(last) : formatValue(total)}
        </div>
        <div className="text-[11px] text-foreground/55">
          {asPercent ? "hoy" : "total"}
        </div>
      </div>
      <div className="text-[11px] text-foreground/60 mb-3">
        {formatTotal(total, avg)}
      </div>
      {loading ? (
        <div className="h-[80px] rounded bg-cream-200 animate-pulse" />
      ) : series.length === 0 ? (
        <div className="h-[80px] flex items-center justify-center text-[11px] text-foreground/45 italic">
          Sin datos
        </div>
      ) : (
        <AreaSparkline values={values} color={color} height={80} />
      )}
    </div>
  );
}

function AreaSparkline({
  values,
  color,
  height = 80,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const width = 280;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const pathLine = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const pathArea = `${pathLine} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;
  const lastPoint = points[points.length - 1];

  const gradId = `g-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathArea} fill={`url(#${gradId})`} />
      <path d={pathLine} stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill={color} />
    </svg>
  );
}
