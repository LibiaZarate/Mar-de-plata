"use client";

import { Sparkles } from "lucide-react";
import {
  useAlertasActivas,
  useEfectividadKpi,
  useEmbudoDia,
  useFacturacionKpi,
  useLeadsHoyKpi,
  useLeadsPorCanal,
} from "@/lib/queries";
import { cn, formatMxn } from "@/lib/utils";

export function Inicio() {
  return (
    <div className="px-10 py-6 space-y-6">
      <Greeting />
      <BloqueA />
      <BloqueB />
      <BloqueC />
    </div>
  );
}

function Greeting() {
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return (
    <header className="flex items-start justify-between">
      <div>
        <div className="label-xs">Inicio · vista general</div>
        <h1 className="font-serif-display text-5xl leading-none mt-2">
          {greet}, Mar
        </h1>
        <div className="text-[12px] text-muted-foreground mt-2 capitalize">
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
      <Sparkles className="h-5 w-5 text-primary mt-3" strokeWidth={1.5} />
    </header>
  );
}

function BloqueA() {
  const leads = useLeadsHoyKpi();
  const ef = useEfectividadKpi();
  const fac = useFacturacionKpi();

  return (
    <section>
      <div className="label-xs mb-3">Bloque A · pulso del día</div>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Leads hoy"
          value={leads.data ? String(leads.data.hoy) : "—"}
          sub={
            leads.data
              ? `${leads.data.delta >= 0 ? "↑" : "↓"} ${Math.abs(leads.data.delta)}% vs ayer (${leads.data.ayer})`
              : "—"
          }
          tone={leads.data && leads.data.delta >= 0 ? "up" : "down"}
          loading={leads.isLoading}
          error={leads.error?.message}
        />
        <KpiCard
          label="Efectividad del bot"
          value={ef.data ? `${ef.data.pct.toFixed(1)}%` : "—"}
          sub={ef.data ? `${ef.data.con} de ${ef.data.total} pidieron humano` : "—"}
          tone="neutral"
          loading={ef.isLoading}
          error={ef.error?.message}
        />
        <KpiCard
          label="Facturación hoy"
          value={fac.data ? `${formatMxn(fac.data.facturacion)} MXN` : "—"}
          sub={
            fac.data
              ? `${fac.data.pedidos} pedidos · ticket prom. ${formatMxn(fac.data.ticket)}`
              : "—"
          }
          tone="up"
          highlight
          loading={fac.isLoading}
          error={fac.error?.message}
        />
      </div>
    </section>
  );
}

const CANAL_COLOR: Record<string, string> = {
  Meta: "bg-meta",
  TikTok: "bg-tiktok",
  Grupo: "bg-grupo",
  Recurrente: "bg-recurrente",
  "Orgánico": "bg-organico",
  Organico: "bg-organico",
};

