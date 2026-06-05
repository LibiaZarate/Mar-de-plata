-- Registra a Libia (CEO) como número de prueba oficial.
-- Corre esto UNA VEZ en el SQL editor de Supabase.
--
-- Efectos:
-- 1. Crea/actualiza la fila en `leads` con número +5216682322911 marcada
--    como 'test' + 'admin:libia'.
-- 2. El trigger crear_estado_conversacion poblará estado_conversacion_actual.
-- 3. A partir de ahí, todas las queries del dashboard filtran este número:
--    pipeline, KPIs, embudo, alertas, cola de equipo.
-- 4. La UI de /configuracion/seguimientos la ve como "Libia (CEO)" en el
--    selector del sandbox para mandar pruebas.

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
  '5216682322911',
  'Libia (CEO)',
  'MX',
  'mayoreo',
  'lead_nueva',
  'whatsapp_directo',
  ARRAY['test', 'admin:libia'],
  'CDMX'
)
ON CONFLICT (numero_whatsapp) DO UPDATE
SET nombre    = 'Libia (CEO)',
    etiquetas = (
      SELECT ARRAY(SELECT DISTINCT UNNEST(
        COALESCE(leads.etiquetas, '{}'::text[]) || ARRAY['test', 'admin:libia']
      ))
    );

-- Verificación
SELECT numero_whatsapp, nombre, etiquetas, estado, tipo
FROM leads
WHERE numero_whatsapp = '5216682322911';
