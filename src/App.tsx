import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Inicio from "./pages/Inicio";
import Pipeline from "./pages/Pipeline";
import Equipo from "./pages/Equipo";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
