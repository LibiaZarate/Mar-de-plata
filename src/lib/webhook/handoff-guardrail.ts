// Sub-workflow handoff_directo_guardrail — ver CLAUDE.md §12.
//
// Fase 3: solo planifica el handoff y deja `pendingActions` visibles.
// Las acciones reales (POST a ManyChat, INSERTs en alertas/eventos/
// conversaciones, round-robin de asesora) se cablean en fases siguientes
// porque dependen del lookup de lead (Fase 4) y de la conexión a
// ManyChat (Fase 7+).

import type { CleanedPayload } from "./clean";
import type { GuardrailMatch } from "./guardrails";

export type HandoffStep = {
  id: string;
  description: string;
  status: "stub" | "pending-fase-4" | "pending-fase-7";
};

export type HandoffGuardrailPlan = {
  trigger: "guardrail_critico";
  match: GuardrailMatch;
  payload: {
    numero_whatsapp: string;
    motivo: string;
    prioridad: "urgente";
    mensaje_original: string;
    subscriber_id: string | null;
  };
  steps: HandoffStep[];
};

export function planHandoffGuardrail(
  cleaned: CleanedPayload,
  match: GuardrailMatch,
): HandoffGuardrailPlan {
  return {
    trigger: "guardrail_critico",
    match,
    payload: {
      numero_whatsapp: cleaned.whatsappPhone ?? cleaned.sessionId,
      motivo: match.motivo,
      prioridad: "urgente",
      mensaje_original: cleaned.userText,
      subscriber_id: cleaned.subscriberId,
    },
    steps: [
      {
        id: "mensaje_puente",
        description:
          "POST a ManyChat con texto puente: \"Entiendo · te paso con una asesora real ahora mismo 💗\"",
        status: "pending-fase-7",
      },
      {
        id: "round_robin",
        description:
          "Round-robin sobre asesoras activas (orden: en_onboarding=true primero, conversaciones_abiertas ASC, ultima_asignacion ASC NULLS FIRST)",
        status: "pending-fase-4",
      },
      {
        id: "update_lead",
        description: "UPDATE leads SET asesora_asignada, fecha_asignacion",
        status: "pending-fase-4",
      },
      {
        id: "update_estado",
        description:
          "UPDATE estado_conversacion_actual SET requiere_handoff=true, prioridad_handoff='urgente', rama_activa='handoff', paso_actual='guardrail_critico_disparado'",
        status: "pending-fase-4",
      },
      {
        id: "update_asesora_carga",
        description:
          "UPDATE asesoras SET conversaciones_abiertas+1, conversaciones_dia+1, ultima_asignacion=NOW()",
        status: "pending-fase-4",
      },
      {
        id: "insert_alerta",
        description:
          "INSERT alertas (tipo='guardrail_critico', prioridad='urgente', para_mar=TRUE, contexto_json con motivo + mensaje_original)",
        status: "pending-fase-4",
      },
      {
        id: "insert_evento",
        description:
          "INSERT eventos_negocio (tipo_evento='pregunta_no_clasificada', detalle con motivo + mensaje_original)",
        status: "pending-fase-4",
      },
      {
        id: "insert_conversacion",
        description:
          "INSERT conversaciones (direccion='saliente', tool_ejecutada='handoff_directo_guardrail', status='handoff_iniciado')",
        status: "pending-fase-4",
      },
    ],
  };
}

// Punto de entrada para ejecutar el handoff. En Fase 3 solo registra
// en logs del servidor; en Fase 4+ ejecutará los steps reales contra
// Supabase y ManyChat.
export async function executeHandoffGuardrail(
  plan: HandoffGuardrailPlan,
): Promise<void> {
  console.warn(
    `[guardrail_critico] ${plan.match.category} · "${plan.match.keyword}" · ` +
      `${plan.payload.numero_whatsapp} · motivo=${plan.payload.motivo}`,
  );
  // TODO Fase 4: ejecutar steps con status 'pending-fase-4'
  // TODO Fase 7: ejecutar steps con status 'pending-fase-7'
}
