"use client";

import useSWR from "swr";
import { useState } from "react";
import { ChevronDown, ChevronRight, Mic, MessageSquare } from "lucide-react";
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

type Entry = {
  id: string;
  receivedAt: string;
  durationMs: number;
  source: "manychat" | "kaizen";
  kaizenSessionId: string | null;
  kaizenCallback: string | null;
  cleaned: CleanedPayload;
  rawBody: Record<string, unknown>;
  headers: Record<string, string>;
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
          return (
            <li
              key={entry.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
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
                  <Section title="Payload limpio (clean())">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.cleaned, null, 2)}
                    </pre>
                  </Section>

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
