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

const CATALOGOS = {
  pandora: "https://www.canva.com/design/DAGgun-_kzE/isvBbeVkT0S448hgiqV3YA/view",
  taxco: "https://mardeplatataxco.my.canva.site/",
  tows: "https://mardeplatataxco.my.canva.site/tows",
} as const;

const LINK_GRUPO = "https://chat.whatsapp.com/DtpuIyQljqhLu0B7pwnZkB?mode=ac_t";

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
export async function enviarCatalogo(args: {
  numero_whatsapp: string;
  coleccion: "pandora" | "taxco" | "tows";
  texto_acompanante: string;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();
  const claveMap = {
    pandora: "catalogo_pandora_url",
    taxco: "catalogo_taxco_url",
    tows: "catalogo_tows_url",
  } as const;
  const url = await readConfig(claveMap[args.coleccion], CATALOGOS[args.coleccion]);

  const messages = [
    { type: "text" as const, text: `${args.texto_acompanante}\n\n${url}` },
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
      catalogo_enviado: true,
      catalogo_tipo: args.coleccion,
      rama_activa: "R1",
      paso_actual: "catalogo_enviado",
      ultimo_tool_ejecutado: "enviar_catalogo",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  // tipo := COALESCE(tipo, 'mayoreo'), estado lead_nueva → calificada
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
    parametros_tool: { coleccion: args.coleccion },
  });

  return {
    tool: "enviar_catalogo",
    ok: true,
    outboundMessages: messages,
    notes: [`Catálogo ${args.coleccion} enviado`],
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
  const link = await readConfig("link_grupo_abierto", LINK_GRUPO);

  const messages = [
    { type: "text" as const, text: `${args.texto_acompanante}\n\n${link}` },
  ];
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
// Tool 4 · handoff_asesora
// ──────────────────────────────────────────────────────────
export async function handoffAsesora(args: {
  numero_whatsapp: string;
  motivo: string;
  prioridad: "normal" | "alta" | "urgente";
  contexto_breve: string | null;
} & CommonArgs): Promise<ToolResult> {
  const supabase = createAdminClient();

  // Asesora habitual (si existe) o round-robin
  const { data: leadRow } = await supabase
    .from("leads")
    .select("asesora_asignada")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  let asesora: { id: string; nombre_completo: string } | null = null;
  if (leadRow?.asesora_asignada) {
    const { data } = await supabase
      .from("asesoras")
      .select("id,nombre_completo")
      .eq("id", leadRow.asesora_asignada)
      .maybeSingle();
    asesora = data
      ? { id: data.id as string, nombre_completo: data.nombre_completo as string }
      : null;
  }
  if (!asesora) {
    const { data } = await supabase
      .from("asesoras")
      .select("id,nombre_completo,en_onboarding,conversaciones_abiertas,ultima_asignacion")
      .eq("activa", true)
      .order("en_onboarding", { ascending: false })
      .order("conversaciones_abiertas", { ascending: true })
      .order("ultima_asignacion", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    asesora = data
      ? { id: data.id as string, nombre_completo: data.nombre_completo as string }
      : null;
  }
  if (!asesora) {
    return {
      tool: "handoff_asesora",
      ok: false,
      outboundMessages: [],
      notes: ["No hay asesora activa para asignar el handoff"],
    };
  }

  await supabase
    .from("leads")
    .update({
      asesora_asignada: asesora.id,
      fecha_asignacion: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  await supabase
    .from("estado_conversacion_actual")
    .update({
      requiere_handoff: true,
      prioridad_handoff: args.prioridad,
      rama_activa: "handoff",
      paso_actual: "handoff_iniciado",
      ultimo_tool_ejecutado: "handoff_asesora",
      ultimo_timestamp: new Date().toISOString(),
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  // INSERT alerta con tipo calculado
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
    asesora_asignada_id: asesora.id,
    para_mar: isUrgent || isReclamo,
    contexto_json: {
      motivo: args.motivo,
      origen: "handoff_asesora",
      asesora_nombre: asesora.nombre_completo,
    },
  });

  // UPDATE carga de asesora
  const { data: cargaRow } = await supabase
    .from("asesoras")
    .select("conversaciones_abiertas,conversaciones_dia")
    .eq("id", asesora.id)
    .maybeSingle();
  await supabase
    .from("asesoras")
    .update({
      conversaciones_abiertas: (cargaRow?.conversaciones_abiertas ?? 0) + 1,
      conversaciones_dia: (cargaRow?.conversaciones_dia ?? 0) + 1,
      ultima_asignacion: new Date().toISOString(),
    })
    .eq("id", asesora.id);

  const texto = `Te paso con ${asesora.nombre_completo} — ella te atiende en breve 💎`;
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
      asesora: asesora.id,
    },
  });

  return {
    tool: "handoff_asesora",
    ok: true,
    outboundMessages: messages,
    notes: [`Handoff a ${asesora.nombre_completo} (${tipoAlerta})`],
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
  const { data, error } = await supabase
    .from("seguimientos_programados")
    .insert({
      numero_whatsapp: args.numero_whatsapp,
      tipo: args.tipo,
      ejecutar_en: ejecutarEn,
      contexto: { contexto_adicional: args.contexto_adicional ?? "" },
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
  messages.push({
    type: "text",
    text: `Esta es nuestra ubicación 📍\n${maps}\n\nPor favor agenda tu visita con 24 horas de anticipación con una de nuestras asesoras — ya te paso con ella 💗`,
  });

  // Round-robin asesora (igual que handoffAsesora)
  const { data: leadRow } = await supabase
    .from("leads")
    .select("asesora_asignada")
    .eq("numero_whatsapp", args.numero_whatsapp)
    .maybeSingle();
  let asesora: { id: string; nombre_completo: string } | null = null;
  if (leadRow?.asesora_asignada) {
    const { data } = await supabase
      .from("asesoras")
      .select("id,nombre_completo")
      .eq("id", leadRow.asesora_asignada)
      .maybeSingle();
    asesora = data
      ? { id: data.id as string, nombre_completo: data.nombre_completo as string }
      : null;
  }
  if (!asesora) {
    const { data } = await supabase
      .from("asesoras")
      .select("id,nombre_completo,en_onboarding,conversaciones_abiertas,ultima_asignacion")
      .eq("activa", true)
      .order("en_onboarding", { ascending: false })
      .order("conversaciones_abiertas", { ascending: true })
      .order("ultima_asignacion", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    asesora = data
      ? { id: data.id as string, nombre_completo: data.nombre_completo as string }
      : null;
  }

  await sendToClient({
    subscriberId: args.subscriber_id,
    kaizenSessionId: args.kaizen_session_id ?? null,
    mode: args.mode,
    messages: messages as Array<{ type: "text"; text: string } | { type: "image"; url: string }>,
  });

  // Estado: rama R5
  await supabase
    .from("estado_conversacion_actual")
    .update({
      rama_activa: "R5",
      paso_actual: "visita_agendando",
      ultimo_tool_ejecutado: "agendar_visita_taxco",
      ultimo_timestamp: new Date().toISOString(),
      requiere_handoff: !!asesora,
      prioridad_handoff: "normal",
    })
    .eq("numero_whatsapp", args.numero_whatsapp);

  if (asesora) {
    await supabase
      .from("leads")
      .update({
        asesora_asignada: asesora.id,
        fecha_asignacion: new Date().toISOString(),
      })
      .eq("numero_whatsapp", args.numero_whatsapp);

    await supabase.from("alertas").insert({
      tipo: "handoff_normal",
      prioridad: "normal",
      titulo: `Visita presencial · ${args.dia === "sabado" ? "sábado" : "entre semana"}`,
      descripcion: "Cliente quiere visitar el local en Taxco. Agendar 24h antes.",
      numero_whatsapp: args.numero_whatsapp,
      asesora_asignada_id: asesora.id,
      para_mar: false,
      contexto_json: {
        motivo: "agendar_visita_taxco",
        origen: "agendar_visita_taxco",
        asesora_nombre: asesora.nombre_completo,
        dia_solicitado: args.dia,
      },
    });

    const { data: cargaRow } = await supabase
      .from("asesoras")
      .select("conversaciones_abiertas,conversaciones_dia")
      .eq("id", asesora.id)
      .maybeSingle();
    await supabase
      .from("asesoras")
      .update({
        conversaciones_abiertas: (cargaRow?.conversaciones_abiertas ?? 0) + 1,
        conversaciones_dia: (cargaRow?.conversaciones_dia ?? 0) + 1,
        ultima_asignacion: new Date().toISOString(),
      })
      .eq("id", asesora.id);
  }

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
      `Imagen #${idImagen} (${args.dia}) + maps enviados${asesora ? ` + handoff a ${asesora.nombre_completo}` : " (sin asesora disponible)"}`,
    ],
  };
}
