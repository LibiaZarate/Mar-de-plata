import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // No detenemos la app — todas las queries fallarán con un error legible.
  console.warn(
    "[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidos. " +
      "Copia .env.example a .env y reinicia el dev server."
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: false },
});

export const BUCKET_COMPROBANTES =
  (import.meta.env.VITE_SUPABASE_BUCKET_COMPROBANTES as string | undefined) ??
  "comprobantes";

export const TZ =
  (import.meta.env.VITE_TZ as string | undefined) ?? "America/Mexico_City";

// Inicio y fin del día actual en hora local de operación, en formato ISO.
export function dayBoundsMx(offsetDays = 0): { start: string; end: string } {
  const now = new Date();
  // Mover al UTC equivalente del día en CDMX.
  const local = new Date(
    now.toLocaleString("en-US", { timeZone: TZ })
  );
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + offsetDays);

  // Reconstruir el offset entre UTC y CDMX a partir de la diferencia.
  const tzOffsetMin = Math.round(
    (new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(now.toLocaleString("en-US", { timeZone: TZ })).getTime()) /
      60000
  );
  const start = new Date(local.getTime() + tzOffsetMin * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
