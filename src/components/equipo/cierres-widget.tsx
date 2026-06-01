"use client";

import { useEffect, useRef, useState } from "react";
import { buscarLeads, useAsesoras, useCierresRecientes } from "@/lib/queries";
import { registrarCierre, uploadComprobante } from "@/lib/actions";
import type { Cierre, Lead } from "@/lib/types";

const CANAL_OPTIONS: { value: Cierre["canal"]; label: string }[] = [
  { value: "mayoreo_catalogo", label: "Mayoreo · catálogo" },
  { value: "mayoreo_grupo", label: "Mayoreo · grupo" },
  { value: "menudeo", label: "Menudeo" },
  { value: "live", label: "Live" },
  { value: "presencial", label: "Presencial" },
];

export function CierresWidget() {
  const { data: asesoras } = useAsesoras();
  const cierres = useCierresRecientes(5);

  const [lead, setLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [monto, setMonto] = useState("");
  const [canal, setCanal] = useState<Cierre["canal"]>("mayoreo_catalogo");
  const [notas, setNotas] = useState("");
  const [asesoraId, setAsesoraId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    if (!asesoraId && asesoras && asesoras.length > 0) setAsesoraId(asesoras[0].id);
  }, [asesoras, asesoraId]);

  useEffect(() => {
    if (lead) return;
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(() => {
      const q = query.trim();
      if (q.length < 2) { setResults([]); return; }
      buscarLeads(q).then(setResults).catch(() => setResults([]));
    }, 220);
  }, [query, lead]);

  async function submit() {
    setError(null);
    if (!lead) return setError("Elige un cliente del buscador.");
    if (!asesoraId) return setError("Elige una asesora.");
    const m = Number(monto);
    if (!m || m <= 0) return setError("Monto inválido.");
    setSubmitting(true);
    try {
      let comprobante_url: string | undefined;
      if (file) comprobante_url = await uploadComprobante(file, lead.numero_whatsapp);
      await registrarCierre({
        numero_whatsapp: lead.numero_whatsapp,
        asesora_id: asesoraId,
        monto: m,
        canal,
        notas: notas || undefined,
        comprobante_url,
      });
      setLead(null); setQuery(""); setMonto(""); setNotas(""); setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="rounded-md border border-primary/30 bg-card p-5 flex flex-col gap-4 h-fit sticky top-6">
      <div>
        <div className="label-xs">Widget operativo</div>
        <h2 className="font-serif-display text-3xl leading-tight">Cierres del día</h2>
        <p className="text-[12px] text-muted-foreground mt-1">
          Cuando llegue el comprobante, regístralo aquí. Marca el lead como pagado y suma a la facturación al instante.
        </p>
      </div>

      <Field label="Cliente">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => { setLead(null); setQuery(e.target.value); }}
            placeholder="Buscar por nombre o número…"
            className="input"
          />
          {!lead && results.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
              {results.map((r) => (
                <li key={r.numero_whatsapp}>
                  <button
                    onClick={() => { setLead(r); setQuery(`${r.nombre ?? r.numero_whatsapp} · ${r.numero_whatsapp}`); setResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-secondary border-b border-border last:border-0"
                  >
                    <div className="text-sm font-medium">{r.nombre ?? "Sin nombre"} · {r.ciudad ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{r.numero_whatsapp}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="1500" className="input pl-6 pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">MXN</span>
          </div>
        </Field>
        <Field label="Canal">
          <select value={canal} onChange={(e) => setCanal(e.target.value as Cierre["canal"])} className="input">
            {CANAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Asesora">
        <select value={asesoraId} onChange={(e) => setAsesoraId(e.target.value)} className="input">
          {(asesoras ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
        </select>
      </Field>

      <Field label="Notas (opcional)">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="tarjeta · 2 piezas pandora" rows={2} className="input resize-none" />
      </Field>

      <Field label="Comprobante (opcional)">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          className={"block border-2 border-dashed rounded-md px-3 py-3 text-center text-[12px] cursor-pointer transition-colors " +
            (dragOver ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-secondary")
          }
        >
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <span className="text-foreground">{file.name}</span>
          ) : (
            <>
              <span className="block">Arrastra o haz clic para subir</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">imagen o PDF</span>
            </>
          )}
        </label>
      </Field>

      {error && (
        <div className="text-[12px] text-destructive border border-destructive/40 bg-destructive/5 rounded px-3 py-2">
          {error}
        </div>
      )}

      <button onClick={submit} disabled={submitting}
        className="w-full py-2.5 rounded-md bg-grupo hover:opacity-90 text-white font-medium transition-opacity disabled:opacity-50">
        {submitting ? "Guardando…" : "Registrar cierre"}
      </button>

      <div className="pt-3 border-t border-border">
        <div className="label-xs mb-2">Últimos cierres de hoy</div>
        {cierres.isLoading ? (
          <div className="text-[12px] text-muted-foreground italic">Cargando…</div>
        ) : (cierres.data ?? []).length === 0 ? (
          <div className="text-[12px] text-muted-foreground italic">
            Aún no se registra ningún cierre hoy.
          </div>
        ) : (
          <ul className="space-y-2">
            {(cierres.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-[12px] border-b border-border pb-2 last:border-0">
                <div>
                  <div className="font-medium">{c.leads?.nombre ?? c.numero_whatsapp}</div>
                  <div className="text-muted-foreground">
                    {c.canal.replace("_", " · ")} · {new Date(c.fecha_cierre).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="font-serif-display text-base">${Number(c.monto).toLocaleString("es-MX")}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .input { width: 100%; padding: 8px 10px; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--card)); font-size: 14px; color: hsl(var(--foreground)); outline: none; }
        .input:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </aside>
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
