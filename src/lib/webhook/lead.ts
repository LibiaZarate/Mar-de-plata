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

  const { data: inserted, error: insErr } = await supabase
    .from("leads")
    .insert({
      numero_whatsapp: numero,
      estado: "lead_nueva",
      canal_origen: cleaned.canalOrigen,
      anuncio_id: cleaned.anuncioId,
      primer_contacto: new Date().toISOString(),
      ticket_promedio: 0,
      compras_totales: 0,
      monto_acumulado: 0,
      reclamos_historicos: 0,
    })
    .select("*")
    .single();

  if (insErr) {
    throw new Error(`leads INSERT falló: ${insErr.message}`);
  }
  return { lead: inserted as Lead, created: true };
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
