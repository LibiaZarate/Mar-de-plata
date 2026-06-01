"use client";

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
    <div className="px-10 py-6 space-y-6 bg-background">
      <TopHeader />
      <BloqueA />
      <BloqueB />
      <BloqueC />
    </div>
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={cn("text-rosey-300", className)}>
      <path
        d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TopHeader() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const today = new Date()
    .toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        <div className="label-xs">Inicio · vista general</div>
        <h1 className="font-serif-display text-[64px] leading-[1.05] mt-2">
          {greet}, Mar
        </h1>
        <div className="text-[13px] text-foreground/60 mt-2">{today}</div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Sparkle className="mr-2" />
        <button className="btn-outline">
          <span className="font-mono text-[11px] tracking-tight">⌘K</span>
          <span>Buscar</span>
        </button>
        <button className="btn-rose">Registrar pedido</button>
        <div className="relative">
          <div className="w-9 h-9 rounded-full border border-foreground/30 flex items-center justify-center bg-cream-50">
            <div className="w-5 h-5 rounded-full bg-rosey-200" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rosey-400 border border-cream-50" />
        </div>
      </div>
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
        <CardKpi
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
        <CardKpi
          label="Efectividad del bot"
          value={ef.data ? `${ef.data.pct.toFixed(1)}%` : "—"}
          sub={ef.data ? `${ef.data.con} de ${ef.data.total} pidieron humano` : "—"}
          tone="neutral"
          loading={ef.isLoading}
          error={ef.error?.message}
        />
        <CardKpi
          label="Facturación hoy"
          value={fac.data ? `${formatMxn(fac.data.facturacion)}` : "—"}
          valueUnit="MXN"
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
  Meta: "bg-skyy-300",
  TikTok: "bg-lila-300",
  Grupo: "bg-sage-300",
  Recurrente: "bg-ambr-300",
  "Orgánico": "bg-foreground/40",
  Organico: "bg-foreground/40",
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
          <div className="font-serif-display text-[42px] leading-none">
            {formatMxn(fac.data?.facturacion ?? 0)}
            <span className="text-sm text-foreground/60 ml-2 font-sans">MXN</span>
          </div>
          <div className="mt-3 text-[12px] text-sage-500">
            ↑ 18% vs prom. 7 días · ticket prom. {formatMxn(fac.data?.ticket ?? 0)}
          </div>
        </Card>

        <Card title="Pedidos cerrados hoy">
          <div className="flex items-baseline gap-2">
            <div className="font-serif-display text-[42px] leading-none">
              {fac.data?.pedidos ?? 0}
            </div>
            <div className="text-sm text-foreground/60">tickets</div>
          </div>
          <div className="mt-3 text-[12px] text-foreground/60">
            cierres registrados manualmente
          </div>
        </Card>

        <Card title="Leads por canal">
          {(canales.data ?? []).length === 0 ? (
            <div className="text-[12px] text-foreground/55 italic mt-2">
              Aún no entran leads hoy.
            </div>
          ) : (
            <>
              <div className="font-serif-display text-[42px] leading-none">
                {(canales.data ?? []).reduce((s, r) => s + r.total, 0)}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-foreground/80">
                {(canales.data ?? []).slice(0, 4).map((r) => (
                  <li key={r.canal} className="flex items-center gap-2">
                    <i className={cn("w-2 h-2 rounded-sm", CANAL_COLOR[r.canal] ?? "bg-foreground/40")} />
                    {r.canal} <span className="text-foreground/55">{r.total}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="En tu cancha ahora" highlight>
          <div className="flex items-start justify-between">
            <div className="font-serif-display text-[42px] leading-none">
              {alertas.data ?? 0}
            </div>
            <div className="text-right">
              <div className="font-italic-serif text-rosey-500 text-sm leading-tight">
                requiere<br />humano →
              </div>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-foreground/80 leading-snug">
            alertas pendientes
          </div>
        </Card>
      </div>
    </section>
  );
}

const ETAPA_COLOR = [
  "bg-skyy-200",
  "bg-lila-200",
  "bg-ambr-200",
  "bg-rosey-200",
  "bg-ambr-300",
  "bg-sage-200",
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
          <span className="pill-ambr">
            Cuello de botella · {cuello.from} → {cuello.to}
          </span>
        )}
      </div>

      <Card>
        {e.isLoading ? (
          <div className="h-40 rounded bg-cream-200 animate-pulse" />
        ) : e.error ? (
          <ErrorLine msg={e.error.message} />
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
                  cuello && i > 0 && etapas[i - 1].label === cuello.from && etapa.label === cuello.to;
                return (
                  <div key={etapa.key}>
                    {i > 0 && (
                      <div className="grid grid-cols-[140px_1fr_56px] items-center text-[11px] text-foreground/55 mb-1">
                        <span />
                        <span className={isCuello ? "text-rosey-500 font-medium" : ""}>
                          {stepConv != null
                            ? `↓ ${stepConv}% de la etapa anterior${isCuello ? " · cuello" : ""}`
                            : "—"}
                        </span>
                        <span />
                      </div>
                    )}
                    <li className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
                      <span className="text-[12px] text-foreground/80">{etapa.label}</span>
                      <div className="h-7 rounded bg-cream-200 overflow-hidden border border-foreground/10">
                        <div
                          className={cn("h-full flex items-center px-3", ETAPA_COLOR[i] ?? "bg-recurrente")}
                          style={{ width: total === 0 ? "0%" : `${Math.max(pct, 6)}%` }}
                        >
                          <span className="text-[12px] font-semibold">{etapa.count}</span>
                        </div>
                      </div>
                      <span className="text-[12px] text-foreground/55 text-right">{Math.round(pct)}%</span>
                    </li>
                  </div>
                );
              })}
            </ul>

            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-foreground/10">
              <Mini label="Conversión total" value={`${(e.data?.conversion ?? 0).toFixed(1)}%`} />
              <Mini label="Facturación de hoy" value={formatMxn(fac.data?.facturacion ?? 0)} />
              <Mini label="Ticket promedio" value={formatMxn(fac.data?.ticket ?? 0)} />
            </div>
          </>
        )}
      </Card>

      <div className="text-right mt-3">
        <a href="/pipeline" className="font-italic-serif text-rosey-500 text-sm">
          Ver pipeline completo →
        </a>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────
