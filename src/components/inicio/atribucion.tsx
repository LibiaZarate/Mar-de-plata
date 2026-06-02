"use client";

import { useState } from "react";
import { useTopAnuncios } from "@/lib/queries";
import { cn, formatMxn } from "@/lib/utils";
import { ExternalLink, TrendingUp } from "lucide-react";

type Days = 7 | 30 | 90;

export function Atribucion() {
  const [days, setDays] = useState<Days>(30);
  const { data, isLoading } = useTopAnuncios(days);
  const anuncios = data?.anuncios ?? [];
  const error = data && !data.ok ? data.error : null;

  const totalLeads = anuncios.reduce((s, a) => s + a.leads, 0);
  const totalFact = anuncios.reduce((s, a) => s + a.facturacion, 0);

  return (
    <section>
      <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="label-xs">Bloque E · atribución de anuncios</div>
          <div className="text-[12px] text-foreground/55 mt-1">
            Qué anuncios de Meta están trayendo más leads y cerrando más venta.
          </div>
        </div>
        <DaysSelector value={days} onChange={setDays} />
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
        <div className="grid grid-cols-[2fr_90px_90px_140px_90px] text-[10px] tracking-wider uppercase text-foreground/55 px-5 py-3 border-b border-foreground/10">
          <div>Anuncio</div>
          <div className="text-right">Leads</div>
          <div className="text-right">Pagados</div>
          <div className="text-right">Facturación</div>
          <div className="text-right">Conv. %</div>
        </div>

        {isLoading ? (
          <div className="px-5 py-6 space-y-2">
            <div className="h-3 bg-cream-200 rounded animate-pulse" />
            <div className="h-3 bg-cream-200 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-cream-200 rounded animate-pulse w-1/2" />
          </div>
        ) : anuncios.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {anuncios.slice(0, 5).map((a, i) => (
              <AdRowItem
                key={a.anuncio_id}
                ad={a}
                rank={i + 1}
                maxLeads={anuncios[0]?.leads ?? 1}
              />
            ))}
            {anuncios.length > 5 && (
              <div className="px-5 py-3 text-center text-[11px] text-foreground/55 border-t border-foreground/10 bg-cream-100/50">
                + {anuncios.length - 5} anuncios más · drill-down próximamente
              </div>
            )}
            <div className="grid grid-cols-[2fr_90px_90px_140px_90px] text-[11px] px-5 py-3 border-t border-foreground/10 bg-cream-100/40 font-medium">
              <div className="text-foreground/70">Total ({days}d)</div>
              <div className="text-right">{totalLeads}</div>
              <div className="text-right">
                {anuncios.reduce((s, a) => s + a.pagados, 0)}
              </div>
              <div className="text-right">{formatMxn(totalFact)}</div>
              <div className="text-right text-foreground/55">—</div>
            </div>
          </>
        )}
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

function AdRowItem({
  ad,
  rank,
  maxLeads,
}: {
  ad: ReturnType<typeof useTopAnuncios>["data"] extends infer T
    ? T extends { anuncios: infer A }
      ? A extends Array<infer R>
        ? R
        : never
      : never
    : never;
  rank: number;
  maxLeads: number;
}) {
  const widthLeads = (ad.leads / Math.max(maxLeads, 1)) * 100;
  return (
    <div className="grid grid-cols-[2fr_90px_90px_140px_90px] items-center px-5 py-3 border-b border-foreground/10 last:border-0 text-sm hover:bg-cream-100/40">
      <div className="min-w-0 pr-3">
        <div className="flex items-center gap-2">
          <span className="font-serif-display text-[18px] leading-none text-foreground/55 w-5">
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] text-foreground/85 truncate">
              {ad.anuncio_id}
            </div>
            {ad.campaign_id && (
              <div className="text-[10px] text-foreground/55 truncate">
                campaña <span className="font-mono">{ad.campaign_id}</span>
              </div>
            )}
          </div>
        </div>
        <div className="h-1 rounded-full bg-cream-200 overflow-hidden mt-1.5 ml-7">
          <div
            className="h-full bg-skyy-300"
            style={{ width: `${Math.max(widthLeads, 3)}%` }}
          />
        </div>
      </div>
      <div className="text-right tabular-nums">{ad.leads}</div>
      <div className="text-right tabular-nums">{ad.pagados}</div>
      <div className="text-right tabular-nums">
        {ad.facturacion > 0 ? (
          <span className="font-medium">{formatMxn(ad.facturacion)}</span>
        ) : (
          <span className="text-foreground/40">—</span>
        )}
      </div>
      <div className="text-right tabular-nums">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-medium",
            ad.conversion_pct >= 20
              ? "bg-sage-100 text-sage-600"
              : ad.conversion_pct >= 5
                ? "bg-ambr-100 text-ambr-600"
                : "text-foreground/55",
          )}
        >
          {ad.conversion_pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-10 text-center space-y-3">
      <TrendingUp
        className="h-8 w-8 mx-auto text-foreground/30"
        strokeWidth={1.3}
      />
      <div className="font-italic-serif text-rosey-400 text-lg">
        No hay leads con atribución de anuncio todavía
      </div>
      <p className="text-[12px] text-foreground/65 leading-relaxed max-w-md mx-auto">
        Para que los leads lleguen con el ID del anuncio de Meta, tus anuncios{" "}
        <strong>Click to WhatsApp</strong> deben configurar el <em>Postback
        Payload</em> con{" "}
        <code className="text-[11px] bg-cream-100 px-1.5 py-0.5 rounded">
          campaign_id={"{{campaign.id}}"}&ad_id={"{{ad.id}}"}
        </code>
        .
      </p>
      <a
        href="https://www.facebook.com/business/help/2330002180146034"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[12px] text-rosey-500 hover:text-rosey-600"
      >
        Cómo configurar Click to WhatsApp en Meta
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