function BloqueB() {
  const fac = useFacturacionKpi();
  const canales = useLeadsPorCanal();
  const alertas = useAlertasActivas();

  return (
    <section>
      <div className="label-xs mb-3">Bloque B · operación de hoy</div>
      <div className="grid grid-cols-4 gap-4">
        <Card title="Facturación hoy">
          <div className="font-serif-display text-3xl leading-none">
            {formatMxn(fac.data?.facturacion ?? 0)}
            <span className="text-sm text-muted-foreground ml-1">MXN</span>
          </div>
          <div className="text-[12px] text-muted-foreground mt-2">
            ticket prom. {formatMxn(fac.data?.ticket ?? 0)}
          </div>
        </Card>
        <Card title="Pedidos cerrados hoy">
          <div className="font-serif-display text-3xl leading-none">
            {fac.data?.pedidos ?? 0}
          </div>
          <div className="text-[12px] text-muted-foreground mt-2">
            cierres registrados manualmente
          </div>
        </Card>
        <Card title="Leads por canal">
          {(canales.data ?? []).length === 0 ? (
            <div className="text-[12px] text-muted-foreground italic mt-2">
              Aún no entran leads hoy.
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {(canales.data ?? []).slice(0, 5).map((r) => {
                const max = Math.max(...(canales.data ?? []).map((x) => x.total), 1);
                return (
                  <li key={r.canal} className="grid grid-cols-[60px_1fr_24px] items-center gap-2">
                    <span className="text-[11px] text-foreground/80 truncate">{r.canal}</span>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full", CANAL_COLOR[r.canal] ?? "bg-organico")} style={{ width: `${(r.total / max) * 100}%` }} />
                    </div>
                    <span className="text-[12px] text-right font-medium">{r.total}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="En tu cancha" highlight>
          <div className="font-serif-display text-5xl leading-none">{alertas.data ?? 0}</div>
          <div className="text-[12px] text-foreground/80 mt-2">alertas pendientes</div>
        </Card>
      </div>
    </section>
  );
}

const ETAPA_COLOR = [
  "bg-meta/40",
  "bg-tiktok/40",
  "bg-recurrente/40",
  "bg-primary/30",
  "bg-recurrente/60",
  "bg-grupo/50",
];

function BloqueC() {
  const e = useEmbudoDia();
  const fac = useFacturacionKpi();
  const etapas = e.data?.etapas ?? [];
  const total = etapas[0]?.count ?? 0;
  const cuello = e.data?.cuello;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div className="label-xs">Bloque C · embudo del día</div>
        {cuello && total > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-recurrente/60 bg-recurrente/10 text-[10px] tracking-[0.14em] uppercase font-medium text-recurrente">
            Cuello de botella · {cuello.from} → {cuello.to}
          </span>
        )}
      </div>

      <Card>
        {e.isLoading ? (
          <div className="h-40 rounded bg-muted animate-pulse" />
        ) : e.error ? (
          <div className="border border-destructive/40 bg-destructive/5 rounded px-3 py-2 text-[12px] text-destructive">
            {e.error.message}
          </div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {etapas.map((etapa, i) => {
                const pct = total === 0 ? 0 : (etapa.count / total) * 100;
                const stepConv =
                  i === 0 || etapas[i - 1].count === 0
                    ? null
                    : Math.round((etapa.count / etapas[i - 1].count) * 100);
                const isCuello =
                  cuello &&
                  i > 0 &&
                  etapas[i - 1].label === cuello.from &&
                  etapa.label === cuello.to;
                return (
                  <div key={etapa.key}>
                    {i > 0 && (
                      <div className="grid grid-cols-[140px_1fr_56px] items-center text-[11px] text-muted-foreground mb-1">
                        <span />
                        <span className={isCuello ? "text-destructive font-medium" : ""}>
                          {stepConv != null
                            ? `↓ ${stepConv}% de la etapa anterior${isCuello ? " · cuello" : ""}`
                            : "—"}
                        </span>
                        <span />
                      </div>
                    )}
                    <li className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
                      <span className="text-[12px] text-foreground/80">{etapa.label}</span>
                      <div className="h-7 rounded bg-muted overflow-hidden">
                        <div
                          className={cn("h-full flex items-center px-3", ETAPA_COLOR[i] ?? "bg-recurrente/40")}
                          style={{ width: total === 0 ? "0%" : `${Math.max(pct, 6)}%` }}
                        >
                          <span className="text-[12px] font-semibold">{etapa.count}</span>
                        </div>
                      </div>
                      <span className="text-[12px] text-muted-foreground text-right">{Math.round(pct)}%</span>
                    </li>
                  </div>
                );
              })}
            </ul>

            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-border">
              <Mini label="Conversión total" value={`${(e.data?.conversion ?? 0).toFixed(1)}%`} />
              <Mini label="Facturación de hoy" value={formatMxn(fac.data?.facturacion ?? 0)} />
              <Mini label="Ticket promedio" value={formatMxn(fac.data?.ticket ?? 0)} />
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function KpiCard({
  label, value, sub, tone, highlight, loading, error,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "up" | "down" | "neutral";
  highlight?: boolean;
  loading?: boolean;
  error?: string;
}) {
  const subColor =
    tone === "up" ? "text-grupo" : tone === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <Card title={label} highlight={highlight}>
      {loading ? (
        <div className="h-12 rounded bg-muted animate-pulse" />
      ) : error ? (
        <div className="text-[12px] text-destructive">{humanize(error)}</div>
      ) : (
        <>
          <div className="font-serif-display text-5xl leading-none">{value}</div>
          <div className={cn("mt-3 text-[12px] font-medium", subColor)}>{sub}</div>
        </>
      )}
    </Card>
  );
}

function Card({
  title, children, highlight,
}: {
  title?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}
    >
      {title && <div className="label-xs mb-3">{title}</div>}
      {children}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-2xl leading-tight mt-1">{value}</div>
    </div>
  );
}

function humanize(m: string): string {
  if (/Failed to fetch|fetch failed|ENOTFOUND/i.test(m))
    return "Sin conexión con Supabase. Revisa .env / red.";
  if (/Invalid API key|JWT/i.test(m))
    return "Credenciales inválidas.";
  if (/permission denied|row-level security|RLS/i.test(m))
    return "RLS bloqueó la lectura — agrega policy SELECT a anon.";
  return m;
}
