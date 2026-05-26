import { Link } from "react-router-dom";
import { useStore, formatMxn } from "../data/store";
import { Card, Pill } from "../components/ui";

export default function Resumen() {
  const s = useStore((x) => x);
  const stageCount = (st: string) => s.leads.filter((l) => l.stage === (st as any)).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif-display text-5xl leading-none">Buenos días, Mar</h1>
        <div className="text-[13px] text-ink-mute mt-2">
          Hoy: {formatMxn(s.facturacionHoy)} facturado · {s.leadsHoy} leads entraron · {s.enCancha.comprobantes + s.enCancha.cotizaciones + s.enCancha.reclamos} cosas en tu cancha
        </div>
      </div>

      <div className="border border-rosey-300 bg-rosey-50/30 rounded-md px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <i className="w-3.5 h-3.5 rounded-sm bg-rosey-300 mt-1" />
          <div>
            <div className="text-sm">
              <span className="font-medium text-rosey-400">En tu cancha ahora:</span>{" "}
              <span className="text-ink-soft">{s.enCancha.comprobantes} comprobantes por revisar · {s.enCancha.cotizaciones} cotizaciones de mayoreo por armar · {s.enCancha.reclamos} reclamo sin atender</span>
            </div>
          </div>
        </div>
        <button className="btn-primary text-sm">Resolver ahora</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Facturación de hoy" tone="highlight">
          <div className="font-serif-display text-5xl leading-none">
            {formatMxn(s.facturacionHoy)} <span className="text-base text-ink-mute align-middle">MXN</span>
          </div>
          <div className="mt-3 text-[12px] text-sage-300 font-medium">
            ↑ 18% vs prom. 7 días · prom {formatMxn(9520)}
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {[0, 0, 0, 0, 0, 0, 1].map((v, i) => (
              <i key={i} className={"w-5 h-5 rounded-[3px] border " + (v ? "bg-rosey-300 border-rosey-400" : "border-ink/25 bg-cream-50")} />
            ))}
            <span className="text-[12px] text-ink-mute ml-2">L–D · esta sem.</span>
          </div>
        </Card>

        <Card title="Pedidos cerrados hoy">
          <div className="font-serif-display text-5xl leading-none">{s.pedidosHoy}</div>
          <div className="mt-3 text-[12px] text-ink-mute">
            ticket promedio {formatMxn(s.ticketPromedio)}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Pill tone="rose">{s.pedidosMayoreo} mayoreo</Pill>
            <Pill tone="ambr">{s.pedidosMenudeo} menudeo</Pill>
          </div>
        </Card>

        <Card title="Leads que entraron hoy">
          <div className="font-serif-display text-5xl leading-none">{s.leadsHoy}</div>
          <div className="label-xs mt-3 mb-1.5">Por canal</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-ink-soft">
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-skyy-200" /> Meta {s.leadsPorCanal.meta}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-lila-200" /> TikTok {s.leadsPorCanal.tiktok}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-sage-200" /> Grupo {s.leadsPorCanal.grupo}</div>
            <div className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm bg-ambr-200" /> Org. {s.leadsPorCanal.organico}</div>
          </div>
        </Card>
      </div>

      <Card
        title="Pipeline en vivo"
        topRight={<Link to="/pipeline" className="text-rosey-400 italic font-serif-display text-sm">Ver pipeline completo →</Link>}
      >
        <div className="text-[12px] text-ink-mute -mt-3 mb-4">
          {formatMxn(28400)} esperados · 45 leads activas
        </div>
        <div className="flex w-full rounded-md overflow-hidden border border-ink/15">
          <Segment count={stageCount("nuevas")} label="Nuevas" color="bg-skyy-100" w={12} />
          <Segment count={stageCount("preguntando")} label="Preguntando" color="bg-lila-100" w={18} />
          <Segment count={stageCount("cotizada") + stageCount("esperando_pago")} label="Por pagar" color="bg-ambr-100" w={7} />
          <Segment count={stageCount("pagada")} label="Confirmadas" color="bg-sage-100" w={8} />
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div className="label-xs mb-2">Tu equipo</div>
            <ul className="space-y-2">
              {s.advisors.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 border-b border-ink/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full border border-ink/30 flex items-center justify-center text-xs font-semibold bg-cream-100">{a.name[0]}</span>
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={
                      "text-[12px] italic font-serif-display " +
                      (a.status === "activa" ? "text-sage-300" :
                       a.status === "cerca_del_tope" ? "text-rosey-400" :
                       "text-skyy-300")
                    }>
                      {a.status === "activa" ? "activa" :
                       a.status === "cerca_del_tope" ? "cerca del tope" :
                       "onboarding · día 7"}
                    </span>
                    <span className="font-serif-display text-lg">{a.id === "eli" ? 9 : a.id === "nat" ? 15 : 4}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label-xs mb-2">Tu día · próximas 24h</div>
            <ul className="space-y-3">
              {s.events.slice(0, 3).map((e, i) => (
                <li key={e.id} className="flex gap-3">
                  <div className={"w-0.5 rounded-full " + (i === 0 ? "bg-rosey-300" : i === 1 ? "bg-ambr-200" : "bg-sage-300")} />
                  <div>
                    <div className="text-[12px] text-ink-mute">{e.when.toUpperCase()}</div>
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-[12px] text-ink-mute">{e.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="text-center py-2">
        <Link to="/" className="text-rosey-400 italic font-serif-display text-sm mr-4">← Vista general</Link>
        <Link to="/kpis" className="text-rosey-400 italic font-serif-display text-sm">Ver KPIs →</Link>
      </div>
    </div>
  );
}

function Segment({ count, label, color, w }: { count: number; label: string; color: string; w: number }) {
  return (
    <div className={`${color} px-4 py-3 flex-1 border-r border-ink/10 last:border-0 text-center`}
      style={{ flexGrow: Math.max(w, 1) }}>
      <span className="text-sm font-medium tracking-wide">{count} {label.toUpperCase()}</span>
    </div>
  );
}
