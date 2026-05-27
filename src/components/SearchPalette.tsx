import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buscarLeads } from "../lib/queries";
import type { Lead } from "../lib/types";

type Pagina = { type: "page"; label: string; path: string; hint: string };
type LeadHit = { type: "lead"; label: string; hint: string; lead: Lead };
type Result = Pagina | LeadHit;

const PAGES: Pagina[] = [
  { type: "page", label: "Inicio · vista general", path: "/", hint: "KPIs + embudo" },
  { type: "page", label: "Pipeline activo", path: "/pipeline", hint: "Kanban con drag & drop" },
  { type: "page", label: "Equipo · cierres del día", path: "/equipo", hint: "Registrar pago + asesoras" },
];

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setLeads([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      buscarLeads(term)
        .then((rs) => {
          if (!cancelled) setLeads(rs);
        })
        .catch(() => setLeads([]));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const results: Result[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = needle
      ? PAGES.filter((p) => p.label.toLowerCase().includes(needle) || p.hint.toLowerCase().includes(needle))
      : PAGES;
    const leadResults: LeadHit[] = leads.map((l) => ({
      type: "lead" as const,
      label: `${l.nombre ?? "Sin nombre"} · ${l.ciudad ?? "—"}`,
      hint: `${l.numero_whatsapp} · ${l.canal_origen ?? "—"} · ${l.estado ?? "—"}`,
      lead: l,
    }));
    return [...pages, ...leadResults];
  }, [leads, q]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/25 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="bg-cream-50 border border-ink/20 rounded-lg w-full max-w-[560px] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar lead por nombre o número, o saltar a una pantalla…"
          className="w-full px-5 py-4 bg-transparent outline-none text-base border-b border-ink/15"
        />
        <ul className="max-h-[360px] overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  if (r.type === "page") navigate(r.path);
                  else navigate("/pipeline");
                  onClose();
                }}
                className="w-full text-left px-5 py-3 hover:bg-cream-100 flex items-center justify-between border-b border-ink/5"
              >
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-[12px] text-ink-mute">{r.hint}</div>
                </div>
                <span className="label-xs">{r.type === "page" ? "ir a" : "lead"}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && q.trim().length >= 2 && (
            <li className="px-5 py-8 text-center text-ink-mute text-sm">Sin resultados</li>
          )}
          {results.length === 0 && q.trim().length < 2 && (
            <li className="px-5 py-8 text-center text-ink-mute text-sm">
              Escribe al menos 2 caracteres para buscar leads, o navega arriba.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
