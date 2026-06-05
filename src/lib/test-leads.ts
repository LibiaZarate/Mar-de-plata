// Identificación de leads de prueba (Libia + cualquier otro que el equipo
// quiera registrar). Un lead es "de prueba" si tiene la etiqueta 'test'.
// Su número se excluye de pipeline, KPIs, embudo, alertas y métricas.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

let cache: { numeros: Set<string>; expira: number } | null = null;
const TTL_MS = 60_000;

export async function obtenerNumerosTest(
  sb?: SupabaseClient,
): Promise<Set<string>> {
  if (cache && cache.expira > Date.now()) return cache.numeros;
  const client = sb ?? createAdminClient();
  const { data } = await client
    .from("leads")
    .select("numero_whatsapp,etiquetas")
    .contains("etiquetas", ["test"]);
  const numeros = new Set<string>(
    (data ?? []).map((r) => r.numero_whatsapp as string),
  );
  cache = { numeros, expira: Date.now() + TTL_MS };
  return numeros;
}

export function esTest<T extends { numero_whatsapp?: string | null }>(
  fila: T,
  numerosTest: Set<string>,
): boolean {
  const n = (fila.numero_whatsapp ?? "").trim();
  return !!n && numerosTest.has(n);
}

export function filtrarProduccion<T extends { numero_whatsapp?: string | null }>(
  filas: T[],
  numerosTest: Set<string>,
): T[] {
  return filas.filter((f) => !esTest(f, numerosTest));
}

export function invalidarCacheTest(): void {
  cache = null;
}
