"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  X,
  Clock,
  Send,
  ExternalLink,
  Sparkles,
  MessageCircle,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type Etiqueta = {
  key: string;
  label: string;
  tono: "neutral" | "verde" | "ambar" | "rojo" | "lila" | "sky";
};

const TONOS: Record<Etiqueta["tono"], string> = {
  neutral: "border-foreground/20 bg-cream-100 text-foreground",
  verde: "border-sage-300 bg-sage-50 text-sage-700",
  ambar: "border-ambr-300 bg-ambr-50 text-ambr-600",
  rojo: "border-rosey-400 bg-rosey-100 text-rosey-600",
  lila: "border-lila-300 bg-lila-50 text-lila-500",
  sky: "border-skyy-300 bg-skyy-50 text-skyy-500",
};

type Mensaje = {
  id: number;
  direccion: "entrante" | "saliente";
  texto: string | null;
  tipo_mensaje: string | null;
  tool_ejecutada: string | null;
  timestamp: string;
};

type Seguimiento = {
  id: number;
  tipo: string;
  ejecutar_en: string;
  ejecutado_en: string | null;
  resultado: string | null;
  mensaje_enviado: string | null;
  contexto: Record<string, unknown> | null;
  estado_render: "enviado" | "saltado" | "error" | "pendiente" | "pendiente_atrasado";
};

type LeadDetail = {
  ok: boolean;
  lead: {
    numero_whatsapp: string;
    nombre: string | null;
    ciudad: string | null;
    canal_origen: string | null;
    tipo: string | null;
    estado: string;
    compras_totales: number;
    monto_acumulado: number;
    fecha_primera_compra: string | null;
    fecha_ultima_compra: string | null;
    etiquetas: string[] | null;
    primer_contacto: string;
    ultima_interaccion: string;
  };
  estado: Record<string, unknown> | null;
  mensajes: Mensaje[];
  seguimientos: Seguimiento[];
  etiquetas: Etiqueta[];
  snapshot: Record<string, unknown>;
};

export function LeadDetailDrawer({
  numero,
  onClose,
}: {
  numero: string;
  onClose: () => void;
}) {
  const { data, error, isLoading } = useSWR<LeadDetail>(
    `/api/dashboard/lead-detail/${encodeURIComponent(numero)}`,
    fetcher,
    { refreshInterval: 15_000 },
  );

  return (
    <div
      className="fixed inset-0 z-40 bg-foreground/40"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-cream-50 shadow-2xl overflow-y-auto z-50"
      >
        <div className="sticky top-0 bg-cream-50 border-b border-foreground/10 px-5 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="label-xs">Detalle del lead</div>
            <div className="text-[15px] font-medium truncate">
              {data?.lead?.nombre?.trim() || "Sin nombre"}
            </div>
            <div className="text-[11px] text-foreground/55 font-mono">{numero}</div>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${numero.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] px-2 py-1.5 rounded border border-foreground/20 hover:bg-cream-100 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> WA
            </a>
            <button
              onClick={onClose}
              className="text-[12px] p-1.5 rounded border border-foreground/20 hover:bg-cream-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isLoading && <div className="p-5 text-[12px] text-foreground/55">Cargando…</div>}
        {error && (
          <div className="m-5 border border-rosey-300 bg-rosey-50/40 px-3 py-2 rounded text-[12px] text-rosey-600">
            {(error as Error).message}
          </div>
        )}
        {data?.ok && (
          <div className="p-5 space-y-5">
            <ChipsSection chips={data.etiquetas} />
            <DatosSection lead={data.lead} />
            <SeguimientosSection
              numero={numero}
              seguimientos={data.seguimientos}
            />
            <MensajesSection mensajes={data.mensajes} />
          </div>
        )}
      </aside>
    </div>
  );
}

