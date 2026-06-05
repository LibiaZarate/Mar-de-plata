"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Inbox, ExternalLink, Check, UserCheck, Clock4 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asesora } from "@/lib/types";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type Lead = {
  numero_whatsapp: string;
  nombre: string | null;
  ciudad: string | null;
  canal_origen: string | null;
  tipo: string | null;
  etiquetas: string[] | null;
};

type ColaItem = {
  id: number;
  tipo: string;
  prioridad: string;
  titulo: string;
  descripcion: string | null;
  numero_whatsapp: string;
  contexto_json: { motivo?: string } | null;
  created_at: string;
  lead: Lead | null;
};

const HANDOFF_MOTIVOS: Record<string, { emoji: string; nombre: string; tono: string }> = {
  visita_presencial: { emoji: "📍", nombre: "Visita local", tono: "border-skyy-300 bg-skyy-50 text-skyy-500" },
  compra_en_vivo: { emoji: "🎥", nombre: "Compra en live", tono: "border-rosey-300 bg-rosey-50 text-rosey-500" },
  personalizado: { emoji: "💎", nombre: "Personalizada", tono: "border-lila-300 bg-lila-50 text-lila-500" },
  lista_pedido: { emoji: "🛒", nombre: "Lista para pedido", tono: "border-sage-300 bg-sage-50 text-sage-600" },
  mayoreo_cotizacion: { emoji: "💰", nombre: "Cotización", tono: "border-ambr-300 bg-ambr-50 text-ambr-600" },
  reclamo: { emoji: "⚠️", nombre: "Reclamo", tono: "border-rosey-400 bg-rosey-100 text-rosey-600" },
  solicitud_explicita: { emoji: "🙋‍♀️", nombre: "Pidió humana", tono: "border-foreground/30 bg-cream-100 text-foreground" },
};

const LS_ASESORA = "mar:equipo:asesoraActual";

export function ColaHandoffs({ asesoras }: { asesoras: Asesora[] }) {
  // Selección de asesora "yo soy" (Eli o Nat). Persiste en localStorage.
  const [yo, setYo] = useState<string>("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_ASESORA) : null;
    if (saved) setYo(saved);
  }, []);

  function pickYo(id: string) {
    setYo(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_ASESORA, id);
  }

  const cola = useSWR<{ ok: boolean; cola: ColaItem[] }>(
    "/api/equipo/cola",
    fetcher,
    { refreshInterval: 15_000 },
  );
  const mis = useSWR<{ ok: boolean; mis_leads: ColaItem[] }>(
    yo ? `/api/equipo/mis-leads?asesora_id=${yo}` : null,
    fetcher,
    { refreshInterval: 15_000 },
  );

  const items = cola.data?.cola ?? [];
  const mios = mis.data?.mis_leads ?? [];

  async function tomar(alertaId: number) {
    if (!yo) return;
    const r = await fetch("/api/equipo/tomar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alerta_id: alertaId, asesora_id: yo }),
    });
    const d = await r.json();
    if (!d.ok) {
      alert(d.error || "No se pudo tomar");
      return;
    }
    mutate("/api/equipo/cola");
    mutate(`/api/equipo/mis-leads?asesora_id=${yo}`);
  }

  async function atender(alertaId: number) {
    if (!yo) return;
    const notas = prompt("¿Alguna nota del cierre? (opcional)") ?? "";
    const r = await fetch("/api/equipo/atender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alerta_id: alertaId, asesora_id: yo, notas: notas || null }),
    });
    const d = await r.json();
    if (!d.ok) {
      alert(d.error || "No se pudo cerrar");
      return;
    }
    mutate(`/api/equipo/mis-leads?asesora_id=${yo}`);
    mutate("/api/equipo/cola");
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-foreground/15 bg-cream-50 px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="label-xs">¿Quién está aquí ahora?</div>
            <div className="text-[12px] text-foreground/65 mt-1">
              Selecciona tu nombre para poder tomar leads de la cola y cerrarlos al atender.
            </div>
          </div>
          <select
            value={yo}
            onChange={(e) => pickYo(e.target.value)}
            className="text-sm px-3 py-1.5 rounded border border-foreground/20 bg-cream-50"
          >
            <option value="">— elige —</option>
            {asesoras.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre_completo}</option>
            ))}
          </select>
        </div>
      </div>

      <ColaPanel
        items={items}
        loading={cola.isLoading}
        yo={yo}
        onTomar={tomar}
      />

      {yo && (
        <MisPanel
          items={mios}
          loading={mis.isLoading}
          onAtender={atender}
        />
      )}
    </section>
  );
}

function ColaPanel({
  items,
  loading,
  yo,
  onTomar,
}: {
  items: ColaItem[];
  loading: boolean;
  yo: string;
  onTomar: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="label-xs flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5" />
          Cola compartida ({items.length})
        </div>
        <div className="text-[11px] text-foreground/55">
          Si nadie las toma, se asignan automático después de 5 min
        </div>
      </div>
      {loading && <div className="h-24 rounded bg-cream-200 animate-pulse" />}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-foreground/15 bg-cream-50 px-5 py-6 text-center text-[12px] text-foreground/55 italic">
          No hay handoffs pendientes en la cola 🌊
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <ColaItemCard key={item.id} item={item} yo={yo} onTomar={onTomar} />
        ))}
      </div>
    </div>
  );
}

