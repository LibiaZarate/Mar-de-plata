"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/equipo", label: "Equipo" },
  { href: "/configuracion/lives", label: "Lives" },
  { href: "/configuracion/playground", label: "Playground" },
  { href: "/configuracion", label: "Configuración" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[232px] shrink-0 h-screen sticky top-0 px-5 py-6 flex flex-col bg-cream-100">
      <div className="text-[10px] tracking-[0.22em] uppercase text-foreground/60 font-medium mb-2">
        Azxion · Kaizen
      </div>

      <div className="font-serif-display text-[28px] leading-none border border-foreground/40 rounded-md px-3 py-2 mb-1.5 whitespace-nowrap">
        Mar de Plata
      </div>
      <div className="text-[11px] tracking-[0.18em] uppercase text-foreground/55 mb-8">
        Taxco · Workspace
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-md border text-[15px] font-medium transition-colors",
                active
                  ? "bg-rosey-100 border-rosey-300 text-foreground"
                  : "border-transparent text-foreground/65 hover:bg-cream-50 hover:border-foreground/15",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className={cn(
                  "w-3.5 h-3.5 rounded-full border",
                  active ? "border-foreground/55 bg-cream-50" : "border-foreground/40",
                )} />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className="border-t border-dashed border-foreground/25 mb-4" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border border-foreground/40 flex items-center justify-center text-[13px] font-semibold bg-rosey-100">
            M
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">Mar</div>
            <div className="text-[11px] text-foreground/55">Dueña</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Lives y Playground tienen rutas /configuracion/lives y /configuracion/playground
  // Configuración es /configuracion (no debe matchear sub-rutas que tengan su propia entrada)
  if (href === "/configuracion") {
    return (
      pathname.startsWith("/configuracion") &&
      pathname !== "/configuracion/lives" &&
      pathname !== "/configuracion/playground"
    );
  }
  return pathname === href || pathname.startsWith(href + "/");
}
