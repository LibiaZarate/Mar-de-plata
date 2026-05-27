import { useAsesoras, useMetricasEquipo } from "../lib/queries";
import { Pill } from "../components/ui";
import { Skeleton, ErrorBanner } from "../components/feedback";
import CierresWidget from "../components/CierresWidget";
import type { Asesora } from "../lib/types";

function fmtMxn(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX");
}

export default function Equipo() {
  const asesoras = useAsesoras();
  const metricas = useMetricasEquipo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif-display text-5xl leading-none">Tu equipo</h1>
        <div className="text-[13px] text-ink-mute mt-2">
          {asesoras.data?.length ?? 0} asesoras activas · sin ranking, sin competencia
        </div>
      </div>

      <div className="border border-rosey-300 bg-rosey-50/30 rounded-md px-5 py-3 text-[13px] text-ink-soft flex items-start gap-3">
        <span className="font-serif-display italic text-rosey-400 mt-0.5">nota →</span>
        <p>
          Las métricas que ves vienen de <span className="font-mono text-[12px]">cierres_diarios</span>{" "}
          y <span className="font-mono text-[12px]">alertas</span> en vivo. El widget de la derecha
          es el lugar oficial donde Eli y Nat registran cada pago al recibir el comprobante.
        </p>
      </div>

      {asesoras.error && <ErrorBanner message={asesoras.error.message} />}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {asesoras.isLoading ? (
            <Skeleton lines={8} />
          ) : (asesoras.data ?? []).length === 0 ? (
            <div className="text-[13px] text-ink-mute italic">No hay asesoras activas en la base de datos todavía.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(asesoras.data ?? []).map((a) => (
                <AsesoraCard
                  key={a.id}
                  asesora={a}
                  metrica={metricas.data?.find((m) => m.asesora_id === a.id)}
                />
              ))}
            </div>
          )}
        </div>

        <CierresWidget />
      </div>
    </div>
  );
}

function AsesoraCard({
  asesora,
  metrica,
}: {
  asesora: Asesora;
  metrica?: {
    pedidos_hoy: number;
    monto_hoy: number;
    alertas_activas: number;
    conversaciones_hoy: number;
    pct_cierre: number;
  };
}) {
  const accent = asesora.en_onboarding ? "border-skyy-300" : "border-sage-300";
  const initials =
    asesora.nombre_completo
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  return (
    <div className={`rounded-md border ${accent} bg-cream-50 p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-ink/30 flex items-center justify-center text-base font-semibold bg-cream-100">
            {initials}
          </div>
          <div>
            <div className="font-serif-display text-2xl leading-none">
              {asesora.nombre_completo}
            </div>
            <div className="text-[11px] text-ink-mute mt-1">
              {asesora.en_onboarding ? "Onboarding" : "Asesora senior"}
              {asesora.horario_inicio && asesora.horario_fin
                ? ` · ${asesora.horario_inicio.slice(0, 5)}–${asesora.horario_fin.slice(0, 5)}`
                : ""}
            </div>
          </div>
        </div>
        <Pill tone={asesora.en_onboarding ? "sky" : "sage"}>● Disponible</Pill>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <Stat label="Conversaciones hoy" value={(metrica?.conversaciones_hoy ?? 0).toString()} />
        <Stat label="Pedidos cerrados" value={(metrica?.pedidos_hoy ?? 0).toString()} />
        <Stat label="Monto generado" value={fmtMxn(metrica?.monto_hoy ?? 0)} />
        <Stat label="Resp. promedio" value="—" hint="próximamente" />
        <Stat label="Alertas activas" value={(metrica?.alertas_activas ?? 0).toString()} />
        <Stat label="% de cierre" value={`${(metrica?.pct_cierre ?? 0).toFixed(0)}%`} />
      </div>

      {asesora.en_onboarding && (
        <div className="border border-ink/15 rounded-md p-3">
          <div className="label-xs mb-2">Sugerencias Sirena</div>
          <div className="text-[12px] text-ink-mute italic">
            Por configurar — aquí aparecerán los tips que la IA genere para esta persona.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-ink/15 rounded-md px-3 py-2">
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-2xl leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-ink-mute italic">{hint}</div>}
    </div>
  );
}
