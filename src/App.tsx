import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Inicio from "./pages/Inicio";
import Resumen from "./pages/Resumen";
import Kpis from "./pages/Kpis";
import Pipeline from "./pages/Pipeline";
import Embudo from "./pages/Embudo";
import Equipo from "./pages/Equipo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="/resumen" element={<Resumen />} />
          <Route path="/kpis" element={<Kpis />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/pipeline/embudo" element={<Embudo />} />
          <Route path="/equipo" element={<Equipo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
