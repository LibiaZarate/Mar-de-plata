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
        <h1 className="font-serif-display text-5xl leading-none mt-1">Tu equipo</h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          {asesoras.data?.length ?? 0} asesoras activas · sin ranking, sin competencia
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {asesoras.error && (
            <div className="border border-destructive/40 bg-destructive/5 rounded px-3 py-2 text-[12px] text-destructive">
              {asesoras.error.message}
            </div>
          )}
          {asesoras.isLoading ? (
            <div className="h-40 rounded bg-muted animate-pulse" />
          ) : (asesoras.data ?? []).length === 0 ? (
            <div className="text-[13px] text-muted-foreground italic">
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
  const accent = asesora.en_onboarding ? "border-meta/50" : "border-grupo/50";
  const initials = asesora.nombre_completo.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`rounded-md border ${accent} bg-card p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-base font-semibold bg-secondary">
            {initials || "—"}
          </div>
          <div>
            <div className="font-serif-display text-2xl leading-none">{asesora.nombre_completo}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {asesora.en_onboarding ? "Onboarding" : "Asesora senior"}
              {asesora.horario_inicio && asesora.horario_fin
                ? ` · ${asesora.horario_inicio.slice(0, 5)}–${asesora.horario_fin.slice(0, 5)}`
                : ""}
            </div>
          </div>
        </div>
        <span className="text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border border-grupo/40 bg-grupo/10 text-grupo">● Disponible</span>
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
    <div className="border border-border rounded-md px-3 py-2">
      <div className="label-xs">{label}</div>
      <div className="font-serif-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
