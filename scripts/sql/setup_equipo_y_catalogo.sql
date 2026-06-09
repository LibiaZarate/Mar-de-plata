-- Actualiza la información del equipo y los links oficiales con los
-- valores que confirmó Libia en junio 2026.
--
-- Cambios:
-- 1. Asesoras: Nat (whatsapp_personal=527626230460) y Eli (link wa.me)
-- 2. Catálogo único: deprecar las claves de pandora y tows
-- 3. Grupos: las 3 claves de mayoreo ya quedaron seteadas en el SQL anterior

-- ─── 1. ASESORAS ───────────────────────────────────────────

-- Verificación previa
SELECT id, nombre_completo, whatsapp_personal, activa, en_onboarding
FROM asesoras
ORDER BY nombre_completo;

-- Update Nat (busca por nombre que empiece con "Nat")
UPDATE asesoras
SET whatsapp_personal = '527626230460'
WHERE nombre_completo ILIKE 'nat%';

-- Update Eli (busca por nombre que empiece con "Eli")
-- Para Eli el contacto es un link wa.me/mardeplatataxco que es el
-- WhatsApp Business público, no un número personal. Lo guardamos como
-- string en whatsapp_personal y queda como link directo.
UPDATE asesoras
SET whatsapp_personal = 'https://wa.me/mardeplatataxco'
WHERE nombre_completo ILIKE 'eli%';

-- Si alguna de las dos no existía como fila, créala
INSERT INTO asesoras (id, nombre_completo, whatsapp_personal, activa, en_onboarding)
SELECT 'nat', 'Nat', '527626230460', true, false
WHERE NOT EXISTS (SELECT 1 FROM asesoras WHERE nombre_completo ILIKE 'nat%');

INSERT INTO asesoras (id, nombre_completo, whatsapp_personal, activa, en_onboarding)
SELECT 'eli', 'Eli', 'https://wa.me/mardeplatataxco', true, false
WHERE NOT EXISTS (SELECT 1 FROM asesoras WHERE nombre_completo ILIKE 'eli%');

-- Verificación posterior
SELECT id, nombre_completo, whatsapp_personal, activa
FROM asesoras
ORDER BY nombre_completo;

-- ─── 2. CATÁLOGO ÚNICO ─────────────────────────────────────

-- Asegurar la URL del catálogo único (idempotente)
INSERT INTO config_sistema (clave, valor, descripcion) VALUES
  ('catalogo_taxco_url', 'https://mardeplatataxco.my.canva.site/', 'Catálogo único de mayoreo (Pandora y TOWS están incluidos dentro)')
ON CONFLICT (clave) DO UPDATE SET
  valor = EXCLUDED.valor,
  descripcion = EXCLUDED.descripcion,
  actualizado_en = NOW();

-- Marcar las claves viejas como deprecadas (no las borra, por si hay
-- referencias o historia que revisar). Si quieres limpiarlas borralas
-- después manualmente.
UPDATE config_sistema
SET descripcion = '[DEPRECADO junio 2026] Catálogo único ahora vive en catalogo_taxco_url. Esta clave ya no se usa.'
WHERE clave IN ('catalogo_pandora_url', 'catalogo_tows_url', 'catalogo_pandora_sin_precios_url');

-- Verificación
SELECT clave, valor, descripcion FROM config_sistema
WHERE clave LIKE 'catalogo_%'
ORDER BY clave;
