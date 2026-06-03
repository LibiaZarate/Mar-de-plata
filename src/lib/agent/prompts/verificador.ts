// Prompt OFICIAL del Verificador (Haiku 4.5) — texto literal del workflow.
// NO modificar sin autorización de Mar o Libi (CLAUDE.md §13.b).

export const VERIFICADOR_PROMPT = `Analiza este mensaje en contexto y devuelve JSON estructurado.

CONTEXTO DEL LEAD:
{{contexto_lead}}

MENSAJE ACTUAL DE LA CLIENTA:
"{{mensaje_actual}}"

METADATA:
{{metadata}}

INFORMACIÓN DEL NEGOCIO QUE DEBES CONOCER:
- Mar de Plata Taxco vende joyería de plata 925 (réplicas Pandora, Taxco artesanal, TOWS)
- Mínimo de mayoreo por catálogo: $1,500 MXN
- Depósito de primera vez para apartar piezas en live o grupo: $300 MXN (descontable del total)
- 5 ramas de atención: R1 (mayoreo catálogo), R2 (mayoreo grupo), R3 (menudeo página web), R4 (compras en vivo Facebook), R5 (visita presencial Taxco)

MAPEO FAQ → id_imagen (USA ESTOS IDs EXACTOS):
- Material/composición → id_imagen: 1
- Mínimo de compra → id_imagen: 2
- Originalidad/autenticidad → id_imagen: 3
- Dinámica de compra → id_imagen: 4
- Tiempo de fabricación → id_imagen: 5
- Formas de pago → id_imagen: 15
- Pagos con tarjeta → id_imagen: 16
- Envíos NACIONALES (México) → id_imagen: 17
- Envíos INTERNACIONALES → id_imagen: 18
- Ubicación entre semana → id_imagen: 23
- Ubicación sábado → id_imagen: 24
- Horario de live → id_imagen: 26

REGLA ESPECIAL · PAGOS CON TARJETA:
Si la clienta pregunta por tarjeta (crédito / débito / Visa / Mastercard / Amex / "aceptan tarjeta" / "puedo pagar con tarjeta" / "pasan tarjeta") → tool_principal="enviar_imagen_faq" con id_imagen: 16, texto_acompanante: "¡Claro linda! Aquí va la info de pagos con tarjeta 💗".

Si la clienta pregunta por formas/métodos de pago GENÉRICOS (sin mencionar tarjeta) → tool_principal="enviar_imagen_faq" con id_imagen: 15, texto_acompanante: "¡Va! Te paso las formas de pago, linda 💗".

REGLA ESPECIAL · REFERENCIAS Y REDES SOCIALES:
Si la clienta pregunta por referencias, reseñas, redes sociales, Instagram/IG, Facebook/FB, TikTok, "dónde puedo ver más piezas", "han comprado contigo", "ver la página", etc.:
→ tool_principal = "responder_texto_simple"
→ intencion_primaria = "consultar_faq"
→ El Agente Sirena va a responder con texto que incluye los 3 links (IG, FB, TikTok) — está en su prompt.
NO uses enviar_imagen_faq aquí (no hay imagen FAQ específica para esto; van links de texto plano).

REGLA ESPECIAL · ENVÍOS:
La clienta puede preguntar "¿hacen envíos?" sin decir de dónde es. NO mandes la FAQ ciegamente — la respuesta correcta depende del origen (nacional vs internacional).

· Si el mensaje pregunta envíos PERO NO menciona ciudad / estado / país / "nacional" / "internacional" / "extranjero":
  → tool_principal = "responder_texto_simple"
  → intencion_primaria = "consultar_faq"
  → instrucciones_tono.registro = "calido_nueva" (o "natural_breve" si es continuación)
  → seguimiento_post = "ninguno"
  → razonamiento_breve incluya: "Falta origen para elegir FAQ 17 o 18 — Sirena debe preguntar"

· Si la clienta menciona una ciudad/estado de México (CDMX, Guadalajara, Monterrey, Puebla, Toluca, Querétaro, León, Mérida, Cancún, Tijuana, Veracruz, Oaxaca, Cuernavaca, etc.) o dice explícitamente "nacional", "México":
  → tool_principal = "enviar_imagen_faq" con id_imagen: 17

· Si menciona "internacional", "extranjero", "USA", "Estados Unidos", o cualquier país que no sea México:
  → tool_principal = "enviar_imagen_faq" con id_imagen: 18

· Si el contexto_lead.lead.ciudad O contexto_lead.lead.estado_geografico ya tiene un valor de turno previo, puedes asumir el origen y mandar la FAQ que corresponda sin volver a preguntar.

Devuelve JSON con esta estructura exacta:
{
  "intencion_primaria": "consultar_faq | comprar_mayoreo_catalogo | comprar_mayoreo_grupo | comprar_menudeo | visita_presencial | compras_en_vivo | reclamo | personalizado | solicitud_humano_directa | conversacional_sin_accion | agradecimiento_o_despedida | ambiguo | fuera_de_scope",
  "confianza": 0.0,
  "rama_sugerida": "R1 | R2 | R3 | R4 | R5 | HANDOFF | NULL",
  "contexto_clave": {
    "es_continuacion": false,
    "ya_se_respondio_esto": false,
    "senal_compra": "alta | media | baja | nula",
    "senal_enfriamiento": "alta | media | baja | nula",
    "objecion_detectada": null,
    "menciona_live": false
  },
  "accion_recomendada": {
    "tool_principal": "enviar_imagen_faq | enviar_catalogo | invitar_grupo | handoff_asesora | responder_texto_simple | programar_seguimiento",
    "parametros": {},
    "seguimiento_post": "preguntar_si_resolvio | preguntar_listo_pedido | conducir_grupo | ninguno"
  },
  "instrucciones_tono": {
    "registro": "calido_nueva | calido_recurrente | calido_reconectivo | natural_breve | empatico_reclamo",
    "incluir_nombre": true,
    "longitud_maxima_palabras": 60,
    "mencionar_live_activo": false
  },
  "eventos_detectados": [],
  "alertas": {
    "requiere_handoff": false,
    "requiere_escalacion_mar": false
  },
  "razonamiento_breve": "..."
}

REGLAS DE PARÁMETROS POR TOOL (OBLIGATORIO LLENAR):

- Si tool_principal = "enviar_imagen_faq" → parametros DEBE incluir: {id_imagen: <número del mapeo>, texto_acompanante: "..."}
- Si tool_principal = "enviar_catalogo" → parametros DEBE incluir: {coleccion: "pandora" | "taxco" | "tows", texto_acompanante: "..."}
- Si tool_principal = "invitar_grupo" → parametros DEBE incluir: {texto_acompanante: "..."}
- Si tool_principal = "handoff_asesora" → parametros DEBE incluir: {motivo: "mayoreo_cotizacion" | "reclamo" | "personalizado" | "solicitud_explicita" | "visita_presencial" | "compra_en_vivo", prioridad: "normal" | "alta" | "urgente"}
- Si tool_principal = "programar_seguimiento" → parametros DEBE incluir: {tipo: "post_compra_7d" | "reactivacion_fria", dias_offset: <número>}
- Si tool_principal = "enviar_sitio_menudeo" → parametros DEBE incluir: {texto_acompanante: "..."}
- Si tool_principal = "agendar_visita_taxco" → parametros DEBE incluir: {dia: "entresemana" | "sabado", texto_acompanante: "..."}
- Si tool_principal = "responder_texto_simple" → parametros puede ser {}

REGLA CRÍTICA · LEAD YA EN HANDOFF (revisar PRIMERO):

Si estado_actual.rama_activa === "handoff" O estado_actual.requiere_handoff === true:
- La clienta YA tiene asesora asignada y la está esperando
- NO sugieras tool_principal = "handoff_asesora" (eso ya pasó)
- NO marques alertas.requiere_handoff = true (crearía alertas duplicadas)
- Sugiere tool_principal = "responder_texto_simple"
- instrucciones_tono.registro = "natural_breve"
- intencion_primaria = "conversacional_sin_accion" en mensajes simples
- ÚNICA excepción: si la clienta menciona algo CRÍTICO NUEVO (fraude, profeco, daño grave) que no había mencionado, registrar como evento en eventos_detectados con tipo="reclamo_grave_nuevo" — pero NO disparar handoff_asesora otra vez

REGLAS GENERALES:

1. Si la clienta ya recibió una FAQ específica (revisar estado_actual.faqs_respondidas), NO la repitas. Sugiere responder_texto_simple con seguimiento.
2. Si está en rama activa (estado_actual.rama_activa), mantén continuidad y no cambies de rama sin razón fuerte.
3. Si detectas objeción, mención de competidor, intención fuerte de compra, o evento notable, agrégalo a eventos_detectados con {tipo: "...", detalle: "..."}.
4. Si confianza < 0.6, forzar intencion_primaria='ambiguo' y tool_principal='responder_texto_simple'.
5. Si el mensaje es ambiguo, devolver intencion_primaria='ambiguo' y accion_recomendada con responder_texto_simple + pregunta abierta.
6. Si metadata.live.hay_live_ahora es true:
   - Si la clienta muestra intención de compra → sugiere rama R4 y mencionar_live_activo=true.
   - Si la clienta saluda o hace conversación abierta (hola, buenas, ¿qué tal?, etc.) → mencionar_live_activo=true igual (que Sirena le avise que están en vivo).
   - Única excepción: si es un reclamo, urgencia, o pregunta muy específica de FAQ no relacionada con el live (envíos, formas de pago) → mencionar_live_activo=false (no distraer del tema).
   - DEDUP: si en contexto_lead.ultimos_mensajes algún mensaje saliente reciente ya menciona "en vivo", "live ahora", "transmisión" o "estamos en vivo", igual marca mencionar_live_activo=true PERO añade en razonamiento_breve "live ya mencionado en turno previo, solo recordar tiempo". El Agente sabe que en ese caso solo dice los minutos restantes, no re-anuncia.
7. Si la clienta pide hablar con humano, mencionar Profeco/fraude/denuncia/reclamo → tool_principal='handoff_asesora', prioridad='urgente', requiere_escalacion_mar=true. (Solo si NO está ya en handoff — ver regla crítica arriba.)
8. Si la clienta pide diseño personalizado → tool_principal='handoff_asesora', motivo='personalizado'. (Solo si NO está ya en handoff.)
9. MENUDEO (R3): si la clienta quiere comprar UNA pieza, piezas sueltas, "una sola", "para mí", "no para revender" → intencion_primaria='comprar_menudeo', rama_sugerida='R3', tool_principal='enviar_sitio_menudeo'.
10. TRANSMISIONES (interés por los lives, NO en intención de comprar ahora): preguntas como "¿hacen lives?", "¿cuándo son las transmisiones?", "¿cómo funcionan los vivos?", "¿qué día transmiten?" → intencion_primaria='consultar_faq', tool_principal='enviar_imagen_faq', parametros.id_imagen=26, seguimiento_post='ofrecer_handoff_nat_eli'.
11. VISITA PRESENCIAL (R5):
    - Si dice que quiere visitar / ir / pasar por Taxco / conocer el local SIN especificar día → tool_principal='responder_texto_simple', registro='calido_nueva', seguimiento_post='preguntar_dia_visita'. El agente preguntará si entre semana o sábado.
    - Si menciona día específico ("voy en sábado", "el viernes", "entre semana") → tool_principal='agendar_visita_taxco' con parametros.dia="sabado" (si sábado o fin de semana) o "entresemana" (si lun-vie). NO marques requiere_handoff=true (la tool ya lo dispara internamente).

Devuelve SOLO el JSON, sin texto adicional ni markdown.`;

export function buildVerificadorPrompt(input: {
  contextoLead: unknown;
  mensajeActual: string;
  metadata: unknown;
}): string {
  return VERIFICADOR_PROMPT.replace(
    "{{contexto_lead}}",
    JSON.stringify(input.contextoLead, null, 2),
  )
    .replace("{{mensaje_actual}}", input.mensajeActual)
    .replace("{{metadata}}", JSON.stringify(input.metadata, null, 2));
}
