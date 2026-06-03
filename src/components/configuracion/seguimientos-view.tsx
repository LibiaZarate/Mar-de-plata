"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Clock,
  Send,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

type Plantilla = {
  tipo: string;
  descripcion: string;
  offset_dias_default: number;
  texto_default: string;
  texto_override: string | null;
  texto_efectivo: string;
};

type Pendiente = {
  id: number;
  numero_whatsapp: string;
  tipo: string;
  ejecutar_en: string;
  contexto: Record<string, unknown> | null;
  created_at: string;
};

type Reciente = {
  id: number;
  numero_whatsapp: string;
  tipo: string;
  ejecutar_en: string;
  ejecutado_en: string;
  resultado: string | null;
  mensaje_enviado: string | null;
};

export function SeguimientosView() {
  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Seguimientos automáticos</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Seguimientos</h1>
        <div className="text-[13px] text-foreground/60 mt-2 max-w-3xl">
          Mensajes que Sirena programa después de cada conversación (lead frío, post-compra,
          depósito pendiente, reactivación). Edita las plantillas, mira la cola, dispara
          pruebas y revisa lo recién enviado.
        </div>
      </div>

      <MigracionAviso />
      <Plantillas />
      <Probar />
      <Cola />
    </div>
  );
}

function MigracionAviso() {
  return (
    <details className="rounded-lg border border-ambr-300 bg-ambr-50/40 px-4 py-3">
      <summary className="cursor-pointer text-[13px] font-medium text-foreground flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-ambr-600" />
        Necesario: correr la migración una vez en Supabase
      </summary>
      <div className="text-[12px] text-foreground/75 mt-3 space-y-2">
        <p>
          Si ves errores que mencionan <code>ejecutado_en</code>, corre esto una vez en{" "}
          Supabase → SQL Editor:
        </p>
        <pre className="text-[11px] font-mono bg-cream-100 border border-foreground/10 rounded px-3 py-3 whitespace-pre overflow-x-auto">{`ALTER TABLE seguimientos_programados
ADD COLUMN IF NOT EXISTS ejecutado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resultado TEXT,
ADD COLUMN IF NOT EXISTS mensaje_enviado TEXT;

CREATE INDEX IF NOT EXISTS idx_seguimientos_pendientes
ON seguimientos_programados (ejecutar_en)
WHERE ejecutado_en IS NULL;`}</pre>
      </div>
    </details>
  );
}

