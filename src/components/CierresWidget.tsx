import { useEffect, useRef, useState } from "react";
import {
  buscarLeads,
  useAsesoras,
  useCierresRecientes,
} from "../lib/queries";
import { registrarCierre, uploadComprobante } from "../lib/actions";
import type { Cierre, Lead } from "../lib/types";

const CANAL_OPTIONS: { value: Cierre["canal"]; label: string }[] = [
  { value: "mayoreo_catalogo", label: "Mayoreo · catálogo" },
  { value: "mayoreo_grupo", label: "Mayoreo · grupo" },
  { value: "menudeo", label: "Menudeo" },
  { value: "live", label: "Live" },
  { value: "presencial", label: "Presencial" },
];

export default function CierresWidget() {
  const { data: asesoras } = useAsesoras();
  const cierres = useCierresRecientes(5);

  const [lead, setLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [monto, setMonto] = useState<string>("");
  const [canal, setCanal] = useState<Cierre["canal"]>("mayoreo_catalogo");
  const [notas, setNotas] = useState("");
  const [asesoraId, setAsesoraId] = useState<string>("");
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
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      buscarLeads(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
  }, [query, lead]);

  function pickLead(l: Lead) {
    setLead(l);
    setQuery(`${l.nombre ?? l.numero_whatsapp} · ${l.numero_whatsapp}`);
    setResults([]);
  }

  function reset() {
    setLead(null);
    setQuery("");
    setMonto("");
    setNotas("");
    setFile(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!lead) return setError("Elige un cliente del buscador.");
    if (!asesoraId) return setError("Elige una asesora.");
    const m = Number(monto);
    if (!m || m <= 0) return setError("Monto inválido.");

    setSubmitting(true);
    try {
      let comprobante_url: string | undefined;
      if (file) {
        comprobante_url = await uploadComprobante(file, lead.numero_whatsapp);
      }
      await registrarCierre({
        numero_whatsapp: lead.numero_whatsapp,
        asesora_id: asesoraId,
        monto: m,
        canal,
        notas: notas || undefined,
        comprobante_url,
      });
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="rounded-md border border-rosey-300 bg-cream-50 p-5 flex flex-col gap-4 h-fit sticky top-6">
      <div>
        <div className="label-xs">Widget operativo</div>
        <h2 className="font-serif-display text-3xl leading-tight">Cierres del día</h2>
        <p className="text-[12px] text-ink-mute mt-1">
          Cuando llegue el comprobante, regístralo aquí. Marca el lead como pagado y suma a la facturación al instante.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Cliente">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => {
                setLead(null);
                setQuery(e.target.value);
              }}
              placeholder="Buscar por nombre o número…"
              className="input"
            />
            {!lead && results.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-cream-50 border border-ink/20 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.numero_whatsapp}>
                    <button
                      onClick={() => pickLead(r)}
                      className="w-full text-left px-3 py-2 hover:bg-cream-100 border-b border-ink/5 last:border-0"
                    >
                      <div className="text-sm font-medium">
                        {r.nombre ?? "Sin nombre"}{" "}
                        <span className="text-ink-mute font-normal">· {r.ciudad ?? "—"}</span>
                      </div>
                      <div className="text-[11px] text-ink-mute font-mono">{r.numero_whatsapp}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-mute">
                buscando…
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute text-sm">$</span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="1500"
                className="input pl-6 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-mute">MXN</span>
            </div>
          </Field>
          <Field label="Canal">
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as Cierre["canal"])}
              className="input"
            >
              {CANAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Asesora que cierra">
          <select
            value={asesoraId}
            onChange={(e) => setAsesoraId(e.target.value)}
            className="input"
          >
            {(asesoras ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre_completo}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas (opcional)">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. tarjeta · 2 piezas pandora"
            rows={2}
            className="input resize-none"
          />
        </Field>

        <Field label="Comprobante (opcional)">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={
              "block border-2 border-dashed rounded-md px-3 py-3 text-center text-[12px] cursor-pointer transition-colors " +
              (dragOver
                ? "border-rosey-300 bg-rosey-50/40 text-rosey-400"
                : "border-ink/20 text-ink-mute hover:bg-cream-100")
            }
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="text-ink">{file.name}</span>
            ) : (
              <>
                <span className="block">Arrastra o haz clic para subir</span>
                <span className="block text-[10px] text-ink-mute mt-0.5">imagen o PDF</span>
              </>
            )}
          </label>
        </Field>
      </div>

      {error && (
        <div className="text-[12px] text-rosey-400 border border-rosey-300 bg-rosey-50/40 rounded px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2.5 rounded-md bg-sage-300 hover:bg-sage-200 text-cream-50 font-medium transition-colors disabled:opacity-50"
      >
        {submitting ? "Guardando…" : "Registrar cierre"}
      </button>

      <div className="pt-3 border-t border-ink/10">
        <div className="label-xs mb-2">Últimos cierres de hoy</div>
        {cierres.isLoading ? (
          <div className="text-[12px] text-ink-mute italic">Cargando…</div>
        ) : (cierres.data ?? []).length === 0 ? (
          <div className="text-[12px] text-ink-mute italic">
            Aún no se registra ningún cierre hoy.
          </div>
        ) : (
          <ul className="space-y-2">
            {(cierres.data ?? []).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-[12px] border-b border-ink/5 pb-2 last:border-0"
              >
                <div>
                  <div className="font-medium">
                    {c.lead?.nombre ?? c.numero_whatsapp}
                  </div>
                  <div className="text-ink-mute">
                    {c.canal.replace("_", " · ")} ·{" "}
                    {new Date(c.fecha_cierre).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="font-serif-display text-base">
                  ${Number(c.monto).toLocaleString("es-MX")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid rgba(43,38,32,0.25);
          border-radius: 6px;
          background: #FBF7F0;
          font-size: 14px;
          color: #2B2620;
          outline: none;
        }
        .input:focus { border-color: #C97A8B; }
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
