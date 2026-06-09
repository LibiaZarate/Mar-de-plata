-- Migración grande de trazabilidad + máquina de secuencias.
-- Corre esto UNA VEZ en Supabase. Es idempotente — puedes correrlo
-- varias veces sin romper nada.

-- ─── 1. Trazabilidad de la etapa comercial ─────────────────

-- Cuándo entró el lead a su etapa actual
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS fecha_entrada_etapa TIMESTAMPTZ DEFAULT NOW();

-- Trigger que actualiza fecha_entrada_etapa cada vez que cambia estado
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

-- ─── 2. Último envío estructurado ──────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS ultimo_envio TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_envio_en TIMESTAMPTZ;

COMMENT ON COLUMN leads.ultimo_envio IS
  'Última cosa que Sirena le mandó: catalogo|grupos|menudeo|live|visita|seguimiento|handoff|texto_simple';

-- ─── 3. Última respuesta · qué quiere ──────────────────────

ALTER TABLE estado_conversacion_actual
  ADD COLUMN IF NOT EXISTS ultima_intencion TEXT,
  ADD COLUMN IF NOT EXISTS ultima_objecion TEXT,
  ADD COLUMN IF NOT EXISTS ultima_senal_compra TEXT
    CHECK (ultima_senal_compra IS NULL OR ultima_senal_compra IN ('alta','media','baja','nula')),
  ADD COLUMN IF NOT EXISTS ultima_actualizacion_intencion TIMESTAMPTZ;

-- ─── 4. Es revendedora ─────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS es_revendedora BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS detectada_revendedora_en TIMESTAMPTZ;

-- ─── 5. Motivos de pérdida con enum ────────────────────────

-- Dropear el campo viejo de texto libre si tiene CHECK, recrear con enum
ALTER TABLE estado_conversacion_actual
  DROP CONSTRAINT IF EXISTS estado_conversacion_actual_motivo_cierre_check;

ALTER TABLE estado_conversacion_actual
  ADD CONSTRAINT estado_conversacion_actual_motivo_cierre_check
  CHECK (motivo_cierre IS NULL OR motivo_cierre IN (
    'precio',
    'tiempo_envio',
    'agotado',
    'sin_respuesta',
    'cambio_idea',
    'compro_otro_lado',
    'fuera_de_alcance',
    'reclamo_no_resuelto',
    'otro'
  ));

-- ─── 6. Tiempo primera respuesta (para la métrica 07) ──────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tiempo_primera_respuesta_ms INTEGER;
COMMENT ON COLUMN leads.tiempo_primera_respuesta_ms IS
  'Milisegundos entre primer mensaje entrante y primer mensaje saliente';

-- ─── 7. Máquina de secuencias de seguimiento ───────────────

CREATE TABLE IF NOT EXISTS secuencias_seguimiento (
  id BIGSERIAL PRIMARY KEY,
  numero_whatsapp TEXT NOT NULL REFERENCES leads(numero_whatsapp) ON DELETE CASCADE,
  tipo_secuencia TEXT NOT NULL CHECK (tipo_secuencia IN (
    'lead_frio',
    'deposito_pendiente',
    'post_pedido',
    'reactivacion',
    'restock_revendedora'
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

CREATE INDEX IF NOT EXISTS idx_secuencias_siguiente
  ON secuencias_seguimiento (siguiente_disparo)
  WHERE pausada = FALSE AND cancelada_por IS NULL AND finalizada_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_secuencias_numero
  ON secuencias_seguimiento (numero_whatsapp);

-- Constraint: un solo lead, un solo tipo de secuencia activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uniq_secuencia_activa
  ON secuencias_seguimiento (numero_whatsapp, tipo_secuencia)
  WHERE pausada = FALSE AND cancelada_por IS NULL AND finalizada_en IS NULL;

-- ─── 8. Registro de pasos de la cadencia (auditoría) ───────

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

CREATE INDEX IF NOT EXISTS idx_pasos_secuencia
  ON secuencia_pasos_ejecutados (secuencia_id, paso);

-- ─── Verificación ──────────────────────────────────────────

SELECT
  'leads.fecha_entrada_etapa' AS columna,
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name='leads' AND column_name='fecha_entrada_etapa'
  ) AS existe
UNION ALL SELECT 'leads.ultimo_envio',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ultimo_envio')
UNION ALL SELECT 'leads.es_revendedora',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='es_revendedora')
UNION ALL SELECT 'estado_conversacion_actual.ultima_intencion',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='estado_conversacion_actual' AND column_name='ultima_intencion')
UNION ALL SELECT 'secuencias_seguimiento (tabla)',
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='secuencias_seguimiento')
UNION ALL SELECT 'secuencia_pasos_ejecutados (tabla)',
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='secuencia_pasos_ejecutados');
