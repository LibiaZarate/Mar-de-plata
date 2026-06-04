"use client";

import useSWR from "swr";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Mic,
  MessageSquare,
  ShieldAlert,
  Clock4,
  Hourglass,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CleanedPayload = {
  sessionId: string;
  userText: string;
  whatsappPhone: string | null;
  email: string | null;
  timezone: string;
  tipoMensajeOriginal: "texto" | "audio";
  canalOrigen: string;
  anuncioId: string | null;
  subscriberId: string | null;
};

type HandoffStep = {
  id: string;
  description: string;
  status: "stub" | "pending-fase-4" | "pending-fase-7";
};

type GuardrailPlan = {
  trigger: "guardrail_critico";
  match: {
    keyword: string;
    category: "humano" | "reclamo";
    motivo: string;
    matchedAt: number;
  };
  payload: {
    numero_whatsapp: string;
    motivo: string;
    prioridad: "urgente";
    mensaje_original: string;
    subscriber_id: string | null;
  };
  steps: HandoffStep[];
};

type Entry = {
  id: string;
  receivedAt: string;
  durationMs: number;
  source: "manychat" | "kaizen";
  kaizenSessionId: string | null;
  kaizenCallback: string | null;
  cleaned: CleanedPayload;
  flow?: {
    mode: string;
    demo: boolean;
    leadCreated: boolean;
    toolResult: { tool: string; ok: boolean } | null;
    agenteTexto: string;
    fragmentos: string[];
    deliveryNotes: string[];
    outbound: Array<{ source: string; type: string; text?: string; url?: string }>;
  } | null;
  error?: string | null;
  rawBody: Record<string, unknown>;
  headers: Record<string, string>;
  guardrail: GuardrailPlan | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function WebhookInspector() {
  const { data, error, isLoading, mutate } = useSWR<{
    ok: boolean;
    count: number;
    entries: Entry[];
  }>("/api/webhook/manychat", fetcher, {
    refreshInterval: 5_000,
    revalidateOnFocus: true,
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading
            ? "cargando…"
            : error
              ? "error consultando inspector"
              : `${data?.count ?? 0} webhook${data?.count === 1 ? "" : "s"} en buffer`}
        </div>
        <button
          onClick={() => mutate()}
          className="text-xs px-3 py-1.5 rounded border border-border bg-card hover:bg-secondary transition-colors"
        >
          Refrescar
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="label-xs mb-2">Cómo probar desde la terminal</div>
        <pre className="text-xs font-mono bg-muted rounded px-3 py-3 overflow-x-auto whitespace-pre">
{`curl -X POST http://localhost:3000/api/webhook/manychat \\
  -H 'Content-Type: application/json' \\
  -d '{
    "last_input_text": "hola, quiero ver el catalogo de Pandora",
    "whatsapp_phone": "5217771234567",
    "phone": "5217771234567",
    "id": "subscriber_abc123",
    "email": "ana@example.com",
    "timezone": "America/Mexico_City",
    "canal_origen": "meta_ctwa",
    "anuncio_id": "ad_pandora_dia_madres"
  }'`}
        </pre>
        <p className="text-[12px] text-muted-foreground mt-3">
          También puedes simular un audio cambiando{" "}
          <code className="text-foreground">last_input_text</code> por una URL
          con extensión <code className="text-foreground">.ogg</code> — en la
          fase 2 solo se detecta el flag; Whisper viene en una fase posterior.
        </p>
      </div>

      {data?.entries?.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Aún no llega ningún webhook. Manda el curl de arriba y aparecerá
          aquí en menos de 5 segundos.
        </div>
      )}

      <ul className="space-y-2">
        {data?.entries?.map((entry) => {
          const open = expanded === entry.id;
          const t = new Date(entry.receivedAt);
          const hasGuardrail = entry.guardrail !== null;
          return (
            <li
              key={entry.id}
              className={cn(
                "rounded-lg border bg-card overflow-hidden transition-colors",
                hasGuardrail
                  ? "border-destructive/50 ring-1 ring-destructive/20"
                  : "border-border",
              )}
            >
              <button
                onClick={() => setExpanded(open ? null : entry.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
              >
                {open ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase border",
                    entry.source === "kaizen"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-border text-muted-foreground bg-secondary",
                  )}
                >
                  {entry.source}
                </span>

                {entry.cleaned.tipoMensajeOriginal === "audio" ? (
                  <Mic className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                )}

                {hasGuardrail && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border border-destructive/60 text-destructive bg-destructive/10">
                    <ShieldAlert className="h-3 w-3" />
                    {entry.guardrail!.match.category}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {entry.cleaned.userText || (
                      <span className="text-muted-foreground italic">
                        (sin texto)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {entry.cleaned.sessionId} · {entry.cleaned.canalOrigen}
                    {hasGuardrail && (
                      <span className="text-destructive ml-2">
                        · match &ldquo;{entry.guardrail!.match.keyword}&rdquo;
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {t.toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>
              </button>

              {open && (
                <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-3">
                  {entry.guardrail && (
                    <GuardrailPanel plan={entry.guardrail} />
                  )}

                  <Section title="Payload limpio (clean())">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.cleaned, null, 2)}
                    </pre>
                  </Section>

                  {entry.flow && <FlowResultPanel flow={entry.flow} />}
                  {entry.error && (
                    <Section title="Error">
                      <pre className="text-[11px] font-mono text-rosey-500 whitespace-pre-wrap break-all">
                        {entry.error}
                      </pre>
                    </Section>
                  )}

                  {(entry.kaizenSessionId || entry.kaizenCallback) && (
                    <Section title="Headers Kaizen">
                      <div className="text-[11px] font-mono space-y-1">
                        {entry.kaizenSessionId && (
                          <div>
                            <span className="text-muted-foreground">
                              x-kaizen-session-id:
                            </span>{" "}
                            {entry.kaizenSessionId}
                          </div>
                        )}
                        {entry.kaizenCallback && (
                          <div>
                            <span className="text-muted-foreground">
                              x-kaizen-callback:
                            </span>{" "}
                            {entry.kaizenCallback}
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  <Section title="Body raw (lo que mandó ManyChat)">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.rawBody, null, 2)}
                    </pre>
                  </Section>

                  <Section title="Headers">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.headers, null, 2)}
                    </pre>
                  </Section>

                  <div className="text-[11px] text-muted-foreground">
                    procesado en {entry.durationMs} ms · id{" "}
                    <code>{entry.id}</code>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-xs mb-1.5">{title}</div>
      <div className="rounded border border-border bg-card px-3 py-2 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function FlowResultPanel({
  flow,
}: {
  flow: NonNullable<Entry["flow"]>;
}) {
  const delivery = flow.deliveryNotes.join(", ") || "—";
  const stub = flow.deliveryNotes.some((n) => n.startsWith("stub"));
  const manychatOk = flow.deliveryNotes.some((n) => n.startsWith("manychat 200") || n === "manychat");
  return (
    <Section title="Resultado del flow (lo que SALIÓ)">
      <div className="space-y-2 text-[12px]">
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <div className="text-muted-foreground">mode</div>
          <div className="font-mono">{flow.mode}{flow.demo ? " · demo" : ""}</div>
          <div className="text-muted-foreground">tool ejecutada</div>
          <div className="font-mono">
            {flow.toolResult ? `${flow.toolResult.tool} · ${flow.toolResult.ok ? "ok" : "FAILED"}` : "—"}
          </div>
          <div className="text-muted-foreground">delivery</div>
          <div className={`font-mono ${stub ? "text-rosey-500" : manychatOk ? "text-sage-600" : ""}`}>
            {delivery}
            {stub && (
              <div className="text-rosey-500 text-[11px] mt-1 leading-snug">
                ⚠️ MANYCHAT_API_KEY no está configurada en Vercel. La respuesta
                NUNCA llegó al cliente porque cayó al stub.
              </div>
            )}
          </div>
          <div className="text-muted-foreground">lead creado</div>
          <div className="font-mono">{String(flow.leadCreated)}</div>
        </div>

        {flow.agenteTexto && (
          <div>
            <div className="text-muted-foreground mb-1">texto generado por Sirena</div>
            <div className="bg-cream-100 border border-foreground/10 rounded px-2 py-1.5 font-mono text-[11px] whitespace-pre-wrap">
              {flow.agenteTexto}
            </div>
          </div>
        )}

        {flow.outbound.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">
              mensajes salientes ({flow.outbound.length})
            </div>
            <div className="space-y-1">
              {flow.outbound.map((m, i) => (
                <div
                  key={i}
                  className="bg-cream-100 border border-foreground/10 rounded px-2 py-1 font-mono text-[11px]"
                >
                  <span className="text-foreground/55">
                    [{m.source}/{m.type}]
                  </span>{" "}
                  {m.type === "image" ? m.url : m.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function GuardrailPanel({ plan }: { plan: GuardrailPlan }) {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldAlert
          className="h-5 w-5 text-destructive shrink-0 mt-0.5"
          strokeWidth={1.7}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-destructive">
            Guardrail crítico disparado
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            categoría <code className="text-foreground">{plan.match.category}</code> ·
            keyword <code className="text-foreground">&ldquo;{plan.match.keyword}&rdquo;</code> ·
            motivo <code className="text-foreground">{plan.match.motivo}</code>
          </div>
        </div>
      </div>

      <div>
        <div className="label-xs mb-1.5">Payload del sub-workflow</div>
        <pre className="text-[11px] font-mono bg-card border border-border rounded px-3 py-2 whitespace-pre-wrap break-all">
          {JSON.stringify(plan.payload, null, 2)}
        </pre>
      </div>

      <div>
        <div className="label-xs mb-2">
          Acciones del sub-workflow ({plan.steps.length})
        </div>
        <ol className="space-y-1.5">
          {plan.steps.map((step, i) => (
            <li
              key={step.id}
              className="flex items-start gap-2.5 text-[12px] leading-relaxed"
            >
              <StatusDot status={step.status} />
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground tabular-nums mr-2">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground">{step.description}</span>
                <span
                  className={cn(
                    "ml-2 text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border",
                    step.status === "stub" &&
                      "border-muted text-muted-foreground bg-muted",
                    step.status === "pending-fase-4" &&
                      "border-yellow-600/40 text-yellow-700 bg-yellow-50",
                    step.status === "pending-fase-7" &&
                      "border-blue-600/40 text-blue-700 bg-blue-50",
                  )}
                >
                  {step.status === "stub"
                    ? "stub"
                    : step.status === "pending-fase-4"
                      ? "fase 4"
                      : "fase 7"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: HandoffStep["status"] }) {
  const Icon =
    status === "stub" ? Circle : status === "pending-fase-4" ? Hourglass : Clock4;
  const color =
    status === "stub"
      ? "text-muted-foreground"
      : status === "pending-fase-4"
        ? "text-yellow-600"
        : "text-blue-600";
  return <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", color)} />;
}
