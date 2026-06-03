# Simulador portable · contexto técnico

> Documento para reusar el patrón de simulador/playground en otro proyecto (otro cliente, otro vertical). No es código copiar/pegar — es la arquitectura conceptual y los contratos entre piezas.

**Versión:** 2026.06.03

---

## 1. Qué es el simulador (y qué no es)

**Es:** una segunda boca de entrada al mismo cerebro. Mar (o quien sea) escribe en un chat del dashboard y el sistema responde **exactamente igual** que cuando WhatsApp le manda un mensaje real — usa los mismos prompts, las mismas tools, escribe a la misma base de datos. La única diferencia es que **el mensaje saliente no se entrega por ManyChat**, se pinta como burbuja en la UI.

**No es:** un mock, un stub, un sandbox separado. No tiene su propia base de datos, sus propios prompts, ni su propia lógica. Eso sería trampa.

**Por qué importa:**
- Mar puede probar cambios sin tocar el WhatsApp real
- Los KPIs del dashboard reflejan la actividad del simulador (puedes "estresar" el pipeline)
- Si funciona en simulador, funciona en producción (mismo código)
- Permite onboarding de Eli/Nat sin gastar tokens en WhatsApp real

---

## 2. Las 4 piezas

### Pieza 1 · `FlowMode` (1 línea de código que cambia todo)

```ts
// src/lib/agent/mode.ts
export type FlowMode = "production" | "simulator";
```

Esta enum se **enhebra** por toda la app. El webhook real fija `mode="production"`. El endpoint del playground fija `mode="simulator"`. Todo lo demás respeta el flag.

### Pieza 2 · Capa de delivery aislada (el único `if mode` que existe)

```ts
// src/lib/agent/manychat.ts
export async function sendToClient(input) {
  if (input.mode === "simulator") {
    return { ok: true, delivered: false, via: "simulator" };
  }
  // resto: POST a ManyChat real
}
```

**Esta es la única función que ramifica por modo.** Toda la lógica de negocio (prompts, tools, decisión de qué hacer) es modo-agnóstica. Las tools devuelven `outboundMessages` independientemente — la UI del playground los pinta, ManyChat los manda.

### Pieza 3 · Demo fallback (sobrevive sin keys)

Si `OPENROUTER_API_KEY` no está, el sistema NO crashea. Cae en **clasificación determinística por keywords**:

```ts
// src/lib/agent/verificador.ts
if (isDemoMode()) return demoVerificador(mensaje, contexto, metadata);
// vs.
const resp = await chat({ model: MODELS.verificador, ... });
```

`demoVerificador` y `demoAgenteText` son tablas de regex → intent → tool. Cubren el 70% de los casos comunes. Mar puede demostrarle el sistema a alguien sin OpenRouter prendido. Y si en producción se cae OpenRouter, no hay outage total — degradación elegante.

### Pieza 4 · UI del playground

`/configuracion/playground` es un chat de browser que:
- POSTea texto + número → `/api/playground` → mismo `runFlow()` que el webhook
- Recibe `outboundMessages` + `verificadorOutput` + `toolResult`
- Pinta burbujas, badges de tool ejecutada, imágenes reales de `imagenes_faq`
- Muestra el JSON del Verificador en un panel de debug (transparencia total)
- Lista conversaciones recientes para reanudar contexto

---

## 3. Contratos entre piezas

```
                  ┌─────────────────────┐
   WhatsApp ──→   │ /api/webhook/X      │ mode="production"
                  │                     │
   Chat UI  ──→   │ /api/playground     │ mode="simulator"
                  └──────────┬──────────┘
                             ↓
                  ┌──────────────────────┐
                  │   runFlow(input)     │   ← src/lib/webhook/flow.ts
                  │                      │
                  │   1. guardrails      │   (keywords críticas)
                  │   2. lookup/insert   │   leads + estado_conversacion_actual
                  │   3. live + ctx + urls
                  │   4. Verificador     │   prompt o demo
                  │   5. log eventos     │
                  │   6. Agente Madre    │   prompt o demo
                  │   7. exec tool       │   ← respeta mode
                  │   8. log conversación
                  │   9. update turnos   │
                  └──────────┬───────────┘
                             ↓
                  ┌────────────────────┐
                  │  ToolResult        │
                  │  - outboundMessages│  ← UI lo pinta o ManyChat lo manda
                  │  - notes           │
                  │  - ok              │
                  └────────────────────┘
```

**Reglas duras del contrato:**
1. Cualquier código que escriba a Supabase **NO consulta mode**. Siempre escribe.
2. Cualquier código que llame a un servicio externo (ManyChat, OpenRouter, Whisper) **SÍ consulta mode** — pero está aislado en `manychat.ts`, `openrouter.ts`, etc.
3. Las tools devuelven `outboundMessages` siempre, no importa el modo. La UI o ManyChat deciden qué hacer con eso.

---

## 4. Cómo portarlo a otro cliente

Para reutilizar este patrón con otro vertical (ej. clínica, agencia, restaurante), el plan es:

### Paso 1 · Replicar la columna vertebral
- `FlowMode` enum
- `runFlow(input)` con la misma estructura de 9 pasos (algunos cambian de contenido pero el orden conceptual es el mismo)
- `ToolResult` con `outboundMessages: Array<{type, text|url}>` + `notes` + `ok`

### Paso 2 · Tabla `config_sistema` (clave/valor)
Todo lo específico del negocio vive aquí, no hardcoded:
- URLs externas (sitio web, catálogos, maps, PDFs)
- Números (mínimos de compra, depósitos)
- Plantillas de seguimientos
- Credenciales de APIs externas (con fallback a env vars)

