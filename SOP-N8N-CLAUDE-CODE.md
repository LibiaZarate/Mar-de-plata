# SOP · Migración de proyectos n8n → Claude Code

> **Versión:** 1.0 · 2026.06 · Azxion / Mar de Plata Taxco como caso piloto
>
> **Audiencia:** desarrollador junior/mid que va a ejecutar la migración con Claude Code como co-piloto. También sirve como instructivo para el propio Claude Code del nuevo proyecto.

---

## 1. Cuándo aplica este SOP

Aplica si el cliente cumple **3 de 4** de estos criterios:

- [ ] Tiene un **orquestador en n8n** que mezcla webhooks + LLM + base de datos + delivery (WhatsApp/Telegram/email/Discord).
- [ ] Volumen **medio o creciente** (200+ mensajes/día). n8n se empieza a poner lento o caro.
- [ ] Necesita un **dashboard operativo** (KPIs, pipeline, métricas de equipo, gestión manual de algo).
- [ ] El cliente quiere **control total del código** y poder iterar features sin depender de n8n.

**NO aplica si:**

- Es ETL nocturno sin UI humana — n8n está bien para eso.
- Volumen <50 mensajes/día y el cliente prefiere bajo código.
- El cliente no tiene budget para Vercel + Supabase Pro (~$45 USD/mes mínimo).
- El flujo es 100% automático y no necesita pantallas para que un humano lo opere.

---

## 2. Inputs que tienes que pedirle al cliente ANTES de tocar código

Sin estos 8 ítems, no arranques:

1. **Export JSON de los workflows de n8n** (todos los principales + los sub-workflows). Pídelos como archivos, no como capturas.
2. **Schema completo de la base** (Supabase o lo que use): tablas, columnas, types, defaults, foreign keys, **CHECK constraints**, índices, **RLS policies activas**.
3. **Funciones SQL custom y triggers** que existan en la base. Ojo: muchos clientes no se acuerdan que existen y son críticos.
4. **Los prompts oficiales** que están en producción ahora mismo (verificador / clasificador, agente principal, sub-prompts). Textual, no parafraseado.
5. **Un payload real del webhook entrante** — copy/paste del body que llega del proveedor (ManyChat, etc.).
6. **Credenciales de los servicios**: API keys de LLM (OpenRouter / Anthropic), proveedor de mensajería (ManyChat / WhatsApp Cloud API / Telegram), Whisper si hay audio, etc.
7. **Las "reglas duras inviolables" del negocio**: montos, tonos, lo que el bot NUNCA puede hacer. Lo que el dueño del proyecto consideraría una catástrofe.
8. **Las pantallas que necesita el dashboard** y quién las va a usar (admin / operador / etc.). Sin esto vas a sobrediseñar.

Si el cliente no tiene alguno de estos, **pídeselo por escrito** antes de cotizar tiempo.

---

## 3. Stack canónico (no negociable salvo justificación fuerte)

```
Next.js 14 App Router + TypeScript estricto
Tailwind CSS + primitivas Radix (estilo shadcn)
Supabase JS SDK (@supabase/supabase-js + @supabase/ssr)
SWR para polling (30s default)
OpenRouter como gateway de LLMs (Anthropic, OpenAI bajo el mismo SDK)
Vercel para deploy
```

**Tres clientes de Supabase**, sin excepción:
- `client.ts` — browser, **anon key**. RLS activo.
- `server.ts` — Server Components + cookies. Anon key.
- `admin.ts` — `service_role`, **solo server-side, nunca expuesto al browser**. Salta RLS.

**Por qué no:**
- No Storybook · perdés tiempo
- No Jest unitario al inicio · usa scripts de `tsx` para tests puntuales
- No OAuth de inicio · email/password de Supabase Auth es suficiente
- No Redux/Zustand · SWR alcanza para el 95% de casos

---

## 4. Las 13 fases del roadmap (con check obligatorio entre cada una)

