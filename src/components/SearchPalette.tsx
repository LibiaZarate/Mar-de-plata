import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../data/store";

type Result =
  | { type: "page"; label: string; path: string; hint: string }
  | { type: "lead"; label: string; path: string; hint: string };

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const leads = useStore((s) => s.leads);

  const results: Result[] = useMemo(() => {
    const pages: Result[] = [
      { type: "page", label: "Vista general", path: "/", hint: "Inicio · hoy" },
      { type: "page", label: "Resumen del día", path: "/resumen", hint: "Inicio" },
      { type: "page", label: "KPIs y tendencias", path: "/kpis", hint: "Pulso del negocio" },
      { type: "page", label: "Pipeline activo", path: "/pipeline", hint: "Kanban" },
      { type: "page", label: "Embudo", path: "/pipeline/embudo", hint: "Trazabilidad" },
      { type: "page", label: "Equipo", path: "/equipo", hint: "Eli · Nat · Jess" },
    ];
    const leadResults: Result[] = leads.map((l) => ({
      type: "lead" as const,
      label: l.name + " · " + l.city,
      path: "/pipeline",
      hint: l.product,
    }));
    const all = [...pages, ...leadResults];
    if (!q.trim()) return all.slice(0, 8);
    const needle = q.toLowerCase();
    return all
      .filter((r) => r.label.toLowerCase().includes(needle) || r.hint.toLowerCase().includes(needle))
      .slice(0, 10);
  }, [q, leads]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          placeholder="Buscar lead, asesora, página…"
          className="w-full px-5 py-4 bg-transparent outline-none text-base border-b border-ink/15"
        />
        <ul className="max-h-[360px] overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  navigate(r.path);
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
          {results.length === 0 && (
            <li className="px-5 py-8 text-center text-ink-mute text-sm">Sin resultados</li>
          )}
        </ul>
      </div>
    </div>
  );
}
