import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import RegisterOrderModal from "./RegisterOrderModal";
import SearchPalette from "./SearchPalette";

export default function Layout() {
  const [orderOpen, setOrderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOrderOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const breadcrumb = (() => {
    if (location.pathname.startsWith("/pipeline/embudo")) return ["Inicio", "Pipeline", "Embudo"];
    if (location.pathname.startsWith("/pipeline")) return ["Inicio", "Pipeline"];
    if (location.pathname.startsWith("/equipo")) return ["Inicio", "Equipo"];
    if (location.pathname.startsWith("/kpis")) return ["Inicio", "KPIs y tendencias"];
    if (location.pathname.startsWith("/resumen")) return ["Inicio", "Resumen del día"];
    return ["Inicio", "Vista general"];
  })();

  return (
    <div className="flex bg-cream-100 min-h-screen text-ink">
      <Sidebar />
      <main className="flex-1 min-w-0 px-10 py-6">
        <TopBar
          crumbs={breadcrumb}
          onSearch={() => setSearchOpen(true)}
          onRegister={() => setOrderOpen(true)}
        />
        <Outlet />
      </main>
      {orderOpen && <RegisterOrderModal onClose={() => setOrderOpen(false)} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
