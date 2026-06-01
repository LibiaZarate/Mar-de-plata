// Orquestador completo del flujo madre · CLAUDE.md §10.
// Webhook → guardrails → buffer (omitido en fase actual, ver nota) →
// log entrante → lives → contexto → enriquecer → Verificador → eventos →
// Agente → tools → parse loop → enviar → log saliente → +turnos.

import { createAdminClient } from "@/lib/supabase/admin";
import type { CleanedPayload } from "./clean";
import { checkGuardrails } from "./guardrails";
import {
  executeHandoffGuardrail,
  planHandoffGuardrail,
  type HandoffGuardrailPlan,
} from "./handoff-guardrail";
import { findOrCreateLead } from "./lead";
import {
  consultarLiveActivo,
  obtenerContextoLead,
  enrichMetadata,
  yaPagoDeposito,
  type EnrichedMetadata,
} from "./context";
import { runVerificador, type VerificadorOutput } from "@/lib/agent/verificador";
import { runAgenteMadre } from "@/lib/agent/agente";
import { parseLoop } from "@/lib/agent/parse-loop";
import {
  enviarImagenFaq,
  enviarCatalogo,
  invitarGrupo,
  handoffAsesora,
  programarSeguimiento,
  type ToolResult,
} from "@/lib/agent/tools";
import { sendToClient } from "@/lib/agent/manychat";

export type FlowResult = {
  ok: boolean;
  demo: boolean;
  earlyExit: null | { reason: "guardrail"; plan: HandoffGuardrailPlan };
  leadCreated: boolean;
  metadata: EnrichedMetadata;
  contexto: Record<string, unknown>;
  verificador: VerificadorOutput;
  toolResult: ToolResult | null;
  agenteTexto: string;
  fragmentos: string[];
  deliveryNotes: string[];
  durationMs: number;
};

