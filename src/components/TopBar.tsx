import { useLastRefresh } from "../lib/refresh";
import { useRelativeTime } from "../lib/time";

export default function TopBar({
  crumbs,
  onSearch,
  onRegister,
}: {
  crumbs: string[];
  onSearch: () => void;
  onRegister: () => void;
}) {
  const last = useLastRefresh();
  const rel = useRelativeTime(last);

  return (
    <div className="flex items-start justify-between mb-6">
      <div className="text-[11px] tracking-[0.22em] uppercase text-ink-mute font-medium">
        {crumbs.join(" · ")}
      </div>
      <div className="flex items-center gap-3 relative">
        <RefreshDot last={last} />
        <span className="text-[11px] text-ink-mute hidden sm:inline">
          {last ? `actualizado ${rel}` : "cargando…"}
        </span>
        <Sparkle />
        <button onClick={onSearch} className="btn">
          <span className="font-mono text-[11px] tracking-tight">⌘K</span>
          <span>Buscar</span>
        </button>
        <button onClick={onRegister} className="btn-primary">
          Registrar cierre
        </button>
        <div className="relative">
          <div className="w-9 h-9 rounded-full border border-ink/30 flex items-center justify-center bg-cream-50">
            <div className="w-5 h-5 rounded-full bg-rosey-200" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rosey-400 border border-cream-50" />
        </div>
      </div>
    </div>
  );
}

function RefreshDot({ last }: { last: number | null }) {
  const fresh = last != null && Date.now() - last < 45_000;
  return (
    <span
      className={
        "w-2 h-2 rounded-full " + (fresh ? "bg-sage-300 animate-pulse" : "bg-ink-mute/40")
      }
      title="indicador de actualización"
    />
  );
}

function Sparkle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-rosey-300">
      <path
        d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
