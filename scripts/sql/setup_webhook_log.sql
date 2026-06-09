-- Tabla para persistir el body completo de cada webhook entrante.
-- Hoy el log vive en memoria del proceso de Vercel y se pierde con
-- cada recycle. Cuando sacamos a producción necesitamos poder
-- inspeccionar exactamente qué campos manda ManyChat (referral,
-- ctwa_clid, ad_id, campaign_id, name, etc.) para decidir si la
-- atribución llega automática o no.

CREATE TABLE IF NOT EXISTS webhook_log (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,                  -- 'manychat' | 'kaizen'
  duration_ms INTEGER,
  numero_whatsapp TEXT,                  -- desnormalizado para filtrar
  subscriber_id TEXT,
  tipo_mensaje TEXT,
  texto_corto TEXT,                      -- primeros 200 chars del userText
  guardrail_hit BOOLEAN DEFAULT FALSE,
  tool_ejecutada TEXT,
  flow_ok BOOLEAN,
  flow_error TEXT,
  raw_body JSONB NOT NULL,               -- lo que mandó ManyChat tal cual
  headers JSONB,
  cleaned JSONB,                         -- el resultado de cleanManychatBody
  flow_resumen JSONB                     -- resultado del flow (verificador, tool, etc.)
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_received_at
  ON webhook_log (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_log_numero
  ON webhook_log (numero_whatsapp, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_log_tool
  ON webhook_log (tool_ejecutada, received_at DESC);

-- Verificación
SELECT COUNT(*) AS filas FROM webhook_log;
