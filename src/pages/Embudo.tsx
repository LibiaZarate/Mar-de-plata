import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore, CHANNEL_LABEL } from "../data/store";
import { Card, Tabs } from "../components/ui";

export default function Embudo() {
  const s = useStore((x) => x);
  const [range, setRange] = useState<"hoy" | "sem" | "30d">("sem");

  const funnel = s.funnel;
  const top = funnel[0].count;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif-display text-5xl leading-none">Trazabilidad del embudo</h1>
          <div className="text-[13px] text-ink-mute mt-2">
            Dónde se va la gente, cuánto tarda cada etapa y qué canal convierte mejor
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={range}
            options={[
              { value: "hoy", label: "Hoy" },
              { value: "sem", label: "Esta semana" },
              { value: "30d", label: "30d" },
            ]}
            onChange={setRange}
          />
          <Link to="/pipeline" className="btn text-sm">Cambiar a Kanban</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Conversión global">
          <div className="font-serif-display text-5xl leading-none">{s.conversionGlobal}% <span className="text-sm text-sage-300 font-sans">↑ 2.1 pp</span></div>
          <div className="text-[12px] text-ink-mute mt-2">120 leads → 15 ventas (esta sem.)</div>
        </Card>
        <Card title="Cuello de botella" tone="warn">
          <div className="font-serif-display text-3xl leading-tight">
            {s.cuelloBotella.from} → {s.cuelloBotella.to}
          </div>
          <div className="text-[12px] text-rosey-400 font-medium mt-2">
            {s.cuelloBotella.fuga}% de fuga · {s.cuelloBotella.tiempo} prom en etapa
          </div>
        </Card>
        <Card title="Tiempo prom · Lead → Venta">
          <div className="font-serif-display text-5xl leading-none">{s.tiempoLeadVenta.mediana} <span className="text-sm text-ink-mute font-sans">mediana</span></div>
          <div className="text-[12px] text-ink-mute mt-2">p90: {s.tiempoLeadVenta.p90} · p10: {s.tiempoLeadVenta.p10}</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card
          title="Embudo · esta semana"
          topRight={<span className="italic font-serif-display text-sm text-rosey-400">de 120 leads que entraron, 15 cerraron compra ✦</span>}
        >
          <div className="flex flex-col items-center gap-1 mt-2">
            {funnel.map((row, i) => {
              const widthPct = 35 + (row.count / top) * 60;
              const fuga = i > 0 ? Math.round(((funnel[i - 1].count - row.count) / funnel[i - 1].count) * 100) : 0;
              const pctFromPrev = i > 0 ? Math.round((row.count / funnel[i - 1].count) * 100) : 100;
              const tone = ["bg-skyy-100 border-skyy-300", "bg-lila-100 border-lila-300", "bg-ambr-100 border-ambr-300", "bg-ambr-200 border-ambr-300", "bg-sage-100 border-sage-300"][i];
              return (
                <div key={row.stage} className="flex items-center gap-3 w-full justify-center">
                  <div
                    className={`border rounded-md px-4 py-2 text-center ${tone}`}
                    style={{ width: `${widthPct}%`, maxWidth: 380 }}
                  >
                    <div className="font-serif-display text-2xl leading-none">{row.count}</div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-ink-mute mt-1">{row.stage.replace("_", " ")}</div>
                  </div>
                  <div className="w-40 text-[11px] text-ink-mute flex items-baseline gap-2">
                    <span className="font-serif-display text-base text-ink">{pctFromPrev}%</span>
                    <span>de la etapa ant.</span>
                    {i > 0 && fuga > 0 && (
                      <span className={`ml-2 ${fuga > 40 ? "text-rosey-400" : "text-ambr-300"} font-medium`}>↓ {fuga}% fuga</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[12px] text-ink-mute text-center italic mt-5">
            La fuga más grande está entre Preguntando y Cotizada — Eli/Nat tardan en armar la cotización de mayoreo.
          </p>
        </Card>

        <div className="space-y-4">
          <Card title="Tiempo promedio en cada etapa">
            <div className="text-[12px] text-ink-mute -mt-2 mb-3">una barra larga = etapa donde se atoran</div>
            <ul className="space-y-3">
              {s.tiempoEnEtapa.map((row) => (
                <li key={row.stage} className="grid grid-cols-[110px_1fr_70px] items-center gap-3">
                  <span className="text-[12px] text-ink-soft">{row.stage}</span>
                  <div className="h-3 rounded bg-cream-200 overflow-hidden">
                    <div
                      className={
                        "h-full " +
                        (row.w > 80 ? "bg-rosey-300" : row.w > 50 ? "bg-ambr-300" : row.w > 30 ? "bg-ambr-200" : "bg-skyy-200")
                      }
                      style={{ width: `${row.w}%` }}
                    />
                  </div>
                  <span className={"text-[12px] " + (row.w > 80 ? "text-rosey-400 font-medium" : "text-ink-mute")}>{row.label}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Conversión por canal">
            <div className="text-[12px] text-ink-mute -mt-2 mb-3">% de leads que llegan a venta cerrada</div>
            <ul className="space-y-3">
              {s.conversionPorCanal.map((row) => (
                <li key={row.channel} className="grid grid-cols-[90px_1fr_110px] items-center gap-3">
                  <span className="text-[12px] flex items-center gap-2">
                    <i className={"w-2 h-2 rounded-sm " + (row.channel === "meta" ? "bg-skyy-300" : row.channel === "tiktok" ? "bg-lila-300" : row.channel === "grupo" ? "bg-sage-300" : "bg-ambr-300")} />
                    {CHANNEL_LABEL[row.channel]}
                  </span>
                  <div className="h-3 rounded bg-cream-200 overflow-hidden">
                    <div
                      className="h-full bg-rosey-200"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-ink-mute">
                    <span className="font-serif-display text-sm text-ink">{row.pct}%</span> · {row.leads}L · {row.ventas}V
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-mute italic mt-4">
              Lectura: TikTok trae volumen pero convierte poco. Recurrentes es oro.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