Esto es el orden literal. **No saltarse ninguna.** Cada fase termina con "muestra a Libi/cliente y espera OK".

| # | Fase | Entregable |
|---|---|---|
| 1 | Setup repo + layout + sidebar | Pantallas vacías navegables, tipografía y colores definidos |
| 2 | Webhook receptor `/api/webhook/[proveedor]` | Recibe POST, loguea a ring buffer in-memory, inspector visual con últimos 50 POSTs |
| 3 | Capa de guardrails | Detección de keywords críticas con regex case-insensitive, decisión documentada de precedencia |
| 4 | Lookup + INSERT del actor en DB | Crea fila si no existe, dedup, **fallback ante CHECK constraints desconocidos** |
| 5 | Llamada al clasificador (cheap LLM con JSON estricto) | Verificador estilo Haiku que devuelve `{intencion, tool, parametros, instrucciones_tono}` |
| 6 | Llamada al agente principal (smart LLM) | Genera el texto natural respetando el brief del verificador |
| 7 | Implementar las N tools del agente, **una por una** | Cada tool con su test manual antes de la siguiente |
| 8 | Pantalla Home con KPIs principales | Datos reales desde un endpoint server-side único, no 8 queries paralelas |
| 9 | Pantalla Pipeline / Kanban | Lectura via endpoint, drag & drop dispara `PATCH /api/.../lead` |
| 10 | Pantalla Equipo + widget de cierres/captura manual | Form de inserción + upload a Storage + actualización en cascada |
| 11 | Sub-pantallas de Configuración | CRUD de tablas auxiliares (lives, config, prompts read-only) |
| 12 | Playground/simulador del agente | Chat de prueba con burbujas + typing indicator + historial persistente + imagen renderizada inline |
| 13 | Migración final | Cambio de URL del webhook en el proveedor, n8n queda 30 días como respaldo |

**Regla de oro:** entre cada fase, parar y mostrar al cliente. No avances con suposiciones.

---

## 5. Los 15 patterns canónicos (lo que aprendimos haciendo Mar de Plata)

### P1 · Mode simulator / production via env var

Una sola variable `MODO_PRODUCCION=true` decide si los mensajes salen al proveedor real o quedan capturados en memoria. **Default = simulator.** El proveedor solo recibe POSTs cuando explícitamente se activa.

```ts
export function defaultMode(): FlowMode {
  return process.env.MODO_PRODUCCION === "true" ? "production" : "simulator";
}
```

El Playground **siempre** fuerza `simulator` aunque la flag esté en true.

### P2 · Service role para TODAS las queries del dashboard

**RLS es la causa #1 de "no aparece nada" en el dashboard.** Cualquier query desde el browser con anon que toque una tabla con RLS estricto devuelve `[]` silenciosamente. Sin error.

Solución: cada hook SWR del dashboard llama a un endpoint `/api/dashboard/...` que usa `createAdminClient()` con `service_role`. Salta RLS.

Patrón de endpoint:
```ts
// /api/dashboard/inicio/route.ts
export async function GET() {
  try {
    const sb = createAdminClient();
    const data = await sb.from("...").select("...");
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
```

Hook:
```ts
const { data, error } = useSWR("/api/dashboard/inicio", fetcher, { refreshInterval: 30_000 });
```

### P3 · Modo demo cuando faltan API keys

Si `OPENROUTER_API_KEY` no está, el clasificador y el agente entran en **modo demo determinístico**: detección por regex + respuestas hardcodeadas plausibles. Permite iterar la UI **sin gastar tokens** y demostrar al cliente antes de tener la cuenta.

```ts
export function isDemoMode(): boolean {
  return !process.env.OPENROUTER_API_KEY;
}

async function runVerificador(input) {
  if (isDemoMode()) return demoVerificador(input.mensajeActual, input.contextoLead);
  // ... llamada real a OpenRouter
}
```

### P4 · Outbound capturado por las tools

