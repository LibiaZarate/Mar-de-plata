import { Link } from "react-router-dom";
import { useState } from "react";
import {
  useStore,
  store,
  formatMxn,
  STAGE_LABEL,
  CHANNEL_LABEL,
  type Stage,
  type Lead,
  type Channel,
} from "../data/store";
import { Pill } from "../components/ui";

const STAGES: Stage[] = ["nuevas", "preguntando", "cotizada", "esperando_pago", "pagada"];

const STAGE_TONE: Record<Stage, { bar: string; chip: string; text: string }> = {
  nuevas: { bar: "bg-skyy-200", chip: "border-skyy-300 bg-skyy-100/40", text: "text-skyy-300" },
  preguntando: { bar: "bg-lila-200", chip: "border-lila-300 bg-lila-100/40", text: "text-lila-300" },
  cotizada: { bar: "bg-ambr-200", chip: "border-ambr-300 bg-ambr-100/40", text: "text-ambr-300" },
  esperando_pago: { bar: "bg-ambr-300", chip: "border-ambr-300 bg-ambr-100/40", text: "text-ambr-300" },
  pagada: { bar: "bg-sage-200", chip: "border-sage-300 bg-sage-100/40", text: "text-sage-300" },
};

export default function Pipeline() {
  const leads = useStore((s) => s.leads);
  const [filter, setFilter] = useState<Channel | "all">("all");
  const [advisor, setAdvisor] = useState<"all" | "eli" | "nat" | "jess">("all");

  const filtered = leads.filter(
    (l) => (filter === "all" || l.channel === filter) && (advisor === "all" || l.assignedTo === advisor)
  );

  const totalPipeline = filtered
    .filter((l) => l.stage !== "pagada")
    .reduce((a, l) => a + (l.amount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif-display text-5xl leading-none">Pipeline activo</h1>
          <div className="text-[13px] text-ink-mute mt-2">
            {leads.length} conversaciones en juego · cada tarjeta muestra de dónde vino y quién la mueve
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-serif-display">{formatMxn(totalPipeline)} MXN en pipeline</span>
          <FilterDropdown
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos los canales" },
              { value: "meta", label: "Meta" },
              { value: "tiktok", label: "TikTok" },
              { value: "grupo", label: "Grupo abierto" },
              { value: "recurrente", label: "Recurrente" },
              { value: "organico", label: "Orgánico" },
            ]}
            label="Filtros"
          />
          <FilterDropdown
            value={advisor}
            onChange={(v) => setAdvisor(v as any)}
            options={[
              { value: "all", label: "Todas" },
              { value: "eli", label: "Eli" },
              { value: "nat", label: "Nat" },
              { value: "jess", label: "Jess" },
            ]}
            label="Asesora"
          />
          <button className="btn-primary text-sm">+ Lead manual</button>
        </div>
      </div>

      <div className="text-[12px] text-ink-mute flex items-center gap-4 flex-wrap">
        <span className="label-xs">Color del borde superior · canal de entrada</span>
        <div className="flex items-center gap-3">
          <Legend dot="bg-skyy-300" label="Meta" />
          <Legend dot="bg-lila-300" label="TikTok" />
          <Legend dot="bg-sage-300" label="Grupo abierto" />
          <Legend dot="bg-ambr-300" label="Recurrente" />
          <Legend dot="bg-rosey-300" label="Orgánico" />
        </div>
        <Link to="/pipeline/embudo" className="ml-auto text-rosey-400 italic font-serif-display">
          Ver mapa del flujo comercial →
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((st) => (
          <Column
            key={st}
            stage={st}
            leads={filtered.filter((l) => l.stage === st)}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4">
        <FooterCard title="Facturación cerrada hoy">
          <div className="font-serif-display text-3xl">{formatMxn(11240)} MXN</div>
          <div className="text-[12px] text-ink-mute mt-1">8 pedidos · ticket prom. $1,405</div>
        </FooterCard>
        <FooterCard title="Por cerrar en este pipeline">
          <div className="font-serif-display text-3xl">{formatMxn(28400)} MXN</div>
          <div className="text-[12px] text-ink-mute mt-1">15 cotizadas + esperando pago</div>
        </FooterCard>
        <FooterCard title="Mejor anuncio del mes" tone="rose">
          <div className="font-serif-display text-2xl leading-tight">Charms Pandora Día de las Madres</div>
          <div className="text-[12px] text-ink-mute mt-1">142 leads · 38 cerrados · {formatMxn(48200)} generados</div>
        </FooterCard>
      </div>
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

function Column({ stage, leads }: { stage: Stage; leads: Lead[] }) {
  const tone = STAGE_TONE[stage];
  const [over, setOver] = useState(false);

  return (
    <div
      className={
        "rounded-md border bg-cream-50 px-2 py-3 min-h-[400px] " +
        (over ? "border-rosey-300 bg-rosey-50/30" : "border-ink/15")
      }
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) store.moveLead(id, stage);
      }}
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="label-xs">{STAGE_LABEL[stage]}</span>
        <span className={`text-[11px] px-1.5 rounded ${tone.text}`}>{leads.length}</span>
      </div>
      <div className="space-y-2.5">
        {leads.map((l) => <LeadCard key={l.id} lead={l} />)}
        {leads.length === 0 && (
          <div className="text-[12px] text-ink-mute italic text-center py-6">arrastra aquí</div>
        )}
      </div>
    </div>
  );
}

