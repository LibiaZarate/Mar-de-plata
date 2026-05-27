import { Link } from "react-router-dom";
import {
  useAlertasActivas,
  useAlertasActivasCount,
  useEmbudoDia,
  useEfectividadKpi,
  useFacturacionKpi,
  useLeadsHoyKpi,
  useLeadsPorCanal,
} from "../lib/queries";
import { Card, Pill } from "../components/ui";
import { Skeleton, ErrorBanner } from "../components/feedback";

function fmtMxn(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX");
}

const CANAL_COLOR: Record<string, string> = {
  Meta: "bg-skyy-300",
  TikTok: "bg-lila-300",
  Grupo: "bg-sage-300",
  Recurrente: "bg-ambr-300",
  "Orgánico": "bg-ink-mute",
  Organico: "bg-ink-mute",
};

export default function Inicio() {
  return (
    <div className="space-y-6">
      <Greeting />
      <BloqueA />
      <BloqueB />
      <BloqueC />
    </div>
  );
}

function Greeting() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <h1 className="font-serif-display text-5xl leading-none">{greet}, Mar</h1>
      <div className="text-[12px] text-ink-mute mt-2 capitalize">{today}</div>
    </div>
  );
}

// ---------------- Bloque A · 3 KPIs principales ----------------

function BloqueA() {
  const leads = useLeadsHoyKpi();
  const ef = useEfectividadKpi();
  const fac = useFacturacionKpi();

  return (
    <section>
      <div className="label-xs mb-3">Bloque A · pulso del día</div>
      <div className="grid grid-cols-3 gap-4">
        <KpiBig
          label="Leads hoy"
          loading={leads.isLoading}
          error={leads.error}
          value={leads.data ? leads.data.hoy.toString() : "—"}
          sub={
            leads.data
              ? `${leads.data.delta >= 0 ? "↑" : "↓"} ${Math.abs(leads.data.delta)}% vs ayer (${leads.data.ayer})`
              : ""
          }
          tone={leads.data && leads.data.delta >= 0 ? "up" : "down"}
        />
        <KpiBig
          label="Efectividad del bot"
          loading={ef.isLoading}
          error={ef.error}
          value={ef.data ? `${ef.data.pct.toFixed(1)}%` : "—"}
          sub={
            ef.data
              ? `${ef.data.con_handoff} de ${ef.data.total_leads} pidieron humano`
              : ""
          }
          tone="neutral"
        />
        <KpiBig
          label="Facturación hoy"
          loading={fac.isLoading}
          error={fac.error}
          value={fac.data ? `${fmtMxn(fac.data.facturacion)} MXN` : "—"}
          sub={
            fac.data
              ? `${fac.data.pedidos} pedido${fac.data.pedidos === 1 ? "" : "s"} · ticket prom. ${fmtMxn(fac.data.ticket_promedio)}`
              : ""
          }
          tone="up"
          highlight
        />
      </div>
    </section>
  );
}

function KpiBig({
  label,
  value,
  sub,
  loading,
  error,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
  error?: Error;
  tone: "up" | "down" | "neutral";
  highlight?: boolean;
}) {
  const subColor =
    tone === "up" ? "text-sage-300" : tone === "down" ? "text-rosey-400" : "text-ink-mute";
  return (
    <Card title={label} tone={highlight ? "highlight" : "default"}>
      {error ? (
        <ErrorBanner message={error.message} />
      ) : loading ? (
        <Skeleton lines={2} />
      ) : (
        <>
          <div className="font-serif-display text-5xl leading-none">{value}</div>
          <div className={`mt-3 text-[12px] font-medium ${subColor}`}>{sub || "—"}</div>
        </>
      )}
    </Card>
  );
}

// ---------------- Bloque B · 4 datos operativos ----------------