Razón: cambiar de cliente = cambiar filas en una tabla, no recompilar código.

### Paso 3 · Definir las tools del nuevo vertical
Cada tool es una función `async (args) => ToolResult`. Tres invariantes:
- Hace su side effect en Supabase
- Llama `sendToClient({ mode, messages })` — UN solo punto de entrega
- Devuelve `outboundMessages` para la UI

Por ejemplo, una clínica tendría: `agendar_cita`, `enviar_estudios`, `recordar_indicaciones`, `handoff_doctora`. Un restaurante tendría: `enviar_menu`, `tomar_pedido`, `dar_dirección`.

### Paso 4 · Verificador + Agente (los dos LLMs)
**Verificador** (Haiku, JSON) clasifica intent y elige la tool. Es el "router".
**Agente** (Opus/Sonnet, texto) genera el texto natural alrededor de la tool. Es la "voz".

Para cada vertical, escribes dos prompts. La estructura de salida es la misma (intent + tool + parametros + tono).

**Demo fallbacks**: para cada tool, escribe una regex y una respuesta canned. 60–90 min de trabajo, te da resilencia + onboarding gratis.

### Paso 5 · UI del playground
`/configuracion/playground` se reusa casi tal cual. Lo único que cambia:
- Los badges de tools (qué iconos para qué tool del vertical)
- Las "preguntas sugeridas" arriba del chat (cambian por vertical)

### Paso 6 · Seguimientos (opcional pero recomendado)
- Tabla `seguimientos_programados` con `ejecutado_en NULL` filter
- Executor que pesca pendientes, renderiza plantilla, manda
- `/api/cron/<vertical>` invocado por Vercel Cron cada 15 min
- Plantillas con `{nombre}` y otros placeholders en `config_sistema`

---

## 5. Checklist de portabilidad (lo que SÍ y NO compartir entre clientes)

| Pieza | ¿Compartir o duplicar? |
|---|---|
| `FlowMode` enum | Copiar literal |
| `sendToClient` con if mode | Copiar, ajustar a la API real del nuevo cliente |
| `runFlow` esqueleto de 9 pasos | Copiar estructura, cambiar contenido |
| `config_sistema` table | Mismo schema, distintas filas |
| Prompts del Verificador y Agente | **Reescribir** — son específicos del vertical |
| Demo fallbacks | **Reescribir** — son específicos del vertical |
| UI del playground | Copiar, ajustar badges y sugerencias |
| Tools | **Reescribir** — son la lógica de negocio |
| Schema de Supabase (leads, conversaciones, estado_conversacion_actual, alertas) | Copiar casi literal, agregar columnas del vertical |
| Cron de seguimientos | Copiar estructura |
| Skill rules anti-spam | Copiar y adaptar (lead ya en handoff, etc.) |

---

## 6. Gotchas que descubrimos en Mar de Plata

1. **Constraint en `canal_origen`**: la tabla `leads` tiene un CHECK que rechaza valores no autorizados. El playground envía leads con marca `canal_origen='playground'` que tuvimos que whitelist'ar. → Para nuevos clientes, dejen el CHECK constraint laxo durante desarrollo.

2. **Live state cruzado con tiempo restante**: si el agente menciona "estamos en vivo" en el turno 1 y la clienta vuelve a saludar en el turno 5, no debe re-anunciar. Solución: escanear `contexto_lead.ultimos_mensajes` por keyword del live antes de marcar `mencionar_live_activo`. Ese patrón sirve para cualquier "deduplicar mención de X a través de la conversación".

3. **Service role NUNCA en `config_sistema`**: `SUPABASE_SERVICE_ROLE_KEY` se necesita para LEER `config_sistema`. Si la guardas ahí, es chicken-and-egg. Vive en env var y punto.

4. **`encodeURIComponent` no salva del formato MX viejo**: WhatsApp Click-to-Chat dejó de aceptar el "1" después del 52 para móviles MX. Si tu cliente da números, normaliza antes de generar links. Aplica a cualquier vertical que use wa.me / api.whatsapp.com/send.

5. **Tools que mandan políticas auto**: el patrón "después del primer FAQ, anexa políticas" es genérico — sirve para términos de servicio, manual de uso, lo que sea. Vive dentro de `enviarImagenFaq` con flag `politicas_enviadas` en el estado.

6. **`mode` viaja en TODOS los lados**: si lo olvidas en una sola tool, esa tool va a llamar a ManyChat aunque estés en simulador. Es la falla más común al portar.

7. **Atribución de ads**: `campaign_id`, `adset_id`, `ad_id`, `ctwa_clid` vienen del payload de ManyChat (que los toma del CTWA de Meta). Si tu nuevo cliente no usa Meta CTWA, esta capa no aplica — quítala. Si sí usa, copia tal cual la captura en `clean.ts` y `lead.ts`.

---

## 7. Mínimo viable para portar

Si querés empezar a portar con esfuerzo chico:

1. Copia el repo
2. Borra todo lo de `src/lib/agent/prompts/`, `tools/`, y los demos
3. Mantén `runFlow`, `sendToClient`, `manychat.ts`, `openrouter.ts`, `mode.ts`
4. Mantén `playground.tsx` con sus ajustes de branding
5. Cambia el schema de Supabase a tu vertical (leads con tus columnas, tus FAQs)
6. Escribe 2 prompts (Verificador + Agente) y 3-5 tools del vertical
7. Escribe demo fallbacks por cada tool
8. Conecta a tu ManyChat (o WhatsApp Cloud API directo, depende)
9. Listo

**Tiempo realista:** 2–3 semanas si el equipo conoce el patrón. La primera vez son 6 semanas porque hay que entender el contrato. La segunda vez son 10 días.
