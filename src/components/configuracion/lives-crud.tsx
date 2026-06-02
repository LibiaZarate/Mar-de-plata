"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import type { EventoLive } from "@/lib/types";
import { Trash2, Save } from "lucide-react";

const KEY = "/api/dashboard/lives";
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function LivesCrud() {
  const { data, isLoading } = useSWR<{ ok: boolean; lives: EventoLive[]; error?: string }>(
    KEY,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const lives = data?.lives ?? [];
  const error = data && !data.ok ? data.error : null;

  const [draft, setDraft] = useState<Partial<EventoLive>>({
    red_social: "facebook",
    activo: true,
    codigo_descuento: "",
    descripcion_promo: "",
    link_evento: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.fecha_inicio || !draft.fecha_fin) return alert("Falta fecha de inicio o fin");
    setSaving(true);
    try {
      const r = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_inicio: draft.fecha_inicio,
          fecha_fin: draft.fecha_fin,
          red_social: draft.red_social,
          link_evento: draft.link_evento || null,
          codigo_descuento: draft.codigo_descuento || null,
          descripcion_promo: draft.descripcion_promo || null,
          activo: draft.activo ?? true,
        }),
      });
      const d = await r.json();
      if (!d.ok) return alert(d.error || "Error al guardar el live");
      setDraft({ red_social: "facebook", activo: true });
      mutate(KEY);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(id: number, activo: boolean) {
    const r = await fetch(`${KEY}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    const d = await r.json();
    if (!d.ok) return alert(d.error || "Error");
    mutate(KEY);
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar este live?")) return;
    const r = await fetch(`${KEY}/${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!d.ok) return alert(d.error || "Error");
    mutate(KEY);
  }

  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Configuración · Lives</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Calendario de lives</h1>
        <div className="text-[13px] text-foreground/60 mt-2">
          Sirena consulta esta tabla en cada turno para saber si hay live activo o programado.
        </div>
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-foreground/15 bg-cream-50 p-5 space-y-3">
        <div className="label-xs">Nuevo live</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha inicio">
            <input
              type="datetime-local"
              className="input"
              value={draft.fecha_inicio?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  fecha_inicio: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
          </Field>
          <Field label="Fecha fin">
            <input
              type="datetime-local"
              className="input"
              value={draft.fecha_fin?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  fecha_fin: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
            />
          </Field>
          <Field label="Red social">
            <select
              className="input"
              value={draft.red_social ?? "facebook"}
              onChange={(e) =>
                setDraft({ ...draft, red_social: e.target.value as EventoLive["red_social"] })
              }
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </Field>
          <Field label="Código de descuento">
            <input
              className="input"
              value={draft.codigo_descuento ?? ""}
              placeholder="MAR300"
              onChange={(e) => setDraft({ ...draft, codigo_descuento: e.target.value })}
            />
          </Field>
          <Field label="Link al evento">
            <input
              className="input"
              value={draft.link_evento ?? ""}
              placeholder="https://facebook.com/…"
              onChange={(e) => setDraft({ ...draft, link_evento: e.target.value })}
            />
          </Field>
          <Field label="Descripción de la promo">
            <input
              className="input"
              value={draft.descripcion_promo ?? ""}
              onChange={(e) => setDraft({ ...draft, descripcion_promo: e.target.value })}
            />
          </Field>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
          <Save className="h-4 w-4 mr-1.5" /> {saving ? "Guardando…" : "Guardar live"}
        </button>
      </section>

      {isLoading && <div className="h-12 rounded bg-cream-200 animate-pulse" />}

      <section className="rounded-lg border border-foreground/15 bg-cream-50">
        <div className="grid grid-cols-[1fr_120px_120px_140px_120px_60px] text-[11px] tracking-wider uppercase text-foreground/55 px-4 py-2 border-b border-foreground/10">
          <div>Promo / código</div>
          <div>Red</div>
          <div>Inicio</div>
          <div>Fin</div>
          <div>Estado</div>
          <div></div>
        </div>
        {lives.map((ev) => (
          <div
            key={ev.id}
            className="grid grid-cols-[1fr_120px_120px_140px_120px_60px] items-center px-4 py-3 border-b border-foreground/10 last:border-0 text-sm"
          >
            <div>
              <div className="font-medium">
                {ev.descripcion_promo || (
                  <span className="text-foreground/55 italic">sin promo</span>
                )}
              </div>
              <div className="text-[11px] font-mono text-foreground/55">
                {ev.codigo_descuento ?? "—"}
              </div>
            </div>
            <div className="text-[12px]">{ev.red_social}</div>
            <div className="text-[12px]">
              {new Date(ev.fecha_inicio).toLocaleString("es-MX", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-[12px]">
              {new Date(ev.fecha_fin).toLocaleString("es-MX", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div>
              <button
                onClick={() => toggleActivo(ev.id, ev.activo)}
                className={
                  "text-[11px] px-2 py-0.5 rounded border " +
                  (ev.activo
                    ? "border-sage-300 bg-sage-50 text-sage-600"
                    : "border-foreground/15 text-foreground/55")
                }
              >
                {ev.activo ? "activo" : "inactivo"}
              </button>
            </div>
            <button
              onClick={() => remove(ev.id)}
              className="text-foreground/45 hover:text-rosey-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {lives.length === 0 && !isLoading && (
          <div className="text-center text-foreground/55 text-[13px] py-8">
            Sin lives todavía.
          </div>
        )}
      </section>

      <style>{`
        .input { width:100%; padding:8px 10px; border:1px solid hsl(var(--border)); border-radius:6px; background:hsl(var(--card)); font-size:14px; color:hsl(var(--foreground)); outline:none; }
        .input:focus { border-color:hsl(var(--primary)); }
        .btn-primary { display:inline-flex; align-items:center; padding: 8px 14px; border-radius: 6px; background: hsl(var(--primary)); color: white; font-size: 13px; font-weight: 500; }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
}
