import { Link } from "react-router-dom";
import { useStore, formatMxn, STAGE_LABEL } from "../data/store";
import { Card, Pill, Avatar } from "../components/ui";

export default function Inicio() {
  const s = useStore((x) => x);

  const stageCount = (st: keyof typeof STAGE_LABEL) =>
    s.leads.filter((l) => l.stage === st).length;

  const pipelineValue = s.leads
    .filter((l) => l.stage !== "pagada")
    .reduce((acc, l) => acc + (l.amount || 0), 0);

  const top3 = [...s.leads]
    .filter((l) => l.flags.some((f) => f === "urgente" || f === "objecion" || f === "fan"))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <Greeting />

      <div className="grid grid-cols-4 gap-4">
        <Card title="Facturación de hoy">
          <div className="font-serif-display text-4xl leading-none">
            {formatMxn(s.facturacionHoy)} <span className="text-base align-middle text-ink-mute">MXN</span>
          </div>
          <div className="mt-3 text-[12px] text-sage-300 font-medium">
            ↑ 18% vs prom. 7 días · {formatMxn(9520)}
          </div>
        </Card>

        <Card title="Pedidos cerrados hoy">
          <div className="flex items-baseline gap-2">
            <div className="font-serif-display text-4xl leading-none">{s.pedidosHoy}</div>
            <div className="text-sm text-ink-mute">tickets</div>
          </div>
          <div className="mt-3 text-[12px] text-ink-mute">
            ticket promedio <span className="font-serif-display text-base text-ink">{formatMxn(s.ticketPromedio)}</span>
          </div>
        </Card>

        <Card title="Leads que entraron hoy">
          <div className="font-serif-display text-4xl leading-none">{s.leadsHoy}</div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-ink-soft">
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-skyy-200" /> Meta {s.leadsPorCanal.meta}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-lila-200" /> TikTok {s.leadsPorCanal.tiktok}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-sage-200" /> Grupo {s.leadsPorCanal.grupo}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-ambr-200" /> Org. {s.leadsPorCanal.organico}</div>
          </div>
        </Card>

        <Card title="En tu cancha ahora" tone="highlight">
          <div className="flex items-start justify-between">
            <div className="font-serif-display text-4xl leading-none">
              {s.enCancha.comprobantes + s.enCancha.cotizaciones + s.enCancha.reclamos}
            </div>
            <div className="text-right">
              <div className="font-serif-display italic text-rosey-400 text-sm leading-tight">requiere<br/>humano →</div>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-ink-soft leading-snug">
            {s.enCancha.comprobantes} comprobantes · {s.enCancha.cotizaciones} cotizaciones · {s.enCancha.reclamos} reclamo
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card
          title="Pipeline en vivo"
          topRight={<span className="font-serif-display text-base">{formatMxn(pipelineValue)} <span className="text-xs text-ink-mute">en pipeline</span></span>}
          className="col-span-2"
        >
          <div className="grid grid-cols-4 gap-3 mt-1">
            <StageBox label="Nuevas" count={stageCount("nuevas")} tone="sky" />
            <StageBox label="Preguntando" count={stageCount("preguntando")} tone="lila" />
            <StageBox label="Por pagar" count={stageCount("esperando_pago") + stageCount("cotizada")} tone="ambr" />
            <StageBox label="Confirmadas" count={stageCount("pagada")} tone="sage" />
          </div>

          <div className="mt-5">
            <div className="label-xs mb-3">Necesitan atención · top 3</div>
            <ul className="space-y-2.5">
              {top3.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-ink/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar initial={l.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} tone={
                      l.flags.includes("urgente") ? "rose" : l.flags.includes("fan") ? "sage" : "ambr"
                    } />
                    <div className="leading-tight">
                      <div className="text-sm font-medium">{l.name} <span className="text-ink-mute font-normal">· {l.city}</span></div>
                      <div className="text-[12px] text-ink-mute">{l.note} {!l.flags.includes("fan") && `· ${l.lastUpdate}`}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.flags.includes("urgente") && <Pill tone="rose">Urgente</Pill>}
                    {l.flags.includes("objecion") && <Pill tone="ambr">Objeción</Pill>}
                    {l.flags.includes("fan") && <Pill tone="sage">Fan</Pill>}
                    <Link to="/pipeline" className="text-rosey-400 text-sm italic font-serif-display">Ver</Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="text-right mt-3">
              <Link to="/pipeline" className="text-rosey-400 italic font-serif-display text-sm">Ver todo →</Link>
            </div>
          </div>
        </Card>

        <Card title="Equipo · ahora">
          <ul className="space-y-2 mt-1">
            {s.advisors.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 border-b border-ink/10 last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar initial={a.name[0]} tone={a.status === "activa" ? "sage" : a.status === "cerca_del_tope" ? "rose" : "sky"} />
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-[11px] text-ink-mute">{a.role.toLowerCase()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={
                    "text-[12px] italic font-serif-display " +
                    (a.status === "activa" ? "text-sage-300" :
                     a.status === "cerca_del_tope" ? "text-rosey-400" :
                     "text-skyy-300")
                  }>
                    {a.status === "activa" ? "activa" :
                     a.status === "cerca_del_tope" ? "cerca del tope" :
                     "aprendiendo"}
                  </div>
                  <div className="text-sm"><span className="font-serif-display text-base">{a.conversations}</span> <span className="text-[11px] text-ink-mute">convs</span></div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <Link to="/equipo" className="btn text-xs">Reasignar carga ⇄</Link>
          </div>
        </Card>
      </div>

      <div className="border border-ink/15 rounded-md bg-cream-50 px-5 py-4 flex items-stretch gap-6 overflow-x-auto">
        <div className="label-xs writing-vertical pr-3 border-r border-dashed border-ink/30 flex items-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Tu día
        </div>
        {s.events.map((e) => (
          <div key={e.id} className="min-w-[220px]">
            <div className="label-xs mb-1">{e.when}</div>
            <div className="text-sm font-medium">{e.title}</div>
            <div className="text-[12px] text-ink-mute">{e.detail}</div>
          </div>
        ))}
      </div>

      <div className="text-center pt-2 pb-6">
        <Link to="/resumen" className="text-rosey-400 italic font-serif-display text-sm mr-4">Resumen del día →</Link>
        <Link to="/kpis" className="text-rosey-400 italic font-serif-display text-sm">Pulso del negocio (KPIs) →</Link>
      </div>
    </div>
  );
}

function Greeting() {
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <h1 className="font-serif-display text-5xl leading-none">{greet}, Mar</h1>
      <div className="text-[12px] text-ink-mute mt-2">{today}</div>
    </div>
  );
}

function StageBox({ label, count, tone }: { label: string; count: number; tone: "sky" | "lila" | "ambr" | "sage" }) {
  const border = {
    sky: "border-skyy-300",
    lila: "border-lila-300",
    ambr: "border-ambr-300",
    sage: "border-sage-300",
  }[tone];
  const dot = {
    sky: "bg-skyy-200",
    lila: "bg-lila-200",
    ambr: "bg-ambr-200",
    sage: "bg-sage-200",
  }[tone];
  return (
    <div className={`border ${border} rounded-md px-3 py-2 bg-cream-50`}>
      <div className="flex items-center gap-2">
        <i className={`w-2.5 h-2.5 rounded-sm ${dot}`} />
        <span className="label-xs">{label}</span>
      </div>
      <div className="font-serif-display text-3xl mt-1 leading-none">{count}</div>
    </div>
  );
}