function ChipsSection({ chips }: { chips: Etiqueta[] }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div>
      <div className="label-xs mb-2">Etiquetas</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.key}
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded border",
              TONOS[c.tono],
            )}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DatosSection({ lead }: { lead: LeadDetail["lead"] }) {
  return (
    <div>
      <div className="label-xs mb-2">Datos</div>
      <div className="grid grid-cols-2 gap-y-1 text-[12px]">
        <span className="text-foreground/55">Canal</span>
        <span>{lead.canal_origen ?? "—"}</span>
        <span className="text-foreground/55">Ciudad</span>
        <span>{lead.ciudad ?? "—"}</span>
        <span className="text-foreground/55">Tipo</span>
        <span>{lead.tipo ?? "—"}</span>
        <span className="text-foreground/55">Estado</span>
        <span className="font-medium">{lead.estado}</span>
        <span className="text-foreground/55">Compras</span>
        <span>{lead.compras_totales} · {formatMxn(lead.monto_acumulado || 0)}</span>
        <span className="text-foreground/55">Primer contacto</span>
        <span>{new Date(lead.primer_contacto).toLocaleString("es-MX")}</span>
        <span className="text-foreground/55">Última interacción</span>
        <span>{new Date(lead.ultima_interaccion).toLocaleString("es-MX")}</span>
      </div>
    </div>
  );
}

