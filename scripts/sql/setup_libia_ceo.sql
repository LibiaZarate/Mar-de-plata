-- Registra a Libia (CEO) como número de prueba oficial.
-- Corre esto UNA VEZ en el SQL editor de Supabase.
--
-- Nota sobre el número: WhatsApp México acepta dos formatos para el
-- mismo celular: con el 1 (52 1 668...) o sin el 1 (52 668...).
-- ManyChat los trata como contactos distintos. El número que de hecho
-- usa Libia en su WhatsApp es el corto: 526682322911.
-- Este script registra el corto como principal y deja el largo
-- también marcado como test por si en algún momento llega tráfico
-- desde el otro formato (así no contamina métricas).

-- 1. Si quedó la fila vieja del setup previo con el formato largo,
--    la marcamos como test pero no la borramos (puede tener historial)
UPDATE leads
SET nombre = 'Libia (CEO) — formato largo',
    etiquetas = (
      SELECT ARRAY(SELECT DISTINCT UNNEST(
        COALESCE(etiquetas, '{}'::text[]) || ARRAY['test', 'admin:libia']
      ))
    )
WHERE numero_whatsapp = '5216682322911';

-- 2. Upsert del número real (formato corto)
INSERT INTO leads (
  numero_whatsapp,
  nombre,
  pais,
  tipo,
  estado,
  canal_origen,
  etiquetas,
  ciudad
) VALUES (
  '526682322911',
  'Libia (CEO)',
  'MX',
  'mayoreo',
  'lead_nueva',
  NULL,
  ARRAY['test', 'admin:libia'],
  'CDMX'
)
ON CONFLICT (numero_whatsapp) DO UPDATE
SET nombre    = 'Libia (CEO)',
    ciudad    = COALESCE(leads.ciudad, 'CDMX'),
    etiquetas = (
      SELECT ARRAY(SELECT DISTINCT UNNEST(
        COALESCE(leads.etiquetas, '{}'::text[]) || ARRAY['test', 'admin:libia']
      ))
    );

-- 2b. Force-set del nombre si la fila ya existía sin él (por si el
-- webhook la creó antes de la captura automática)
UPDATE leads
SET nombre = 'Libia (CEO)'
WHERE numero_whatsapp IN ('526682322911', '5216682322911')
  AND (nombre IS NULL OR nombre = '' OR nombre LIKE 'Sin nombre%');

-- 3. Verificación
SELECT numero_whatsapp, nombre, etiquetas, estado, tipo
FROM leads
WHERE numero_whatsapp IN ('526682322911', '5216682322911');

-- 4. Ver si ya hay subscriber_id capturado para alguno
SELECT clave, valor
FROM config_sistema
WHERE clave IN ('subscriber_526682322911', 'subscriber_5216682322911');
