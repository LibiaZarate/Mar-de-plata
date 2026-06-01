"use client";

import { useAsesoras, useMetricasEquipo } from "@/lib/queries";
import { CierresWidget } from "./cierres-widget";
import { formatMxn } from "@/lib/utils";
import type { Asesora } from "@/lib/types";

export function EquipoView() {
  const asesoras = useAsesoras();
  const metricas = useMetricasEquipo();

  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Inicio · Equipo</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Tu equipo</h1>
        <div className="text-[13px] text-foreground/60 mt-2">
          {asesoras.data?.length ?? 0} asesoras activas · sin ranking, sin competencia
        </div>
      </div>

      <div className="border border-rosey-300 bg-rosey-50/40 rounded-md px-5 py-3 text-[13px] text-foreground/75 flex items-start gap-3">
        <span className="font-italic-serif text-rosey-500 mt-0.5">nota →</span>
        <p>
          Las métricas vienen de <code className="text-foreground">cierres_diarios</code> y{" "}
          <code className="text-foreground">alertas</code> en vivo. El widget de la derecha es el
          lugar oficial donde Eli y Nat registran cada pago al recibir el comprobante.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {asesoras.error && (
            <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
              {asesoras.error.message}
            </div>
          )}
          {asesoras.isLoading ? (
            <div className="h-40 rounded bg-cream-200 animate-pulse" />
          ) : (asesoras.data ?? []).length === 0 ? (
            <div className="text-[13px] text-foreground/55 italic">
              No hay asesoras activas todavía. Inserta filas en la tabla{" "}
              <code>asesoras</code> con <code>activa=true</code>.
            </div>
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
  asesora, metrica,
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
  const initials = asesora.nombre_completo.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const pill = asesora.en_onboarding ? "pill-sky" : "pill-sage";

  return (
    <div className={`rounded-md border ${accent} bg-cream-50 p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-foreground/30 flex items-center justify-center text-[14px] font-semibold bg-cream-100">
            {initials || "—"}
          </div>
          <div>
            <div className="font-serif-display text-[26px] leading-none">{asesora.nombre_completo}</div>
            <div className="text-[11px] text-foreground/55 mt-1">
              {asesora.en_onboarding ? "Onboarding" : "Asesora senior"}
              {asesora.horario_inicio && asesora.horario_fin
                ? ` · ${asesora.horario_inicio.slice(0, 5)}–${asesora.horario_fin.slice(0, 5)}`
                : ""}
            </div>
          </div>
        </div>
        <span className={pill}>● {asesora.en_onboarding ? "Aprendiendo" : "Disponible"}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <Stat label="Conversaciones hoy" value={String(metrica?.conversaciones_hoy ?? 0)} />
        <Stat label="Pedidos cerrados" value={String(metrica?.pedidos_hoy ?? 0)} />
        <Stat label="Monto generado" value={formatMxn(metrica?.monto_hoy ?? 0)} />
        <Stat label="Alertas activas" value={String(metrica?.alertas_activas ?? 0)} />
        <Stat label="% de cierre" value={`${(metrica?.pct_cierre ?? 0).toFixed(0)}%`} />
        <Stat label="Conv. abiertas" value={String(asesora.conversaciones_abiertas ?? 0)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/15 rounded-md px-3 py-2 bg-cream-50">
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-[26px] leading-tight">{value}</div>
    </div>
  );
}