const CHANNEL_BORDER: Record<Channel, string> = {
  meta: "border-t-skyy-300",
  tiktok: "border-t-lila-300",
  grupo: "border-t-sage-300",
  recurrente: "border-t-ambr-300",
  organico: "border-t-rosey-300",
};

function LeadCard({ lead }: { lead: Lead }) {
  const next = nextStage(lead.stage);
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
      className={
        "bg-cream-50 border border-ink/15 border-t-2 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing select-none " +
        CHANNEL_BORDER[lead.channel]
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-xs">{CHANNEL_LABEL[lead.channel]}</span>
        <span className="text-[10px] text-ink-mute font-mono">{lead.id}</span>
      </div>
      <div className="text-[12px] text-ink font-medium truncate">{lead.product}</div>
      <div className="text-[12px] text-ink-soft mt-1">
        {lead.name} <span className="text-ink-mute">· {lead.city}</span>
      </div>
      {lead.note && <div className="text-[11px] text-ink-mute italic mt-1">{lead.note}</div>}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {lead.amount > 0 && (
          <Pill className="!px-1.5 !text-[10px]">{formatMxn(lead.amount)}</Pill>
        )}
        {lead.flags.includes("urgente") && <Pill tone="rose">Urgente</Pill>}
        {lead.flags.includes("objecion") && <Pill tone="ambr">Objeción</Pill>}
        {lead.flags.includes("fan") && <Pill tone="sage">Fan</Pill>}
        {lead.flags.includes("comprobante") && <Pill tone="sky">Comprobante</Pill>}
        {lead.flags.includes("parcial") && <Pill tone="ambr">Parcial 50%</Pill>}
      </div>
      {next && (
        <button
          onClick={() => store.moveLead(lead.id, next)}
          className="mt-2 w-full text-[11px] py-1 rounded border border-ink/20 hover:bg-cream-100 text-ink-soft"
        >
          → {STAGE_LABEL[next]}
        </button>
      )}
    </article>
  );
}

function nextStage(s: Stage): Stage | null {
  const idx = STAGES.indexOf(s);
  if (idx === -1 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

function FooterCard({ title, tone = "default", children }: { title: string; tone?: "default" | "rose"; children: React.ReactNode }) {
  return (
    <div className={"rounded-md border p-4 " + (tone === "rose" ? "border-rosey-300 bg-rosey-50/30" : "border-ink/15 bg-cream-50")}>
      <div className="label-xs mb-2">{title}</div>
      {children}
    </div>
  );
}

function FilterDropdown({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="btn text-sm appearance-none pr-7"
        style={{ backgroundImage: "none" }}
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
