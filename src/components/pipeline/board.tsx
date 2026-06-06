"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAsesoras, usePipelineLeads, STAGE_LABEL } from "@/lib/queries";
import { actualizarEstadoLead } from "@/lib/actions";
import { cn, formatMxn } from "@/lib/utils";
import type { Lead, LeadEstado } from "@/lib/types";
import { LeadDetailDrawer } from "./lead-detail-drawer";

type LeadConSeg = Lead & {
  seguimientos_pendientes?: number;
  seguimientos_enviados?: number;
  ultimo_seguimiento_en?: string | null;
};

// Etapas visibles del kanban. "seguimiento" es virtual: no existe como
// estado en la tabla leads, se computa al vuelo en `clasificar()` cuando
// el lead tiene seguimientos pendientes o ya enviados estando todavía
// en lead_nueva o calificada.
type PipelineStage = "lead_nueva" | "calificada" | "seguimiento" | "esperando_pago" | "pagada";

type AdInfo = { name: string; campaign_id: string; campaign_name: string };
type AdsMap = Map<string, AdInfo>;

const adsFetcher = async (url: string): Promise<AdsMap> => {
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();
  if (!d.ok) return new Map();
  const campNames = new Map<string, string>(
    (d.campaigns ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  );
  const map: AdsMap = new Map();
  for (const a of (d.ads ?? []) as { id: string; name: string; campaign_id: string }[]) {
    map.set(a.id, {
      name: a.name,
      campaign_id: a.campaign_id,
      campaign_name: campNames.get(a.campaign_id) ?? "—",
    });
  }
  return map;
};

const STAGES: PipelineStage[] = [
  "lead_nueva",
  "calificada",
  "seguimiento",
  "esperando_pago",
  "pagada",
];

const STAGE_LABEL_EXT: Record<PipelineStage, string> = {
  lead_nueva: STAGE_LABEL.lead_nueva,
  calificada: STAGE_LABEL.calificada,
  seguimiento: "Seguimiento",
  esperando_pago: STAGE_LABEL.esperando_pago,
  pagada: STAGE_LABEL.pagada,
};

const STAGE_TONE: Record<PipelineStage, { border: string; chip: string }> = {
  lead_nueva:     { border: "border-skyy-300",  chip: "text-skyy-500" },
  calificada:     { border: "border-lila-300",  chip: "text-lila-500" },
  seguimiento:    { border: "border-rosey-300", chip: "text-rosey-500" },
  esperando_pago: { border: "border-ambr-300",  chip: "text-ambr-500" },
  pagada:         { border: "border-sage-300",  chip: "text-sage-500" },
};

// Para un lead determinado, decide en qué columna visible cae. Si tiene
// seguimiento programado o enviado y todavía está en lead_nueva/calificada,
// lo movemos a la columna virtual "seguimiento".
function clasificar(l: LeadConSeg): PipelineStage | "perdida" {
  if (l.estado === "perdida") return "perdida";
  if (l.estado === "pagada") return "pagada";
  if (l.estado === "esperando_pago") return "esperando_pago";
  const tieneSeguimiento =
    (l.seguimientos_pendientes ?? 0) > 0 || (l.seguimientos_enviados ?? 0) > 0;
  if (tieneSeguimiento && (l.estado === "lead_nueva" || l.estado === "calificada")) {
    return "seguimiento";
  }
  return l.estado as PipelineStage;
}

function siguienteEstadoReal(stage: PipelineStage): LeadEstado | null {
  // Pasar de "seguimiento" → "esperando_pago" en la tabla (porque
  // seguimiento es virtual). El resto sigue el orden normal.
  if (stage === "seguimiento") return "esperando_pago";
  if (stage === "lead_nueva") return "calificada";
  if (stage === "calificada") return "esperando_pago";
  if (stage === "esperando_pago") return "pagada";
  return null;
}

const CANAL_BORDER: Record<string, string> = {
  Meta: "border-t-skyy-300",
  TikTok: "border-t-lila-300",
  Grupo: "border-t-sage-300",
  Recurrente: "border-t-ambr-300",
  "Orgánico": "border-t-rosey-300",
  Organico: "border-t-rosey-300",
};

export function PipelineBoard() {
  const [canal, setCanal] = useState<string | "all">("all");
  const [advisor, setAdvisor] = useState<string | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const { data: leadsRaw, isLoading, error } = usePipelineLeads(canal, advisor);
  const leads = (leadsRaw ?? []) as LeadConSeg[];
  const { data: asesoras } = useAsesoras();
  const { data: adsMap } = useSWR<AdsMap>(
    "/api/dashboard/meta/campanas?days=180",
    adsFetcher,
    { refreshInterval: 10 * 60_000, revalidateOnFocus: false },
  );

  const grouped: Record<PipelineStage | "perdida", LeadConSeg[]> = {
    lead_nueva: [], calificada: [], seguimiento: [],
    esperando_pago: [], pagada: [], perdida: [],
  };
  for (const l of leads) grouped[clasificar(l)].push(l);

  const totalPipeline = leads
    .filter((l) => l.estado !== "pagada" && l.estado !== "perdida")
    .reduce((s, l) => s + Number(l.monto_acumulado || 0), 0);

  return (
    <div className="px-10 py-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-xs">Inicio · Pipeline</div>
          <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Pipeline activo</h1>
          <div className="text-[13px] text-foreground/60 mt-2">
            {leads?.length ?? 0} conversaciones en juego · cada tarjeta muestra de dónde vino y quién la mueve
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-serif-display text-[18px]">
            {formatMxn(totalPipeline)} <span className="text-xs text-foreground/55 font-sans">MXN en pipeline</span>
          </span>
          <FilterSelect value={canal} onChange={setCanal} label="Canal" options={[
            { value: "all", label: "Todos" }, { value: "Meta", label: "Meta" },
            { value: "TikTok", label: "TikTok" }, { value: "Grupo", label: "Grupo abierto" },
            { value: "Recurrente", label: "Recurrente" }, { value: "Orgánico", label: "Orgánico" },
          ]} />
          <FilterSelect value={advisor} onChange={(v) => setAdvisor(v)} label="Asesora" options={[
            { value: "all", label: "Todas" },
            ...(asesoras ?? []).map((a) => ({ value: a.id, label: a.nombre_completo })),
          ]} />
        </div>
      </div>

      <div className="text-[12px] text-foreground/55 flex items-center gap-4 flex-wrap">
        <span className="label-xs">Color del borde superior · canal de entrada</span>
        <Legend dot="bg-skyy-300" label="Meta" />
        <Legend dot="bg-lila-300" label="TikTok" />
        <Legend dot="bg-sage-300" label="Grupo abierto" />
        <Legend dot="bg-ambr-300" label="Recurrente" />
        <Legend dot="bg-rosey-300" label="Orgánico" />
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((st) => (
          <Column
            key={st}
            stage={st}
            leads={grouped[st]}
            loading={isLoading}
            adsMap={adsMap}
            onSelect={setSelected}
          />
        ))}
      </div>

      {grouped.perdida.length > 0 && (
        <details className="rounded-md border border-foreground/15 bg-cream-50 px-4 py-3">
          <summary className="cursor-pointer text-[12px] text-foreground/55">
            Perdidas ({grouped.perdida.length}) · ocultas
          </summary>
        </details>
      )}

      {selected && (
        <LeadDetailDrawer numero={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Column({
  stage,
  leads,
  loading,
  adsMap,
  onSelect,
}: {
  stage: PipelineStage;
  leads: LeadConSeg[];
  loading?: boolean;
  adsMap?: AdsMap;
  onSelect: (numero: string) => void;
}) {
  const [over, setOver] = useState(false);
  const tone = STAGE_TONE[stage];
  // La columna "seguimiento" es virtual — soltar ahí no tiene un estado
  // real al cual mover el lead, así que la dejamos no-drop.
  const droppable = stage !== "seguimiento";
  return (
    <div
      className={cn(
        "rounded-md border bg-cream-50 px-2 py-3 min-h-[440px] transition-colors",
        over && droppable ? "border-rosey-300 bg-rosey-50/30" : "border-foreground/15",
      )}
      onDragOver={(e) => {
        if (!droppable) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        if (!droppable) return;
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) {
          try { await actualizarEstadoLead(id, stage as LeadEstado); }
          catch (err) { alert("No se pudo: " + (err as Error).message); }
        }
      }}
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="label-xs">{STAGE_LABEL_EXT[stage]}</span>
        <span className={cn("text-[11px]", tone.chip)}>{leads.length}</span>
      </div>
      <div className="space-y-2.5">
        {loading && <div className="h-24 rounded bg-cream-200 animate-pulse" />}
        {!loading && leads.map((l) => (
          <LeadCard
            key={l.numero_whatsapp}
            lead={l}
            adsMap={adsMap}
            stage={stage}
            onSelect={onSelect}
          />
        ))}
        {!loading && leads.length === 0 && (
          <div className="text-[12px] text-foreground/50 italic text-center py-6">
            {droppable ? "arrastra aquí" : "sin seguimientos"}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  adsMap,
  stage,
  onSelect,
}: {
  lead: LeadConSeg;
  adsMap?: AdsMap;
  stage: PipelineStage;
  onSelect: (numero: string) => void;
}) {
  const next = siguienteEstadoReal(stage);
  const border = CANAL_BORDER[lead.canal_origen ?? ""] ?? "border-t-foreground/30";
  const tail = lead.numero_whatsapp.slice(-4);
  const displayName = lead.nombre?.trim() || `Sin nombre · ${tail}`;
  const etiquetas = lead.etiquetas ?? [];
  const isPlayground = etiquetas.includes("playground");
  const isAdmin = etiquetas.includes("admin:libia");
  const piezaPersonalizada = etiquetas.includes("pieza_personalizada");
  const handoffMotivo = etiquetas
    .find((e) => e.startsWith("handoff:"))
    ?.slice("handoff:".length);
  const adInfo = lead.anuncio_id ? adsMap?.get(lead.anuncio_id) : undefined;
  const adLabel = adInfo
    ? adInfo.name
    : lead.anuncio_id
      ? `Anuncio ${lead.anuncio_id.slice(-6)}`
      : null;
  const segPend = lead.seguimientos_pendientes ?? 0;
  const segEnv = lead.seguimientos_enviados ?? 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lead.numero_whatsapp)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(lead.numero_whatsapp);
      }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.numero_whatsapp)}
      className={cn(
        "block bg-cream-50 border border-foreground/15 border-t-2 rounded-md px-3 py-2.5 cursor-pointer select-none hover:bg-rosey-50/30",
        border,
      )}
    >
      <div className="flex items-center justify-between mb-1 gap-1.5">
        <span className="label-xs">{lead.canal_origen ?? "—"}</span>
        {isAdmin && (
          <span className="text-[9px] tracking-wider uppercase px-1 py-0.5 rounded border border-lila-300 text-lila-500 bg-lila-50">
            CEO
          </span>
        )}
        {isPlayground && !isAdmin && (
          <span className="text-[9px] tracking-wider uppercase px-1 py-0.5 rounded border border-lila-300 text-lila-500 bg-lila-50">
            test
          </span>
        )}
        <span className="text-[10px] text-foreground/55 font-mono truncate ml-auto max-w-[110px]">
          {lead.numero_whatsapp}
        </span>
      </div>
      <div className={cn(
        "text-[13px] font-medium truncate",
        !lead.nombre?.trim() && "text-foreground/60 italic",
      )}>
        {displayName}
      </div>
      <div className="text-[12px] text-foreground/55 mt-0.5">{lead.ciudad ?? "—"}</div>
      {adLabel && (
        <div
          className="mt-1 text-[10px] text-skyy-500 truncate inline-flex items-center gap-1"
          title={
            adInfo
              ? `Anuncio: ${adInfo.name}\nCampaña: ${adInfo.campaign_name}`
              : `Anuncio ID: ${lead.anuncio_id}`
          }
        >
          <span>📢</span>
          <span className="truncate">{adLabel}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {lead.tipo === "mayoreo" && <span className="pill-rose">Mayoreo</span>}
        {lead.tipo === "menudeo" && <span className="pill-sky">Menudeo</span>}
        {lead.monto_acumulado > 0 && (
          <span className="pill-stone">{formatMxn(lead.monto_acumulado)}</span>
        )}
        {piezaPersonalizada && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-lila-300 bg-lila-50 text-lila-500"
            title="Cliente preguntó por pieza personalizada — revisar imagen de referencia en la conversación"
          >
            💎 Personalizada · revisar imagen
          </span>
        )}
        {(segPend > 0 || segEnv > 0) && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-rosey-300 bg-rosey-50 text-rosey-500"
            title={`Pendientes: ${segPend} · Enviados: ${segEnv}`}
          >
            ⏰ {segPend > 0 ? `${segPend} pend` : `${segEnv} env`}
          </span>
        )}
        {handoffMotivo && <HandoffMotivoChip motivo={handoffMotivo} />}
      </div>
      {next && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            actualizarEstadoLead(lead.numero_whatsapp, next).catch((err) =>
              alert("No se pudo: " + (err as Error).message),
            );
          }}
          className="mt-2 w-full text-[11px] py-1 rounded border border-foreground/20 hover:bg-cream-100 text-foreground/70"
        >
          → {STAGE_LABEL[next]}
        </button>
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <i className={`w-2 h-2 rounded-sm ${dot}`} /> {label}
    </span>
  );
}

