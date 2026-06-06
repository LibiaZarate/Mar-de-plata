-- Programa dos seguimientos de prueba para Libia (CEO).
-- Corre esto UNA VEZ en el SQL editor de Supabase después de
-- haber corrido setup_libia_ceo.sql y haberle mandado un "hola" al
-- bot para que se capture el subscriber_id.
--
-- El cron de seguimientos corre cada 15 min, así que el de "+10 min"
-- puede tardar hasta 20 min en dispararse en la práctica.

-- 1. Seguimiento de prueba en 10 minutos (descartable)
INSERT INTO seguimientos_programados (
  numero_whatsapp, tipo, ejecutar_en, contexto
) VALUES (
  '526682322911',
  'prueba_simulador',
  NOW() + INTERVAL '10 minutes',
  jsonb_build_object(
    'contexto_adicional', 'Test 10 min para validar cron y ManyChat',
    'programado_desde', 'seed_sql',
    'minutos_offset', 10
  )
);

-- 2. Seguimiento de prueba en 2 horas (este queda)
INSERT INTO seguimientos_programados (
  numero_whatsapp, tipo, ejecutar_en, contexto
) VALUES (
  '526682322911',
  'lead_frio_24h',
  NOW() + INTERVAL '2 hours',
  jsonb_build_object(
    'contexto_adicional', 'Test 2h con plantilla de lead frío',
    'programado_desde', 'seed_sql',
    'minutos_offset', 120
  )
);

-- Verificación
SELECT id, tipo, ejecutar_en, ejecutado_en, contexto->>'minutos_offset' AS offset_min
FROM seguimientos_programados
WHERE numero_whatsapp = '526682322911'
ORDER BY ejecutar_en;
