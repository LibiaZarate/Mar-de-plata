-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN A SUPABASE NUEVO · Paso 1 de 2
-- Schema completo del sistema Sirena (Mar de Plata Taxco)
--
-- CÓMO USARLO: copia TODO este archivo y pégalo en el SQL Editor
-- del proyecto Supabase NUEVO (el de Mar). Ejecútalo una vez.
-- Es idempotente: correrlo dos veces no rompe nada.
--
-- Después de esto, corre el paso 2 (02_exportar_datos.sql) en el
-- Supabase ORIGINAL para traer la configuración y el catálogo.
--
-- Fuente: CLAUDE.md §6-7 + migraciones de scripts/sql/ + columnas
-- requeridas por el código (src/lib/seguimientos/executor.ts).
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Tablas base (orden respeta las foreign keys) ───────────

CREATE TABLE IF NOT EXISTS config_sistema (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descripcion TEXT,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asesoras (
  id TEXT PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  whatsapp_personal TEXT,
  activa BOOLEAN DEFAULT TRUE,
  en_onboarding BOOLEAN DEFAULT FALSE,
  horario_inicio TIME DEFAULT '10:00',
  horario_fin TIME DEFAULT '18:00',
  dias_laborales INTEGER[] DEFAULT '{1,2,3,4,5}',
  conversaciones_abiertas INTEGER DEFAULT 0,
  conversaciones_dia INTEGER DEFAULT 0,
  ultima_asignacion TIMESTAMPTZ
);

-- leads · valores esperados:
--   tipo: mayoreo | menudeo
--   estado: lead_nueva | calificada | esperando_pago | pagada | perdida
-- (sin CHECK para no rechazar datos históricos al importarlos)
CREATE TABLE IF NOT EXISTS leads (
  numero_whatsapp TEXT PRIMARY KEY,
  nombre TEXT,
  ciudad TEXT,
  estado_geografico TEXT,
  pais TEXT DEFAULT 'MX',
  tipo TEXT,
  estado TEXT DEFAULT 'lead_nueva',
  canal_origen TEXT,
  anuncio_id TEXT,
  asesora_asignada TEXT REFERENCES asesoras(id),
  grupo_asignado TEXT DEFAULT 'ninguno',
  fecha_asignacion TIMESTAMPTZ,
  ticket_promedio NUMERIC DEFAULT 0,
  compras_totales INTEGER DEFAULT 0,
  monto_acumulado NUMERIC DEFAULT 0,
  fecha_primera_compra TIMESTAMPTZ,
  fecha_ultima_compra TIMESTAMPTZ,
  colecciones_favoritas TEXT[] DEFAULT '{}',
  primer_contacto TIMESTAMPTZ DEFAULT NOW(),
  ultima_interaccion TIMESTAMPTZ DEFAULT NOW(),
  etiquetas TEXT[] DEFAULT '{}',
  reclamos_historicos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- trazabilidad (migración junio 2026)
  fecha_entrada_etapa TIMESTAMPTZ DEFAULT NOW(),
  ultimo_envio TEXT,
  ultimo_envio_en TIMESTAMPTZ,
  es_revendedora BOOLEAN DEFAULT FALSE,
  detectada_revendedora_en TIMESTAMPTZ,
  tiempo_primera_respuesta_ms INTEGER
);

COMMENT ON COLUMN leads.ultimo_envio IS
  'Última cosa que Sirena le mandó: catalogo|grupos|menudeo|live|visita|seguimiento|handoff|texto_simple';
COMMENT ON COLUMN leads.tiempo_primera_respuesta_ms IS
  'Milisegundos entre primer mensaje entrante y primer mensaje saliente';

CREATE TABLE IF NOT EXISTS estado_conversacion_actual (
  numero_whatsapp TEXT PRIMARY KEY REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  rama_activa TEXT,
  paso_actual TEXT,
  ultimo_tool_ejecutado TEXT,
  ultimo_timestamp TIMESTAMPTZ DEFAULT NOW(),
  catalogo_enviado BOOLEAN DEFAULT FALSE,
  catalogo_tipo TEXT,
  politicas_enviadas BOOLEAN DEFAULT FALSE,
  grupo_invitado BOOLEAN DEFAULT FALSE,
  faqs_respondidas INTEGER[] DEFAULT '{}',
  turnos_acumulados INTEGER DEFAULT 0,
  inicio_conversacion TIMESTAMPTZ DEFAULT NOW(),
  intencion_compra_detectada BOOLEAN DEFAULT FALSE,
  objecion_detectada TEXT,
  requiere_handoff BOOLEAN DEFAULT FALSE,
  prioridad_handoff TEXT DEFAULT 'normal',
  conversacion_cerrada BOOLEAN DEFAULT FALSE,
  motivo_cierre TEXT,
  -- última respuesta · qué quiere (migración junio 2026)
  ultima_intencion TEXT,
  ultima_objecion TEXT,
  ultima_senal_compra TEXT
    CHECK (ultima_senal_compra IS NULL OR ultima_senal_compra IN ('alta','media','baja','nula')),
  ultima_actualizacion_intencion TIMESTAMPTZ,
  CONSTRAINT estado_conversacion_actual_motivo_cierre_check
    CHECK (motivo_cierre IS NULL OR motivo_cierre IN (
      'precio','tiempo_envio','agotado','sin_respuesta','cambio_idea',
      'compro_otro_lado','fuera_de_alcance','reclamo_no_resuelto','otro'
    ))
);

CREATE TABLE IF NOT EXISTS conversaciones (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT NOT NULL REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
  texto TEXT,
  tipo_mensaje TEXT DEFAULT 'texto',
  media_url TEXT,
  intencion_detectada TEXT,
  confianza NUMERIC,
  rama_activada TEXT,
  tool_ejecutada TEXT,
  parametros_tool JSONB,
  status TEXT DEFAULT 'completado',
  duracion_ms INTEGER
);

CREATE TABLE IF NOT EXISTS alertas (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'handoff_normal','handoff_urgente','guardrail_critico',
    'reclamo','sin_respuesta_15min','sin_respuesta_2h'
  )),
  prioridad TEXT NOT NULL CHECK (prioridad IN ('baja','normal','alta','urgente')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  numero_whatsapp TEXT REFERENCES leads(numero_whatsapp) ON DELETE SET NULL,
  asesora_asignada_id TEXT REFERENCES asesoras(id),
  para_mar BOOLEAN DEFAULT FALSE,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa','vista','resuelta','archivada')),
  resuelta_en TIMESTAMPTZ,
  resuelta_por_id TEXT REFERENCES asesoras(id),
  notas_resolucion TEXT,
  contexto_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eventos_negocio (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT NOT NULL REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tipo_evento TEXT NOT NULL,
  detalle TEXT,
  contexto_turno_id BIGINT REFERENCES conversaciones(id),  -- NULL si no hay turno asociado
  revisado BOOLEAN DEFAULT FALSE,
  accion_tomada TEXT
);

CREATE TABLE IF NOT EXISTS eventos_live (
  id BIGSERIAL PRIMARY KEY,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  red_social TEXT NOT NULL CHECK (red_social IN ('facebook','instagram','tiktok')),
  link_evento TEXT,
  codigo_descuento TEXT,
  descripcion_promo TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_por_id TEXT REFERENCES asesoras(id)
);

-- IDs fijos del 1 al 26 — NO es BIGSERIAL a propósito
CREATE TABLE IF NOT EXISTS imagenes_faq (
  id INTEGER PRIMARY KEY,
  tag TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  url_publica TEXT,
  categoria TEXT,
  activa BOOLEAN DEFAULT TRUE,
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT
);

CREATE TABLE IF NOT EXISTS cierres_diarios (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT REFERENCES leads(numero_whatsapp) ON DELETE SET NULL,
  asesora_id TEXT REFERENCES asesoras(id),
  monto NUMERIC NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN (
    'mayoreo_catalogo','mayoreo_grupo','menudeo','live','presencial'
  )),
  notas TEXT,
  comprobante_url TEXT,
  fecha_cierre TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depositos_primera_vez (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  contexto TEXT NOT NULL CHECK (contexto IN ('live','grupo')),
  monto NUMERIC DEFAULT 300,
  comprobante_recibido_en TIMESTAMPTZ DEFAULT NOW(),
  asesora_validadora_id TEXT REFERENCES asesoras(id),
  validado BOOLEAN DEFAULT FALSE,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS seguimientos_programados (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT NOT NULL REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  ejecutar_en TIMESTAMPTZ NOT NULL,
  contexto JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- columnas que requiere src/lib/seguimientos/executor.ts
  ejecutado_en TIMESTAMPTZ,
  resultado TEXT,
  mensaje_enviado TEXT
);

ALTER TABLE seguimientos_programados
  DROP CONSTRAINT IF EXISTS seguimientos_programados_tipo_check;
ALTER TABLE seguimientos_programados
  ADD CONSTRAINT seguimientos_programados_tipo_check
  CHECK (tipo IN (
    'lead_frio_24h','lead_frio_3d','lead_frio_6d','lead_frio_10d',
    'post_compra_7d','post_compra_30d',
    'deposito_pendiente_24h','deposito_pendiente_48h',
    'reactivacion_30d','reactivacion_60d',
    'restock_revendedora','disponibilidad_aviso',
    'prueba_simulador','texto_libre_manual'
  ));

-- Memoria conversacional (formato LangChain/n8n)
CREATE TABLE IF NOT EXISTS chat_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kaizen, pausado — la app no la usa hoy
CREATE TABLE IF NOT EXISTS faqs_candidatas (
  id BIGSERIAL PRIMARY KEY,
  pregunta TEXT NOT NULL,
  veces_detectada INTEGER DEFAULT 1,
  ultima_deteccion TIMESTAMPTZ DEFAULT NOW(),
  respuesta_sugerida TEXT,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Máquina de secuencias (scripts/sql/setup_trazabilidad) ──

CREATE TABLE IF NOT EXISTS secuencias_seguimiento (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT NOT NULL REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  tipo_secuencia TEXT NOT NULL CHECK (tipo_secuencia IN (
    'lead_frio','deposito_pendiente','post_pedido','reactivacion','restock_revendedora'
  )),
  paso_actual INTEGER NOT NULL DEFAULT 0,
  siguiente_disparo TIMESTAMPTZ,
  pausada BOOLEAN DEFAULT FALSE,
  cancelada_por TEXT,
  cancelada_en TIMESTAMPTZ,
  contexto_inicial JSONB DEFAULT '{}',
  iniciada_en TIMESTAMPTZ DEFAULT NOW(),
  finalizada_en TIMESTAMPTZ,
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secuencia_pasos_ejecutados (
  id BIGSERIAL PRIMARY KEY,
  secuencia_id BIGINT NOT NULL REFERENCES secuencias_seguimiento(id) ON DELETE CASCADE,
  paso INTEGER NOT NULL,
  ejecutado_en TIMESTAMPTZ DEFAULT NOW(),
  texto_enviado TEXT,
  resultado TEXT,
  trajo_respuesta BOOLEAN DEFAULT FALSE,
  trajo_pedido BOOLEAN DEFAULT FALSE
);

-- ─── 3. Log de webhooks (scripts/sql/setup_webhook_log) ─────────

CREATE TABLE IF NOT EXISTS webhook_log (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  duration_ms INTEGER,
  numero_whatsapp TEXT,
  subscriber_id TEXT,
  tipo_mensaje TEXT,
  texto_corto TEXT,
  guardrail_hit BOOLEAN DEFAULT FALSE,
  tool_ejecutada TEXT,
  flow_ok BOOLEAN,
  flow_error TEXT,
  raw_body JSONB NOT NULL,
  headers JSONB,
  cleaned JSONB,
  flow_resumen JSONB
);

-- ─── 4. Índices ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversaciones_numero
  ON conversaciones (numero_whatsapp, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_estado
  ON alertas (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_negocio_numero
  ON eventos_negocio (numero_whatsapp, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_live_activo
  ON eventos_live (activo, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_cierres_fecha
  ON cierres_diarios (fecha_cierre DESC);
CREATE INDEX IF NOT EXISTS idx_leads_estado
  ON leads (estado, ultima_interaccion DESC);
CREATE INDEX IF NOT EXISTS idx_chat_memory_session
  ON chat_memory (session_id, id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_pendientes
  ON seguimientos_programados (ejecutar_en)
  WHERE ejecutado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_secuencias_siguiente
  ON secuencias_seguimiento (siguiente_disparo)
  WHERE pausada = FALSE AND cancelada_por IS NULL AND finalizada_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_secuencias_numero
  ON secuencias_seguimiento (numero_whatsapp);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_secuencia_activa
  ON secuencias_seguimiento (numero_whatsapp, tipo_secuencia)
  WHERE pausada = FALSE AND cancelada_por IS NULL AND finalizada_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_pasos_secuencia
  ON secuencia_pasos_ejecutados (secuencia_id, paso);
CREATE INDEX IF NOT EXISTS idx_webhook_log_received_at
  ON webhook_log (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_numero
  ON webhook_log (numero_whatsapp, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_tool
  ON webhook_log (tool_ejecutada, received_at DESC);

-- ─── 5. Funciones y triggers ────────────────────────────────────

-- updated_at genérico (leads)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- updated_at de alertas
CREATE OR REPLACE FUNCTION update_alertas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alertas_updated_at ON alertas;
CREATE TRIGGER trg_alertas_updated_at
  BEFORE UPDATE ON alertas
  FOR EACH ROW EXECUTE FUNCTION update_alertas_timestamp();

-- Al crear un lead, crear su fila de estado (NO hacer INSERT manual)
CREATE OR REPLACE FUNCTION crear_estado_conversacion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO estado_conversacion_actual (numero_whatsapp)
  VALUES (NEW.numero_whatsapp)
  ON CONFLICT (numero_whatsapp) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crear_estado_conversacion ON leads;
CREATE TRIGGER trg_crear_estado_conversacion
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION crear_estado_conversacion();

-- Al insertar mensaje, refrescar ultima_interaccion (NO hacer UPDATE manual)
CREATE OR REPLACE FUNCTION actualizar_ultima_interaccion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET ultima_interaccion = COALESCE(NEW.timestamp, NOW())
  WHERE numero_whatsapp = NEW.numero_whatsapp;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_ultima_interaccion ON conversaciones;
CREATE TRIGGER trg_actualizar_ultima_interaccion
  AFTER INSERT ON conversaciones
  FOR EACH ROW EXECUTE FUNCTION actualizar_ultima_interaccion();

-- Cuándo entró el lead a su etapa actual (trazabilidad)
CREATE OR REPLACE FUNCTION actualizar_fecha_entrada_etapa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.fecha_entrada_etapa := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fecha_entrada_etapa ON leads;
CREATE TRIGGER trg_fecha_entrada_etapa
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_entrada_etapa();

-- Limpieza semanal de conversaciones >48h sin actividad
-- Cron: SELECT resetear_conversaciones_inactivas();
CREATE OR REPLACE FUNCTION resetear_conversaciones_inactivas()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH actualizadas AS (
    UPDATE estado_conversacion_actual
    SET rama_activa = NULL,
        paso_actual = NULL,
        ultimo_tool_ejecutado = NULL,
        turnos_acumulados = 0,
        requiere_handoff = FALSE,
        prioridad_handoff = 'normal',
        conversacion_cerrada = TRUE,
        motivo_cierre = COALESCE(motivo_cierre, 'sin_respuesta'),
        ultimo_timestamp = NOW()
    WHERE conversacion_cerrada = FALSE
      AND ultimo_timestamp < NOW() - INTERVAL '48 hours'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM actualizadas;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Contexto completo del lead en una sola query (la usa el flujo madre
-- vía supabase.rpc). Contrato documentado en CLAUDE.md §7.
-- NOTA: el paso 2 incluye una query opcional para traer la versión
-- EXACTA de producción; si la corres, sobreescribe esta sin problema.
CREATE OR REPLACE FUNCTION obtener_contexto_lead(p_numero TEXT)
RETURNS JSONB AS $$
DECLARE
  v_lead JSONB;
  v_estado JSONB;
  v_mensajes JSONB;
  v_eventos JSONB;
  v_seguimientos JSONB;
  v_ultima TIMESTAMPTZ;
  v_hora_mx TIMESTAMP := NOW() AT TIME ZONE 'America/Mexico_City';
BEGIN
  SELECT to_jsonb(l), l.ultima_interaccion
  INTO v_lead, v_ultima
  FROM leads l WHERE l.numero_whatsapp = p_numero;

  SELECT to_jsonb(e) INTO v_estado
  FROM estado_conversacion_actual e WHERE e.numero_whatsapp = p_numero;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.timestamp ASC), '[]'::jsonb)
  INTO v_mensajes
  FROM (
    SELECT direccion, texto, tipo_mensaje, timestamp, tool_ejecutada
    FROM conversaciones
    WHERE numero_whatsapp = p_numero
    ORDER BY timestamp DESC
    LIMIT 5
  ) m;

  SELECT COALESCE(jsonb_agg(to_jsonb(ev) ORDER BY ev.timestamp DESC), '[]'::jsonb)
  INTO v_eventos
  FROM (
    SELECT tipo_evento, detalle, timestamp, revisado
    FROM eventos_negocio
    WHERE numero_whatsapp = p_numero
    ORDER BY timestamp DESC
    LIMIT 10
  ) ev;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.ejecutar_en ASC), '[]'::jsonb)
  INTO v_seguimientos
  FROM (
    SELECT id, tipo, ejecutar_en, contexto
    FROM seguimientos_programados
    WHERE numero_whatsapp = p_numero AND ejecutado_en IS NULL
    ORDER BY ejecutar_en ASC
  ) s;

  RETURN jsonb_build_object(
    'lead', v_lead,
    'estado_actual', v_estado,
    'ultimos_mensajes', v_mensajes,
    'eventos_recientes', v_eventos,
    'seguimientos_pendientes', v_seguimientos,
    'metadata', jsonb_build_object(
      'hora_actual', to_char(v_hora_mx, 'YYYY-MM-DD HH24:MI'),
      'es_horario_habil',
        EXTRACT(ISODOW FROM v_hora_mx) BETWEEN 1 AND 5
        AND EXTRACT(HOUR FROM v_hora_mx) >= 10
        AND EXTRACT(HOUR FROM v_hora_mx) < 18,
      'dias_desde_ultima_interaccion',
        COALESCE(EXTRACT(DAY FROM NOW() - v_ultima)::INTEGER, 0)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 6. Configuración del sistema (semillas) ────────────────────
-- ON CONFLICT DO NOTHING: si el paso 2 ya cargó los valores reales,
-- esto no los pisa. Los marcados PENDIENTE_CONFIGURAR deben llenarse.

INSERT INTO config_sistema (clave, valor, descripcion) VALUES
  ('link_grupo_abierto', 'https://chat.whatsapp.com/DtpuIyQljqhLu0B7pwnZkB?mode=ac_t', 'Link del grupo abierto de mayoreo'),
  ('catalogo_pandora_url', 'https://www.canva.com/design/DAGgun-_kzE/isvBbeVkT0S448hgiqV3YA/view', '[DEPRECADO junio 2026] Catálogo único ahora vive en catalogo_taxco_url'),
  ('catalogo_taxco_url', 'https://mardeplatataxco.my.canva.site/', 'Catálogo único de mayoreo (Pandora y TOWS están incluidos dentro)'),
  ('catalogo_tows_url', 'https://mardeplatataxco.my.canva.site/tows', '[DEPRECADO junio 2026] Catálogo único ahora vive en catalogo_taxco_url'),
  ('whatsapp_mar_personal', 'PENDIENTE_CONFIGURAR', 'WhatsApp personal de Mar para alertas'),
  ('subscriber_id_mar', 'PENDIENTE_CONFIGURAR', 'Subscriber ID de Mar en ManyChat'),
  ('monto_deposito_primera_vez', '300', 'Depósito primera vez para apartar en live/grupo (MXN)'),
  ('monto_minimo_mayoreo', '1500', 'Mínimo de compra mayoreo por catálogo (MXN)')
ON CONFLICT (clave) DO NOTHING;

-- ─── Verificación final ─────────────────────────────────────────

SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns c
        WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'leads','conversaciones','estado_conversacion_actual','asesoras',
    'alertas','eventos_negocio','eventos_live','imagenes_faq',
    'cierres_diarios','depositos_primera_vez','config_sistema',
    'seguimientos_programados','secuencias_seguimiento',
    'secuencia_pasos_ejecutados','webhook_log','chat_memory','faqs_candidatas'
  )
ORDER BY table_name;
