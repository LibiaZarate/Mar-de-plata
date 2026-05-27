import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { SWRConfig } from "swr";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import SearchPalette from "./SearchPalette";

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        navigate("/equipo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const breadcrumb = (() => {
    if (location.pathname.startsWith("/pipeline")) return ["Inicio", "Pipeline"];
    if (location.pathname.startsWith("/equipo")) return ["Inicio", "Equipo"];
    return ["Inicio", "Vista general"];
  })();

  return (
    <SWRConfig value={{ revalidateOnFocus: true, dedupingInterval: 4000 }}>
      <div className="flex bg-cream-100 min-h-screen text-ink">
        <Sidebar />
        <main className="flex-1 min-w-0 px-10 py-6">
          <TopBar
            crumbs={breadcrumb}
            onSearch={() => setSearchOpen(true)}
            onRegister={() => navigate("/equipo")}
          />
          <Outlet />
        </main>
        {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      </div>
    </SWRConfig>
  );
}