Las tools no solo envían — **devuelven** los mensajes que mandarían en una propiedad `outboundMessages`. El simulator los pinta como burbujas. La producción los manda al proveedor.

```ts
export type ToolResult = {
  tool: ToolName;
  ok: boolean;
  outboundMessages: Array<{ type: "text" | "image"; text?: string; url?: string }>;
  notes: string[];
};
```

### P5 · Clasificador (cheap) → Agente (smart) separados

**Nunca** el agente generativo toma decisiones críticas. Esa responsabilidad es del clasificador que devuelve JSON estricto. El agente solo genera el texto natural respetando el brief.

- Clasificador (ej. Haiku) · temperature 0.1 · response_format: json_object · barato y rápido
- Agente (ej. Opus) · temperature 0.4 · max_tokens razonable · le pasa el brief del clasificador como user message

Esto te da:
- Predictibilidad (puedes loguear/auditar las decisiones)
- Posibilidad de A/B test del clasificador sin tocar el agente
- Costos controlados (cheap classifier llamado siempre, smart caller solo cuando hay que generar texto)

### P6 · Defense in depth para las reglas de negocio

**No confíes en que un LLM siga reglas.** Cada regla crítica se aplica en 4 capas:

1. **Hard guard en código** — `if (yaEnHandoff) return null;`
2. **Prompt del clasificador** — "Si X, no sugieras Y"
3. **Prompt del agente** — "Si X, tu rol es Z"
4. **Modo demo** — replica el mismo comportamiento determinísticamente

Ejemplo real de Mar de Plata: si el lead ya está en `rama_activa='handoff'`, las cuatro capas bloquean disparar otro handoff. Bug que se reportó y se corrigió en una sola iteración.

### P7 · Prompts oficiales en archivos `.ts`, NO en la base de datos

Los prompts viven en `src/lib/agent/prompts/*.ts` como `export const ... = \`...\``. Cambiarlos requiere PR + code review. **Esto es feature, no bug.** Cambios incontrolados al prompt rompen el bot silenciosamente.

Los valores **dinámicos** (links, URLs, montos, nombres) viven en una tabla `config_sistema` editable desde el dashboard. El flow consulta `config_sistema` antes de armar el contexto del agente.

### P8 · Etiquetas para distinguir leads de prueba

Los leads creados desde el Playground llevan `etiquetas: ["playground"]`. Aparecen en el Pipeline con un badge "test" claro pero **no se filtran** — el cliente quiere ver que las pruebas también miden cosas.

Patrón:
```ts
findOrCreateLead(cleaned, { etiquetas: ["playground"] });
```

Y en la card:
```tsx
{lead.etiquetas?.includes("playground") && (
  <span className="pill-test">test</span>
)}
```

### P9 · Validación obligatoria entre fases del roadmap

Después de cada fase del §4, **detente y muestra**. No es opcional. Esto evita reescrituras grandes.

Patrón típico:
- Termina fase
- Captura screenshots
- Resumen en mensaje al cliente con "esto entrega X, antes de fase Y necesito que confirmes Z"
- Espera respuesta

### P10 · `CLAUDE.md` como base de conocimiento permanente

El archivo `CLAUDE.md` en la raíz del repo es leído **automáticamente** por Claude Code al iniciar cualquier sesión sobre ese repo. Es la única fuente de verdad técnica del proyecto.

Estructura mínima de un buen `CLAUDE.md`:
1. Propósito y contexto del negocio (1 párrafo)
2. Actores (quiénes lo usan)
3. Montos sagrados / reglas duras (lista numerada)
4. Stack técnico explícito
5. Variables de entorno requeridas
6. Schema completo de las tablas que importan
7. Funciones SQL custom + triggers existentes (NO duplicar)
8. Mapeos críticos (FAQ → id, estados, etc.)
9. Diagrama del flujo en Mermaid
10. Paso a paso del flujo principal
11. Las tools del agente con sus queries SQL
12. Prompts oficiales (referenciar archivo, no copiar entero)
13. Pantallas con su propósito
14. Orden de construcción (las 13 fases)
15. Recursos en Notion / docs externas
16. **Reglas duras inviolables** (no negociables)