function SeguimientosSection({
  numero,
  seguimientos,
}: {
  numero: string;
  seguimientos: Seguimiento[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label-xs">Seguimientos ({seguimientos.length})</div>
      </div>
      <ProgramarForm numero={numero} />
      {seguimientos.length === 0 && (
        <div className="text-[12px] text-foreground/50 italic py-4 text-center border border-dashed border-foreground/15 rounded mt-3">
          Sin seguimientos programados todavía
        </div>
      )}
      <div className="mt-3 space-y-2">
        {seguimientos.map((s) => (
          <SeguimientoCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}

const TIPOS_SEG = [
  { v: "lead_frio_24h", label: "Lead frío 24h" },
  { v: "post_compra_7d", label: "Post-compra 7d" },
  { v: "deposito_pendiente_24h", label: "Depósito pendiente 24h" },
  { v: "reactivacion_30d", label: "Reactivación 30d" },
  { v: "prueba_simulador", label: "Prueba (simulador)" },
];

function ProgramarForm({ numero }: { numero: string }) {
  const [tipo, setTipo] = useState("prueba_simulador");
  const [valor, setValor] = useState<number>(2);
  const [unidad, setUnidad] = useState<"min" | "horas" | "dias">("horas");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tono: "ok" | "err"; texto: string } | null>(null);

  async function programar(override?: {
    valor?: number;
    unidad?: "min" | "horas" | "dias";
    tipo?: string;
  }) {
    setEnviando(true);
    setFeedback(null);
    const u = override?.unidad ?? unidad;
    const v = override?.valor ?? valor;
    const t = override?.tipo ?? tipo;
    const body: Record<string, unknown> = { numero, tipo: t };
    if (u === "min") body.minutos_offset = v;
    if (u === "horas") body.horas_offset = v;
    if (u === "dias") body.dias_offset = v;
    const r = await fetch("/api/seguimientos/programar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setEnviando(false);
    if (!d.ok) {
      setFeedback({ tono: "err", texto: d.error ?? "Falló" });
      return;
    }
    setFeedback({
      tono: "ok",
      texto: `Programado para ${new Date(d.ejecutar_en).toLocaleString("es-MX")}`,
    });
    mutate(`/api/dashboard/lead-detail/${encodeURIComponent(numero)}`);
    mutate("/api/dashboard/pipeline");
  }

  return (
    <div className="rounded-lg border border-rosey-200 bg-rosey-50/30 px-3 py-3 space-y-2">
      <div className="text-[11px] text-foreground/65 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Programar nuevo seguimiento
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => programar({ valor: 10, unidad: "min", tipo: "prueba_simulador" })}
          disabled={enviando}
          className="text-[11px] px-2 py-1 rounded border border-foreground/20 hover:bg-cream-100 disabled:opacity-50"
        >
          + 10 min (prueba)
        </button>
        <button
          onClick={() => programar({ valor: 2, unidad: "horas", tipo: "lead_frio_24h" })}
          disabled={enviando}
          className="text-[11px] px-2 py-1 rounded border border-foreground/20 hover:bg-cream-100 disabled:opacity-50"
        >
          + 2 horas (lead frío)
        </button>
        <button
          onClick={() => programar({ valor: 24, unidad: "horas", tipo: "lead_frio_24h" })}
          disabled={enviando}
          className="text-[11px] px-2 py-1 rounded border border-foreground/20 hover:bg-cream-100 disabled:opacity-50"
        >
          + 24 h (lead frío)
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-center">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="text-[11px] px-2 py-1 rounded border border-foreground/20 bg-cream-50"
        >
          {TIPOS_SEG.map((t) => (
            <option key={t.v} value={t.v}>{t.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="w-16 text-[11px] px-2 py-1 rounded border border-foreground/20 bg-cream-50"
        />
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value as "min" | "horas" | "dias")}
          className="text-[11px] px-2 py-1 rounded border border-foreground/20 bg-cream-50"
        >
          <option value="min">min</option>
          <option value="horas">horas</option>
          <option value="dias">días</option>
        </select>
        <button
          onClick={() => programar()}
          disabled={enviando}
          className="text-[11px] px-2 py-1 rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Send className="h-3 w-3" /> {enviando ? "…" : "Programar"}
        </button>
      </div>

      {feedback && (
        <div
          className={cn(
            "text-[11px] px-2 py-1 rounded border flex items-start gap-1.5",
            feedback.tono === "ok"
              ? "border-sage-300 bg-sage-50/40 text-sage-700"
              : "border-rosey-300 bg-rosey-50/40 text-rosey-600",
          )}
        >
          {feedback.tono === "ok" ? (
            <Check className="h-3 w-3 mt-0.5" />
          ) : (
            <AlertCircle className="h-3 w-3 mt-0.5" />
          )}
          {feedback.texto}
        </div>
      )}
      <div className="text-[10px] text-foreground/50 leading-snug">
        El cron de seguimientos corre cada 15 min. Programar “+10 min” puede
        tardar hasta 20 min en disparar.
      </div>
    </div>
  );
}

function SeguimientoCard({ s }: { s: Seguimiento }) {
  const tone =
    s.estado_render === "enviado"
      ? "border-sage-300 bg-sage-50/40 text-sage-700"
      : s.estado_render === "saltado"
        ? "border-foreground/15 bg-cream-100 text-foreground/55"
        : s.estado_render === "error"
          ? "border-rosey-300 bg-rosey-50/40 text-rosey-600"
          : s.estado_render === "pendiente_atrasado"
            ? "border-ambr-300 bg-ambr-50/40 text-ambr-600"
            : "border-skyy-300 bg-skyy-50/40 text-skyy-600";
  const fechaDisparo = s.ejecutado_en ?? s.ejecutar_en;
  return (
    <div className={cn("rounded border px-3 py-2 text-[12px] space-y-1", tone)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span className="font-medium">{s.tipo}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wide">{s.estado_render.replace("_", " ")}</span>
      </div>
      <div className="text-[11px] text-foreground/65">
        {new Date(fechaDisparo).toLocaleString("es-MX")}
      </div>
      {s.mensaje_enviado && (
        <div className="text-[11px] italic">“{s.mensaje_enviado}”</div>
      )}
      {s.resultado && !s.mensaje_enviado && (
        <div className="text-[11px]">{s.resultado}</div>
      )}
    </div>
  );
}

function MensajesSection({ mensajes }: { mensajes: Mensaje[] }) {
  if (mensajes.length === 0) {
    return (
      <div>
        <div className="label-xs mb-2">Conversación</div>
        <div className="text-[12px] italic text-foreground/55">Sin mensajes</div>
      </div>
    );
  }
  return (
    <div>
      <div className="label-xs mb-2 flex items-center gap-1.5">
        <MessageCircle className="h-3 w-3" /> Últimos mensajes ({mensajes.length})
      </div>
      <div className="space-y-1.5">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] max-w-[85%]",
              m.direccion === "entrante"
                ? "bg-cream-200 mr-auto"
                : "bg-rosey-100 ml-auto",
            )}
          >
            <div className="leading-snug whitespace-pre-wrap">{m.texto ?? "(media)"}</div>
            <div className="text-[9px] text-foreground/45 mt-0.5 flex items-center gap-1">
              {new Date(m.timestamp).toLocaleString("es-MX")}
              {m.tool_ejecutada && (
                <>
                  ·
                  <span className="font-mono">{m.tool_ejecutada}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
