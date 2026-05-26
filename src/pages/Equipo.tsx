import { useState } from "react";
import { useStore, type Advisor } from "../data/store";
import { Tabs, Pill } from "../components/ui";

export default function Equipo() {
  const advisors = useStore((s) => s.advisors);
  const [range, setRange] = useState<"hoy" | "sem" | "mes">("hoy");

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif-display text-5xl leading-none">Tu equipo</h1>
          <div className="text-[13px] text-ink-mute mt-2">
            Tres asesoras activas · sin ranking, sin competencia
          </div>
        </div>
        <Tabs
          value={range}
          options={[
            { value: "hoy", label: "Hoy" },
            { value: "sem", label: "Esta semana" },
            { value: "mes", label: "Este mes" },
          ]}
          onChange={setRange}
        />
      </div>

      <div className="border border-rosey-300 bg-rosey-50/30 rounded-md px-5 py-3 text-[13px] text-ink-soft flex items-start gap-3">
        <span className="font-serif-display italic text-rosey-400 mt-0.5">nota →</span>
        <p>
          La columna <span className="font-medium">“Mi satisfacción”</span> es la lectura subjetiva de Mar sobre cada asesora (0–10, fijada cada lunes). Pendiente con Mar: definir cómo medir cada una de estas seis variables para mantener control real, sin que se sienta vigilancia.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {advisors.map((a) => (
          <AdvisorCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function AdvisorCard({ a }: { a: Advisor }) {
  const accent =
    a.status === "activa" ? "border-sage-300" :
    a.status === "cerca_del_tope" ? "border-rosey-300 bg-rosey-50/30" :
    "border-skyy-300";

  return (
    <div className={`rounded-md border ${accent} bg-cream-50 p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-ink/30 flex items-center justify-center text-base font-semibold bg-cream-100">
            {a.name[0]}
          </div>
          <div>
            <div className="font-serif-display text-3xl leading-none">{a.name}</div>
            <div className="text-[12px] text-ink-mute mt-1">
              {a.role} {a.since && `· desde ${a.since}`}
            </div>
          </div>
        </div>
        <Pill
          tone={a.status === "activa" ? "sage" : a.status === "cerca_del_tope" ? "rose" : "sky"}
        >
          ● {a.status === "activa" ? "Activa" : a.status === "cerca_del_tope" ? "Cerca del tope · 15 abiertas" : "Aprendiendo"}
        </Pill>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Conversaciones" value={a.conversations.toString()} />
        <Stat label="Resp. promedio" value={`${a.avgResponseMin} min`} />
        <Stat label="Pedidos cerrados" value={a.closed.toString()} />
        <Stat label="Mi satisfacción" value={a.selfScore != null ? `${a.selfScore} / 10` : "—"} />
        <Stat label="Reclamos" value={a.complaints.toString()} />
        <Stat label="Satisfacción cliente" value={a.satisfaction != null ? `${a.satisfaction}%` : "—"} />
      </div>

      {a.notes && (
        <div className="border border-ink/15 rounded-md p-3 mt-1">
          <div className="label-xs mb-2">Aprendiendo aún</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {a.notes.learning.map((t) => (
              <Pill key={t} tone="ambr">{t}</Pill>
            ))}
          </div>
          <div className="label-xs mb-2">Ya domina</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {a.notes.mastered.map((t) => (
              <Pill key={t} tone="sage">{t}</Pill>
            ))}
          </div>
          <button className="btn-primary text-xs w-full justify-center">Dejar feedback ✎</button>
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-2">
        <button className="btn text-xs flex-1 justify-center">Ver conversaciones</button>
        {a.status === "cerca_del_tope" && (
          <button className="btn-primary text-xs flex-1 justify-center">Reasignar carga</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink/15 rounded-md px-3 py-2">
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
