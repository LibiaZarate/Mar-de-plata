"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/utils";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

type Status = {
  ok: boolean;
  configured: boolean;
  app_id?: string | null;
  business_id?: string | null;
  configured_ad_account?: string | null;
  user?: { id: string; name?: string };
  ad_accounts?: { id: string; name: string; account_status: number; currency: string; timezone_name: string }[];
  auto_selected?: string | null;
  error?: string;
  meta_code?: number;
  hint?: string;
  missing?: string[];
  message?: string;
};

type CampaignsResp = {
  ok: boolean;
  ad_account_id?: string;
  campaigns?: {
    id: string;
    name: string;
    objective: string;
    effective_status: string;
    meta: {
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number;
      cpc: number;
      cpm: number;
      reach: number;
    };
    dashboard: { leads: number; pagados: number; facturacion: number };
    roas: number | null;
    cpl_dashboard: number | null;
  }[];
  totales?: {
    spend: number;
    impressions: number;
    clicks: number;
    leads_dashboard: number;
    facturacion_dashboard: number;
  };
  error?: string;
};

export function MetaAdsView() {
  const status = useSWR<Status>("/api/dashboard/meta/status", fetcher);
  const days = 30;
  const camps = useSWR<CampaignsResp>(
    `/api/dashboard/meta/campanas?days=${days}`,
    fetcher,
  );

  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Meta Marketing API</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
          Conexión con Meta Ads
        </h1>
        <div className="text-[13px] text-foreground/60 mt-2 max-w-3xl">
          Importa automáticamente todas las campañas y anuncios de tu Ad Account
          de Meta. Cruza el gasto de Meta con la facturación del dashboard para
          calcular ROAS real por anuncio.
        </div>
      </div>

      <SetupGuide />
      <StatusCard status={status.data} loading={status.isLoading} />
      {status.data?.ok && (
        <CampaignsTable resp={camps.data} loading={camps.isLoading} days={days} />
      )}
    </div>
  );
}

