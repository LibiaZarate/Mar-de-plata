"use client";

import { useState } from "react";
import { useAsesoras, usePipelineLeads, STAGE_LABEL } from "@/lib/queries";
import { actualizarEstadoLead } from "@/lib/actions";
import { cn, formatMxn } from "@/lib/utils";
import type { Lead, LeadEstado } from "@/lib/types";

const STAGES: LeadEstado[] = ["lead_nueva", "calificada", "esperando_pago", "pagada"];

const STAGE_TONE: Record<LeadEstado, { border: string; chip: string }> = {
  lead_nueva:     { border: "border-skyy-300",       chip: "text-skyy-500" },
  calificada:     { border: "border-lila-300",       chip: "text-lila-500" },
  esperando_pago: { border: "border-ambr-300",       chip: "text-ambr-500" },
  pagada:         { border: "border-sage-300",       chip: "text-sage-500" },
  perdida:        { border: "border-rosey-300",      chip: "text-rosey-500" },
};

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
  const { data: leads, isLoading, error } = usePipelineLeads(canal, advisor);
  const { data: asesoras } = useAsesoras();

  const grouped: Record<LeadEstado, Lead[]> = {
    lead_nueva: [], calificada: [], esperando_pago: [], pagada: [], perdida: [],
  };
  for (const l of leads ?? []) if (l.estado && grouped[l.estado]) grouped[l.estado].push(l);

  const totalPipeline = (leads ?? [])
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

      <div className="grid grid-cols-4 gap-3">
        {STAGES.map((st) => (
          <Column key={st} stage={st} leads={grouped[st]} loading={isLoading} />
        ))}
      </div>

      {grouped.perdida.length > 0 && (
        <details className="rounded-md border border-foreground/15 bg-cream-50 px-4 py-3">
          <summary className="cursor-pointer text-[12px] text-foreground/55">
            Perdidas ({grouped.perdida.length}) · ocultas
          </summary>
        </details>
      )}
    </div>
  );
}

function Column({ stage, leads, loading }: { stage: LeadEstado; leads: Lead[]; loading?: boolean }) {
  const [over, setOver] = useState(false);
  const tone = STAGE_TONE[stage];
  return (
    <div
      className={cn(
        "rounded-md border bg-cream-50 px-2 py-3 min-h-[440px] transition-colors",
        over ? "border-rosey-300 bg-rosey-50/30" : "border-foreground/15",
      )}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) {
          try { await actualizarEstadoLead(id, stage); }
          catch (err) { alert("No se pudo: " + (err as Error).message); }
        }
      }}
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="label-xs">{STAGE_LABEL[stage]}</span>
        <span className={cn("text-[11px]", tone.chip)}>{leads.length}</span>
      </div>
      <div className="space-y-2.5">
        {loading && <div className="h-24 rounded bg-cream-200 animate-pulse" />}
        {!loading && leads.map((l) => <LeadCard key={l.numero_whatsapp} lead={l} />)}
        {!loading && leads.length === 0 && (
          <div className="text-[12px] text-foreground/50 italic text-center py-6">
            arrastra aquí
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const idx = STAGES.indexOf(lead.estado);
  const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const border = CANAL_BORDER[lead.canal_origen ?? ""] ?? "border-t-foreground/30";
  return (
    <a
      href={`https://wa.me/${lead.numero_whatsapp.replace(/\D/g, "")}`}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.numero_whatsapp)}
      className={cn(
        "block bg-cream-50 border border-foreground/15 border-t-2 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing select-none hover:bg-rosey-50/30",
        border,
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-xs">{lead.canal_origen ?? "—"}</span>
        <span className="text-[10px] text-foreground/55 font-mono truncate max-w-[110px]">
          {lead.numero_whatsapp}
        </span>
      </div>
      <div className="text-[13px] font-medium truncate">{lead.nombre || "Sin nombre"}</div>
      <div className="text-[12px] text-foreground/55 mt-0.5">{lead.ciudad ?? "—"}</div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {lead.tipo === "mayoreo" && <span className="pill-rose">Mayoreo</span>}
        {lead.tipo === "menudeo" && <span className="pill-sky">Menudeo</span>}
        {lead.monto_acumulado > 0 && (
          <span className="pill-stone">{formatMxn(lead.monto_acumulado)}</span>
        )}
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
    </a>
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
