// Tipos espejo de las tablas reales de Supabase. Solo lo que el dashboard
// consume — no es el esquema completo.

export type LeadEstado =
  | "lead_nueva"
  | "calificada"
  | "esperando_pago"
  | "pagada"
  | "perdida";

export type Canal =
  | "Meta"
  | "TikTok"
  | "Grupo"
  | "Recurrente"
  | "Orgánico"
  | string;

export type Lead = {
  numero_whatsapp: string;
  nombre: string | null;
  ciudad: string | null;
  estado: LeadEstado | null;
  tipo: "mayoreo" | "menudeo" | null;
  canal_origen: Canal | null;
  anuncio_id: string | null;
  asesora_asignada: string | null;
  grupo_asignado: string | null;
  fecha_asignacion: string | null;
  primer_contacto: string | null;
  ultima_interaccion: string | null;
};

export type EstadoConversacion = {
  numero_whatsapp: string;
  rama_activa: string | null;
  paso_actual: string | null;
  ultimo_tool_ejecutado: string | null;
  ultimo_timestamp: string | null;
  catalogo_enviado: boolean | null;
  catalogo_tipo: string | null;
  politicas_enviadas: boolean | null;
  grupo_invitado: boolean | null;
  faqs_respondidas: number[] | null;
  turnos_acumulados: number | null;
  inicio_conversacion: string | null;
  intencion_compra_detectada: boolean | null;
  requiere_handoff: boolean | null;
  prioridad_handoff: string | null;
  conversacion_cerrada: boolean | null;
};

export type Asesora = {
  id: string;
  nombre_completo: string;
  whatsapp_personal: string | null;
  activa: boolean;
  en_onboarding: boolean;
  horario_inicio: string | null;
  horario_fin: string | null;
  dias_laborales: number[] | null;
  conversaciones_abiertas: number | null;
  conversaciones_dia: number | null;
  ultima_asignacion: string | null;
};

export type AlertaTipo =
  | "handoff_normal"
  | "handoff_urgente"
  | "guardrail_critico"
  | "reclamo"
  | "sin_respuesta_15min"
  | "sin_respuesta_2h";

export type Alerta = {
  id: number;
  tipo: AlertaTipo;
  prioridad: "baja" | "normal" | "alta" | "urgente";
  titulo: string;
  descripcion: string | null;
  numero_whatsapp: string | null;
  asesora_asignada_id: string | null;
  para_mar: boolean | null;
  estado: "activa" | "vista" | "resuelta" | "archivada";
  resuelta_en: string | null;
  resuelta_por_id: string | null;
  notas_resolucion: string | null;
  contexto_json: Record<string, unknown> | null;
  created_at: string;
};

export type Cierre = {
  id: number;
  numero_whatsapp: string;
  asesora_id: string;
  monto: number;
  canal: "mayoreo_catalogo" | "mayoreo_grupo" | "menudeo" | "live" | "presencial";
  notas: string | null;
  comprobante_url: string | null;
  fecha_cierre: string;
};

export type EventoLive = {
  id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  red_social: "facebook" | "instagram" | "tiktok";
  link_evento: string | null;
  codigo_descuento: string | null;
  descripcion_promo: string | null;
  activo: boolean;
  creado_por_id: string | null;
};