function StatusCard({ status, loading }: { status?: Status; loading?: boolean }) {
  if (loading) {
    return <div className="h-24 rounded-lg bg-cream-200 animate-pulse" />;
  }
  if (!status) return null;

  if (!status.configured) {
    return (
      <div className="rounded-lg border border-rosey-300 bg-rosey-50/40 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-rosey-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">No conectado</div>
            <p className="text-[12px] text-foreground/70 mt-1">
              {status.message ?? "Falta META_ACCESS_TOKEN en .env.local"}
            </p>
            {status.missing && (
              <ul className="mt-3 space-y-1 text-[12px]">
                {status.missing.map((v) => (
                  <li key={v} className="font-mono text-foreground/65">
                    · {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!status.ok) {
    return (
      <div className="rounded-lg border border-ambr-300 bg-ambr-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-ambr-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">Error de conexión</div>
            <p className="text-[12px] text-foreground/75 mt-1">{status.error}</p>
            {status.hint && (
              <p className="text-[12px] text-foreground/60 mt-2 italic">
                💡 {status.hint}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sage-300 bg-sage-50/50 p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-sage-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-medium">Conectado a Meta</div>
          <p className="text-[12px] text-foreground/70 mt-1">
            Usuario:{" "}
            <span className="font-medium text-foreground">
              {status.user?.name ?? status.user?.id}
            </span>
          </p>
          {status.ad_accounts && status.ad_accounts.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="label-xs">Ad accounts disponibles</div>
              <ul className="space-y-1">
                {status.ad_accounts.map((acc) => {
                  const isConfigured =
                    status.configured_ad_account === acc.id ||
                    (!status.configured_ad_account && status.auto_selected === acc.id);
                  return (
                    <li
                      key={acc.id}
                      className={cn(
                        "text-[12px] flex items-center gap-2 px-2 py-1 rounded",
                        isConfigured && "bg-sage-100/60 font-medium",
                      )}
                    >
                      <code className="font-mono text-[11px]">{acc.id}</code>
                      <span className="flex-1 truncate">{acc.name}</span>
                      <span className="text-foreground/55 text-[10px]">
                        {acc.currency} · {acc.timezone_name}
                      </span>
                      {isConfigured && (
                        <span className="text-sage-600 text-[10px] tracking-wider uppercase">
                          {status.configured_ad_account ? "activo" : "auto"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!status.configured_ad_account && status.ad_accounts.length > 1 && (
                <p className="text-[11px] text-foreground/55 italic mt-2">
                  Si tienes varios ad accounts, define{" "}
                  <code>META_AD_ACCOUNT_ID</code> en .env.local para fijar
                  cuál usar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignsTable({
  resp,
  loading,
  days,
}: {
  resp?: CampaignsResp;
  loading?: boolean;
  days: number;
}) {
  if (loading) {
    return <div className="h-40 rounded-lg bg-cream-200 animate-pulse" />;
  }
  if (!resp?.ok) {
    return (
      <div className="rounded-lg border border-rosey-300 bg-rosey-50/40 px-4 py-3 text-[12px] text-rosey-500">
        {resp?.error ?? "Error al cargar campañas"}
      </div>
    );
  }

  const campaigns = resp.campaigns ?? [];
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-foreground/20 bg-cream-50 px-6 py-10 text-center">
        <Megaphone className="h-8 w-8 mx-auto text-foreground/30 mb-2" strokeWidth={1.3} />
        <div className="font-italic-serif text-foreground/55">
          No hay campañas en este Ad Account
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="label-xs">Campañas · últimos {days} días</div>
          <div className="text-[12px] text-foreground/55 mt-1">
            Gasto de Meta cruzado con facturación del dashboard = ROAS real.
          </div>
        </div>
        {resp.totales && (
          <div className="text-right text-[11px] text-foreground/65">
            <div>
              Gasto Meta:{" "}
              <span className="font-medium text-foreground">
                {formatMxn(resp.totales.spend)}
              </span>
            </div>
            <div>
              Facturación dashboard:{" "}
              <span className="font-medium text-foreground">
                {formatMxn(resp.totales.facturacion_dashboard)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-[10px] tracking-wider uppercase text-foreground/55">
              <th className="text-left px-4 py-3 font-medium">Campaña</th>
              <th className="text-right px-3 py-3 font-medium">Gasto</th>
              <th className="text-right px-3 py-3 font-medium">Impr.</th>
              <th className="text-right px-3 py-3 font-medium">Clicks</th>
              <th className="text-right px-3 py-3 font-medium">CTR</th>
              <th className="text-right px-3 py-3 font-medium">CPC</th>
              <th className="text-right px-3 py-3 font-medium">Leads</th>
              <th className="text-right px-3 py-3 font-medium">Cerrados</th>
              <th className="text-right px-3 py-3 font-medium">Facturó</th>
              <th className="text-right px-4 py-3 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-foreground/10 last:border-0 hover:bg-cream-100/40">
                <td className="px-4 py-3">
                  <div className="font-medium truncate max-w-xs">{c.name}</div>
                  <div className="text-[10px] text-foreground/45 flex items-center gap-2 mt-0.5">
                    <code className="font-mono">{c.id}</code>
                    <StatusBadge status={c.effective_status} />
                  </div>
                </td>
                <td className="text-right px-3 py-3 tabular-nums">
                  {c.meta.spend > 0 ? formatMxn(c.meta.spend) : "—"}
                </td>
                <td className="text-right px-3 py-3 tabular-nums text-foreground/65">
                  {c.meta.impressions.toLocaleString("es-MX")}
                </td>
                <td className="text-right px-3 py-3 tabular-nums text-foreground/65">
                  {c.meta.clicks.toLocaleString("es-MX")}
                </td>
                <td className="text-right px-3 py-3 tabular-nums text-foreground/65">
                  {c.meta.ctr > 0 ? `${c.meta.ctr.toFixed(2)}%` : "—"}
                </td>
                <td className="text-right px-3 py-3 tabular-nums text-foreground/65">
                  {c.meta.cpc > 0 ? formatMxn(c.meta.cpc) : "—"}
                </td>
                <td className="text-right px-3 py-3 tabular-nums">
                  {c.dashboard.leads}
                </td>
                <td className="text-right px-3 py-3 tabular-nums">
                  {c.dashboard.pagados}
                </td>
                <td className="text-right px-3 py-3 tabular-nums">
                  {c.dashboard.facturacion > 0 ? formatMxn(c.dashboard.facturacion) : "—"}
                </td>
                <td className="text-right px-4 py-3 tabular-nums">
                  {c.roas !== null ? (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-medium",
                        c.roas >= 3
                          ? "bg-sage-100 text-sage-600"
                          : c.roas >= 1
                            ? "bg-ambr-100 text-ambr-600"
                            : "bg-rosey-50 text-rosey-500",
                      )}
                    >
                      {c.roas.toFixed(1)}x
                    </span>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "border-sage-300 text-sage-600 bg-sage-50"
      : status === "PAUSED"
        ? "border-ambr-300 text-ambr-600 bg-ambr-50"
        : "border-foreground/15 text-foreground/55";
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded border text-[9px] tracking-wider uppercase",
        tone,
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-rosey-200 bg-cream-50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-cream-100"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-rosey-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-rosey-500" />
        )}
        <span className="font-serif-display text-[18px]">
          ¿Cómo configuro esto?
        </span>
        <span className="ml-auto label-xs">paso a paso</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 text-[13px] text-foreground/80 leading-relaxed space-y-4">
          <Step n="1" title="App en Meta for Developers">
            Entra a{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              developers.facebook.com/apps <ExternalLink className="h-3 w-3" />
            </a>{" "}
            con la cuenta de Mar. Si ya existe la app del negocio, úsala. Si
            no, <strong>Create App</strong> tipo <strong>Business</strong>.
            Anota el <code>App ID</code>.
          </Step>

          <Step n="2" title="Marketing API → Get Started">
            En la app, menú izquierdo: <strong>Add Products</strong> →{" "}
            <strong>Marketing API</strong> → Set Up.
          </Step>

          <Step n="3" title="Access Token (para empezar)">
            Para empezar usa{" "}
            <a
              href="https://developers.facebook.com/tools/explorer"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              Graph API Explorer <ExternalLink className="h-3 w-3" />
            </a>
            : elige la app del paso 1, en{" "}
            <strong>User or Page</strong> → User Token, y agrega scopes{" "}
            <code>ads_read</code> y <code>business_management</code>. Click{" "}
            <strong>Generate Access Token</strong>. Cópialo. Este token dura
            ~60 días.
          </Step>

          <Step n="4" title="Para producción · System User Token (permanente)">
            En{" "}
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              Business Manager → System Users{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
            : crea un System User (Admin), asignalo a la app del paso 1, y
            generale un token con <code>ads_read</code>. Este NO expira.
          </Step>

          <Step n="5" title="Ad Account ID">
            En{" "}
            <a
              href="https://business.facebook.com/settings/ad-accounts"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              Business Manager → Ad Accounts{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
            : copia el ID (formato <code>act_1234567890</code>). Si no lo
            sabes, el dashboard auto-detecta el primero cuando le pasas solo
            el token.
          </Step>

          <Step n="6" title="Pegar en Vercel">
            En tu proyecto de Vercel → Settings → Environment Variables, agrega:
            <div className="mt-2 space-y-1">
              <EnvVarRow name="META_APP_ID" />
              <EnvVarRow name="META_ACCESS_TOKEN" />
              <EnvVarRow name="META_AD_ACCOUNT_ID" />
              <EnvVarRow name="META_BUSINESS_ID" />
            </div>
            Marca las 3 environments (Production, Preview, Development), Save,
            y redeploya. En local van en <code>.env.local</code>.
          </Step>

          <div className="border-t border-rosey-200/40 pt-3 mt-3 text-[12px] text-foreground/55 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Una vez configurado, el dashboard sincroniza automáticamente
              cada vez que abres esta pantalla. La tabla cruza el gasto real
              de Meta con la facturación del dashboard para calcular el ROAS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvVarRow({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 font-mono text-[11px] bg-cream-100 border border-foreground/10 rounded px-2 py-1">
        {name}
      </code>
      <button
        onClick={copy}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
          copied
            ? "border-sage-300 text-sage-600 bg-sage-50"
            : "border-foreground/20 hover:bg-cream-100",
        )}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Ok" : "Copiar"}
      </button>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="font-serif-display text-[22px] text-rosey-400 leading-none shrink-0 w-6">
        {n}
      </span>
      <div className="flex-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-foreground/70 mt-0.5">{children}</div>
      </div>
    </div>
  );
}
