"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Send,
  ShieldAlert,
  Wrench,
  Image as ImageIcon,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { mutate } from "swr";
import { cn } from "@/lib/utils";
import {
  useConversacionHistory,
  useRecentConversations,
  type ConversacionMsg,
} from "@/lib/queries";

type OutboundMsg = {
  source: "tool" | "agente";
  type: "text" | "image";
  text?: string;
  url?: string;
};

type Turn = {
  user: string;
  result: {
    ok: boolean;
    cleaned?: Record<string, unknown>;
    flow?: {
      mode: "production" | "simulator";
      demo: boolean;
      leadCreated: boolean;
      earlyExit?: {
        reason: string;
        plan: { match: { keyword: string; category: string; motivo: string } };
      } | null;
      verificador?: Record<string, unknown>;
      toolResult?: { tool: string; ok: boolean; notes: string[] } | null;
      agenteTexto?: string;
      fragmentos?: string[];
      outbound?: OutboundMsg[];
      durationMs?: number;
    };
    error?: string;
  };
};

const SUGERENCIAS = [
  "hola, quiero ver el catalogo de Pandora",
  "¿hacen envios a Guadalajara?",
  "quiero entrar al grupo de mayoreo",
  "necesito hablar con una asesora real",
  "esto es un fraude, voy a Profeco",
];

const LS_NUMERO = "playground:numero";
const DEFAULT_NUMERO = "5215550000000";

function randomNumero(): string {
  // Genera un número MX random para empezar una sesión limpia
  const tail = Math.floor(1000000 + Math.random() * 9000000);
  return `52155${tail}`;
}

