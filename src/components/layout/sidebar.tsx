"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Columns3,
  Users,
  Settings2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", Icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", Icon: Columns3 },
  { href: "/equipo", label: "Equipo", Icon: Users },
  { href: "/configuracion", label: "Configuración", Icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[232px] shrink-0 h-screen sticky top-0 border-r border-border bg-card px-5 py-6 flex flex-col">
      <div className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-2">
        Azxion · Kaizen
      </div>
      <div className="font-serif-display text-3xl leading-none border border-foreground/40 rounded-md px-3 py-2 mb-1.5">
        Mar de Plata
      </div>
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-8">
        Taxco · Workspace
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-secondary hover:border-border",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className="border-t border-dashed border-border mb-4" />
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full border border-foreground/30 flex items-center justify-center text-xs font-semibold bg-primary/10">
            M
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">Mar</div>
            <div className="text-[11px] text-muted-foreground">Dueña</div>
          </div>
          <Circle className="ml-auto h-2 w-2 fill-green-500 text-green-500" />
        </div>
      </div>
    </aside>
  );
}