### P11 · Inspectores visuales > confianza ciega

El cliente debe **ver** que las cosas funcionan, no solo leer que sí. Toda integración crítica necesita:
- Inspector del webhook (`/configuracion/webhook`) con los últimos N POSTs expandibles
- Playground del agente con debug del clasificador + tools ejecutadas
- Panel de credenciales que muestra estado de cada conexión sin exponer secretos

### P12 · Documentar "lo que NO se hace" explícitamente

En `CLAUDE.md`, sección "Lo que NO se hace":
> - No OAuth ni magic links
> - No WebSockets ni real-time
> - No inventar columnas
> - No reemplazar n8n hasta validar todo en local
> - No Redis (decisión de Mar, omitido)

Esto evita scope creep. Cuando una nueva sesión de Claude Code ve esto, no propone esas cosas.

### P13 · Decisiones tomadas con timestamp en el código

Cuando el cliente dice "no Redis", no lo dejas como TODO. Lo documentas como **decisión consciente**:

```ts
// ── Paso 7: buffer de 5s ────────────────────────────────
// Decisión de Mar: sin buffer. Cada mensaje se procesa individual.
// Si se ven respuestas múltiples a mensajes consecutivos, agregamos
// el buffer en una iteración futura (Upstash o KV, NO Redis de n8n).
```

Y en `CLAUDE.md` lo mismo. Sirve para que en una sesión futura ni tú ni Claude lo "redescubran" mal.

### P14 · Endpoints de API tienen forma uniforme

Toda response del API sigue el shape `{ ok: boolean, error?: string, ...payload }`. Status 200 si fue procesable (aunque `ok: false`), 500 solo si hubo crash inesperado.

```ts
return NextResponse.json({ ok: true, leads: data ?? [] });
// o
return NextResponse.json({ ok: false, error: msg, leads: [] }, { status: 500 });
```

Beneficio: el hook del cliente puede leer `data?.ok` siempre, sin try/catch.

### P15 · `vercel.json` minimalista solo con framework

En proyectos que migran desde otra cosa, los settings del panel de Vercel quedan stale (ej. `outputDirectory: dist` heredado de Vite). Solución:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

`vercel.json` gana sobre la config del panel. Evita 1-2 horas de debugging.

---

## 6. Anti-patterns que cuestan tiempo

- ❌ **Empezar por el dashboard, después el bot.** Hazlo al revés. El bot operando con datos reales es lo que da feedback útil. Las pantallas vienen después.
- ❌ **Una megaquery del cliente para mostrar el home.** Mejor un endpoint server-side que agrega todo en una sola response.
- ❌ **Confiar en que el LLM nunca va a romper una regla.** Siempre defense in depth.
- ❌ **Hardcodear secrets en `.env` commiteado.** Solo `NEXT_PUBLIC_*` van ahí. El resto en `.env.local` (gitignored) y en Vercel Env Vars.
- ❌ **Saltar el modo demo.** Un cliente que no tiene cuenta de OpenRouter todavía no puede ver nada. El demo es lo que vende el proyecto.
- ❌ **Reemplazar n8n el día 1.** n8n queda 30 días como respaldo después del corte.
- ❌ **Borrar la rama de n8n del cliente.** Que se queden ambos sistemas hasta que pase un mes operando sin incidentes.
- ❌ **Usar `next/image` para URLs externas.** Te obliga a configurar dominios. Usa `<img>` nativo para attachments del flujo.

---

## 7. Artefactos que tu equipo genera por proyecto

