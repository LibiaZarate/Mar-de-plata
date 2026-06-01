"use client";

import { useState } from "react";
import { Sparkles, Send, ShieldAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Turn = {
  user: string;
  result: {
    ok: boolean;
    cleaned?: Record<string, unknown>;
    flow?: {
      demo: boolean;
      leadCreated: boolean;
      earlyExit?: { reason: string; plan: { match: { keyword: string; category: string; motivo: string } } } | null;
      verificador?: Record<string, unknown>;
      toolResult?: { tool: string; ok: boolean; notes: string[] } | null;
      agenteTexto?: string;
      fragmentos?: string[];
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
      <div>
        <div className="label-xs">Configuración · Playground</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">Playground del agente</h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Escribe como si fueras una clienta de WhatsApp. Sirena va a clasificar, ejecutar la tool
          que el Verificador sugiera, y mostrar el debug completo. Si no hay OPENROUTER_API_KEY,
          el flujo entra en modo demo determinístico.
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-4">
        <section className="rounded-lg border border-border bg-card p-5 min-h-[400px] space-y-4 flex flex-col">
          <div className="flex-1 space-y-4">
            {turns.length === 0 && (
              <div className="text-center text-muted-foreground text-[13px] py-12">
                Tu primera prueba va a aparecer aquí.
              </div>
            )}
            {turns.map((t, i) => <TurnView key={i} turn={t} />)}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="label-xs">numero de prueba</span>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="font-mono text-[11px] px-2 py-1 rounded border border-border bg-card flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && send()}
                placeholder="hola, quiero ver catalogo de pandora…"
                className="flex-1 px-3 py-2 rounded border border-border bg-card text-sm"
              />
              <button
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "…" : "Enviar"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="label-xs mb-2">Sugerencias para probar</div>
            <ul className="space-y-1.5">
              {SUGERENCIAS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => setText(s)}
                    className="text-left text-[12px] text-foreground/80 hover:text-foreground hover:bg-secondary px-2 py-1 rounded w-full"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-[11px] text-muted-foreground">
            El Playground escribe en Supabase real. Si usas un número que ya existe, se incrementan
            sus turnos. Para una sesión limpia, cambia el número de prueba.
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
        <div className="bg-muted px-3 py-2 rounded-lg max-w-[70%] text-sm">
          {turn.user}
        </div>
      </div>
      {turn.result.error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded px-3 py-2 text-[12px] text-destructive">
          {turn.result.error}
        </div>
      )}
      {f?.earlyExit && (
        <div className="border border-destructive/40 bg-destructive/5 rounded px-3 py-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <ShieldAlert className="h-4 w-4" />
            Guardrail · {f.earlyExit.plan.match.category} · {f.earlyExit.plan.match.keyword}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            motivo: <code>{f.earlyExit.plan.match.motivo}</code>
          </div>
        </div>
      )}
      {f?.toolResult && (
        <div className="border border-primary/30 bg-primary/5 rounded px-3 py-2 text-[12px]">
          <div className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Wrench className="h-3.5 w-3.5" />
            tool · {f.toolResult.tool} · {f.toolResult.ok ? "ok" : "falló"}
          </div>
          {f.toolResult.notes.map((n, i) => (
            <div key={i} className="text-muted-foreground mt-1">{n}</div>
          ))}
        </div>
      )}
      {f?.agenteTexto && (
        <div className="flex">
          <div
            className={cn(
              "bg-card border px-3 py-2 rounded-lg max-w-[70%] text-sm whitespace-pre-wrap",
              f.demo ? "border-recurrente/40" : "border-primary/30",
            )}
          >
            {f.demo && (
              <div className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-recurrente mb-1">
                <Sparkles className="h-3 w-3" />
                modo demo
              </div>
            )}
            {f.agenteTexto}
            {f.fragmentos && f.fragmentos.length > 1 && (
              <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                Parse loop: {f.fragmentos.length} fragmentos
              </div>
            )}
          </div>
        </div>
      )}
      {f?.verificador && (
        <details className="border border-border rounded px-3 py-2 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">
            Brief del Verificador · intención{" "}
            <span className="text-foreground font-medium">
              {(f.verificador.intencion_primaria as string) ?? "—"}
            </span>{" "}
            · confianza{" "}
            <span className="text-foreground">
              {(f.verificador.confianza as number)?.toFixed?.(2) ?? "—"}
            </span>
          </summary>
          <pre className="font-mono text-[10px] whitespace-pre-wrap break-all mt-2 bg-muted/40 rounded p-2">
            {JSON.stringify(f.verificador, null, 2)}
          </pre>
        </details>
      )}
      {f && (
        <div className="text-[10px] text-muted-foreground">
          {f.durationMs}ms · lead {f.leadCreated ? "creado" : "existente"}
        </div>
      )}
    </div>
  );
}