export function Playground() {
  const [text, setText] = useState("");
  const [numero, setNumero] = useState<string>(DEFAULT_NUMERO);
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Restaurar último número usado
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(LS_NUMERO) : null;
    if (saved) setNumero(saved);
    setHydrated(true);
  }, []);

  // Persistir número + limpiar turnos in-memory al cambiar de número
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_NUMERO, numero);
    setTurns([]);
  }, [numero, hydrated]);

  const history = useConversacionHistory(numero);
  const recents = useRecentConversations();

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setPending(t);
    setText("");
    setSending(true);
    try {
      const r = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, numero }),
      });
      const data = await r.json();
      setTurns((prev) => [...prev, { user: t, result: data }]);
      // refresca historial + recents + métricas globales para que se vea
      // el lead en el pipeline y los KPIs
      history.mutate();
      recents.mutate();
      mutate("kpi:leads_hoy");
      mutate("blocC:embudo");
      mutate("blocB:canales");
      mutate((k) => Array.isArray(k) && k[0] === "pipeline");
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        { user: t, result: { ok: false, error: (e as Error).message } },
      ]);
    } finally {
      setPending(null);
      setSending(false);
    }
  }

  function nuevaSesion() {
    setNumero(randomNumero());
  }

  return (
    <div className="px-10 py-6 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label-xs">Configuración · Playground</div>
          <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
            Playground del agente
          </h1>
          <div className="text-[13px] text-foreground/60 mt-2">
            Simulador completo. Sirena <strong>escribe en Supabase real</strong> (lead,
            conversaciones, alertas) y se ve en el Pipeline y en las métricas, pero{" "}
            <strong>nunca</strong> envía mensajes a WhatsApp.
          </div>
        </div>
        <span className="pill border-sage-300 bg-sage-50 text-sage-600">● Simulador</span>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4">
        <section className="rounded-lg border border-foreground/15 bg-cream-50 p-5 min-h-[500px] flex flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[640px]">
            {history.isLoading && (
              <div className="text-center text-foreground/45 text-[12px] py-3">
                Cargando historial…
              </div>
            )}
            {history.data && history.data.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase text-foreground/50">
                  <span className="h-px bg-foreground/15 flex-1" />
                  <span>Conversación anterior · {history.data.length} mensaje{history.data.length === 1 ? "" : "s"}</span>
                  <span className="h-px bg-foreground/15 flex-1" />
                </div>
                {history.data.map((m) => (
                  <HistoryBubble key={m.id} msg={m} />
                ))}
                {turns.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase text-rosey-400 my-1">
                    <span className="h-px bg-rosey-200 flex-1" />
                    <span>Nuevos turnos</span>
                    <span className="h-px bg-rosey-200 flex-1" />
                  </div>
                )}
              </>
            )}
            {history.data?.length === 0 && turns.length === 0 && !pending && (
              <div className="text-center text-foreground/55 text-[13px] py-8">
                Sin conversación previa con este número. Escribe abajo para empezar.
              </div>
            )}
            {turns.map((t, i) => (
              <TurnView key={i} turn={t} />
            ))}
            {pending && <PendingTurn text={pending} />}
          </div>

          <div className="border-t border-foreground/10 pt-3 mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="label-xs">número de prueba</span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="font-mono text-[11px] px-2 py-1 rounded border border-foreground/20 bg-cream-50 flex-1"
              />
              <button
                onClick={nuevaSesion}
                disabled={sending}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-foreground/20 hover:bg-cream-100 text-foreground/70"
                title="Generar un número random para empezar una sesión limpia"
              >
                <RotateCcw className="h-3 w-3" />
                Nueva sesión
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="hola, quiero ver catalogo de pandora…"
                className="flex-1 px-3 py-2 rounded border border-foreground/20 bg-cream-50 text-sm"
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={sending || !text.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 text-sm font-medium disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <RecentsPanel
            recents={recents.data ?? []}
            currentNumero={numero}
            onPick={(n) => setNumero(n)}
          />

          <div className="rounded-lg border border-foreground/15 bg-cream-50 p-4">
            <div className="label-xs mb-2">Sugerencias para probar</div>
            <ul className="space-y-1.5">
              {SUGERENCIAS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => setText(s)}
                    disabled={sending}
                    className="text-left text-[12px] text-foreground/80 hover:text-foreground hover:bg-rosey-50 px-2 py-1 rounded w-full disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-dashed border-foreground/20 bg-cream-50 p-4 text-[11px] text-foreground/60 space-y-2">
            <p>
              <strong className="text-foreground">Escribe</strong> en Supabase (lead,
              conversaciones, estado, alertas) y se ve en{" "}
              <Link href="/pipeline" className="text-rosey-500 underline">
                Pipeline
              </Link>{" "}
              y en las métricas.
            </p>
            <p>
              <strong className="text-foreground">NO escribe</strong> en ManyChat.
            </p>
            <p>Los leads de prueba quedan marcados con etiqueta <code>playground</code>.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Panel lateral de conversaciones recientes
// ─────────────────────────────────────────────

function RecentsPanel({
  recents,
  currentNumero,
  onPick,
}: {
  recents: ReturnType<typeof useRecentConversations>["data"] extends infer T
    ? Exclude<T, undefined>
    : never;
  currentNumero: string;
  onPick: (numero: string) => void;
}) {
  if (!recents || recents.length === 0) {
    return (
      <div className="rounded-lg border border-foreground/15 bg-cream-50 p-4">
        <div className="label-xs mb-2">Conversaciones recientes</div>
        <p className="text-[11px] text-foreground/55 italic">
          Aún no hay conversaciones registradas.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-foreground/15 bg-cream-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="label-xs">Conversaciones recientes</span>
        <span className="text-[10px] text-foreground/45">{recents.length}</span>
      </div>
      <ul className="space-y-1.5">
        {recents.map((r) => {
          const isCurrent = r.numero === currentNumero;
          const tail = r.numero.slice(-4);
          const label = r.nombre || `Sin nombre · ${tail}`;
          return (
            <li key={r.numero}>
              <button
                onClick={() => onPick(r.numero)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded border transition-colors",
                  isCurrent
                    ? "border-rosey-300 bg-rosey-50"
                    : "border-transparent hover:bg-rosey-50/40 hover:border-foreground/10",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium truncate flex-1">{label}</span>
                  {r.etiquetas.includes("playground") && (
                    <span className="text-[9px] tracking-wider uppercase px-1 py-0.5 rounded border border-lila-300 text-lila-500 bg-lila-50">
                      test
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-foreground/50 truncate font-mono">
                  {r.numero}
                </div>
                <div className="text-[11px] text-foreground/60 mt-0.5 truncate">
                  {r.lastDir === "entrante" ? "→ " : "← "}
                  {r.lastText || <em>(sin texto)</em>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/pipeline"
        className="mt-3 inline-flex items-center gap-1 text-[11px] text-rosey-500 hover:text-rosey-600"
      >
        Ver todos en Pipeline <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Burbujas
// ─────────────────────────────────────────────

function PendingTurn({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      <UserBubble text={text} />
      <TypingBubble />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-foreground/10 px-3 py-2 rounded-lg max-w-[70%] text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function HistoryBubble({ msg }: { msg: ConversacionMsg }) {
  const isUser = msg.direccion === "entrante";
  const time = new Date(msg.timestamp).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="bg-foreground/10 px-3 py-2 rounded-lg max-w-[70%] text-sm whitespace-pre-wrap">
          {msg.texto || <em className="text-foreground/45">(sin texto)</em>}
        </div>
        <span className="text-[9px] text-foreground/40 mt-0.5 mr-1">{time}</span>
      </div>
    );
  }
  // saliente (Sirena) — si trae imagen, se renderiza arriba
  const hasImage = msg.tipo_mensaje === "imagen" && !!msg.media_url;
  const hasText = !!msg.texto;
  return (
    <div className="flex flex-col items-start">
      {hasImage && (
        <div className="mb-1">
          <ImagePreview url={msg.media_url!} caption={hasText ? undefined : "imagen"} />
        </div>
      )}
      {hasText && (
        <div className="max-w-[70%] rounded-lg border border-rosey-200 bg-cream-50 px-3 py-2">
          <div className="text-sm whitespace-pre-wrap">{msg.texto}</div>
          {msg.tool_ejecutada && (
            <div className="text-[10px] text-foreground/40 mt-1">
              tool: {msg.tool_ejecutada}
            </div>
          )}
        </div>
      )}
      <span className="text-[9px] text-foreground/40 mt-0.5 ml-1">{time}</span>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex">
      <div className="bg-cream-50 border border-rosey-200 rounded-lg px-4 py-2.5 flex items-center gap-1">
        <Dot delay={0} />
        <Dot delay={180} />
        <Dot delay={360} />
        <span className="sr-only">Sirena está escribiendo</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-rosey-400 inline-block"
      style={{
        animation: "typing-dot 1.2s infinite ease-in-out",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const f = turn.result.flow;
  return (
    <div className="space-y-2">
      <UserBubble text={turn.user} />

      {turn.result.error && (
        <div className="border border-rosey-300 bg-rosey-50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {turn.result.error}
        </div>
      )}

      {f?.earlyExit && (
        <div className="border border-rosey-300 bg-rosey-50/60 rounded px-3 py-2">
          <div className="flex items-center gap-2 text-rosey-500 font-medium text-sm">
            <ShieldAlert className="h-4 w-4" />
            Guardrail · {f.earlyExit.plan.match.category} · {f.earlyExit.plan.match.keyword}
          </div>
          <div className="text-[11px] text-foreground/60 mt-1">
            motivo: <code>{f.earlyExit.plan.match.motivo}</code>
          </div>
        </div>
      )}

      {f?.toolResult && (
        <div className="border border-lila-300 bg-lila-50/60 rounded px-3 py-2 text-[12px]">
          <div className="inline-flex items-center gap-1.5 font-medium text-lila-500">
            <Wrench className="h-3.5 w-3.5" />
            tool · {f.toolResult.tool} · {f.toolResult.ok ? "ok" : "falló"}
          </div>
          {f.toolResult.notes.map((n, i) => (
            <div key={i} className="text-foreground/60 mt-1">
              {n}
            </div>
          ))}
        </div>
      )}

      {f?.outbound && f.outbound.length > 0 ? (
        <StaggeredBubbles messages={f.outbound} demo={!!f.demo} />
      ) : (
        f?.agenteTexto && (
          <StaggeredBubbles
            messages={[{ source: "agente", type: "text", text: f.agenteTexto }]}
            demo={!!f.demo}
          />
        )
      )}

      {f?.verificador && (
        <details className="border border-foreground/10 rounded px-3 py-2 text-[11px]">
          <summary className="cursor-pointer text-foreground/55">
            Brief del Verificador · intención{" "}
            <span className="text-foreground font-medium">
              {(f.verificador.intencion_primaria as string) ?? "—"}
            </span>{" "}
            · confianza{" "}
            <span className="text-foreground">
              {(f.verificador.confianza as number)?.toFixed?.(2) ?? "—"}
            </span>
          </summary>
          <pre className="font-mono text-[10px] whitespace-pre-wrap break-all mt-2 bg-cream-100 rounded p-2">
            {JSON.stringify(f.verificador, null, 2)}
          </pre>
        </details>
      )}

      {f && (
        <div className="text-[10px] text-foreground/55 flex gap-2 items-center">
          {f.durationMs}ms · lead {f.leadCreated ? "creado" : "existente"} · modo{" "}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-sage-300 bg-sage-50 text-sage-600 tracking-wider uppercase text-[9px]">
            simulador
          </span>
        </div>
      )}
    </div>
  );
}

function StaggeredBubbles({ messages, demo }: { messages: OutboundMsg[]; demo: boolean }) {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(messages.length > 1);

  useEffect(() => {
    if (visible >= messages.length) {
      setTyping(false);
      return;
    }
    const isFirst = visible === 0;
    const typingMs = isFirst ? 400 : 900;
    setTyping(true);
    const t = setTimeout(() => {
      setVisible((v) => v + 1);
      setTyping(visible + 1 < messages.length);
    }, typingMs);
    return () => clearTimeout(t);
  }, [visible, messages.length]);

  return (
    <div className="space-y-1.5">
      {messages.slice(0, visible).map((m, i) => (
        <OutboundBubble key={i} msg={m} demo={demo && i === 0} />
      ))}
      {typing && <TypingBubble />}
    </div>
  );
}

function OutboundBubble({ msg, demo }: { msg: OutboundMsg; demo?: boolean }) {
  // Imagen → burbuja con la imagen renderizada (sin el wrapper rectangular
  // chato del texto). Se ve como un attachment de WhatsApp.
  if (msg.type === "image" && msg.url) {
    return (
      <div className="flex flex-col items-start">
        {demo && (
          <div className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-ambr-500 mb-1">
            <Sparkles className="h-3 w-3" />
            modo demo (sin OpenRouter)
          </div>
        )}
        <ImagePreview url={msg.url} />
        <div className="text-[10px] text-foreground/40 mt-1 ml-1">
          {msg.source === "tool" ? "vía tool" : "vía agente"}
        </div>
      </div>
    );
  }

  const tone = msg.source === "tool" ? "border-lila-300" : "border-rosey-300";
  return (
    <div className="flex">
      <div className={cn("max-w-[70%] rounded-lg border bg-cream-50 px-3 py-2", tone)}>
        {demo && (
          <div className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-ambr-500 mb-1">
            <Sparkles className="h-3 w-3" />
            modo demo (sin OpenRouter)
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
        <div className="text-[10px] text-foreground/40 mt-1">
          {msg.source === "tool" ? "vía tool" : "vía agente"}
        </div>
      </div>
    </div>
  );
}

// Burbuja-attachment con la imagen renderizada al estilo WhatsApp.
// Maneja loading, error y click-to-zoom.
function ImagePreview({ url, caption }: { url: string; caption?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="max-w-[280px] rounded-lg border border-rosey-300 bg-rosey-50/40 px-3 py-2.5">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-rosey-500 font-medium">
          <ImageIcon className="h-3 w-3" />
          no se pudo cargar la imagen
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block text-[11px] font-mono text-rosey-500 underline break-all mt-1"
        >
          {url}
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block max-w-[280px] rounded-lg overflow-hidden border border-rosey-200 bg-cream-100 group"
      title="Abrir en tamaño completo"
    >
      <div className="relative">
        {!loaded && (
          <div className="absolute inset-0 bg-cream-200 animate-pulse flex items-center justify-center min-h-[180px]">
            <ImageIcon className="h-8 w-8 text-foreground/25" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={caption ?? "imagen enviada por Sirena"}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "block w-full h-auto transition-opacity",
            loaded ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
        />
      </div>
      {caption && (
        <div className="px-3 py-2 text-sm whitespace-pre-wrap border-t border-rosey-200/60">
          {caption}
        </div>
      )}
    </a>
  );
}