function BloqueB() {
  const fac = useFacturacionKpi();
  const canales = useLeadsPorCanal();
  const alertasCount = useAlertasActivasCount();
  const alertas = useAlertasActivas();

  return (
    <section>
      <div className="label-xs mb-3">Bloque B · operación de hoy</div>
      <div className="grid grid-cols-4 gap-4">
        <Card title="Facturación hoy">
          {fac.isLoading ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="font-serif-display text-3xl leading-none">
                {fmtMxn(fac.data?.facturacion ?? 0)}
                <span className="text-sm text-ink-mute ml-1">MXN</span>
              </div>
              <div className="mt-2 text-[12px] text-ink-mute">
                ticket prom. {fmtMxn(fac.data?.ticket_promedio ?? 0)}
              </div>
            </>
          )}
        </Card>

        <Card title="Pedidos cerrados hoy">
          {fac.isLoading ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="font-serif-display text-3xl leading-none">
                {fac.data?.pedidos ?? 0}
              </div>
              <div className="mt-2 text-[12px] text-ink-mute">
                cierres registrados manualmente
              </div>
            </>
          )}
        </Card>

        <Card title="Leads por canal">
          {canales.isLoading ? (
            <Skeleton lines={3} />
          ) : canales.data && canales.data.length > 0 ? (
            <CanalBars rows={canales.data} />
          ) : (
            <div className="text-[12px] text-ink-mute italic mt-2">
              Aún no entran leads hoy.
            </div>
          )}
        </Card>

        <Card title="En tu cancha" tone="highlight">
          {alertasCount.isLoading ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="font-serif-display text-5xl leading-none">
                {alertasCount.data ?? 0}
              </div>
              <div className="mt-2 text-[12px] text-ink-soft">alertas pendientes</div>
              {alertas.data && alertas.data.length > 0 && (
                <ul className="mt-3 space-y-1 text-[11px] text-ink-soft">
                  {alertas.data.slice(0, 2).map((a) => (
                    <li key={a.id} className="truncate">· {a.titulo}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function CanalBars({ rows }: { rows: { canal: string; total: number }[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="mt-2 space-y-2">
      {rows.slice(0, 5).map((r) => (
        <li key={r.canal} className="grid grid-cols-[60px_1fr_24px] items-center gap-2">
          <span className="text-[11px] text-ink-soft truncate">{r.canal}</span>
          <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
            <div
              className={`h-full ${CANAL_COLOR[r.canal] ?? "bg-ink-mute"}`}
              style={{ width: `${(r.total / max) * 100}%` }}
            />
          </div>
          <span className="text-[12px] text-ink text-right font-medium">{r.total}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Bloque C · Embudo ----------------

function BloqueC() {
  const embudo = useEmbudoDia();
  const fac = useFacturacionKpi();

  const etapas = embudo.data?.etapas ?? [];
  const total = etapas[0]?.count ?? 0;
  const cuello = embudo.data?.cuello_de_botella ?? null;

  const ETAPA_COLOR = [
    "bg-skyy-200",
    "bg-lila-200",
    "bg-ambr-200",
    "bg-rosey-200",
    "bg-ambr-300",
    "bg-sage-200",
  ];

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div className="label-xs">Bloque C · embudo del día</div>
        {cuello && total > 0 && (
          <Pill tone="ambr">
            Cuello de botella · {cuello.from} → {cuello.to}
          </Pill>
        )}
      </div>

      <Card>
        {embudo.isLoading ? (
          <Skeleton lines={6} />
        ) : embudo.error ? (
          <ErrorBanner message={embudo.error.message} />
        ) : (
          <>
            <ul className="space-y-1.5">
              {etapas.map((etapa, i) => {
                const pct = total === 0 ? 0 : (etapa.count / total) * 100;
                const isBottleneck =
                  cuello &&
                  i > 0 &&
                  etapas[i - 1].label === cuello.from &&
                  etapa.label === cuello.to;
                const stepConv =
                  i === 0 || etapas[i - 1].count === 0
                    ? null
                    : Math.round((etapa.count / etapas[i - 1].count) * 100);
                return (
                  <div key={etapa.key}>
                    {i > 0 && (
                      <div className="grid grid-cols-[140px_1fr_56px] items-center text-[11px] text-ink-mute mb-1">
                        <span />
                        <span className={isBottleneck ? "text-rosey-400 font-medium" : ""}>
                          {stepConv != null
                            ? `↓ ${stepConv}% de la etapa anterior${isBottleneck ? " · cuello" : ""}`
                            : "—"}
                        </span>
                        <span />
                      </div>
                    )}
                    <li className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
                      <span className="text-[12px] text-ink-soft">{etapa.label}</span>
                      <div className="h-7 rounded bg-cream-200 overflow-hidden relative">
                        <div
                          className={`h-full ${ETAPA_COLOR[i] ?? "bg-ambr-200"} flex items-center px-3`}
                          style={{ width: total === 0 ? "0%" : `${Math.max(pct, 6)}%` }}
                        >
                          <span className="text-[12px] font-semibold text-ink">{etapa.count}</span>
                        </div>
                      </div>
                      <span className="text-[12px] text-ink-mute text-right">{Math.round(pct)}%</span>
                    </li>
                  </div>
                );
              })}
            </ul>

            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-ink/10">
              <MiniStat
                label="Conversión total"
                value={`${(embudo.data?.conversion_total ?? 0).toFixed(1)}%`}
              />
              <MiniStat
                label="Facturación de hoy"
                value={fmtMxn(fac.data?.facturacion ?? 0)}
              />
              <MiniStat
                label="Ticket promedio"
                value={fmtMxn(fac.data?.ticket_promedio ?? 0)}
              />
            </div>
          </>
        )}
      </Card>

      <div className="text-right mt-3">
        <Link to="/equipo" className="text-rosey-400 italic font-serif-display text-sm">
          Ver cierres y equipo →
        </Link>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-2xl leading-tight mt-1">{value}</div>
    </div>
  );
}
