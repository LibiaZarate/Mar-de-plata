# Mar de Plata · Taxco Workspace

Dashboard **+ runtime de IA** del taller de joyería plata 925 **Mar de Plata Taxco**. Reemplaza el orquestador de n8n con código propio en Next.js 14: webhook receptor, Verificador (Haiku), Agente Madre Sirena (Opus), 5 tools, guardrails, y 4 pantallas operativas en vivo contra Supabase.

> Lee primero **[CLAUDE.md](./CLAUDE.md)** · base de conocimiento completa del proyecto (schema, prompts oficiales, las 5 tools, flujo madre paso a paso, las 4 pantallas, roadmap).
>
> Para cortar n8n y dejar la app como orquestador único, sigue **[MIGRACION.md](./MIGRACION.md)** (Fase 13).

## Roadmap · 13 fases

| # | Fase | Estado |
|---|---|---|
| 1 | Setup Next.js + layout sidebar | ✓ |
| 2 | Webhook receptor `/api/webhook/manychat` | ✓ |
| 3 | Guardrails (6 keywords críticas) | ✓ |
| 4 | Lookup + INSERT lead | ✓ |
| 5 | Verificador (Haiku) vía OpenRouter | ✓ |
| 6 | Agente Madre (Opus) | ✓ |
| 7 | Las 5 tools del agente | ✓ |
| 8 | Pantalla Inicio (KPIs A+B+C+embudo) | ✓ |
| 9 | Pantalla Pipeline (Kanban 4 estados) | ✓ |
| 10 | Pantalla Equipo + widget Cierres del día | ✓ |
| 11 | Pantallas de Configuración (lives · sistema · prompts · credenciales) | ✓ |
| 12 | Playground del Agente | ✓ |
| 13 | Migración final (cambiar webhook URL en ManyChat) | ver [MIGRACION.md](./MIGRACION.md) |

## Setup

```bash
npm install
cp .env.local.example .env.local
# Rellena .env.local con los 4 secrets:
#   SUPABASE_SERVICE_ROLE_KEY · OPENROUTER_API_KEY · MANYCHAT_API_KEY
#   OPENAI_API_KEY
npm run dev
```

`.env` (committeado) ya trae `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                       Root layout + sidebar
│   ├── page.tsx                         Inicio · Bloques A + B + C
│   ├── pipeline/page.tsx                Kanban activo
│   ├── equipo/page.tsx                  Tarjetas + widget Cierres
│   ├── configuracion/
│   │   ├── page.tsx                     Hub de sub-pantallas
│   │   ├── webhook/page.tsx             Inspector POSTs
│   │   ├── lives/page.tsx               CRUD eventos_live
│   │   ├── sistema/page.tsx             CRUD config_sistema
│   │   ├── prompts/page.tsx             Lectura de prompts OFICIAL
│   │   ├── credenciales/page.tsx        Estado server-side
│   │   └── playground/page.tsx          Chat de prueba con debug
│   └── api/
│       ├── webhook/manychat/route.ts    POST recibe / GET inspector
│       └── playground/route.ts          POST corre el flow sin tocar ManyChat
├── components/
│   ├── layout/                          Sidebar + helpers
│   ├── inicio/                          KPIs + embudo
│   ├── pipeline/                        Kanban con drag & drop
│   ├── equipo/                          Tarjetas + CierresWidget
│   └── configuracion/                   Las 6 sub-pantallas
└── lib/
    ├── supabase/                        client · server · admin (3 clientes)
    ├── webhook/
    │   ├── clean.ts                     Limpieza body ManyChat
    │   ├── guardrails.ts                6 keywords + categoría + motivo
    │   ├── handoff-guardrail.ts         Sub-workflow plan
    │   ├── lead.ts                      findOrCreateLead + roundRobin
    │   ├── context.ts                   Live activo + obtener_contexto_lead + enrich
    │   ├── recent.ts                    Ring buffer inspector
    │   └── flow.ts                      Orquestador completo del flujo madre
    ├── agent/
    │   ├── openrouter.ts                Cliente común · isDemoMode()
    │   ├── verificador.ts               Haiku 4.5 · JSON · temp 0.1 (+ fallback demo)
    │   ├── agente.ts                    Opus 4.6 fast · temp 0.4 (+ fallback demo)
    │   ├── parse-loop.ts                Fragmentación ≤180 chars (CLAUDE.md §14)
    │   ├── manychat.ts                  POST /fb/sending/sendContent + Kaizen
    │   ├── prompts/                     OFICIAL · Verificador y Sirena
    │   └── tools/                       Las 5 tools como funciones server
    ├── queries.ts                       SWR hooks (KPIs, pipeline, equipo, cierres)
    ├── actions.ts                       Cierres + estado lead (client)
    └── types.ts                         Mirror de las 13 tablas
```

## Modo demo

Si `OPENROUTER_API_KEY` no está definida, Verificador y Agente Madre entran en **modo demo**: clasificación determinística por keywords y respuestas hardcodeadas plausibles. Útil para probar la UI sin conectar OpenRouter aún.

Si `MANYCHAT_API_KEY` no está definida, los mensajes salientes se loguean pero no se envían (no se le manda nada a la clienta real).

## Comandos útiles

| | |
|---|---|
| `npm run dev` | dev server en `http://localhost:3000` |
| `npm run build` | build de producción |
| `npm run start` | sirve el build |
| `npx tsc --noEmit` | type-check sin emitir |

## Validar contra Supabase real

```bash
curl -X POST http://localhost:3000/api/webhook/manychat \
  -H 'Content-Type: application/json' \
  -d '{
    "last_input_text": "hola, quiero ver el catalogo de Pandora",
    "whatsapp_phone": "5217777777777",
    "id": "subscriber_test"
  }'
```

Después abre `/configuracion/webhook` y deberías ver la entrada con la tool `enviar_catalogo` ejecutada. En `leads` debe aparecer la fila nueva con `estado='calificada'`.