function FilterSelect({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="text-sm appearance-none pr-7 pl-3 py-1.5 rounded-md border border-foreground/30 bg-cream-50 hover:bg-cream-100">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{label}: {o.label}</option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/55 pointer-events-none">▾</span>
    </div>
  );
}

const HANDOFF_LABELS: Record<string, { emoji: string; nombre: string; tono: string }> = {
  visita_presencial: { emoji: "📍", nombre: "Quiere visitar local", tono: "border-skyy-300 bg-skyy-50 text-skyy-500" },
  compra_en_vivo: { emoji: "🎥", nombre: "Comprando en vivo", tono: "border-rosey-300 bg-rosey-50 text-rosey-500" },
  personalizado: { emoji: "💎", nombre: "Pieza personalizada", tono: "border-lila-300 bg-lila-50 text-lila-500" },
  lista_pedido: { emoji: "🛒", nombre: "Lista para pedido", tono: "border-sage-300 bg-sage-50 text-sage-600" },
  mayoreo_cotizacion: { emoji: "💰", nombre: "Cotización mayoreo", tono: "border-ambr-300 bg-ambr-50 text-ambr-600" },
  reclamo: { emoji: "⚠️", nombre: "Reclamo", tono: "border-rosey-400 bg-rosey-100 text-rosey-600" },
  solicitud_explicita: { emoji: "🙋‍♀️", nombre: "Pidió hablar con humana", tono: "border-foreground/30 bg-cream-100 text-foreground" },
};

function HandoffMotivoChip({ motivo }: { motivo: string }) {
  const info = HANDOFF_LABELS[motivo] ?? {
    emoji: "👤",
    nombre: motivo.replace(/_/g, " "),
    tono: "border-foreground/30 bg-cream-100 text-foreground",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded border",
        info.tono,
      )}
      title={`Handoff a asesora · motivo: ${info.nombre}`}
    >
      {info.emoji} {info.nombre}
    </span>
  );
}
