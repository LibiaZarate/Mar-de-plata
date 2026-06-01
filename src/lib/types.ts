// Tipos espejo de las tablas reales de Supabase — CLAUDE.md §6.

export type LeadEstado =
  | "lead_nueva"
  | "calificada"
  | "esperando_pago"
  | "pagada"
  | "perdida";

export type LeadTipo = "mayoreo" | "menudeo" | null;

export type Lead = {
  numero_whatsapp: string;
  nombre: string | null;
  ciudad: string | null;
  estado_geografico: string | null;
  pais: string;
  tipo: LeadTipo;
  estado: LeadEstado;
  canal_origen: string | null;
  anuncio_id: string | null;
  asesora_asignada: string | null;
  grupo_asignado: string | null;
  fecha_asignacion: string | null;
  ticket_promedio: number;
  compras_totales: number;
  monto_acumulado: number;
  fecha_primera_compra: string | null;
  fecha_ultima_compra: string | null;
  colecciones_favoritas: string[];
  primer_contacto: string;
  ultima_interaccion: string;
  etiquetas: string[];
  reclamos_historicos: number;
};

export type EstadoConversacion = {
  numero_whatsapp: string;
  rama_activa: string | null;
  paso_actual: string | null;
  ultimo_tool_ejecutado: string | null;
  ultimo_timestamp: string;
  catalogo_enviado: boolean;
  catalogo_tipo: string | null;
  politicas_enviadas: boolean;
  grupo_invitado: boolean;
  faqs_respondidas: number[];
  turnos_acumulados: number;
  inicio_conversacion: string;
  intencion_compra_detectada: boolean;
  objecion_detectada: string | null;
  requiere_handoff: boolean;
  prioridad_handoff: string;
  conversacion_cerrada: boolean;
  motivo_cierre: string | null;
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
  conversaciones_abiertas: number;
  conversaciones_dia: number;
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
  para_mar: boolean;
  estado: "activa" | "vista" | "resuelta" | "archivada";
  resuelta_en: string | null;
  resuelta_por_id: string | null;
  notas_resolucion: string | null;
  contexto_json: Record<string, unknown>;
  created_at: string;
};

export type Cierre = {
  id: number;
  numero_whatsapp: string;
  asesora_id: string;
  monto: number;
  canal:
    | "mayoreo_catalogo"
    | "mayoreo_grupo"
    | "menudeo"
    | "live"
    | "presencial";
  notas: string | null;
  comprobante_url: string | null;
  fecha_cierre: string;
};

export type EventoLive = {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  red_social: "facebook" | "instagram" | "tiktok";
  link_evento: string | null;
  codigo_descuento: string | null;
  descripcion_promo: string | null;
  activo: boolean;
  creado_por_id: string | null;
};

export type ImagenFaq = {
  id: number;
  tag: string;
  descripcion: string;
  url_publica: string | null;
  categoria: string | null;
  activa: boolean;
};

export type ConfigClave = {
  clave: string;
  valor: string;
  descripcion: string | null;
  actualizado_en: string;
};
