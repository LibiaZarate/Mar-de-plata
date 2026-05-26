import { useState } from "react";
import { useStore, formatMxn } from "../data/store";
import { Card, Pill, Sparkline, Tabs } from "../components/ui";

export default function Kpis() {
  const s = useStore((x) => x);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif-display text-5xl leading-none">Pulso del negocio</h1>
          <div className="text-[13px] text-ink-mute mt-2">
            Las cuatro métricas con tendencia · ventana: últimos {range === "7d" ? "7 días" : range === "30d" ? "30 días" : "90 días"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={range}
            options={[
              { value: "7d", label: "7d" },
              { value: "30d", label: "30d" },
              { value: "90d", label: "90d" },
            ]}
            onChange={setRange}
          />
          <button className="btn-primary text-sm">Exportar</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Facturación hoy"
          value={formatMxn(s.facturacionHoy)}
          delta="↑ 18% vs prom 7d"
          deltaTone="up"
          color="#C97A8B"
        />
        <KpiCard
          label="Pedidos cerrados"
          value={s.pedidosHoy.toString()}
          delta={`ticket prom ${formatMxn(s.ticketPromedio)}`}
          deltaTone="neutral"
          color="#9482BC"
        />
        <KpiCard
          label="Leads que entraron"
          value={s.leadsHoy.toString()}
          delta="Meta lidera (VFL)"
          deltaTone="neutral"
          color="#88A6C8"
        />
        <KpiCard
          label="En cancha"
          value={"9"}
          delta="↓ Mayor (mejor)"
          deltaTone="down"
          color="#D9A05B"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card
          title={`Facturación · últimos ${range === "7d" ? "7" : range === "30d" ? "30" : "90"} días`}
          className="col-span-2"
        >
          <div className="flex items-baseline gap-4 mb-3">
            <div className="font-serif-display text-4xl leading-none">{formatMxn(s.facturacion30d)} MXN</div>
            <div className="text-[12px] text-sage-300 font-medium">↑ {s.facturacion30dDelta}% vs 30d anteriores</div>
          </div>
          <AreaChart data={s.facturacionSpark} height={170} />
          <div className="grid grid-cols-3 gap-6 mt-4 pt-4 border-t border-ink/10 text-[12px]">
            <div>
              <div className="label-xs">Mejor día</div>
              <div className="font-serif-display text-lg">{formatMxn(s.mejorDia)}</div>
            </div>
            <div>
              <div className="label-xs">Peor día</div>
              <div className="font-serif-display text-lg">{formatMxn(s.peorDia)}</div>
            </div>
            <div>
              <div className="label-xs">Prom diario</div>
              <div className="font-serif-display text-lg">{formatMxn(s.promDiario)}</div>
            </div>
          </div>
        </Card>

        <Card title="Mix por canal · hoy">
          <DonutChart leads={s.leadsHoy} segments={[
            { label: "Meta", value: s.leadsPorCanal.meta, color: "#88A6C8" },
            { label: "Grupo", value: s.leadsPorCanal.grupo, color: "#8FAE82" },
            { label: "TikTok", value: s.leadsPorCanal.tiktok, color: "#9482BC" },
            { label: "Orgánico", value: s.leadsPorCanal.organico, color: "#D9A05B" },
          ]} />
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card
          title="Top 5 anuncios del mes"
          topRight={<span className="label-xs">Ordenado por facturación generada</span>}
          className="col-span-2"
        >
          <ul className="space-y-3 mt-2">
            {s.topAds.map((ad) => (
              <li key={ad.rank} className="flex items-center gap-4">
                <span className="font-serif-display text-xl w-5 text-ink-mute">{ad.rank}</span>
                <span className="text-sm font-medium flex-1 min-w-0 truncate">{ad.name}</span>
                <Pill tone={ad.channel === "meta" ? "sky" : ad.channel === "tiktok" ? "lila" : ad.channel === "grupo" ? "sage" : "ambr"}>
                  {ad.channel.charAt(0).toUpperCase() + ad.channel.slice(1)}
                </Pill>
                <div className="w-40">
                  <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                    <div
                      className="h-full bg-rosey-200"
                      style={{ width: `${(ad.revenue / s.topAds[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[12px] text-ink-mute w-32 text-right">
                  {ad.leads}L · {ad.sales}V · <span className="font-serif-display text-sm text-ink">{formatMxn(ad.revenue / 1000).slice(0, -1)}k</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Conversión global del embudo">
            <div className="font-serif-display text-5xl leading-none">{s.conversionGlobal}%</div>
            <div className="text-[12px] text-ink-mute mt-2">120 leads · 32 cot. · 15 venta</div>
            <div className="text-[12px] text-sage-300 mt-3">↑ 2.1 pp vs mes anterior</div>
          </Card>
          <Card title="Sirena · respuesta < 5 min">
            <div className="font-serif-display text-5xl leading-none">{s.respuestaPct}%</div>
            <div className="text-[12px] text-ink-mute mt-1">de {s.respuestaTotal.toLocaleString("es-MX")} msgs</div>
            <div className="flex gap-1 mt-3">
              {["L","M","M","J","V","S","D"].map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="h-8 w-full bg-rosey-100 rounded-sm" style={{ height: 8 + (i % 3) * 6 + "px" }} />
                  <span className="text-[10px] text-ink-mute">{d}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-ink-mute mt-1">esta semana</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, deltaTone, color }: { label: string; value: string; delta: string; deltaTone: "up" | "down" | "neutral"; color: string }) {
  const random = Array.from({ length: 10 }, () => 8 + Math.random() * 8);
  const deltaColor =
    deltaTone === "up" ? "text-sage-300" :
    deltaTone === "down" ? "text-rosey-400" :
    "text-ink-mute";
  return (
    <Card title={label}>
      <div className="flex items-end justify-between">
        <div className="font-serif-display text-3xl leading-none">{value}</div>
        <Sparkline data={random} color={color} width={90} height={32} />
      </div>
      <div className={`mt-2 text-[12px] ${deltaColor} font-medium`}>{delta}</div>
    </Card>
  );
}

function AreaChart({ data, height = 160 }: { data: number[]; height?: number }) {
  const width = 600;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 20) - 10;
    return [x, y] as const;
  });
  const path = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), "");
  const fillPath = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EDB5C0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#EDB5C0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#areaGrad)" />
      <path d={path} stroke="#C97A8B" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <line x1="0" y1={height - 8} x2={width} y2={height - 8} stroke="rgba(43,38,32,0.15)" />
      <text x="0" y={height - 1} fontSize="9" fill="#8A7F72" letterSpacing="2">HACE 30D</text>
      <text x={width - 22} y={height - 1} fontSize="9" fill="#8A7F72" letterSpacing="2">HOY</text>
    </svg>
  );
}

function DonutChart({ leads, segments }: { leads: number; segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0);
  let acc = 0;
  const R = 50, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="-60 -60 120 120" width="120" height="120" className="-rotate-90">
        <circle r={R} cx="0" cy="0" fill="none" stroke="#EFE6D3" strokeWidth="14" />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * C;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={i}
              r={R}
              cx="0"
              cy="0"
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
            />
          );
        })}
        <text x="0" y="3" textAnchor="middle" fontSize="20" fontFamily="DM Serif Display" transform="rotate(90)" fill="#2B2620">
          {leads}
        </text>
        <text x="0" y="18" textAnchor="middle" fontSize="7" letterSpacing="2" fill="#8A7F72" transform="rotate(90)">
          LEADS HOY
        </text>
      </svg>
      <ul className="text-[12px] flex-1 space-y-1.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-sm" style={{ background: seg.color }} />
              {seg.label}
            </span>
            <span className="text-ink-mute">
              {seg.value} · {Math.round((seg.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
