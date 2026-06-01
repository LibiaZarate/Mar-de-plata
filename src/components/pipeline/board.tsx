"use client";

import { useState } from "react";
import { useAsesoras, usePipelineLeads, STAGE_LABEL } from "@/lib/queries";
import { actualizarEstadoLead } from "@/lib/actions";
import { cn, formatMxn } from "@/lib/utils";
import type { Lead, LeadEstado } from "@/lib/types";

const STAGES: LeadEstado[] = ["lead_nueva", "calificada", "esperando_pago", "pagada"];
const STAGE_COLOR: Record<LeadEstado, string> = {
  lead_nueva: "border-meta/50",
  calificada: "border-tiktok/50",
  esperando_pago: "border-recurrente/50",
  pagada: "border-grupo/50",
  perdida: "border-destructive/50",
};

const CANAL_BORDER: Record<string, string> = {
  Meta: "border-t-meta",
  TikTok: "border-t-tiktok",
  Grupo: "border-t-grupo",
  Recurrente: "border-t-recurrente",
  "Orgánico": "border-t-primary",
  Organico: "border-t-primary",
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

  return (
    <div className="px-10 py-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-xs">Inicio · Pipeline</div>
          <h1 className="font-serif-display text-5xl leading-none mt-1">Pipeline activo</h1>
          <div className="text-[13px] text-muted-foreground mt-2">
            {leads?.length ?? 0} conversaciones en juego · datos en vivo de Supabase
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded px-3 py-2 text-[12px] text-destructive">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {STAGES.map((st) => (
          <Column key={st} stage={st} leads={grouped[st]} loading={isLoading} />
        ))}
      </div>

      {grouped.perdida.length > 0 && (
        <details className="rounded-md border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-[12px] text-muted-foreground">
            Perdidas ({grouped.perdida.length}) · ocultas
          </summary>
        </details>
      )}
    </div>
  );
}

function Column({ stage, leads, loading }: { stage: LeadEstado; leads: Lead[]; loading?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-2 py-3 min-h-[440px] transition-colors",
        over ? "border-primary/50 bg-primary/5" : "border-border",
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
        <span className={cn("text-[11px]", STAGE_COLOR[stage].replace("border-", "text-"))}>
          {leads.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {loading && <div className="h-24 rounded bg-muted animate-pulse" />}
        {!loading && leads.map((l) => <LeadCard key={l.numero_whatsapp} lead={l} />)}
        {!loading && leads.length === 0 && (
          <div className="text-[12px] text-muted-foreground italic text-center py-6">
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
  const border = CANAL_BORDER[lead.canal_origen ?? ""] ?? "border-t-muted-foreground";
  return (
    <a
      href={`https://wa.me/${lead.numero_whatsapp.replace(/\D/g, "")}`}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.numero_whatsapp)}
      className={cn(
        "block bg-card border border-border border-t-2 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing select-none hover:bg-secondary/40",
        border,
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-xs">{lead.canal_origen ?? "—"}</span>
        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[110px]">
          {lead.numero_whatsapp}
        </span>
      </div>
      <div className="text-[13px] font-medium truncate">{lead.nombre || "Sin nombre"}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{lead.ciudad ?? "—"}</div>
      {next && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            actualizarEstadoLead(lead.numero_whatsapp, next).catch((err) =>
              alert("No se pudo: " + (err as Error).message),
            );
          }}
          className="mt-2 w-full text-[11px] py-1 rounded border border-border hover:bg-secondary text-foreground/70"
        >
          → {STAGE_LABEL[next]}
        </button>
      )}
      {lead.monto_acumulado > 0 && (
        <div className="text-[10px] text-muted-foreground mt-1.5">
          acumulado · {formatMxn(lead.monto_acumulado)}
        </div>
      )}
    </a>
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
        className="text-sm appearance-none pr-7 pl-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{label}: {o.label}</option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">▾</span>
    </div>
  );
}
