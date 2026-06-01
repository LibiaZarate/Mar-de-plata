"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Database,
  Shield,
  Brain,
  MessageSquare,
  Mic,
  Radio,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "ok" | "warn" | "missing";

type Statuses = {
  supabasePublic: Status;
  supabaseService: Status;
  openrouter: Status;
  manychat: Status;
  openai: Status;
  modo: "production" | "simulator";
};

type Cred = {
  id: keyof Statuses;
  label: string;
  Icon: typeof Database;
  required: boolean;
  vars: string[];
  use: string;
  fallback: string;
  obtain: { label: string; url: string }[];
  notes?: string;
};

const CREDS: Cred[] = [
  {
    id: "supabasePublic",
    label: "Supabase (URL + anon key)",
    Icon: Database,
    required: true,
    vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    use: "Lectura desde browser y server. Las pantallas de KPIs, pipeline, equipo y cierres dependen de esto.",
    fallback: "Sin esto el dashboard no funciona — todos los datos vienen de Supabase.",
    obtain: [
      { label: "Dashboard de Supabase → Settings → API", url: "https://supabase.com/dashboard/project/nbciljmueoihtzznmvdg/settings/api" },
    ],
    notes: "Estas dos ya están comiteadas en .env (no son secretos — el anon key se diseña para ser público y la seguridad la da RLS).",
  },
  {
    id: "supabaseService",
    label: "Supabase service role",
    Icon: Shield,
    required: true,
    vars: ["SUPABASE_SERVICE_ROLE_KEY"],
    use: "El webhook necesita esta key para hacer INSERTs en alertas, eventos_negocio, conversaciones y leads. Salta RLS.",
    fallback: "Sin esto el webhook devuelve 500 al recibir un mensaje. El dashboard sigue funcionando para lectura.",
    obtain: [
      { label: "Dashboard de Supabase → Settings → API → service_role", url: "https://supabase.com/dashboard/project/nbciljmueoihtzznmvdg/settings/api" },
    ],
    notes: "⚠️ Esta key SÍ es secreta. Sólo vive en servidor — nunca aparece en el browser. Tratala como contraseña.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (Verificador + Agente)",
    Icon: Brain,
    required: false,
    vars: ["OPENROUTER_API_KEY"],
    use: "Llama a Haiku 4.5 (Verificador, clasifica intención) y Opus 4.6 fast (Sirena, genera respuestas).",
    fallback: "Sin esto el flujo entra en MODO DEMO: clasifica por keywords y devuelve respuestas hardcodeadas. La UI funciona pero las respuestas no son inteligentes.",
    obtain: [
      { label: "Crear cuenta y key en OpenRouter", url: "https://openrouter.ai/settings/keys" },
    ],
    notes: "Carga $10-20 USD de saldo. Para 600-800 mensajes/día con Haiku+Opus rondas $0.50-1.50 USD/día.",
  },
  {
    id: "manychat",
    label: "ManyChat (envío a WhatsApp)",
    Icon: MessageSquare,
    required: false,
    vars: ["MANYCHAT_API_KEY"],
    use: "POST a /fb/sending/sendContent — es lo que le habla de vuelta a la clienta en WhatsApp.",
    fallback: "Sin esto el agente piensa la respuesta pero NO la envía. Las respuestas solo se loguean. Útil mientras pruebas.",
    obtain: [
      { label: "ManyChat → Settings → API → Generate token", url: "https://app.manychat.com/api" },
    ],
    notes: "En n8n estaba como credencial 'Salvador Manychat' (httpHeaderAuth). Es ese mismo token.",
  },
  {
    id: "openai",
    label: "OpenAI Whisper (audios)",
    Icon: Mic,
    required: false,
    vars: ["OPENAI_API_KEY"],
    use: "Transcribe los audios .ogg que llegan por WhatsApp a texto antes de mandarlos al Verificador.",
    fallback: "Sin esto los audios se procesan como URL cruda y el Verificador no entiende qué dijeron — devolverá 'ambiguo' la mayoría de veces.",
    obtain: [
      { label: "OpenAI Platform → API Keys", url: "https://platform.openai.com/api-keys" },
    ],
    notes: "Whisper es muy barato (~$0.006 USD por minuto). Para 50 audios/día son centavos.",
  },
];

