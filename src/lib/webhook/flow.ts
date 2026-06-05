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
import { findOrCreateLead, persistirSubscriberId } from "./lead";
import {
  consultarLiveActivo,
  resolveSirenaUrls,
  detectarOfertaAsesoraReciente,
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
  enviarSitioMenudeo,
  agendarVisitaTaxco,
  programarSeguimiento,
  type ToolResult,
} from "@/lib/agent/tools";
import { sendToClient } from "@/lib/agent/manychat";
import { defaultMode, type FlowMode } from "@/lib/agent/mode";

export type FlowResult = {
  ok: boolean;
  mode: FlowMode;
  demo: boolean;
  earlyExit: null | { reason: "guardrail"; plan: HandoffGuardrailPlan };
  leadCreated: boolean;
  metadata: EnrichedMetadata;
  contexto: Record<string, unknown>;
  verificador: VerificadorOutput;
  toolResult: ToolResult | null;
  agenteTexto: string;
  fragmentos: string[];
  /** Mensajes que se enviarían/enviaron al cliente. En simulator captura todo. */
  outbound: Array<{
    source: "tool" | "agente";
    type: "text" | "image";
    text?: string;
    url?: string;
  }>;
  deliveryNotes: string[];
  durationMs: number;
};

export async function runFlowMadre(input: {
  cleaned: CleanedPayload;
  kaizenSessionId?: string | null;
  source: "manychat" | "kaizen";
  /** Forzar modo, si no se especifica usa defaultMode() (env var) */
  mode?: FlowMode;
  /** Etiquetas extras a agregar al lead (ej. "playground" desde el simulador) */
  leadEtiquetas?: string[];
}): Promise<FlowResult> {
  const mode: FlowMode = input.mode ?? defaultMode();
  const start = Date.now();
  const supabase = createAdminClient();
  const numero = input.cleaned.whatsappPhone ?? input.cleaned.sessionId;

  // ── Paso 4: lookup + INSERT lead ─────────────────────────
  const { lead, created } = await findOrCreateLead(input.cleaned, {
    etiquetas: input.leadEtiquetas,
  });

  // Captura el subscriber_id de ManyChat para futuros envíos salientes
  // (seguimientos automáticos, sandbox manual, handoffs). Idempotente.
  await persistirSubscriberId(numero, input.cleaned.subscriberId);

  // ── Paso 6: guardrails ──────────────────────────────────
  const match = checkGuardrails(input.cleaned.userText);
  if (match) {
    const plan = planHandoffGuardrail(input.cleaned, match);
    await executeHandoffGuardrail(plan);

    // Cablear los pending-fase-4 del sub-workflow (CLAUDE.md §12)
    const guardrailOutbound = await runHandoffGuardrailSteps({
      numero,
      mensajeOriginal: input.cleaned.userText,
      motivo: plan.payload.motivo,
      subscriberId: input.cleaned.subscriberId,
      kaizenSessionId: input.kaizenSessionId ?? null,
      mode,
    });

    return {
      ok: true,
      mode,
      demo: false,
      earlyExit: { reason: "guardrail", plan },
      leadCreated: created,
      metadata: enrichMetadata(await consultarLiveActivo(), await resolveSirenaUrls()),
      contexto: {},
      verificador: {} as VerificadorOutput,
      toolResult: null,
      agenteTexto: "",
      fragmentos: [],
      outbound: guardrailOutbound,
      deliveryNotes: [`guardrail ${plan.match.category}:${plan.match.keyword}`],
      durationMs: Date.now() - start,
    };
  }

  // ── Paso 7: buffer de 5s ────────────────────────────────
  // Decisión de Mar: sin buffer. Cada mensaje se procesa individual.
  // Si se ven respuestas múltiples a mensajes consecutivos, agregamos
  // el buffer en una iteración futura (Upstash o KV, NO Redis de n8n).

  // ── Paso 8: log conversación entrante ───────────────────
  await supabase.from("conversaciones").insert({
    numero_whatsapp: numero,
    direccion: "entrante",
    texto: input.cleaned.userText,
    tipo_mensaje: input.cleaned.tipoMensajeOriginal,
  });

  // ── Pasos 9 + 10 + 11: live + contexto + enrich ─────────
  const [live, urls] = await Promise.all([consultarLiveActivo(), resolveSirenaUrls()]);
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
  const metadata = enrichMetadata(live, urls);
  metadata.asesora_ofrecida_reciente = detectarOfertaAsesoraReciente(
    contexto.ultimos_mensajes,
  );
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

  // ── Etiquetar lead según intent del Verificador ─────────
  // Cuando alguien pregunta por pieza personalizada, taggeamos
  // el lead para que la asesora sepa que tiene que revisar la
  // imagen de referencia en la conversación.
  if (verificador.intencion_primaria === "personalizado") {
    await agregarEtiquetaLead(supabase, numero, "pieza_personalizada");
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
  const estadoActual = (contexto.estado_actual ?? null) as Record<string, unknown> | null;
  const yaEnHandoff =
    !!estadoActual &&
    (estadoActual.rama_activa === "handoff" ||
      estadoActual.requiere_handoff === true);

  const toolResult = await executeTool({
    verificador,
    numero,
    subscriberId: input.cleaned.subscriberId,
    kaizenSessionId: input.kaizenSessionId ?? null,
    mode,
    yaEnHandoff,
  });

  // ── Paso 16: parse loop sobre el texto del Agente ───────
  const fragmentos = parseLoop(agente.texto);

  // ── Capturar outbound (lo que mandó la tool + lo que mandó el Agente)
  const outbound: FlowResult["outbound"] = [];
  if (toolResult) {
    for (const m of toolResult.outboundMessages) {
      outbound.push({ source: "tool", type: m.type, text: m.text, url: m.url });
    }
  }

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
        mode,
        messages: [{ type: "text", text: fragmento }],
      });
      deliveryNotes.push(`${result.via}${result.status ? " " + result.status : ""}`);
      outbound.push({ source: "agente", type: "text", text: fragmento });
      // En simulator no esperamos 2.5s — es instantáneo
      if (mode === "production") await delay(2500);
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
    mode,
    demo: !!verificador._demo || !!agente._demo,
    earlyExit: null,
    leadCreated: created,
    metadata,
    contexto,
    verificador,
    toolResult,
    agenteTexto: agente.texto,
    fragmentos,
    outbound,
    deliveryNotes,
    durationMs: Date.now() - start,
  };
}

