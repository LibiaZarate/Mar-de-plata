"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { EventoLive } from "@/lib/types";
import { Trash2, Save } from "lucide-react";

const KEY = "eventos_live";

export function LivesCrud() {
  const { data, isLoading, error } = useSWR(KEY, async () => {
    const sb = createClient();
    const { data, error } = await sb.from("eventos_live").select("*").order("fecha_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EventoLive[];
  }, { refreshInterval: 30_000 });

  const [draft, setDraft] = useState<Partial<EventoLive>>({
    red_social: "facebook", activo: true, codigo_descuento: "", descripcion_promo: "", link_evento: "",
  });

  async function save() {
    if (!draft.fecha_inicio || !draft.fecha_fin) return alert("Falta fecha de inicio o fin");
    const sb = createClient();
    const { error } = await sb.from("eventos_live").insert({
      fecha_inicio: draft.fecha_inicio,
      fecha_fin: draft.fecha_fin,
      red_social: draft.red_social,
      link_evento: draft.link_evento || null,
      codigo_descuento: draft.codigo_descuento || null,
      descripcion_promo: draft.descripcion_promo || null,
      activo: draft.activo ?? true,
    });
    if (error) return alert(error.message);
    setDraft({ red_social: "facebook", activo: true });
    mutate(KEY);
  }

  async function toggleActivo(id: number, activo: boolean) {
    const sb = createClient();
    const { error } = await sb.from("eventos_live").update({ activo: !activo }).eq("id", id);
    if (error) return alert(error.message);
    mutate(KEY);
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar este live?")) return;
    const sb = createClient();
    const { error } = await sb.from("eventos_live").delete().eq("id", id);
    if (error) return alert(error.message);
    mutate(KEY);
  }

  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Configuración · Lives</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">Calendario de lives</h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Sirena consulta esta tabla en cada turno para saber si hay live activo o programado.
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="label-xs">Nuevo live</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha inicio">
            <input type="datetime-local" className="input" value={draft.fecha_inicio?.slice(0, 16) ?? ""}
              onChange={(e) => setDraft({ ...draft, fecha_inicio: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </Field>
          <Field label="Fecha fin">
            <input type="datetime-local" className="input" value={draft.fecha_fin?.slice(0, 16) ?? ""}
              onChange={(e) => setDraft({ ...draft, fecha_fin: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </Field>
          <Field label="Red social">
            <select className="input" value={draft.red_social ?? "facebook"}
              onChange={(e) => setDraft({ ...draft, red_social: e.target.value as EventoLive["red_social"] })}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </Field>
          <Field label="Código de descuento">
            <input className="input" value={draft.codigo_descuento ?? ""} placeholder="MAR300"
              onChange={(e) => setDraft({ ...draft, codigo_descuento: e.target.value })} />
          </Field>
          <Field label="Link al evento">
            <input className="input" value={draft.link_evento ?? ""} placeholder="https://facebook.com/…"
              onChange={(e) => setDraft({ ...draft, link_evento: e.target.value })} />
          </Field>
          <Field label="Descripción de la promo">
            <input className="input" value={draft.descripcion_promo ?? ""}
              onChange={(e) => setDraft({ ...draft, descripcion_promo: e.target.value })} />
          </Field>
        </div>
        <button onClick={save} className="btn-primary">
          <Save className="h-4 w-4 mr-1.5" /> Guardar live
        </button>
      </section>

      {error && <div className="text-[12px] text-destructive">{error.message}</div>}
      {isLoading && <div className="h-12 rounded bg-muted animate-pulse" />}

      <section className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_120px_120px_140px_120px_60px] text-[11px] tracking-wider uppercase text-muted-foreground px-4 py-2 border-b border-border">
          <div>Promo / código</div>
          <div>Red</div>
          <div>Inicio</div>
          <div>Fin</div>
          <div>Estado</div>
          <div></div>
        </div>
        {(data ?? []).map((ev) => (
          <div key={ev.id} className="grid grid-cols-[1fr_120px_120px_140px_120px_60px] items-center px-4 py-3 border-b border-border last:border-0 text-sm">
            <div>
              <div className="font-medium">{ev.descripcion_promo || <span className="text-muted-foreground italic">sin promo</span>}</div>
              <div className="text-[11px] font-mono text-muted-foreground">{ev.codigo_descuento ?? "—"}</div>
            </div>
            <div className="text-[12px]">{ev.red_social}</div>
            <div className="text-[12px]">{new Date(ev.fecha_inicio).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            <div className="text-[12px]">{new Date(ev.fecha_fin).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            <div>
              <button onClick={() => toggleActivo(ev.id, ev.activo)}
                className={"text-[11px] px-2 py-0.5 rounded border " + (ev.activo ? "border-grupo/40 bg-grupo/10 text-grupo" : "border-border text-muted-foreground")}>
                {ev.activo ? "activo" : "inactivo"}
              </button>
            </div>
            <button onClick={() => remove(ev.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <div className="text-center text-muted-foreground text-[13px] py-8">Sin lives todavía.</div>
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