export function CredencialesPanel({ statuses }: { statuses: Statuses }) {
  const credStatuses = {
    supabasePublic: statuses.supabasePublic,
    supabaseService: statuses.supabaseService,
    openrouter: statuses.openrouter,
    manychat: statuses.manychat,
    openai: statuses.openai,
  } as const;
  const okCount = Object.values(credStatuses).filter((s) => s === "ok").length;
  const total = Object.values(credStatuses).length;

  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Credenciales</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Credenciales</h1>
        <div className="text-[13px] text-foreground/60 mt-2">
          {okCount} de {total} conectadas · Los secretos se setean en Vercel, no en el código.
        </div>
      </div>

      <ModoCard modo={statuses.modo} />

      <VercelGuide />

      <section className="space-y-3">
        {CREDS.map((c) => (
          <CredCard
            key={c.id}
            cred={c}
            status={credStatuses[c.id as keyof typeof credStatuses]}
          />
        ))}
      </section>
    </div>
  );
}

function ModoCard({ modo }: { modo: "production" | "simulator" }) {
  const isProd = modo === "production";
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        isProd
          ? "border-rosey-300 bg-rosey-50/50"
          : "border-sage-300 bg-sage-50/50",
      )}
    >
      <div className="flex items-start gap-3">
        {isProd ? (
          <Radio className="h-5 w-5 text-rosey-500 shrink-0 mt-0.5" />
        ) : (
          <Beaker className="h-5 w-5 text-sage-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-serif-display text-[22px] leading-none">
              Modo de operación
            </div>
            <span
              className={cn(
                "pill",
                isProd
                  ? "border-rosey-300 bg-rosey-50 text-rosey-500"
                  : "border-sage-300 bg-sage-50 text-sage-600",
              )}
            >
              {isProd ? "Producción" : "Simulador"}
            </span>
          </div>
          <p className="text-[12px] text-foreground/70 mt-2 leading-relaxed">
            {isProd ? (
              <>
                Sirena está enviando mensajes <strong>reales</strong> a WhatsApp vía ManyChat. Los
                clientes ya hablan con el bot. El Playground sigue siendo simulador (no envía).
              </>
            ) : (
              <>
                Todo el flujo corre normal — Supabase, OpenRouter, las 5 tools, alertas, eventos —{" "}
                <strong>pero nada se envía a WhatsApp</strong>. Ideal para probar antes de salir a
                producción.
              </>
            )}
          </p>
          <div className="mt-3 flex items-start gap-2">
            <code className="font-mono text-[11px] bg-cream-100 border border-foreground/10 rounded px-2 py-1 inline-block">
              MODO_PRODUCCION
            </code>
            <span className="text-[12px] text-foreground/65">
              {isProd
                ? '= "true" en Vercel. Para volver a simulador, borra la variable o pon "false" + redeploy.'
                : 'no está activado. Para salir a producción, pon = "true" en Vercel + redeploy.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VercelGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-rosey-300 bg-rosey-50/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-rosey-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-rosey-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-rosey-500" />
        )}
        <span className="font-serif-display text-[18px]">¿Cómo agrego o cambio una credencial en Vercel?</span>
        <span className="ml-auto label-xs">paso a paso</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 text-[13px] text-foreground/80 leading-relaxed space-y-3">
          <Step n="1" title="Entra a vercel.com">
            Inicia sesión con tu cuenta y abre el proyecto <code>mar-de-plata</code> (o el nombre que le hayas puesto al
            deployar).
          </Step>
          <Step n="2" title="Settings → Environment Variables">
            En el menú superior del proyecto haz click en <strong>Settings</strong> y después en{" "}
            <strong>Environment Variables</strong> en la barra lateral izquierda.
          </Step>
          <Step n="3" title="Add New">
            Click en el botón <strong>“Add New”</strong>. Te pide tres cosas:
            <ul className="list-disc list-inside mt-1.5 ml-1">
              <li><strong>Key</strong>: el nombre EXACTO de la variable (cópialo del botón “Copiar nombre” abajo).</li>
              <li><strong>Value</strong>: el valor (la clave que te dio el proveedor — OpenRouter, ManyChat, etc).</li>
              <li><strong>Environments</strong>: marca las tres (Production, Preview, Development).</li>
            </ul>
          </Step>
          <Step n="4" title="Save y re-deploy">
            Vercel guarda la variable pero <strong>no la activa</strong> hasta que rehagas el deploy.
            Ve a <strong>Deployments</strong>, el último deploy, click en los tres puntos (⋯) y{" "}
            <strong>“Redeploy”</strong>.
          </Step>
          <Step n="5" title="Para cambiar una existente">
            Buscas la variable en la lista, click en los tres puntos (⋯) a la derecha y “Edit”. Cambia el value y
            “Save”. Re-deploy.
          </Step>
          <div className="border-t border-rosey-300/40 pt-3 mt-3 text-[12px] text-foreground/60">
            En local (cuando corres <code>npm run dev</code> en tu compu) los secretos van en{" "}
            <code>.env.local</code> en la raíz del repo. Ese archivo está en .gitignore así que nunca se sube. La página
            de arriba mira tu <code>.env.local</code> + lo que esté en Vercel cuando corre en producción.
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="font-serif-display text-[22px] text-rosey-400 leading-none shrink-0 w-6">{n}</span>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-foreground/70 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function CredCard({ cred, status }: { cred: Cred; status: Status }) {
  const [open, setOpen] = useState(false);
  const Icon = cred.Icon;

  const statusLabel =
    status === "ok"
      ? "Conectada"
      : status === "warn"
        ? cred.required
          ? "Falta · crítica"
          : "Sin conectar · modo demo"
        : "Falta";

  const statusTone =
    status === "ok"
      ? "border-sage-300 bg-sage-50 text-sage-600"
      : status === "warn" && cred.required
        ? "border-rosey-300 bg-rosey-50 text-rosey-500"
        : status === "warn"
          ? "border-ambr-300 bg-ambr-50 text-ambr-600"
          : "border-rosey-300 bg-rosey-50 text-rosey-500";

  return (
    <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-cream-100"
      >
        <StatusIcon status={status} />
        <div className="rounded-md border border-foreground/15 bg-cream-100 p-2 shrink-0">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-serif-display text-[20px] leading-none">{cred.label}</div>
            <span className={cn("pill", statusTone)}>{statusLabel}</span>
            {cred.required && (
              <span className="pill border-foreground/30 bg-cream-50 text-foreground/60">obligatoria</span>
            )}
          </div>
          <p className="text-[12px] text-foreground/65 mt-1.5 leading-relaxed">{cred.use}</p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-foreground/40 mt-1.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-foreground/40 mt-1.5" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-foreground/10 space-y-4">
          <div>
            <div className="label-xs mb-1.5">Si no la tienes</div>
            <p className="text-[12px] text-foreground/75 leading-relaxed">{cred.fallback}</p>
          </div>

          <div>
            <div className="label-xs mb-2">Variables de entorno</div>
            <ul className="space-y-1.5">
              {cred.vars.map((v) => (
                <CopyableVar key={v} name={v} />
              ))}
            </ul>
          </div>

          <div>
            <div className="label-xs mb-2">Dónde obtener la key</div>
            <ul className="space-y-1.5">
              {cred.obtain.map((o) => (
                <li key={o.url}>
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-rosey-500 hover:text-rosey-600 underline decoration-rosey-300 underline-offset-2"
                  >
                    {o.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {cred.notes && (
            <div className="border border-foreground/10 bg-cream-100 rounded px-3 py-2 text-[12px] text-foreground/70 leading-relaxed">
              {cred.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyableVar({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <li className="flex items-center gap-2">
      <code className="flex-1 font-mono text-[11px] bg-cream-100 border border-foreground/10 rounded px-2 py-1">
        {name}
      </code>
      <button
        onClick={copy}
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors shrink-0",
          copied
            ? "border-sage-300 text-sage-600 bg-sage-50"
            : "border-foreground/20 hover:bg-cream-100",
        )}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado" : "Copiar nombre"}
      </button>
    </li>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok")
    return <CheckCircle2 className="h-5 w-5 text-sage-500 shrink-0 mt-1" />;
  if (status === "warn")
    return <AlertCircle className="h-5 w-5 text-ambr-400 shrink-0 mt-1" />;
  return <XCircle className="h-5 w-5 text-rosey-400 shrink-0 mt-1" />;
}
