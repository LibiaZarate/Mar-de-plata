// Etiquetas semánticas derivadas del estado del lead.
// Se calculan al vuelo desde leads + estado_conversacion_actual + deposit.
// Las que pidió Mar: etapa comercial, handoff necesario, canal de origen,
// depósito, recurrencia, origen geográfico.
//
// El array `etiquetas` de la tabla leads se reserva para overrides
// manuales (handoff:motivo, test, admin:libia, lo que sea). Lo que ves
// en UI es la unión de ambas.

export type LeadParaTags = {
  estado?: string | null;
  tipo?: string | null;
  canal_origen?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  compras_totales?: number | null;
  monto_acumulado?: number | null;
  ticket_promedio?: number | null;
  fecha_ultima_compra?: string | null;
  etiquetas?: string[] | null;
};

export type EstadoParaTags = {
  rama_activa?: string | null;
  requiere_handoff?: boolean | null;
  catalogo_enviado?: boolean | null;
  catalogo_tipo?: string | null;
  grupo_invitado?: boolean | null;
  intencion_compra_detectada?: boolean | null;
  objecion_detectada?: string | null;
} | null;

export type DepositoInfo = {
  hay_deposito: boolean;
  validado: boolean;
  contexto?: string | null;
};

export type Etiqueta = {
  key: string;        // formato canonical "categoria:valor"
  label: string;      // texto humano para el chip
  tono: "neutral" | "verde" | "ambar" | "rojo" | "lila" | "sky";
};

const TONO_ESTADO: Record<string, Etiqueta["tono"]> = {
  lead_nueva: "neutral",
  calificada: "sky",
  esperando_pago: "ambar",
  pagada: "verde",
  perdida: "rojo",
};

const LABEL_ESTADO: Record<string, string> = {
  lead_nueva: "Lead nueva",
  calificada: "Calificada",
  esperando_pago: "Esperando pago",
  pagada: "Pagada",
  perdida: "Perdida",
};

const LABEL_CANAL: Record<string, string> = {
  meta_ctwa: "Meta CTWA",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp_directo: "WhatsApp directo",
  grupo: "Grupo abierto",
  referido: "Referido",
};

export function etiquetasDerivadas(
  lead: LeadParaTags,
  estado: EstadoParaTags,
  deposito: DepositoInfo | null = null,
): Etiqueta[] {
  const out: Etiqueta[] = [];

  // Etapa comercial — la pidió primero
  if (lead.estado) {
    out.push({
      key: `etapa:${lead.estado}`,
      label: LABEL_ESTADO[lead.estado] ?? lead.estado,
      tono: TONO_ESTADO[lead.estado] ?? "neutral",
    });
  }

  // Recurrencia
  const compras = Number(lead.compras_totales ?? 0);
  if (compras > 0) {
    out.push({
      key: "recurrente",
      label: compras === 1 ? "1ª compra hecha" : `${compras} compras`,
      tono: "verde",
    });
  } else {
    out.push({ key: "primera_vez", label: "Primera vez", tono: "neutral" });
  }

  // Tipo de cliente
  if (lead.tipo === "mayoreo") {
    out.push({ key: "tipo:mayoreo", label: "Mayoreo", tono: "lila" });
  } else if (lead.tipo === "menudeo") {
    out.push({ key: "tipo:menudeo", label: "Menudeo", tono: "neutral" });
  }

  // Canal de origen
  if (lead.canal_origen) {
    out.push({
      key: `canal:${lead.canal_origen}`,
      label: LABEL_CANAL[lead.canal_origen] ?? lead.canal_origen,
      tono: "sky",
    });
  }

  // Origen geográfico (sólo si no es default)
  if (lead.ciudad) {
    out.push({
      key: `geo:${lead.ciudad.toLowerCase()}`,
      label: lead.ciudad,
      tono: "neutral",
    });
  }

  // Rama activa de Sirena
  if (estado?.rama_activa) {
    out.push({
      key: `rama:${estado.rama_activa}`,
      label: estado.rama_activa.toUpperCase(),
      tono: "neutral",
    });
  }

  // Catálogo visto
  if (estado?.catalogo_enviado && estado?.catalogo_tipo) {
    out.push({
      key: `vio:${estado.catalogo_tipo}`,
      label: `Vio ${estado.catalogo_tipo}`,
      tono: "sky",
    });
  }

  // Depósito
  if (deposito?.hay_deposito) {
    out.push({
      key: deposito.validado ? "deposito:validado" : "deposito:recibido",
      label: deposito.validado ? "Depósito validado" : "Depósito recibido",
      tono: "verde",
    });
  } else if (estado?.intencion_compra_detectada) {
    out.push({
      key: "deposito:pendiente",
      label: "Depósito pendiente",
      tono: "ambar",
    });
  }

  // Handoff
  if (estado?.requiere_handoff) {
    out.push({ key: "handoff", label: "Necesita asesora", tono: "ambar" });
  }

  // Objeción detectada
  if (estado?.objecion_detectada) {
    out.push({
      key: `objecion:${estado.objecion_detectada}`,
      label: `Objeción: ${estado.objecion_detectada}`,
      tono: "rojo",
    });
  }

  return out;
}

// Combina derivadas + manuales (de la columna etiquetas).
// Las manuales se rotulan con tono lila por default y key con prefijo `manual:`.
export function etiquetasParaUI(
  lead: LeadParaTags,
  estado: EstadoParaTags,
  deposito: DepositoInfo | null = null,
): Etiqueta[] {
  const derivadas = etiquetasDerivadas(lead, estado, deposito);
  const manuales: Etiqueta[] = (lead.etiquetas ?? [])
    .filter((t) => !t.startsWith("handoff:")) // handoff lo cubre derivadas
    .map((t) => {
      if (t === "test") return { key: "test", label: "Prueba", tono: "ambar" as const };
      if (t === "admin:libia")
        return { key: "admin:libia", label: "Libia (CEO)", tono: "lila" as const };
      return { key: `manual:${t}`, label: t, tono: "neutral" as const };
    });
  return [...derivadas, ...manuales];
}