function Plantillas() {
  const { data, isLoading } = useSWR<{ ok: boolean; items: Plantilla[]; error?: string }>(
    "/api/seguimientos/plantillas",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const items = data?.items ?? [];
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    Record<string, "ok" | "err" | "saving" | undefined>
  >({});

  async function guardar(tipo: string) {
    const texto = edits[tipo] ?? "";
    setStatus((s) => ({ ...s, [tipo]: "saving" }));
    const r = await fetch("/api/seguimientos/plantillas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, texto }),
    });
    const d = await r.json();
    if (!d.ok) {
      setStatus((s) => ({ ...s, [tipo]: "err" }));
      return;
    }
    setStatus((s) => ({ ...s, [tipo]: "ok" }));
    setTimeout(() => setStatus((s) => ({ ...s, [tipo]: undefined })), 2000);
    mutate("/api/seguimientos/plantillas");
  }

  return (
    <section className="space-y-3">
      <div>
        <div className="label-xs">Plantillas por tipo</div>
        <div className="text-[12px] text-foreground/55 mt-1">
          Usa <code>{"{nombre}"}</code> como placeholder del nombre de la clienta. Si está
          vacío en el lead, Sirena pone &ldquo;linda&rdquo;.
        </div>
      </div>

      {isLoading && <div className="h-32 rounded bg-cream-200 animate-pulse" />}

      {items.map((p) => {
        const valorActual = edits[p.tipo] ?? p.texto_efectivo;
        const usandoDefault = !p.texto_override;
        const st = status[p.tipo];
        return (
          <div
            key={p.tipo}
            className="rounded-lg border border-foreground/15 bg-cream-50 p-4 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <div className="font-mono text-[13px] text-foreground">{p.tipo}</div>
                <div className="text-[11px] text-foreground/55 mt-0.5">{p.descripcion}</div>
              </div>
              <div className="text-[10px] text-foreground/55">
                {usandoDefault ? "usando default" : "personalizado"}
              </div>
            </div>
            <textarea
              value={valorActual}
              onChange={(e) => setEdits({ ...edits, [p.tipo]: e.target.value })}
              rows={3}
              className="w-full text-[13px] font-mono leading-snug px-3 py-2 rounded border border-foreground/15 bg-cream-50 focus:border-rosey-300 outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setEdits({ ...edits, [p.tipo]: p.texto_default })}
                className="text-[11px] text-foreground/55 hover:text-foreground underline"
              >
                ↺ restaurar default
              </button>
              <button
                onClick={() => guardar(p.tipo)}
                disabled={st === "saving" || edits[p.tipo] === undefined}
                className="text-[12px] px-3 py-1.5 rounded border border-foreground/20 bg-cream-50 hover:bg-cream-100 inline-flex items-center gap-1 disabled:opacity-40"
              >
                {st === "saving" ? (
                  "guardando…"
                ) : st === "ok" ? (
                  <>
                    <Check className="h-3 w-3 text-sage-600" />{" "}
                    <span className="text-sage-600">guardado</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" /> Guardar
                  </>
                )}
              </button>
            </div>
            {st === "err" && (
              <div className="text-[11px] text-rosey-500">Error al guardar.</div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Probar() {
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("prueba_simulador");
  const [delayMin, setDelayMin] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function programar() {
    if (!numero.trim()) {
      setMsg("Falta el número");
      return;
    }
    setLoading(true);
    setMsg(null);
    const r = await fetch("/api/seguimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero_whatsapp: numero.trim(),
        tipo,
        delay_min: delayMin,
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (!d.ok) {
      setMsg(`Error: ${d.error}`);
      return;
    }
    setMsg(`Programado id=${d.programado.id} para ${new Date(d.programado.ejecutar_en).toLocaleString("es-MX")}`);
    mutate("/api/seguimientos");
  }

  async function ejecutarAhora() {
    setLoading(true);
    setMsg(null);
    const r = await fetch("/api/cron/seguimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "simulator",
        numero_whatsapp: numero.trim() || undefined,
        lookahead_min: 60 * 24, // dispara también lo que vence en las próximas 24h
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (!d.ok) {
      setMsg(`Error: ${d.error ?? "desconocido"}`);
      return;
    }
    const enviados = d.procesados.filter((p: { resultado: string }) => p.resultado === "enviado").length;
    const saltados = d.procesados.filter((p: { resultado: string }) => p.resultado === "saltado").length;
    setMsg(
      `Ejecutados ${d.procesados.length} (${enviados} enviados, ${saltados} saltados de ${d.total_pendientes} totales en ventana).`,
    );
    mutate("/api/seguimientos");
  }

  return (
    <section className="rounded-lg border border-rosey-200 bg-rosey-50/20 px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-rosey-500" />
        <div className="font-serif-display text-xl leading-none">Probar la cola</div>
      </div>
      <div className="text-[12px] text-foreground/65">
        Programa un seguimiento de prueba a 5 min o 24h y luego ejecuta el cron en modo
        simulador para verlo aparecer en el playground del lead.
      </div>

      <div className="grid grid-cols-[1fr_180px_120px_auto] gap-2 items-end">
        <div>
          <div className="label-xs mb-1">Número (whatsapp)</div>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="ej. 5217771234567"
            className="w-full px-3 py-1.5 text-sm border border-foreground/20 rounded bg-cream-50 outline-none focus:border-rosey-300 font-mono"
          />
        </div>
        <div>
          <div className="label-xs mb-1">Tipo</div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-foreground/20 rounded bg-cream-50 outline-none focus:border-rosey-300"
          >
            <option value="prueba_simulador">prueba_simulador</option>
            <option value="lead_frio_24h">lead_frio_24h</option>
            <option value="post_compra_7d">post_compra_7d</option>
            <option value="deposito_pendiente_24h">deposito_pendiente_24h</option>
            <option value="reactivacion_30d">reactivacion_30d</option>
          </select>
        </div>
        <div>
          <div className="label-xs mb-1">Delay (min)</div>
          <input
            type="number"
            value={delayMin}
            onChange={(e) => setDelayMin(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-foreground/20 rounded bg-cream-50 outline-none focus:border-rosey-300"
          />
        </div>
        <button
          onClick={programar}
          disabled={loading || !numero.trim()}
          className="px-3 py-1.5 text-sm rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Clock className="h-3 w-3" />
          Programar
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setTipo("prueba_simulador");
            setDelayMin(5);
          }}
          className="text-[11px] px-2 py-1 rounded border border-foreground/15 hover:bg-cream-100"
        >
          Preset: prueba en 5 min
        </button>
        <button
          onClick={() => {
            setTipo("lead_frio_24h");
            setDelayMin(60 * 24);
          }}
          className="text-[11px] px-2 py-1 rounded border border-foreground/15 hover:bg-cream-100"
        >
          Preset: lead frío 24h
        </button>
        <div className="flex-1" />
        <button
          onClick={ejecutarAhora}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded border border-sage-300 bg-sage-50 hover:bg-sage-100 text-sage-600 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          Ejecutar pendientes ahora (simulador)
        </button>
      </div>

      {msg && (
        <div className="text-[12px] text-foreground/75 bg-cream-100 rounded px-3 py-2">
          {msg}
        </div>
      )}
    </section>
  );
}

function Cola() {
  const { data, isLoading } = useSWR<{
    ok: boolean;
    pendientes: Pendiente[];
    recientes: Reciente[];
    error?: string;
  }>("/api/seguimientos", fetcher, { refreshInterval: 30_000 });

  const pendientes = data?.pendientes ?? [];
  const recientes = data?.recientes ?? [];
  const error = data && !data.ok ? data.error : null;

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este seguimiento programado?")) return;
    await fetch(`/api/seguimientos?id=${id}`, { method: "DELETE" });
    mutate("/api/seguimientos");
  }

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded border border-rosey-300 bg-rosey-50/30 px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}

      <div>
        <div className="label-xs">Cola pendiente ({pendientes.length})</div>
        <div className="text-[11px] text-foreground/55 mt-1">
          Lo que aún no se ha disparado. Se ejecutan automáticamente cuando llega su hora.
        </div>
      </div>
      <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
        <div className="grid grid-cols-[140px_120px_1fr_180px_60px] text-[10px] tracking-wider uppercase text-foreground/55 px-4 py-2 border-b border-foreground/10">
          <div>Número</div>
          <div>Tipo</div>
          <div>Vence</div>
          <div>Programado</div>
          <div></div>
        </div>
        {isLoading && <div className="h-16 bg-cream-200 animate-pulse" />}
        {!isLoading && pendientes.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-foreground/55 italic">
            Sin seguimientos pendientes.
          </div>
        )}
        {pendientes.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[140px_120px_1fr_180px_60px] items-center px-4 py-2.5 border-b border-foreground/10 last:border-0 text-[12px] hover:bg-cream-100/40"
          >
            <div className="font-mono">{p.numero_whatsapp}</div>
            <div className="font-mono text-[11px] text-foreground/75">{p.tipo}</div>
            <div className="tabular-nums">
              {new Date(p.ejecutar_en).toLocaleString("es-MX")}
            </div>
            <div className="text-foreground/55 tabular-nums">
              {new Date(p.created_at).toLocaleString("es-MX")}
            </div>
            <div className="text-right">
              <button
                onClick={() => eliminar(p.id)}
                className="text-foreground/40 hover:text-rosey-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="label-xs">Ejecutados recientes ({recientes.length})</div>
      </div>
      <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
        <div className="grid grid-cols-[140px_120px_1fr_140px] text-[10px] tracking-wider uppercase text-foreground/55 px-4 py-2 border-b border-foreground/10">
          <div>Número</div>
          <div>Tipo</div>
          <div>Resultado</div>
          <div>Ejecutado</div>
        </div>
        {recientes.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-foreground/55 italic">
            Aún no hay ejecutados.
          </div>
        )}
        {recientes.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[140px_120px_1fr_140px] items-start px-4 py-2.5 border-b border-foreground/10 last:border-0 text-[12px] hover:bg-cream-100/40"
          >
            <div className="font-mono">{r.numero_whatsapp}</div>
            <div className="font-mono text-[11px] text-foreground/75">{r.tipo}</div>
            <div>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] mr-2",
                  r.resultado?.startsWith("enviado")
                    ? "bg-sage-100 text-sage-600"
                    : r.resultado?.startsWith("saltado")
                      ? "bg-ambr-100 text-ambr-600"
                      : "bg-rosey-100 text-rosey-500",
                )}
              >
                {r.resultado ?? "—"}
              </span>
              {r.mensaje_enviado && (
                <div className="text-foreground/65 mt-1 text-[11px] leading-snug">
                  {r.mensaje_enviado}
                </div>
              )}
            </div>
            <div className="text-foreground/55 tabular-nums">
              {r.ejecutado_en ? new Date(r.ejecutado_en).toLocaleString("es-MX") : "—"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
