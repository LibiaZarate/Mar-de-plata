// Las 5 tools del Agente Madre · CLAUDE.md §11.
// Cada tool: ejecuta su acción (POST a ManyChat + UPDATEs/INSERTs a Supabase)
// y devuelve un ToolResult. El orquestador del flujo decide cuál ejecutar
// según `accion_recomendada.tool_principal` del Verificador.
//
// En modo "simulator", las escrituras a Supabase SÍ ocurren (para que se
// vea el efecto real en el dashboard) pero el envío a ManyChat se omite.
// Los mensajes que se hubieran enviado quedan en `outboundMessages` para
// que la UI del Playground los pinte como burbujas de Sirena.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendToClient } from "../manychat";
import type { FlowMode } from "../mode";

export type ToolName =
  | "enviar_imagen_faq"
  | "enviar_catalogo"
  | "invitar_grupo"
  | "handoff_asesora"
  | "programar_seguimiento"
  | "agendar_visita_taxco"
  | "enviar_sitio_menudeo"
  | "responder_texto_simple";

export type ToolResult = {
  tool: ToolName;
  ok: boolean;
  outboundMessages: Array<{ type: "text" | "image"; text?: string; url?: string }>;
  notes: string[];
};

type CommonArgs = {
  subscriber_id: string | null;
  kaizen_session_id?: string | null;
  mode: FlowMode;
};

const CATALOGO_MAYOREO_DEFAULT = "https://mardeplatataxco.my.canva.site/";
const LINK_GRUPO = "https://chat.whatsapp.com/KGHBRGal5Lg5hvtkmnttei?mode=gi_t";

async function readConfig(clave: string, fallback: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("config_sistema")
    .select("valor")
    .eq("clave", clave)
    .maybeSingle();
  return ((data?.valor as string | undefined) ?? fallback).trim();
}