| Archivo | Propósito |
|---|---|
| `CLAUDE.md` | Base de conocimiento permanente. Estructura del §P10 arriba. |
| `MIGRACION.md` | Guía de Fase 13 (cambio de URL, smoke test, rollback, cron jobs pendientes). |
| `.env` (commiteado) | Solo `NEXT_PUBLIC_*` (Supabase URL + anon, bucket, TZ). |
| `.env.local.example` | Plantilla de los 4-5 secrets server-side con comentarios. |
| `README.md` | Setup + estructura del repo + 13 fases checklist. |
| `vercel.json` | `{ "framework": "nextjs" }` y nada más. |

---

## 8. Prompt inicial para Claude Code en un proyecto nuevo

Ver archivo separado [`PROMPT-ARRANQUE.md`](./PROMPT-ARRANQUE.md). Es el texto exacto que el desarrollador pega al primer turno de Claude Code en el nuevo repo.

---

## 9. Checklist de migración final (Fase 13)

Antes de cortar n8n, lo que tiene que estar verde:

- [ ] Build verde en producción (Vercel)
- [ ] Las 5 env vars server-side configuradas en Vercel y redeployado
- [ ] Smoke test con curl al webhook de producción → flow.tool_ok: true
- [ ] Lead nuevo aparece en `/pipeline` después del smoke test
- [ ] KPIs del Home reflejan el lead nuevo (Leads hoy +1)
- [ ] Playground responde con LLM real (no demo) con `OPENROUTER_API_KEY`
- [ ] El proveedor de mensajería tiene la URL nueva apuntando al webhook
- [ ] Workflow madre de n8n desactivado (sub-workflows quedan 24h activos como respaldo)
- [ ] Comunicación al cliente: "estamos en producción, monitoreo 48h"
- [ ] Después de 24-48h sin incidentes: desactivar sub-workflows de n8n
- [ ] Después de 30 días sin incidentes: exportar JSONs de n8n como backup, eliminar instancia

---

## 10. Métricas de éxito por proyecto

Después de 7 días en producción con la app:

- Leads creados automáticamente por el webhook (no manuales)
- Conversaciones registradas (ambas direcciones)
- Alertas distribuidas entre los tipos del clasificador
- Cierres registrados manualmente desde el widget
- **>90% de efectividad del bot** (% de leads que no requirieron handoff a humano)
- **<500ms p95 de tiempo de respuesta** del webhook (excluyendo la espera del LLM)
- 0 alertas duplicadas por bugs de defense-in-depth

---

## 11. Soporte post-migración

- Los bugs nuevos se documentan como commits del repo, **no en n8n**.
- Inspector del webhook + Playground dan visibilidad completa para reproducir.
- Variables editables vía dashboard (`config_sistema`) — no requieren deploy.
- Cambios al prompt requieren PR — esto es feature, no bug.

---

## 12. Tabla de costos típica (referencia)

Para un cliente con 1000 mensajes/día con clasificador Haiku + agente Opus vía OpenRouter:

| Servicio | Costo mensual estimado |
|---|---|
| Vercel Pro | $20 USD |
| Supabase Pro | $25 USD |
| OpenRouter (Haiku + Opus) | $30-60 USD |
| Whisper (audio opcional) | $5-15 USD |
| **Total** | **~$80-120 USD/mes** |

Lo que costaba n8n self-hosted + Redis + LLM: típicamente lo mismo o más, con menos control.

---

## 13. Versionado de este SOP

Este SOP es un documento vivo. Cada proyecto migrado debe **commitear de vuelta** los patterns nuevos que descubre. Si Claude Code en el nuevo proyecto descubre un edge case que merece estar acá, abre PR a este archivo.

**Cambios v1.0 → vNext:**
- ☐ Pattern para realtime subscriptions (cuando se justifique)
- ☐ Pattern para cron jobs (Vercel Cron o pg_cron)
- ☐ Pattern para multi-tenant (clientes con varios proyectos)
- ☐ Pattern para auth por roles (Mar admin / Eli operadora)

---

**Fin del SOP.** Si algo no está claro, abrir issue en el repo del proyecto piloto (Mar de Plata).
