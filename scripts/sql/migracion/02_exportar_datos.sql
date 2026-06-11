-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN A SUPABASE NUEVO · Paso 2 de 2
-- Exportar configuración y catálogo desde el Supabase ORIGINAL
--
-- CÓMO USARLO:
--   1. Pega y ejecuta la QUERY A en el SQL Editor del Supabase
--      ORIGINAL (el de Libia). El resultado es una columna llamada
--      "sql": cada fila es un INSERT listo.
--   2. Copia TODAS las filas del resultado (selecciónalas en la
--      tabla de resultados y copia, o descarga el CSV y abre el
--      contenido).
--   3. Pégalas en el SQL Editor del Supabase NUEVO (el de Mar) y
--      ejecuta.
--
-- Exporta: config_sistema (links, montos, subscriber_ids),
-- imagenes_faq (las 26 imágenes) y asesoras (Eli, Nat, etc.).
-- NO exporta leads ni conversaciones (datos de prueba).
-- ════════════════════════════════════════════════════════════════

-- ─── QUERY A · genera los INSERTs de datos ──────────────────────

WITH piezas AS (

  -- config_sistema (todas las claves, incluidos los subscriber_*)
  SELECT 1 AS orden, clave AS k,
    'INSERT INTO config_sistema (clave, valor, descripcion) VALUES ('
      || quote_literal(clave) || ', '
      || quote_literal(valor) || ', '
      || quote_nullable(descripcion)
      || ') ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion, actualizado_en = NOW();'
    AS sql
  FROM config_sistema

  UNION ALL

  -- imagenes_faq (IDs fijos 1-26)
  SELECT 2, lpad(id::text, 3, '0'),
    'INSERT INTO imagenes_faq (id, tag, descripcion, url_publica, categoria, activa, notas) VALUES ('
      || id || ', '
      || quote_literal(tag) || ', '
      || quote_literal(descripcion) || ', '
      || quote_nullable(url_publica) || ', '
      || quote_nullable(categoria) || ', '
      || activa || ', '
      || quote_nullable(notas)
      || ') ON CONFLICT (id) DO UPDATE SET tag = EXCLUDED.tag, descripcion = EXCLUDED.descripcion, url_publica = EXCLUDED.url_publica, categoria = EXCLUDED.categoria, activa = EXCLUDED.activa, notas = EXCLUDED.notas;'
  FROM imagenes_faq

  UNION ALL

  -- asesoras (sin contadores de carga: arrancan en 0 en el proyecto nuevo)
  SELECT 3, id,
    'INSERT INTO asesoras (id, nombre_completo, whatsapp_personal, activa, en_onboarding, horario_inicio, horario_fin, dias_laborales) VALUES ('
      || quote_literal(id) || ', '
      || quote_literal(nombre_completo) || ', '
      || quote_nullable(whatsapp_personal) || ', '
      || activa || ', '
      || en_onboarding || ', '
      || quote_literal(horario_inicio::text) || '::time, '
      || quote_literal(horario_fin::text) || '::time, '
      || quote_literal(dias_laborales::text) || '::integer[]'
      || ') ON CONFLICT (id) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo, whatsapp_personal = EXCLUDED.whatsapp_personal, activa = EXCLUDED.activa, en_onboarding = EXCLUDED.en_onboarding, horario_inicio = EXCLUDED.horario_inicio, horario_fin = EXCLUDED.horario_fin, dias_laborales = EXCLUDED.dias_laborales;'
  FROM asesoras

)
SELECT sql FROM piezas ORDER BY orden, k;


-- ─── QUERY B (OPCIONAL) · funciones exactas de producción ───────
-- El paso 1 ya crea las funciones según el contrato documentado,
-- pero si quieres llevarte la versión EXACTA que corre hoy en el
-- Supabase original (p. ej. obtener_contexto_lead), ejecuta esto
-- por separado en el Supabase ORIGINAL, copia el resultado y
-- pégalo/ejecuta en el NUEVO. Sobreescribe sin problema.
--
-- SELECT pg_get_functiondef(p.oid) || ';' AS sql
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
--   AND p.proname IN (
--     'obtener_contexto_lead',
--     'resetear_conversaciones_inactivas',
--     'crear_estado_conversacion',
--     'actualizar_ultima_interaccion',
--     'actualizar_fecha_entrada_etapa',
--     'update_updated_at_column',
--     'update_alertas_timestamp'
--   );
