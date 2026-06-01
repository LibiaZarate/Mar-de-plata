# Migración n8n → Claude Code · Fase 13

Esta guía describe los pasos para cortar n8n y dejar la app Next.js como el orquestador único del bot Sirena.

## Pre-requisitos

Antes de migrar verifica que:

- [ ] La app está deployada en producción (Vercel/Railway/etc) con HTTPS.
- [ ] Las 6 variables de entorno están seteadas en el deploy:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENROUTER_API_KEY`
  - `MANYCHAT_API_KEY`
  - `OPENAI_API_KEY` (opcional · audios)
- [ ] Las 3 asesoras (Eli, Nat, persona nueva) están en la tabla `asesoras` con `activa=true`.
- [ ] Las 26 imágenes de FAQ están en la tabla `imagenes_faq` con `activa=true` y `url_publica` válida.
- [ ] La tabla `config_sistema` tiene las 8 claves del brief (ver `/configuracion/sistema`).
- [ ] El bucket `comprobantes` de Storage existe con políticas de upload para `anon`.
- [ ] El Playground (`/configuracion/playground`) muestra una respuesta razonable de Sirena con un mensaje de prueba (verifica que OpenRouter está conectado).

## Paso 1 · Smoke test contra producción

```bash
curl -X POST https://tu-app.vercel.app/api/webhook/manychat \
  -H 'Content-Type: application/json' \
  -d '{
    "last_input_text": "hola, quiero ver el catalogo de Pandora",
    "whatsapp_phone": "5217777777777",
    "id": "subscriber_test"
  }'
```

Resultado esperado: `200 OK` con `flow.tool_ok: true` y la tool `enviar_catalogo` ejecutada. En el inspector (`/configuracion/webhook`) debe aparecer la entrada y en Supabase un lead nuevo con `estado='calificada'`.

## Paso 2 · Cambiar URL en ManyChat

1. Entra a ManyChat → Settings → External Actions → Webhook (el que actualmente apunta a n8n).
2. Reemplaza la URL por la de producción: `https://tu-app.vercel.app/api/webhook/manychat`
3. Si usaste Bearer/header auth para n8n, en Claude Code el webhook acepta cualquier POST (no requiere auth) — la validación recae en la `MANYCHAT_API_KEY` que usamos para responder.
4. Guarda los cambios.

## Paso 3 · Desactivar workflow en n8n

1. Ve al workflow madre en n8n.
2. Toggle "Inactive" para detener el procesamiento.
3. Deja los sub-workflows de tools activos por 24h como red de seguridad (por si necesitas revertir).

## Paso 4 · Vigilancia post-corte (primeras 24h)

- Abre `/configuracion/webhook` y verifica que llegan los POSTs reales de ManyChat.
- Abre `/` y mira los KPIs: deberían moverse a tiempo real.
- Abre `/equipo` y confirma que las asesoras ven sus métricas y que Eli/Nat pueden registrar cierres.
- Revisa la tabla `alertas` después de cada handoff para confirmar que `para_mar=TRUE` cuando corresponde.

## Paso 5 · Apagar n8n (después de 24-48h estables)

Una vez confirmas que el flujo en Claude Code está funcionando bien:

1. Desactiva los sub-workflows de tools en n8n.
2. Mantén el proyecto n8n por 30 días como respaldo.
3. Después de 30 días, exporta los JSONs como backup y elimina la instancia de n8n.

## Rollback de emergencia

Si en las primeras 24h aparece un problema crítico:

1. Vuelve a ManyChat → Settings → External Actions → Webhook.
2. Cambia la URL de vuelta a la de n8n.
3. Re-activa el workflow madre en n8n.
4. Documenta el bug en un nuevo branch de Claude Code, fíxalo, deploya y reintenta.

## Cron jobs pendientes (no bloquean migración)

Cuando tengas un par de horas extra:

- **Resetear conversaciones inactivas** (semanal):
  ```sql
  SELECT resetear_conversaciones_inactivas();
  ```
  Configura como Supabase pg_cron o como Vercel Cron apuntando a un endpoint nuevo `/api/cron/reset-inactivas`.

- **Ejecutar seguimientos programados** (cada 15 min):
  Hay que crear un endpoint `/api/cron/seguimientos` que haga:
  ```sql
  SELECT * FROM seguimientos_programados
  WHERE ejecutado = false AND ejecutar_en <= NOW();
  ```
  Y dispare la lógica correspondiente según `tipo`. Esto sustituye el `Schedule Trigger` vacío que vimos en el JSON `programar_seguimiento`.

## Métricas de éxito

Después de 7 días con la app en producción, deberías ver:

- `leads.estado='lead_nueva'` creados automáticamente por el webhook.
- `conversaciones` creciendo con ambas direcciones (entrante + saliente).
- `alertas` con `tipo` distribuido entre `handoff_normal`, `handoff_urgente`, `guardrail_critico`, `reclamo`.
- `cierres_diarios` poblándose vía el widget de `/equipo`.
- 96%+ de efectividad del bot (% de leads que no requirieron handoff) — mismo benchmark del brief.

## Soporte

Cualquier bug nuevo se documenta en commits del repo (no en n8n). Si Sirena dice algo raro, el inspector del webhook + el Playground te dan visibilidad completa del brief del Verificador + tool ejecutada para reproducir y debuggear.