async function executeTool(input: {
  verificador: VerificadorOutput;
  numero: string;
  subscriberId: string | null;
  kaizenSessionId: string | null;
  mode: FlowMode;
  yaEnHandoff: boolean;
}): Promise<ToolResult | null> {
  const v = input.verificador;
  const tool = v.accion_recomendada.tool_principal;
  const p = v.accion_recomendada.parametros as Record<string, unknown>;
  const common = {
    numero_whatsapp: input.numero,
    subscriber_id: input.subscriberId,
    kaizen_session_id: input.kaizenSessionId,
    mode: input.mode,
  };

  // Si el lead ya está en handoff (asesora ya fue asignada), NO disparamos
  // otro handoff aunque el Verificador o el flag de alerta lo sugieran.
  // El Verificador, al ver el contexto con rama_activa='handoff', tiende a
  // querer mantener la rama → genera "te paso con X" en cada turno → alertas
  // duplicadas y respuestas robóticas. El Agente toma el turno con texto
  // natural que acompaña a la clienta mientras espera.
  if (input.yaEnHandoff && (tool === "handoff_asesora" || v.alertas.requiere_handoff)) {
    return null;
  }

  // Override: si requiere_handoff = true (y no estaba ya), arrancamos handoff.
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
          coleccion: (p.coleccion as "pandora" | "taxco" | "tows" | "todos") ?? "todos",
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
      case "enviar_sitio_menudeo":
        return await enviarSitioMenudeo({
          ...common,
          texto_acompanante: String(p.texto_acompanante ?? ""),
        });
      case "agendar_visita_taxco":
        return await agendarVisitaTaxco({
          ...common,
          dia: (p.dia as "entresemana" | "sabado") ?? "entresemana",
          texto_acompanante: String(p.texto_acompanante ?? ""),
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
  mode: FlowMode;
}): Promise<FlowResult["outbound"]> {
  const supabase = createAdminClient();
  const outbound: FlowResult["outbound"] = [];

  // Mensaje puente
  const puenteTxt = "Entiendo · te paso con una asesora real ahora mismo 💗";
  await sendToClient({
    subscriberId: args.subscriberId,
    kaizenSessionId: args.kaizenSessionId,
    mode: args.mode,
    messages: [{ type: "text", text: puenteTxt }],
  });
  outbound.push({ source: "tool", type: "text", text: puenteTxt });

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
  if (!data) return outbound;

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

  return outbound;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Añade una etiqueta a leads.etiquetas (TEXT[]) sin duplicar.
// PostgREST no soporta array_append directo así que leemos y
// reescribimos en cliente.
async function agregarEtiquetaLead(
  supabase: ReturnType<typeof createAdminClient>,
  numero: string,
  etiqueta: string,
): Promise<void> {
  const { data } = await supabase
    .from("leads")
    .select("etiquetas")
    .eq("numero_whatsapp", numero)
    .maybeSingle();
  const actuales = (data?.etiquetas as string[] | null) ?? [];
  if (actuales.includes(etiqueta)) return;
  await supabase
    .from("leads")
    .update({ etiquetas: [...actuales, etiqueta] })
    .eq("numero_whatsapp", numero);
}