// Cards reutilizables
// ──────────────────────────────────────────────────

function CardKpi({
  label,
  value,
  valueUnit,
  sub,
  tone,
  highlight,
  loading,
  error,
}: {
  label: string;
  value: string;
  valueUnit?: string;
  sub: string;
  tone: "up" | "down" | "neutral";
  highlight?: boolean;
  loading?: boolean;
  error?: string;
}) {
  const subColor =
    tone === "up"
      ? "text-sage-500"
      : tone === "down"
        ? "text-rosey-500"
        : "text-foreground/60";
  return (
    <Card title={label} highlight={highlight}>
      {loading ? (
        <div className="h-12 rounded bg-cream-200 animate-pulse" />
      ) : error ? (
        <ErrorLine msg={error} />
      ) : (
        <>
          <div className="font-serif-display text-[56px] leading-[1] flex items-baseline gap-2">
            {value}
            {valueUnit && (
              <span className="text-base text-foreground/55 font-sans">{valueUnit}</span>
            )}
          </div>
          <div className={cn("mt-3 text-[12px] font-medium", subColor)}>{sub}</div>
        </>
      )}
    </Card>
  );
}

function Card({
  title,
  children,
  highlight,
}: {
  title?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5 relative",
        highlight ? "border-rosey-300 bg-rosey-50/60" : "border-foreground/15 bg-cream-50",
      )}
    >
      {title && (
        <div className="label-xs mb-3 flex items-center justify-between">
          <span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-[28px] leading-tight mt-1">{value}</div>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  const human = /Failed to fetch|fetch failed|ENOTFOUND/i.test(msg)
    ? "Sin conexión con Supabase. Revisa .env / red."
    : /Invalid API key|JWT/i.test(msg)
      ? "Credenciales inválidas."
      : /permission denied|row-level security|RLS/i.test(msg)
        ? "RLS bloqueó la lectura — agrega policy SELECT a anon."
        : msg;
  return (
    <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
      {human}
    </div>
  );
}
