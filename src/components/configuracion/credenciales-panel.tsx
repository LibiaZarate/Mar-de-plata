// Server component: lee el estado de las env vars de servidor SIN exponerlas.

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Status = "ok" | "missing" | "warn";

async function probeSupabase(): Promise<Status> {
  try {
    const sb = createClient();
    const { error } = await sb.from("leads").select("*", { count: "exact", head: true });
    if (error) return "warn";
    return "ok";
  } catch {
    return "missing";
  }
}

export async function CredencialesPanel() {
  const supa = await probeSupabase();
  const credenciales = [
    {
      label: "Supabase URL + anon key",
      vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? supa : "missing",
      use: "Lectura desde browser y server.",
    },
    {
      label: "Supabase service role",
      vars: ["SUPABASE_SERVICE_ROLE_KEY"],
      status: (process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "missing") as Status,
      use: "Webhook · INSERTs a alertas, eventos_negocio, conversaciones.",
    },
    {
      label: "OpenRouter (Verificador + Agente)",
      vars: ["OPENROUTER_API_KEY"],
      status: (process.env.OPENROUTER_API_KEY ? "ok" : "warn") as Status,
      use: "Haiku 4.5 · Opus 4.6 fast. Sin key, el flujo entra en modo demo.",
    },
    {
      label: "ManyChat",
      vars: ["MANYCHAT_API_KEY"],
      status: (process.env.MANYCHAT_API_KEY ? "ok" : "warn") as Status,
      use: "POST a /fb/sending/sendContent. Sin key, los mensajes solo se loguean.",
    },
    {
      label: "OpenAI Whisper",
      vars: ["OPENAI_API_KEY"],
      status: (process.env.OPENAI_API_KEY ? "ok" : "warn") as Status,
      use: "Transcripción de audios .ogg. Sin key, los audios pasan como URL cruda.",
    },
    {
      label: "Redis",
      vars: ["REDIS_URL"],
      status: (process.env.REDIS_URL ? "ok" : "warn") as Status,
      use: "Buffer de 5s entre mensajes cercanos del mismo lead.",
    },
  ];

  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Configuración · Credenciales</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">Estado de credenciales</h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Server-side check. Los valores nunca se muestran — solo si están definidos y si la conexión responde.
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card divide-y divide-border">
        {credenciales.map((c) => (
          <div key={c.label} className="grid grid-cols-[40px_1fr_220px] gap-4 px-5 py-4 items-start">
            <StatusIcon status={c.status} />
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-[12px] text-muted-foreground mt-1">{c.use}</div>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground space-y-0.5 text-right">
              {c.vars.map((v) => <div key={v}>{v}</div>)}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card p-5 text-[12px] text-muted-foreground leading-relaxed">
        Los secretos van en <code className="text-foreground">.env.local</code> (gitignored).
        Después de cambiarlos, hay que reiniciar el dev server (Next.js no hace hot-reload de env vars).
        En producción Vercel, se setean desde el panel del proyecto.
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-grupo" />;
  if (status === "warn") return <AlertCircle className="h-5 w-5 text-recurrente" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}
