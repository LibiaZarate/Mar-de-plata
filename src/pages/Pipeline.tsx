import { useState } from "react";
import { useAsesoras, usePipelineLeads } from "../lib/queries";
import { actualizarEstadoLead } from "../lib/actions";
import { Pill } from "../components/ui";
import { Skeleton, ErrorBanner } from "../components/feedback";
import type { Lead, LeadEstado } from "../lib/types";

const STAGES: { key: LeadEstado; label: string }[] = [
  { key: "lead_nueva", label: "Nuevas" },
  { key: "calificada", label: "Calificada" },
  { key: "esperando_pago", label: "Esperando pago" },
  { key: "pagada", label: "Pagada" },
];

const STAGE_TONE: Record<LeadEstado, { border: string; chip: string }> = {
  lead_nueva: { border: "border-skyy-300", chip: "text-skyy-300" },
  calificada: { border: "border-lila-300", chip: "text-lila-300" },
  esperando_pago: { border: "border-ambr-300", chip: "text-ambr-300" },
  pagada: { border: "border-sage-300", chip: "text-sage-300" },
  perdida: { border: "border-rosey-300", chip: "text-rosey-400" },
};

const CANAL_BORDER: Record<string, string> = {
  Meta: "border-t-skyy-300",
  TikTok: "border-t-lila-300",
  Grupo: "border-t-sage-300",
  Recurrente: "border-t-ambr-300",
  "Orgánico": "border-t-rosey-300",
  Organico: "border-t-rosey-300",
};

export default function Pipeline() {
  const [canal, setCanal] = useState<string | "all">("all");
  const [asesoraFilter, setAsesoraFilter] = useState<string | "all">("all");
  const { data: leads, isLoading, error } = usePipelineLeads(canal, asesoraFilter);
  const { data: asesoras } = useAsesoras();

  const grouped: Record<LeadEstado, Lead[]> = {
    lead_nueva: [],
    calificada: [],
    esperando_pago: [],
    pagada: [],
    perdida: [],
  };
  for (const l of leads ?? []) {
    if (l.estado && grouped[l.estado]) grouped[l.estado].push(l);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif-display text-5xl leading-none">Pipeline activo</h1>
          <div className="text-[13px] text-ink-mute mt-2">
            {leads?.length ?? 0} conversaciones en juego · datos en vivo de Supabase
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect
            value={canal}
            onChange={setCanal}
            label="Canal"
            options={[
              { value: "all", label: "Todos" },
              { value: "Meta", label: "Meta" },
              { value: "TikTok", label: "TikTok" },
              { value: "Grupo", label: "Grupo abierto" },
              { value: "Recurrente", label: "Recurrente" },
              { value: "Orgánico", label: "Orgánico" },
            ]}
          />
          <FilterSelect
            value={asesoraFilter}
            onChange={setAsesoraFilter}
            label="Asesora"
            options={[
              { value: "all", label: "Todas" },
              ...(asesoras ?? []).map((a) => ({ value: a.id, label: a.nombre_completo })),
            ]}
          />
        </div>
      </div>

      <div className="text-[12px] text-ink-mute flex items-center gap-4 flex-wrap">
        <span className="label-xs">Borde superior · canal de entrada</span>
        <Legend dot="bg-skyy-300" label="Meta" />
        <Legend dot="bg-lila-300" label="TikTok" />
        <Legend dot="bg-sage-300" label="Grupo abierto" />
        <Legend dot="bg-ambr-300" label="Recurrente" />
        <Legend dot="bg-rosey-300" label="Orgánico" />
      </div>

      {error && <ErrorBanner message={error.message} />}

      <div className="grid grid-cols-4 gap-3">
        {STAGES.map((st) => (
          <Column
            key={st.key}
            stage={st.key}
            label={st.label}
            leads={grouped[st.key]}
            loading={isLoading}
          />
        ))}
      </div>

      {grouped.perdida.length > 0 && (
        <details className="rounded-md border border-ink/10 bg-cream-50 px-4 py-3">
          <summary className="cursor-pointer text-[12px] text-ink-mute">
            Perdidas ({grouped.perdida.length}) · ocultas
          </summary>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {grouped.perdida.slice(0, 8).map((l) => (
              <LeadCard key={l.numero_whatsapp} lead={l} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Column({
  stage,
  label,
  leads,
  loading,
}: {
  stage: LeadEstado;
  label: string;
  leads: Lead[];
  loading?: boolean;
}) {
  const [over, setOver] = useState(false);
  const tone = STAGE_TONE[stage];

  return (
    <div
      className={
        "rounded-md border bg-cream-50 px-2 py-3 min-h-[440px] " +
        (over ? "border-rosey-300 bg-rosey-50/30" : "border-ink/15")
      }
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) {
          try {
            await actualizarEstadoLead(id, stage);
          } catch (err) {
            alert("No se pudo actualizar el lead: " + (err as Error).message);
          }
        }
      }}
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="label-xs">{label}</span>
        <span className={`text-[11px] ${tone.chip}`}>{leads.length}</span>
      </div>
      <div className="space-y-2.5">
        {loading && <Skeleton lines={4} />}
        {!loading && leads.map((l) => <LeadCard key={l.numero_whatsapp} lead={l} />)}
        {!loading && leads.length === 0 && (
          <div className="text-[12px] text-ink-mute italic text-center py-6">
            arrastra aquí
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, compact }: { lead: Lead; compact?: boolean }) {
  const next = nextStage(lead.estado);
  const canalBorder = CANAL_BORDER[lead.canal_origen ?? ""] ?? "border-t-ink/30";
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.numero_whatsapp)}
      className={
        "bg-cream-50 border border-ink/15 border-t-2 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing select-none " +
        canalBorder
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-xs">{lead.canal_origen ?? "—"}</span>
        <span className="text-[10px] text-ink-mute font-mono truncate max-w-[110px]">
          {lead.numero_whatsapp}
        </span>
      </div>
      <div className="text-[13px] text-ink font-medium truncate">
        {lead.nombre || "Sin nombre"}
      </div>
      <div className="text-[12px] text-ink-soft mt-0.5">
        <span className="text-ink-mute">{lead.ciudad ?? "—"}</span>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {lead.tipo === "mayoreo" && <Pill tone="rose">Mayoreo</Pill>}
          {lead.tipo === "menudeo" && <Pill tone="sky">Menudeo</Pill>}
          {lead.asesora_asignada && (
            <Pill className="!px-1.5 !text-[10px]">{lead.asesora_asignada}</Pill>
          )}
        </div>
      )}
      {!compact && next && (
        <button
          onClick={() =>
            actualizarEstadoLead(lead.numero_whatsapp, next).catch((e) =>
              alert("No se pudo: " + (e as Error).message)
            )
          }
          className="mt-2 w-full text-[11px] py-1 rounded border border-ink/20 hover:bg-cream-100 text-ink-soft"
        >
          → {labelFor(next)}
        </button>
      )}
    </article>
  );
}

function nextStage(s: LeadEstado | null): LeadEstado | null {
  if (!s) return "lead_nueva";
  const idx = STAGES.findIndex((st) => st.key === s);
  if (idx === -1 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1].key;
}

function labelFor(s: LeadEstado): string {
  return STAGES.find((x) => x.key === s)?.label ?? s;
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <i className={`w-2 h-2 rounded-sm ${dot}`} /> {label}
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="btn text-sm appearance-none pr-7"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none">▾</span>
    </div>
  );
}
