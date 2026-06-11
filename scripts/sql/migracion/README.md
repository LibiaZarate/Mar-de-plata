# Migración a un Supabase nuevo (proyecto de Mar)

Todo se hace copiando y pegando en el navegador — **no necesitas terminal**.

## Paso 1 · Crear el schema en el Supabase NUEVO

1. Entra al proyecto Supabase **nuevo** (el de Mar) → **SQL Editor**
2. Abre `01_schema_completo.sql`, copia TODO el contenido, pégalo y ejecuta (**Run**)
3. Al final verás una tabla de verificación con las 17 tablas creadas

## Paso 2 · Traer la configuración desde el Supabase ORIGINAL

1. Entra al proyecto Supabase **original** (el de Libia) → **SQL Editor**
2. Abre `02_exportar_datos.sql`, copia la **QUERY A**, pégala y ejecuta
3. El resultado es una columna `sql` con un INSERT por fila — copia todas las filas
4. Pega esos INSERTs en el SQL Editor del proyecto **nuevo** y ejecuta

Esto trae `config_sistema` (links, montos, subscriber_ids), las 26 imágenes de
`imagenes_faq` y el equipo de `asesoras`. **No** copia leads ni conversaciones
de prueba.

(Opcional) La **QUERY B** del mismo archivo exporta las funciones SQL exactas
de producción, por si prefieres llevártelas literales en lugar de las del paso 1.

## Paso 3 · Lo que el SQL no puede mover

- **Storage:** crear el bucket `comprobantes` en el proyecto nuevo
  (Storage → New bucket). Los archivos no viajan con SQL.
- **Imágenes FAQ:** si las URLs de `imagenes_faq.url_publica` apuntan al
  Storage del proyecto original, seguirán funcionando solo mientras ese
  proyecto exista. Lo limpio: resubir las 26 imágenes al Storage nuevo y
  actualizar las URLs.
- **Variables de entorno de la app** (en Vercel): apuntar al proyecto nuevo
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  (se obtienen en el proyecto nuevo: Settings → API)
- **config_sistema:** revisar las claves con valor `PENDIENTE_CONFIGURAR`
  (`whatsapp_mar_personal`, `subscriber_id_mar`) — el paso 2 normalmente
  las llena con los valores reales.

## Notas

- Los scripts de `scripts/sql/` (trazabilidad, webhook_log, etc.) **ya están
  incluidos** en `01_schema_completo.sql` — no hace falta correrlos de nuevo.
- `setup_libia_ceo.sql` y `seed_libia_seguimientos.sql` son seeds de prueba
  personales; córrelos solo si quieres el número de prueba en el proyecto nuevo.
- Ambos archivos son idempotentes: ejecutarlos dos veces no rompe nada.
