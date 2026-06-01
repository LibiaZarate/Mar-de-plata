"use client";

import { useState } from "react";
import { Sparkles, Send, ShieldAlert, Wrench, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
      earlyExit?: { reason: string; plan: { match: { keyword: string; category: string; motivo: string } } } | null;
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

export function Playground() {
  const [text, setText] = useState("");
  const [numero, setNumero] = useState("5215550000000");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const r = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, numero }),
      });
      const data = await r.json();
      setTurns((prev) => [...prev, { user: t, result: data }]);
      setText("");
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        { user: t, result: { ok: false, error: (e as Error).message } },
      ]);
    } finally {
      setSending(false);
    }
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
            Simulador completo. Sirena clasifica, ejecuta tools, escribe en Supabase real, pero{" "}
            <strong className="text-foreground">nunca</strong> envía mensajes a WhatsApp. Los
            mensajes que se mandarían aparecen como burbujas.
          </div>
        </div>
        <span className="pill border-sage-300 bg-sage-50 text-sage-600">● Simulador</span>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-4">
        <section className="rounded-lg border border-foreground/15 bg-cream-50 p-5 min-h-[400px] space-y-4 flex flex-col">
          <div className="flex-1 space-y-4">
            {turns.length === 0 && (
              <div className="text-center text-foreground/55 text-[13px] py-12">
                Tu primera prueba va a aparecer aquí.
              </div>
            )}
            {turns.map((t, i) => <TurnView key={i} turn={t} />)}
          </div>

          <div className="border-t border-foreground/10 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="label-xs">número de prueba</span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="font-mono text-[11px] px-2 py-1 rounded border border-foreground/20 bg-cream-50 flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && send()}
                placeholder="hola, quiero ver catalogo de pandora…"
                className="flex-1 px-3 py-2 rounded border border-foreground/20 bg-cream-50 text-sm"
              />
              <button
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 text-sm font-medium disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "…" : "Enviar"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-lg border border-foreground/15 bg-cream-50 p-4">
            <div className="label-xs mb-2">Sugerencias para probar</div>
            <ul className="space-y-1.5">
              {SUGERENCIAS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => setText(s)}
                    className="text-left text-[12px] text-foreground/80 hover:text-foreground hover:bg-rosey-50 px-2 py-1 rounded w-full"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-dashed border-foreground/20 bg-cream-50 p-4 text-[11px] text-foreground/60 space-y-2">
            <p>
              <strong className="text-foreground">Escribe</strong> en Supabase real (lead, conversaciones,
              estado, alertas si corresponde).
            </p>
            <p>
              <strong className="text-foreground">NO escribe</strong> en ManyChat — los mensajes
              salientes solo se ven aquí.
            </p>
            <p>
              Si usas un número que ya existe, se incrementan sus turnos. Para una sesión limpia,
              cambia el número.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const f = turn.result.flow;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="bg-foreground/10 px-3 py-2 rounded-lg max-w-[70%] text-sm">
          {turn.user}
        </div>
      </div>

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
            <div key={i} className="text-foreground/60 mt-1">{n}</div>
          ))}
        </div>
      )}

      {/* Burbujas de mensajes salientes (catálogo + URL, FAQ + imagen, etc) */}
      {f?.outbound && f.outbound.length > 0 && (
        <div className="space-y-1.5">
          {f.outbound.map((m, i) => (
            <OutboundBubble key={i} msg={m} />
          ))}
        </div>
      )}

      {/* Cuando no hubo tool con outbound, el agenteTexto se renderiza como fallback */}
      {f && (!f.outbound || f.outbound.length === 0) && f.agenteTexto && (
        <OutboundBubble msg={{ source: "agente", type: "text", text: f.agenteTexto }} demo={f.demo} />
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

function OutboundBubble({ msg, demo }: { msg: OutboundMsg; demo?: boolean }) {
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
        {msg.type === "text" && (
          <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
        )}
        {msg.type === "image" && (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-lila-500">
              <ImageIcon className="h-3 w-3" />
              imagen
            </div>
            <a
              href={msg.url}
              target="_blank"
              rel="noreferrer"
              className="block text-[12px] font-mono text-lila-500 underline break-all"
            >
              {msg.url}
            </a>
          </div>
        )}
        <div className="text-[10px] text-foreground/40 mt-1">
          {msg.source === "tool" ? "vía tool" : "vía agente"}
        </div>
      </div>
    </div>
  );
}