function ColaItemCard({
  item,
  yo,
  onTomar,
}: {
  item: ColaItem;
  yo: string;
  onTomar: (id: number) => void;
}) {
  const motivo = item.contexto_json?.motivo ?? "handoff";
  const info = HANDOFF_MOTIVOS[motivo] ?? {
    emoji: "👤",
    nombre: motivo,
    tono: "border-foreground/30 bg-cream-100 text-foreground",
  };
  const tiempoMin = Math.max(
    0,
    Math.round((Date.now() - new Date(item.created_at).getTime()) / 60_000),
  );
  const tiempoLabel = tiempoMin === 0 ? "ahora" : `hace ${tiempoMin} min`;
  const numeroLimpio = item.numero_whatsapp.replace(/\D/g, "");
  const nombre = item.lead?.nombre?.trim() || `Sin nombre · ${item.numero_whatsapp.slice(-4)}`;
  const isUrgent = item.prioridad === "urgente";

  return (
    <div
      className={cn(
        "rounded-lg border bg-cream-50 px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center",
        isUrgent ? "border-rosey-300" : "border-foreground/15",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", info.tono)}>
            {info.emoji} {info.nombre}
          </span>
          {isUrgent && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-rosey-400 bg-rosey-100 text-rosey-600">
              URGENTE
            </span>
          )}
          <span className="text-[11px] text-foreground/55 flex items-center gap-1">
            <Clock4 className="h-3 w-3" /> {tiempoLabel}
          </span>
        </div>
        <div className="text-[14px] font-medium truncate">{nombre}</div>
        <div className="text-[11px] text-foreground/55 truncate">
          {item.lead?.ciudad ?? "—"} · {item.lead?.canal_origen ?? "—"} ·{" "}
          <span className="font-mono">{item.numero_whatsapp}</span>
        </div>
        {item.descripcion && (
          <div className="text-[12px] text-foreground/65 italic truncate">
            “{item.descripcion}”
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onTomar(item.id)}
          disabled={!yo}
          className="inline-flex items-center justify-center gap-1.5 text-[12px] px-3 py-1.5 rounded bg-rosey-300 hover:bg-rosey-400 text-cream-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          title={yo ? "Tomar este lead" : "Primero selecciona tu nombre arriba"}
        >
          <UserCheck className="h-3 w-3" /> Tomar
        </button>
        <a
          href={`https://wa.me/${numeroLimpio}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded border border-foreground/15 hover:bg-cream-100"
        >
          <ExternalLink className="h-3 w-3" /> chat
        </a>
      </div>
    </div>
  );
}

function MisPanel({
  items,
  loading,
  onAtender,
}: {
  items: ColaItem[];
  loading: boolean;
  onAtender: (id: number) => void;
}) {
  return (
    <div>
      <div className="label-xs mb-2">Tus leads atendiendo ({items.length})</div>
      {loading && <div className="h-24 rounded bg-cream-200 animate-pulse" />}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-foreground/15 bg-cream-50 px-5 py-6 text-center text-[12px] text-foreground/55 italic">
          No tienes ningún lead activo asignado a ti.
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => {
          const motivo = item.contexto_json?.motivo ?? "handoff";
          const info = HANDOFF_MOTIVOS[motivo] ?? {
            emoji: "👤",
            nombre: motivo,
            tono: "border-foreground/30 bg-cream-100 text-foreground",
          };
          const numeroLimpio = item.numero_whatsapp.replace(/\D/g, "");
          const nombre =
            item.lead?.nombre?.trim() || `Sin nombre · ${item.numero_whatsapp.slice(-4)}`;
          const tiempoMin = Math.max(
            0,
            Math.round((Date.now() - new Date(item.created_at).getTime()) / 60_000),
          );
          return (
            <div
              key={item.id}
              className="rounded-lg border border-sage-300/60 bg-sage-50/40 px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", info.tono)}>
                    {info.emoji} {info.nombre}
                  </span>
                  <span className="text-[11px] text-foreground/55">hace {tiempoMin} min</span>
                </div>
                <div className="text-[14px] font-medium truncate">{nombre}</div>
                <div className="text-[11px] text-foreground/55 truncate">
                  <span className="font-mono">{item.numero_whatsapp}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => onAtender(item.id)}
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] px-3 py-1.5 rounded bg-sage-200 hover:bg-sage-300 text-sage-700 font-medium"
                >
                  <Check className="h-3 w-3" /> Atendido
                </button>
                <a
                  href={`https://wa.me/${numeroLimpio}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded border border-foreground/15 hover:bg-cream-100"
                >
                  <ExternalLink className="h-3 w-3" /> chat
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
