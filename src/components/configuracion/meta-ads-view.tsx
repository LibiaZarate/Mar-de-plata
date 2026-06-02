"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Save,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
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
  ad_accounts?: {
    id: string;
    name: string;
    account_status: number;
    currency: string;
    timezone_name: string;
  }[];
  auto_selected?: string | null;
  error?: string;
  meta_code?: number;
  hint?: string;
  message?: string;
};

type CredsState = {
  ok: boolean;
  configured: {
    app_id: boolean;
    access_token: boolean;
    ad_account_id: boolean;
    business_id: boolean;
  };
  mascaras: {
    app_id: string;
    access_token: string;
    ad_account_id: string;
    business_id: string;
  };
};

type CampaignsResp = {
  ok: boolean;
  ad_account_id?: string;
  campaigns?: Array<{
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
  }>;
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
  const creds = useSWR<CredsState>("/api/dashboard/meta/credentials", fetcher);
  const camps = useSWR<CampaignsResp>(
    status.data?.ok ? "/api/dashboard/meta/campanas?days=30" : null,
    fetcher,
  );

  const isConnected = status.data?.ok === true;

  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Meta Marketing API</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
          Conexión con Meta Ads
        </h1>
        <div className="text-[13px] text-foreground/60 mt-2 max-w-3xl">
          Importa automáticamente todas las campañas y anuncios de Meta. Cruza
          el gasto de Meta con la facturación del dashboard para calcular ROAS
          real por anuncio. Las credenciales se guardan en Supabase, no en
          archivos.
        </div>
      </div>

      <CredentialsForm creds={creds.data} loading={creds.isLoading} />

      <StatusCard status={status.data} loading={status.isLoading} />

      {isConnected && (
        <CampaignsTable resp={camps.data} loading={camps.isLoading} days={30} />
      )}

      <SetupGuide />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Form de credenciales
// ────────────────────────────────────────────────────────────

function CredentialsForm({
  creds,
  loading,
}: {
  creds?: CredsState;
  loading?: boolean;
}) {
  const [appId, setAppId] = useState("");
  const [token, setToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Si nunca ha guardado credenciales, abrir el form por default
  useEffect(() => {
    if (creds && !creds.configured.access_token) setShowForm(true);
  }, [creds]);

  async function guardar() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (appId.trim()) body.app_id = appId.trim();
      if (token.trim()) body.access_token = token.trim();
      if (adAccountId.trim()) body.ad_account_id = adAccountId.trim();
      if (businessId.trim()) body.business_id = businessId.trim();

      const r = await fetch("/api/dashboard/meta/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) {
        alert(d.error ?? "Error al guardar");
        return;
      }
      setAppId("");
      setToken("");
      setAdAccountId("");
      setBusinessId("");
      setSavedAt(Date.now());
      setShowForm(false);
      mutate("/api/dashboard/meta/credentials");
      mutate("/api/dashboard/meta/status");
      mutate("/api/dashboard/meta/campanas?days=30");
    } finally {
      setSaving(false);
    }
  }

  async function borrarTodo() {
    if (
      !confirm(
        "¿Borrar las credenciales de Meta? Tendrás que volver a pegarlas para reconectar.",
      )
    )
      return;
    await fetch("/api/dashboard/meta/credentials", { method: "DELETE" });
    mutate("/api/dashboard/meta/credentials");
    mutate("/api/dashboard/meta/status");
  }

  if (loading) {
    return <div className="h-24 rounded-lg bg-cream-200 animate-pulse" />;
  }

  if (!creds) return null;

  const yaConfigurado = creds.configured.access_token;

  if (yaConfigurado && !showForm) {
    return (
      <div className="rounded-lg border border-foreground/15 bg-cream-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-sage-600 shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-sm">Credenciales guardadas en Supabase</div>
            <div className="text-[11px] text-foreground/55 mt-0.5 grid grid-cols-2 gap-x-4 mt-1.5">
              <div>
                App ID:{" "}
                <code className="text-foreground">
                  {creds.mascaras.app_id || "—"}
                </code>
              </div>
              <div>
                Access Token:{" "}
                <code className="text-foreground">
                  {creds.mascaras.access_token || "—"}
                </code>
              </div>
              <div>
                Ad Account:{" "}
                <code className="text-foreground">
                  {creds.mascaras.ad_account_id || "(auto-detectado)"}
                </code>
              </div>
              <div>
                Business ID:{" "}
                <code className="text-foreground">
                  {creds.mascaras.business_id || "—"}
                </code>
              </div>
            </div>
            {savedAt && Date.now() - savedAt < 8000 && (
              <div className="text-[11px] text-sage-600 mt-2 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> guardado
              </div>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-[11px] px-2.5 py-1.5 rounded border border-foreground/20 hover:bg-cream-100"
          >
            cambiar
          </button>
          <button
            onClick={borrarTodo}
            className="text-[11px] px-2 py-1.5 rounded border border-foreground/20 text-foreground/55 hover:text-rosey-500 hover:bg-cream-100 inline-flex items-center gap-1"
            title="Borrar credenciales"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rosey-300 bg-rosey-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {yaConfigurado ? "Editar credenciales" : "Pega tus credenciales de Meta"}
          </div>
          <div className="text-[12px] text-foreground/65 mt-0.5">
            Se guardan en Supabase. No tocas archivos. No reinicias nada.
          </div>
        </div>
        {yaConfigurado && (
          <button
            onClick={() => setShowForm(false)}
            className="text-[11px] text-foreground/55 hover:text-foreground"
          >
            cancelar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="App ID">
          <input
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder={creds.mascaras.app_id || "989087883972224"}
            className="input font-mono text-[12px]"
          />
        </Field>
        <Field label="Business Manager ID (opcional)">
          <input
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder={creds.mascaras.business_id || "344419908689274"}
            className="input font-mono text-[12px]"
          />
        </Field>

        <Field label="Access Token" wide>
          <div className="relative">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                creds.mascaras.access_token || "EAAxxxxxx... (pégalo aquí)"
              }
              type={showToken ? "text" : "password"}
              className="input font-mono text-[11px] pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/45 hover:text-foreground"
              title={showToken ? "Ocultar" : "Mostrar"}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Ad Account ID (opcional · auto-detecta si lo dejas vacío)" wide>
          <input
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value)}
            placeholder={creds.mascaras.ad_account_id || "act_1234567890"}
            className="input font-mono text-[12px]"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-rosey-200/40">
        <div className="text-[11px] text-foreground/55">
          ⚠️ El access token <strong>nunca</strong> se vuelve a mostrar después
          de guardar — para cambiarlo pega uno nuevo.
        </div>
        <button
          onClick={guardar}
          disabled={saving || (!appId && !token && !adAccountId && !businessId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rosey-300 hover:bg-rosey-400 text-cream-50 text-sm font-medium disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <style>{`
        .input { width:100%; padding:8px 10px; border:1px solid hsl(var(--border)); border-radius:6px; background:hsl(var(--card)); font-size:14px; color:hsl(var(--foreground)); outline:none; }
        .input:focus { border-color:hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "col-span-2")}>
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
}

// ────────────────────────────────────────────────────────────
// Estado de la conexión
// ────────────────────────────────────────────────────────────

function StatusCard({ status, loading }: { status?: Status; loading?: boolean }) {
  if (loading) {
    return <div className="h-24 rounded-lg bg-cream-200 animate-pulse" />;
  }
  if (!status) return null;

  if (!status.configured) {
    return null; // El form de arriba ya muestra qué falta
  }

  if (!status.ok) {
    return (
      <div className="rounded-lg border border-ambr-300 bg-ambr-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-ambr-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">Error al conectar con Meta</div>
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
                  Si tienes varios ad accounts, pega el ID del que quieras
                  fijar arriba (campo Ad Account ID).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tabla de campañas
// ────────────────────────────────────────────────────────────

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
        <Megaphone
          className="h-8 w-8 mx-auto text-foreground/30 mb-2"
          strokeWidth={1.3}
        />
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
              <tr
                key={c.id}
                className="border-b border-foreground/10 last:border-0 hover:bg-cream-100/40"
              >
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
                  {c.dashboard.facturacion > 0
                    ? formatMxn(c.dashboard.facturacion)
                    : "—"}
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

// ────────────────────────────────────────────────────────────
// Guía paso a paso
// ────────────────────────────────────────────────────────────

function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
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
          ¿De dónde saco el App ID, Token y Ad Account ID?
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
              developers.facebook.com/apps{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
            . Si ya tienes una app, úsala. Si no, <strong>Create App</strong>{" "}
            tipo <strong>Business</strong>. Anota el <code>App ID</code> (lo
            ves arriba en la cabecera de la app).
          </Step>

          <Step n="2" title="Marketing API → Set Up">
            En la app, menú izquierdo: <strong>Add Products</strong> →{" "}
            <strong>Marketing API</strong> → Set Up. Eso habilita los scopes.
          </Step>

          <Step n="3" title="Access Token">
            Ve a{" "}
            <a
              href="https://developers.facebook.com/tools/explorer"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              Graph API Explorer{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
            . Selecciona tu app del dropdown, en <strong>User or Page</strong>{" "}
            elige <em>User Token</em>, agrega los scopes{" "}
            <code>ads_read</code> y <code>business_management</code>, click{" "}
            <strong>Generate Access Token</strong>. Cópialo y pégalo arriba.
            Este token dura 60 días.
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
            : crea un System User (Admin), asígnalo a la app del paso 1, genera
            su token con <code>ads_read</code>. Este NO expira y es el correcto
            para producción.
          </Step>

          <Step n="5" title="Ad Account ID (opcional)">
            En{" "}
            <a
              href="https://business.facebook.com/settings/ad-accounts"
              target="_blank"
              rel="noreferrer"
              className="text-rosey-500 underline inline-flex items-center gap-1"
            >
              Business Manager → Ad Accounts{" "}
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            copias el ID (formato <code>act_1234567890</code>). Si lo dejas
            vacío arriba, el dashboard usa el primero que vea.
          </Step>

          <div className="border-t border-foreground/10 pt-3 mt-3 text-[12px] text-foreground/55">
            🔒 Las credenciales se guardan encriptadas en Supabase (la propia
            instancia del cliente). No las commiteamos en código ni las
            mostramos completas en la UI. Solo el dashboard server-side las
            usa para hablar con Meta.
          </div>
        </div>
      )}
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
