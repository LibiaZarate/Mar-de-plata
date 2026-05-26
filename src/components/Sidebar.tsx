import { NavLink } from "react-router-dom";
import { useStore } from "../data/store";

export default function Sidebar() {
  const pipelineCount = useStore(
    (s) => s.leads.filter((l) => l.flags.some((f) => f === "urgente" || f === "objecion" || f === "comprobante")).length
  );

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 border-r border-ink/15 px-5 py-6 flex flex-col bg-cream-50">
      <div className="text-[10px] tracking-[0.22em] uppercase text-ink-mute font-medium mb-2">
        Azxion · Kaizen
      </div>
      <div className="font-serif-display text-3xl leading-none border border-ink/40 rounded-md px-3 py-2 mb-1.5">
        Mar de Plata
      </div>
      <div className="text-[11px] tracking-[0.18em] uppercase text-ink-mute mb-8">
        Taxco · Workspace
      </div>

      <nav className="flex flex-col gap-1">
        <SidebarItem to="/" label="Inicio" />
        <SidebarItem to="/pipeline" label="Pipeline" badge={pipelineCount} />
        <SidebarItem to="/equipo" label="Equipo" />
      </nav>

      <div className="mt-auto pt-6">
        <div className="border-t border-dashed border-ink/25 mb-4" />
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full border border-ink/30 flex items-center justify-center text-xs font-semibold bg-rosey-100">
            M
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">Mar</div>
            <div className="text-[11px] text-ink-mute">Dueña</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ to, label, badge }: { to: string; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "flex items-center justify-between px-3 py-2.5 rounded-md border text-sm font-medium transition-colors",
          isActive
            ? "bg-rosey-100 border-rosey-300 text-ink"
            : "border-transparent text-ink-soft hover:bg-cream-100 hover:border-ink/15",
        ].join(" ")
      }
    >
      <span className="flex items-center gap-2.5">
        <span className="w-3.5 h-3.5 rounded-full border border-ink/40" />
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-rosey-100 border border-rosey-300 text-ink-soft min-w-[22px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
