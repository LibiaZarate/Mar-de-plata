// Lookup + INSERT de lead — CLAUDE.md §10 paso 4.
// El trigger `crear_estado_conversacion` se encarga de la fila en
// `estado_conversacion_actual` automáticamente.

import { createAdminClient } from "@/lib/supabase/admin";
import type { CleanedPayload } from "@/lib/webhook/clean";
import type { Lead } from "@/lib/types";

export type LeadLookupResult = {
  lead: Lead;
  created: boolean;
};

// La tabla `leads` tiene un CHECK constraint en canal_origen.
// Los valores permitidos son los que usa el dashboard: Meta, TikTok,
// Grupo, Recurrente, Orgánico. Cualquier otro valor (ej. "playground",
// "meta_ctwa") debe normalizarse antes de insertar.
const CANALES_VALIDOS = new Set([
  "Meta",
  "TikTok",
  "Grupo",
  "Recurrente",
  "Orgánico",
]);

function normalizarCanal(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (CANALES_VALIDOS.has(trimmed)) return trimmed;
  // Mapeos comunes de ManyChat / Meta
  const lower = trimmed.toLowerCase();
  if (lower.includes("meta") || lower.includes("ctwa") || lower.includes("facebook"))
    return "Meta";
  if (lower.includes("tiktok") || lower.includes("tt")) return "TikTok";
  if (lower.includes("grupo") || lower.includes("group")) return "Grupo";
  if (lower.includes("recur")) return "Recurrente";
  if (lower.includes("organic") || lower.includes("orgánic")) return "Orgánico";
  // Para test/playground/desconocido → null. La columna acepta NULL.
  return null;
}

export async function findOrCreateLead(
  cleaned: CleanedPayload,
): Promise<LeadLookupResult> {
  const supabase = createAdminClient();
  const numero = cleaned.whatsappPhone ?? cleaned.sessionId;

  const { data: existing, error: findErr } = await supabase
    .from("leads")
    .select("*")
    .eq("numero_whatsapp", numero)
    .maybeSingle();

  if (findErr && findErr.code !== "PGRST116") {
    throw new Error(`leads SELECT falló: ${findErr.message}`);
  }
  if (existing) {
    return { lead: existing as Lead, created: false };
  }

  const baseInsert = {
    numero_whatsapp: numero,
    estado: "lead_nueva",
    canal_origen: normalizarCanal(cleaned.canalOrigen),
    anuncio_id: cleaned.anuncioId,
    primer_contacto: new Date().toISOString(),
    ticket_promedio: 0,
    compras_totales: 0,
    monto_acumulado: 0,
    reclamos_historicos: 0,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("leads")
    .insert(baseInsert)
    .select("*")
    .single();

  if (!insErr) {
    return { lead: inserted as Lead, created: true };
  }

  // Si falló por un constraint, reintentamos con valores mínimos.
  // (Por ejemplo si canal_origen tiene una whitelist diferente a la
  // que conocemos.)
  if (insErr.code === "23514" || /check constraint/i.test(insErr.message)) {
    const { data: retry, error: retryErr } = await supabase
      .from("leads")
      .insert({
        numero_whatsapp: numero,
        estado: "lead_nueva",
        primer_contacto: new Date().toISOString(),
        ticket_promedio: 0,
        compras_totales: 0,
        monto_acumulado: 0,
        reclamos_historicos: 0,
      })
      .select("*")
      .single();
    if (retryErr) {
      throw new Error(`leads INSERT falló (retry sin canal): ${retryErr.message}`);
    }
    return { lead: retry as Lead, created: true };
  }

  throw new Error(`leads INSERT falló: ${insErr.message}`);
}

// Round-robin de asesora disponible · CLAUDE.md §11 tool 4 / §12 paso 2.
export async function pickAsesoraRoundRobin(): Promise<{
  id: string;
  nombre_completo: string;
  whatsapp_personal: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("asesoras")
    .select("id,nombre_completo,whatsapp_personal,en_onboarding,conversaciones_abiertas,ultima_asignacion")
    .eq("activa", true)
    .order("en_onboarding", { ascending: false })
    .order("conversaciones_abiertas", { ascending: true })
    .order("ultima_asignacion", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`asesoras round-robin falló: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id as string,
    nombre_completo: data.nombre_completo as string,
    whatsapp_personal: (data.whatsapp_personal as string | null) ?? null,
  };
}