// ──────────────────────────────────────────────────────────
// Tool 1 · enviar_imagen_faq
// ──────────────────────────────────────────────────────────
export async function enviarImagenFaq(args: {
  numero_whatsapp: string;
  id_imagen: number;
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();
  const { data: img, error: imgErr } = await supabase
    .from("imagenes_faq")
    .select("*")
    .eq("id", args.id_imagen)
    .eq("activa", true)
    .maybeSingle();

  if (imgErr || !img) {
    return {
      tool: "enviar_imagen_faq",
      ok: false,
      outboundMessages: [],
      notes: [`imagenes_faq id=${args.id_imagen} no encontrada`],
    };
  }
  const url = img.url_publica as string;

  // Estado actual: para saber si ya se mandaron políticas+manual
  // y si es la primera FAQ de la conversación.
  const { data: estado } = await supabase
    .from("estado_conversacion_actual")
    .select("faqs_respondidas,politicas_enviadas")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  const current = (estado?.faqs_respondidas as number[] | null) ?? [];
  const politicasYaEnviadas = !!estado?.politicas_enviadas;

  const messages: Array<{ type: "text" | "image"; text?: string; url?: string }> = [];
  if (args.texto_acompanante) {
    messages.push({ type: "text", text: args.texto_acompanante });
  }
  messages.push({ type: "image", url });

  // Si es la primera FAQ de la conversación y aún no se mandaron
  // las políticas, las anexamos automáticamente.
  let mandamosPoliticas = false;
  if (!politicasYaEnviadas) {
    const politicasPdf = await readConfig(
      "politicas_manual_pdf",
      "https://nbciljmueoihtzznmvdg.supabase.co/storage/v1/object/public/politicasmanual/Politicas%20y%20Manual%20de%20Compras.pdf",
    );
    if (politicasPdf) {
      messages.push({
        type: "text",
        text: `Te dejo también nuestras políticas y manual de compras para que las tengas a la mano 💗\n\n${politicasPdf}`,
      });
      mandamosPoliticas = true;
    }
  }

  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages: messages as Array<{ type: "text"; text: string } | { type: "image"; url: string }>,
  });

  // PostgREST no soporta array_append directo; leemos el array y
  // hacemos el append en cliente con dedup.
  const next = current.includes(args.id_imagen)
    ? current
    : [...current, args.id_imagen];
  await supabase
    .from("estado_conversacion_actual")
    .update({
      faqs_respondidas: next,
      paso_actual: "faq_respondida_esperando",
      ultimo_tool_ejecutado: "enviar_imagen_faq",
      ultimo_timestamp: new Date().toISOString(),
      ...(mandamosPoliticas ? { politicas_enviadas: true } : {}),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto: args.texto_acompanante,
    tipo_mensaje: "imagen",
    media_url: url,
    tool_ejecutada: "enviar_imagen_faq",
    parametros_tool: { id_imagen: args.id_imagen },
  });

  return {
    tool: "enviar_imagen_faq",
    ok: true,
    outboundMessages: messages,
    notes: [`FAQ #${args.id_imagen} (${img.tag}) enviada`],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 2 · enviar_catalogo
// ──────────────────────────────────────────────────────────
// Decisión del negocio (junio 2026): el catálogo es UNO solo, vive
// en mardeplatataxco.my.canva.site. Las colecciones Pandora/TOWS
// se descontinuaron como links separados, todo está dentro del
// mismo Canva site. La tool acepta `coleccion` por retrocompat,
// pero ignora el valor y siempre envía el único catálogo oficial.
export async function enviarCatalogo(args: {
  numero_whatsapp: string;
  coleccion?: string;
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();

  const url = await readConfig("catalogo_taxco_url", CATALOGO_MAYOREO_DEFAULT);
  const apertura = args.texto_acompanante?.trim()
    ? args.texto_acompanante.trim()
    : "¡Hola! 🥳💖 Te paso nuestro catálogo de mayoreo, con sets, anillos, collares y todas las piezas disponibles.";
  const textoMensaje = `${apertura}\n\n👉🏻 ${url}`;

  const messages = [{ type: "text" as const, text: textoMensaje }];
  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages,
  });

  await supabase
    .from("estado_conversacion_actual")
    .update({
      catalogo_enviado: true,
      catalogo_tipo: "mayoreo",
      rama_activa: "R1",
      paso_actual: "catalogo_enviado",
      ultimo_tool_ejecutado: "enviar_catalogo",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  const { data: lead } = await supabase
    .from("leads")
    .select("tipo,estado")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  await supabase
    .from("leads")
    .update({
      tipo: lead?.tipo ?? "mayoreo",
      estado: lead?.estado === "lead_nueva" ? "calificada" : lead?.estado,
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto: args.texto_acompanante,
    tipo_mensaje: "texto",
    tool_ejecutada: "enviar_catalogo",
    parametros_tool: { coleccion: "mayoreo" },
  });

  return {
    tool: "enviar_catalogo",
    ok: true,
    outboundMessages: messages,
    notes: ["Catálogo de mayoreo enviado"],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 3 · invitar_grupo
// ──────────────────────────────────────────────────────────
export async function invitarGrupo(args: {
  numero_whatsapp: string;
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();

  // Mandar los TRES grupos con orden sugerido. Si el primero está
  // lleno, la clienta prueba el siguiente — eso funciona como
  // rotación pasiva sin tener que llevar contadores. (Decisión Libia,
  // junio 2026.)
  const link1 = await readConfig("link_grupo_mayoreo_1", LINK_GRUPO);
  const link2 = await readConfig("link_grupo_mayoreo_2", LINK_GRUPO);
  const link3 = await readConfig("link_grupo_mayoreo_3", LINK_GRUPO);

  const aperturaUsuario = args.texto_acompanante?.trim();
  const apertura =
    aperturaUsuario && aperturaUsuario.length > 0
      ? aperturaUsuario
      : "Te dejo los grupos abiertos, linda 💗";

  const textoMensaje = `${apertura}

Métete al *Grupo 1* primero. Si te sale que está lleno, prueba el 2, y si tampoco, el 3 ✨

Grupo 1 👉🏻 ${link1}
Grupo 2 👉🏻 ${link2}
Grupo 3 👉🏻 ${link3}`;

  const messages = [{ type: "text" as const, text: textoMensaje }];
  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages,
  });

  const { data: estado } = await supabase
    .from("estado_conversacion_actual")
    .select("rama_activa")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  await supabase
    .from("estado_conversacion_actual")
    .update({
      grupo_invitado: true,
      paso_actual: "grupo_invitado",
      ultimo_tool_ejecutado: "invitar_grupo",
      ultimo_timestamp: new Date().toISOString(),
      rama_activa: estado?.rama_activa ?? "R2",
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  const { data: lead } = await supabase
    .from("leads")
    .select("tipo")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  await supabase
    .from("leads")
    .update({ grupo_asignado: "abierto", tipo: lead?.tipo ?? "mayoreo" })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto: args.texto_acompanante,
    tipo_mensaje: "texto",
    tool_ejecutada: "invitar_grupo",
  });

  return {
    tool: "invitar_grupo",
    ok: true,
    outboundMessages: messages,
    notes: ["Invitación al grupo abierto enviada"],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 4 · handoff_asesora (modelo pull con fallback)
// ──────────────────────────────────────────────────────────
// Cambio operativo:
// - Si el lead ya tiene asesora habitual (asesora_asignada en leads)
//   → asignamos directo a ella, sin pasar por la cola.
// - Si NO → cae a la cola compartida (alertas con asesora_asignada_id
//   NULL). El cron /api/cron/asignar-pendientes hace fallback a 5 min
//   asignando round-robin si nadie la tomó.
// La asesora puede tomar leads de la cola desde /equipo.
export async function handoffAsesora(args: {
  numero_whatsapp: string;
  motivo: string;
  prioridad: "normal" | "alta" | "urgente";
  contexto_breve: string | null;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();

  // Asesora habitual: solo si el lead ya tenía una previamente.
  const { data: leadRow } = await supabase
    .from("leads")
    .select("asesora_asignada")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  let asesoraHabitual: { id: string; nombre_completo: string } | null = null;
  if (leadRow?.asesora_asignada) {
    const { data } = await supabase
      .from("asesoras")
      .select("id,nombre_completo")
      .eq("id", leadRow.asesora_asignada)
      .maybeSingle();
    asesoraHabitual = data
      ? { id: data.id as string, nombre_completo: data.nombre_completo as string }
      : null;
  }

  // Etiquetar el lead con el motivo del handoff para que se vea en pipeline
  await agregarEtiquetaLeadInterna(
    supabase,
    args.numero_whatsapp,
    `handoff:${args.motivo}`,
  );

  await supabase
    .from("estado_conversacion_actual")
    .update({
      requiere_handoff: true,
      prioridad_handoff: args.prioridad,
      rama_activa: "handoff",
      paso_actual: asesoraHabitual ? "handoff_iniciado" : "handoff_en_cola",
      ultimo_tool_ejecutado: "handoff_asesora",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  // INSERT alerta con asesora_asignada_id = habitual o NULL (cola).
  const isUrgent = args.prioridad === "urgente";
  const isReclamo = /reclamo/i.test(args.motivo);
  const tipoAlerta = isUrgent
    ? "handoff_urgente"
    : isReclamo
      ? "reclamo"
      : "handoff_normal";
  await supabase.from("alertas").insert({
    tipo: tipoAlerta,
    prioridad: args.prioridad,
    titulo: `Handoff · ${args.motivo}`,
    descripcion: args.contexto_breve || "Sin contexto adicional",
    numero_whatsapp: args.numero_whatsapp,
    asesora_asignada_id: asesoraHabitual?.id ?? null,
    para_mar: isUrgent || isReclamo,
    contexto_json: {
      motivo: args.motivo,
      origen: "handoff_asesora",
      asesora_nombre: asesoraHabitual?.nombre_completo ?? null,
    },
  });

  if (asesoraHabitual) {
    // Solo cuando hay asesora habitual ya asignada, marcamos el lead
    // y bumpeamos su carga.
    await supabase
      .from("leads")
      .update({
        asesora_asignada: asesoraHabitual.id,
        fecha_asignacion: new Date().toISOString(),
      })
      .eq("numero_whatsapp", args.numero_whatsapp);

    const { data: cargaRow } = await supabase
      .from("asesoras")
      .select("conversaciones_abiertas,conversaciones_dia")
      .eq("id", asesoraHabitual.id)
      .maybeSingle();
    await supabase
      .from("asesoras")
      .update({
        conversaciones_abiertas: (cargaRow?.conversaciones_abiertas ?? 0) + 1,
        conversaciones_dia: (cargaRow?.conversaciones_dia ?? 0) + 1,
        ultima_asignacion: new Date().toISOString(),
      })
      .eq("id", asesoraHabitual.id);
  }

  // Mensaje a la clienta. Si hay habitual menciona el nombre, si no
  // dice algo neutral (no podemos prometer quién, depende de quién
  // tome la cola).
  const texto = asesoraHabitual
    ? `Te paso con ${asesoraHabitual.nombre_completo} — ella te atiende en breve 💎`
    : `Te paso con una de nuestras asesoras — ya viene en un momento 💎`;
  const messages = [{ type: "text" as const, text: texto }];
  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages,
  });

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto,
    tipo_mensaje: "texto",
    tool_ejecutada: "handoff_asesora",
    status: "handoff_iniciado",
    parametros_tool: {
      motivo: args.motivo,
      prioridad: args.prioridad,
      asesora: asesoraHabitual?.id ?? null,
      en_cola: !asesoraHabitual,
    },
  });

  return {
    tool: "handoff_asesora",
    ok: true,
    outboundMessages: messages,
    notes: [
      asesoraHabitual
        ? `Handoff directo a ${asesoraHabitual.nombre_completo} (asesora habitual, ${tipoAlerta})`
        : `Handoff a cola compartida (${tipoAlerta}) — esperando que alguien la tome o fallback en 5 min`,
    ],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 5 · programar_seguimiento
// ──────────────────────────────────────────────────────────
export async function programarSeguimiento(args: {
  numero_whatsapp: string;
  tipo: string;
  dias_offset: number;
  contexto_adicional?: string;
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const ejecutarEn = new Date(Date.now() + args.dias_offset * 86400_000).toISOString();

  // Snapshot del contexto al momento de programar.
  // Si falla, seguimos guardando el seguimiento sin snapshot — el
  // executor lo reconstruirá al enviar.
  let snapshot: Record<string, unknown> | null = null;
  try {
    const { construirSnapshot } = await import("@/lib/seguimientos/snapshot");
    snapshot = (await construirSnapshot(
      supabase,
      args.numero_whatsapp,
      args.contexto_adicional ?? null,
    )) as unknown as Record<string, unknown>;
  } catch {
    snapshot = null;
  }

  const { data, error } = await supabase
    .from("seguimientos_programados")
    .insert({
      numero_whatsapp: args.numero_whatsapp,
      tipo: args.tipo,
      ejecutar_en: ejecutarEn,
      contexto: {
        contexto_adicional: args.contexto_adicional ?? "",
        snapshot,
      },
    })
    .select("id,ejecutar_en")
    .single();

  if (error) {
    return {
      tool: "programar_seguimiento",
      ok: false,
      outboundMessages: [],
      notes: [`INSERT seguimientos_programados falló: ${error.message}`],
    };
  }
  return {
    tool: "programar_seguimiento",
    ok: true,
    outboundMessages: [],
    notes: [`Seguimiento id=${data?.id} programado para ${data?.ejecutar_en}`],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 6 · enviar_sitio_menudeo (R3)
// ──────────────────────────────────────────────────────────
export async function enviarSitioMenudeo(args: {
  numero_whatsapp: string;
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();
  const sitio = await readConfig(
    "sitio_web_menudeo",
    "https://www.mardeplatataxco.com",
  );

  const messages = [
    { type: "text" as const, text: `${args.texto_acompanante}\n\n${sitio}` },
  ];
  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages,
  });

  await supabase
    .from("estado_conversacion_actual")
    .update({
      rama_activa: "R3",
      paso_actual: "sitio_menudeo_enviado",
      ultimo_tool_ejecutado: "enviar_sitio_menudeo",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  const { data: lead } = await supabase
    .from("leads")
    .select("tipo")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  await supabase
    .from("leads")
    .update({ tipo: lead?.tipo ?? "menudeo" })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto: args.texto_acompanante,
    tipo_mensaje: "texto",
    tool_ejecutada: "enviar_sitio_menudeo",
  });

  return {
    tool: "enviar_sitio_menudeo",
    ok: true,
    outboundMessages: messages,
    notes: ["Link de sitio web (menudeo) enviado"],
  };
}

// ──────────────────────────────────────────────────────────
// Tool 7 · agendar_visita_taxco (R5)
// Manda imagen #23 (lun-vie) o #24 (sáb), ubicación de Google
// Maps, instrucción de agendar 24h antes, y dispara handoff
// a la asesora habitual (o round-robin).
// ──────────────────────────────────────────────────────────
export async function agendarVisitaTaxco(args: {
  numero_whatsapp: string;
  dia: "entresemana" | "sabado";
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();
  const idImagen = args.dia === "sabado" ? 24 : 23;

  const { data: img } = await supabase
    .from("imagenes_faq")
    .select("url_publica,tag")
    .eq("id", idImagen)
    .eq("activa", true)
    .maybeSingle();
  const imgUrl = (img?.url_publica as string | undefined) ?? null;

  const maps = await readConfig(
    "ubicacion_taxco_maps",
    "https://www.google.com/maps/search/?api=1&query=Plaza+San+Hip%C3%B3lito+Local+5%2C+Taxco+de+Alarc%C3%B3n%2C+40200",
  );

  const messages: Array<{ type: "text" | "image"; text?: string; url?: string }> = [];
  if (args.texto_acompanante) {
    messages.push({ type: "text", text: args.texto_acompanante });
  }
  if (imgUrl) {
    messages.push({ type: "image", url: imgUrl });
  }
  // Mensaje sin auto-handoff: damos la info, le pedimos agendar
  // 24h antes y le PREGUNTAMOS si quiere asesora (no asumimos).
  messages.push({
    type: "text",
    text: `Esta es nuestra ubicación 📍\n${maps}\n\nPor favor agenda tu visita con 24 horas de anticipación. ¿Te gustaría que te pase con una de nuestras asesoras para coordinarlo? 💗`,
  });

  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages: messages as Array<{ type: "text"; text: string } | { type: "image"; url: string }>,
  });

  // Estado: rama R5, esperando confirmación. NO marcamos
  // requiere_handoff todavía — lo decide el verificador cuando la
  // clienta responda "sí, pásame con asesora".
  await supabase
    .from("estado_conversacion_actual")
    .update({
      rama_activa: "R5",
      paso_actual: "visita_esperando_confirmacion_asesora",
      ultimo_tool_ejecutado: "agendar_visita_taxco",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase.from("conversaciones").insert({
    numero_whatsapp: args.numero_whatsapp,
    direccion: "saliente",
    texto: args.texto_acompanante,
    tipo_mensaje: "imagen",
    media_url: imgUrl,
    tool_ejecutada: "agendar_visita_taxco",
    parametros_tool: { dia: args.dia, id_imagen: idImagen },
  });

  return {
    tool: "agendar_visita_taxco",
    ok: true,
    outboundMessages: messages,
    notes: [
      `Imagen #${idImagen} (${args.dia}) + maps enviados · esperando confirmación de handoff`,
    ],
  };
}

// Añade una etiqueta a leads.etiquetas (TEXT[]) sin duplicar.
// Usada por las tools que necesitan dejar rastro en el pipeline.
async function agregarEtiquetaLeadInterna(
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
