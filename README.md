# Mar de Plata · Taxco Workspace

Dashboard + AI Agent del taller de joyería de plata 925 **Mar de Plata Taxco**. Reemplaza el orquestador de n8n con código propio en Next.js 14.

> Lee primero **[CLAUDE.md](./CLAUDE.md)** — es la base de conocimiento completa del proyecto (schema, prompts oficiales, las 5 tools, flujo madre paso a paso, las 4 pantallas, roadmap).

## Stack

- **Next.js 14** App Router + TypeScript estricto
- **Tailwind CSS** + primitivas Radix (shadcn-style)
- **Supabase** (`@supabase/ssr` para SSR + `@supabase/supabase-js` para tools server-side)
- **SWR** (refresh 30s)
- **Recharts** (gráficas)
- **OpenRouter** (Verificador Haiku + Agente Madre Opus)
- **ManyChat** (delivery WhatsApp)
- **Redis** (buffer de 5s entre mensajes)
- **OpenAI Whisper** (transcripción audio)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Rellena .env.local con: SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY,
# MANYCHAT_API_KEY, OPENAI_API_KEY, REDIS_URL
npm run dev
```

`.env` ya trae las claves públicas del proyecto Supabase de Mar.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                  Root layout + sidebar
│   ├── page.tsx                    Inicio · query de prueba a leads
│   ├── pipeline/page.tsx           Stub (fase 9)
│   ├── equipo/page.tsx             Stub (fase 10)
│   └── configuracion/page.tsx      Stub (fase 11)
├── components/
│   ├── layout/sidebar.tsx
│   ├── layout/soon.tsx
│   └── inicio/leads-count-probe.tsx
└── lib/
    ├── utils.ts
    └── supabase/
        ├── client.ts               Browser client (anon)
        ├── server.ts               RSC + Server Actions (anon + cookies)
        └── admin.ts                Service role · solo server-side
```

## Fase actual

**Fase 1 del roadmap completa.** Layout funcional, query a Supabase validable visualmente desde `/`. Listo para validar con Libi:

1. Árbol de archivos del proyecto ← este README
2. Layout funcionando ← `npm run dev` → http://localhost:3000
3. Query de prueba a Supabase ← tarjeta en Inicio muestra el resultado de `SELECT COUNT(*) FROM leads;`

## Siguiente fase

**Fase 2** — Webhook receptor `/api/webhook/manychat` que recibe el body de ManyChat, lo loguea, detecta audio y devuelve 200. Sin lógica de Sirena todavía. Validación obligatoria con Libi antes de pasar a fase 3.