export async function runFlowMadre(input: {
  cleaned: CleanedPayload;
  kaizenSessionId?: string | null;
  source: "manychat" | "kaizen";
}): Promise<FlowResult> {
  const start = Date.now();
  const supabase = createAdminClient();
  const numero = input.cleaned.whatsappPhone ?? input.cleaned.sessionId;

  // ── Paso 4: lookup + INSERT lead ─────────────────────────
  const { lead, created } = await findOrCreateLead(input.cleaned);

  // ── Paso 6: guardrails ──────────────────────────────────
  const match = checkGuardrails(input.cleaned.userText);
  if (match) {
    const plan = planHandoffGuardrail(input.cleaned, match);
    await executeHandoffGuardrail(plan);

    // Cablear los pending-fase-4 del sub-workflow (CLAUDE.md §12)
    await runHandoffGuardrailSteps({
      numero,
      mensajeOriginal: input.cleaned.userText,
      motivo: plan.payload.motivo,
      subscriberId: input.cleaned.subscriberId,
      kaizenSessionId: input.kaizenSessionId ?? null,
    });

    return {
      ok: true,
      demo: false,
      earlyExit: { reason: "guardrail", plan },
      leadCreated: created,
      metadata: enrichMetadata(await consultarLiveActivo()),
      contexto: {},
      verificador: {} as VerificadorOutput,
      toolResult: null,
      agenteTexto: "",
      fragmentos: [],
      deliveryNotes: [`guardrail ${plan.match.category}:${plan.match.keyword}`],
      durationMs: Date.now() - start,
    };
  }

  // ── Paso 7: buffer Redis ────────────────────────────────
  // NOTA: el buffer de 5s con Redis requiere REDIS_URL. Si no está,
  // procesamos cada mensaje individualmente. ManyChat ya combina
  // mensajes cercanos antes de mandar el webhook en muchos casos.

  // ── Paso 8: log conversación entrante ───────────────────
  await supabase.from("conversaciones").insert({
    numero_whatsapp: numero,
    direccion: "entrante",
    texto: input.cleaned.userText,
    tipo_mensaje: input.cleaned.tipoMensajeOriginal,
  });

  // ── Pasos 9 + 10 + 11: live + contexto + enrich ─────────
  const live = await consultarLiveActivo();
  let contexto: Record<string, unknown> = {};
  try {
    contexto = await obtenerContextoLead(numero);
  } catch {
    // Si la RPC no está disponible, armamos un contexto mínimo desde el lead
    contexto = {
      lead,
      estado_actual: null,
      ultimos_mensajes: [],
      eventos_recientes: [],
      seguimientos_pendientes: [],
    };
  }
  const metadata = enrichMetadata(live);
  const pagoDeposito = await yaPagoDeposito(numero);

  // ── Paso 12 + 13: Verificador ────────────────────────────
  const verificador = await runVerificador({
    contextoLead: contexto,
    mensajeActual: input.cleaned.userText,
    metadata,
  });

  // ── Paso 14: log eventos_negocio ────────────────────────
  if (
    verificador.eventos_detectados &&
    verificador.eventos_detectados.length > 0
  ) {
    await supabase.from("eventos_negocio").insert(
      verificador.eventos_detectados.map((ev) => ({
        numero_whatsapp: numero,
        tipo_evento: ev.tipo,
        detalle: ev.detalle,
      })),
    );
  }

  // ── Paso 15: Agente Madre ───────────────────────────────
  const agente = await runAgenteMadre({
    verificador,
    mensajeActual: input.cleaned.userText,
    contextoLead: contexto,
    metadata,
    yaPagoDeposito: pagoDeposito,
  });

  // ── Ejecutar la tool sugerida (si aplica) ───────────────
  const toolResult = await executeTool({
    verificador,
    numero,
    subscriberId: input.cleaned.subscriberId,
    kaizenSessionId: input.kaizenSessionId ?? null,
  });

  // ── Paso 16: parse loop sobre el texto del Agente ───────
  const fragmentos = parseLoop(agente.texto);

  // ── Paso 17: enviar a WhatsApp / Kaizen ─────────────────
  const deliveryNotes: string[] = [];
  // Si la tool ya envió contenido (catálogo, FAQ, grupo, handoff),
  // mandamos solo el seguimiento de Sirena (si quedó texto extra).
  const toolYaEnvio =
    toolResult && toolResult.outboundMessages.length > 0 && toolResult.ok;
  if (!toolYaEnvio) {
    for (const fragmento of fragmentos) {
      const result = await sendToClient({
        subscriberId: input.cleaned.subscriberId,
        kaizenSessionId: input.kaizenSessionId ?? null,
        messages: [{ type: "text", text: fragmento }],
      });
      deliveryNotes.push(`${result.via}${result.status ? " " + result.status : ""}`);
      await delay(2500);
    }
  }

  // ── Paso 18: log conversación saliente ──────────────────
  if (agente.texto) {
    await supabase.from("conversaciones").insert({
      numero_whatsapp: numero,
      direccion: "saliente",
      texto: agente.texto,
      tipo_mensaje: "texto",
      intencion_detectada: verificador.intencion_primaria,
      confianza: verificador.confianza,
      rama_activada: verificador.rama_sugerida,
    });
  }

  // ── Paso 19: +turnos ────────────────────────────────────
  const { data: estado } = await supabase
    .from("estado_conversacion_actual")
    .select("turnos_acumulados")
    .eq("numero_whatsapp", numero)
    .maybeSingle();
  await supabase
    .from("estado_conversacion_actual")
    .update({
      turnos_acumulados: ((estado?.turnos_acumulados as number) ?? 0) + 1,
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", numero);

  return {
    ok: true,
    demo: !!verificador._demo || !!agente._demo,
    earlyExit: null,
    leadCreated: created,
    metadata,
    contexto,
    verificador,
    toolResult,
    agenteTexto: agente.texto,
    fragmentos,
    deliveryNotes,
    durationMs: Date.now() - start,
  };
}

async function executeTool(input: {
  verificador: VerificadorOutput;
  numero: string;
  subscriberId: string | null;
  kaizenSessionId: string | null;
}): Promise<ToolResult | null> {
  const v = input.verificador;
  const tool = v.accion_recomendada.tool_principal;
  const p = v.accion_recomendada.parametros as Record<string, unknown>;
  const common = {
    numero_whatsapp: input.numero,
    subscriber_id: input.subscriberId,
    kaizen_session_id: input.kaizenSessionId,
  };

  // Override: si requiere_handoff = true, forzamos handoff_asesora.
  if (v.alertas.requiere_handoff) {
    return handoffAsesora({
      ...common,
      motivo: (p.motivo as string) ?? "solicitud_explicita",
      prioridad: (p.prioridad as "normal" | "alta" | "urgente") ?? "urgente",
      contexto_breve: (p.contexto_breve as string) ?? v.razonamiento_breve,
    });
  }

  try {
    switch (tool) {
      case "enviar_imagen_faq":
        return await enviarImagenFaq({
          ...common,
          id_imagen: Number(p.id_imagen ?? 0),
          texto_acompanante: String(p.texto_acompanante ?? ""),
        });
      case "enviar_catalogo":
        return await enviarCatalogo({
          ...common,
          coleccion: (p.coleccion as "pandora" | "taxco" | "tows") ?? "pandora",
          texto_acompanante: String(p.texto_acompanante ?? ""),
        });
      case "invitar_grupo":
        return await invitarGrupo({
          ...common,
          texto_acompanante: String(p.texto_acompanante ?? ""),
        });
      case "handoff_asesora":
        return await handoffAsesora({
          ...common,
          motivo: (p.motivo as string) ?? "solicitud_explicita",
          prioridad:
            (p.prioridad as "normal" | "alta" | "urgente") ?? "normal",
          contexto_breve: (p.contexto_breve as string) ?? null,
        });
      case "programar_seguimiento":
        return await programarSeguimiento({
          numero_whatsapp: input.numero,
          tipo: (p.tipo as string) ?? "reactivacion_fria",
          dias_offset: Number(p.dias_offset ?? 7),
          contexto_adicional: (p.contexto_adicional as string) ?? undefined,
        });
      case "responder_texto_simple":
      default:
        return null;
    }
  } catch (e) {
    return {
      tool: tool as ToolResult["tool"],
      ok: false,
      outboundMessages: [],
      notes: [`tool falló: ${(e as Error).message}`],
    };
  }
}

async function runHandoffGuardrailSteps(args: {
  numero: string;
  mensajeOriginal: string;
  motivo: string;
  subscriberId: string | null;
  kaizenSessionId: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  // Mensaje puente
  await sendToClient({
    subscriberId: args.subscriberId,
    kaizenSessionId: args.kaizenSessionId,
    messages: [{ type: "text", text: "Entiendo · te paso con una asesora real ahora mismo 💗" }],
  });

  // Round-robin
  const { data } = await supabase
    .from("asesoras")
    .select("id,nombre_completo,en_onboarding,conversaciones_abiertas,ultima_asignacion")
    .eq("activa", true)
    .order("en_onboarding", { ascending: false })
    .order("conversaciones_abiertas", { ascending: true })
    .order("ultima_asignacion", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (!data) return;

  const asesoraId = data.id as string;
  const asesoraNombre = data.nombre_completo as string;

  // UPDATE leads
  await supabase
    .from("leads")
    .update({ asesora_asignada: asesoraId, fecha_asignacion: new Date().toISOString() })
    .eq("numero_whatsapp", args.numero);

  // UPDATE estado_conversacion_actual
  await supabase
    .from("estado_conversacion_actual")
    .update({
      requiere_handoff: true,
      prioridad_handoff: "urgente",
      rama_activa: "handoff",
      paso_actual: "guardrail_critico_disparado",
      ultimo_tool_ejecutado: "handoff_directo_guardrail",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero);

  // UPDATE asesoras carga +1
  const { data: cargaRow } = await supabase
    .from("asesoras")
    .select("conversaciones_abiertas,conversaciones_dia")
    .eq("id", asesoraId)
    .maybeSingle();
  await supabase
    .from("asesoras")
    .update({
      conversaciones_abiertas: (cargaRow?.conversaciones_abiertas ?? 0) + 1,
      conversaciones_dia: (cargaRow?.conversaciones_dia ?? 0) + 1,
      ultima_asignacion: new Date().toISOString(),
    })
    .eq("id", asesoraId);

  // INSERT alertas
  await supabase.from("alertas").insert({
    tipo: "guardrail_critico",
    prioridad: "urgente",
    titulo: `Guardrail crítico · ${args.motivo}`,
    descripcion: `Mensaje original: ${args.mensajeOriginal || "(sin mensaje capturado)"}`,
    numero_whatsapp: args.numero,
    asesora_asignada_id: asesoraId,
    para_mar: true,
    contexto_json: {
      motivo: args.motivo,
      mensaje_original: args.mensajeOriginal,
      origen: "guardrail_directo",
      asesora_nombre: asesoraNombre,
    },
  });

  // INSERT eventos_negocio
  await supabase.from("eventos_negocio").insert({
    numero_whatsapp: args.numero,
    tipo_evento: "pregunta_no_clasificada",
    detalle: `GUARDRAIL CRÍTICO disparado · motivo: ${args.motivo} · mensaje original: ${args.mensajeOriginal}`,
  });

  // INSERT conversaciones
  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero,
    direccion: "saliente",
    texto: "Entiendo · te paso con una asesora real ahora mismo 💗",
    tipo_mensaje: "texto",
    tool_ejecutada: "handoff_directo_guardrail",
    status: "handoff_iniciado",
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
