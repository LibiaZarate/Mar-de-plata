# Mar de Plata · Taxco Workspace

Dashboard operativo para el taller de joyería **Mar de Plata** (Taxco).
Conectado en vivo a la base de datos de Supabase donde n8n + Sirena
(Claude) registran cada conversación de WhatsApp.

## Vistas

| Ruta | Contenido |
|---|---|
| `/` | **Inicio** · Bloque A (KPIs leads/efectividad/facturación), Bloque B (operación), Bloque C (embudo con detección de cuello de botella) |
| `/pipeline` | Kanban en vivo sobre la tabla `leads` con drag & drop entre estados |
| `/equipo` | Tarjetas de asesoras (`asesoras` + `cierres_diarios`) + widget **Cierres del día** |

## Funcional

- **Cierres del día** (en `/equipo`) — busca el lead por nombre o número, sube comprobante a Supabase Storage (`bucket "comprobantes"`), inserta en `cierres_diarios` y actualiza `leads.estado = 'pagada'`. SWR invalida la facturación, el embudo y las métricas del equipo al instante.
- **Pipeline Kanban** — arrastra una tarjeta entre columnas o usa el botón “→”. Cada movimiento hace `UPDATE leads SET estado = ...`.
- **Búsqueda global** (`⌘K`) — autocompleta páginas y leads desde Supabase.
- **Detección automática del cuello de botella** — se calcula del lado del cliente comparando la diferencia de % entre cada par de etapas consecutivas del embudo del día.
- **Polling 30s + indicador “actualizado hace X seg”** en la barra superior.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 3
- React Router 6
- `@supabase/supabase-js` + SWR (refresh 30s)
- Charts SVG hechos a mano (sin recharts)

## Setup

```bash
npm install
cp .env .env.local       # si necesitas overridear
npm run dev
```

`.env` ya trae las credenciales del proyecto Supabase de Mar de Plata.

### Variables

| Var | Default |
|---|---|
| `VITE_SUPABASE_URL` | `https://nbciljmueoihtzznmvdg.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (anon key del proyecto) |
| `VITE_SUPABASE_BUCKET_COMPROBANTES` | `comprobantes` |
| `VITE_TZ` | `America/Mexico_City` |

## Tablas que consume

`leads`, `estado_conversacion_actual`, `asesoras`, `alertas`, `cierres_diarios`, `eventos_live`. Solo lectura, excepto `cierres_diarios` (insert) y `leads.estado` (update vía drag & drop + cierre).

## Mapeo de SQL → SDK

PostgREST no acepta CTEs sueltos, así que cada query del spec se traduce a 1–3 llamadas y composición en cliente. Ver `src/lib/queries.ts` — cada hook lleva el comentario de su query equivalente.

## Estructura

```
src/
├── App.tsx              Router (3 rutas)
├── components/
│   ├── Layout.tsx       SWRConfig + topbar
│   ├── Sidebar.tsx      Navegación + badge dinámico de alertas
│   ├── TopBar.tsx       ⌘K + indicador "actualizado hace X"
│   ├── CierresWidget.tsx  Form de pagos + upload de comprobantes
│   ├── SearchPalette.tsx  ⌘K palette
│   ├── ui.tsx           Card / Pill / Sparkline / Avatar / Tabs
│   └── feedback.tsx     Skeleton + ErrorBanner
├── lib/
│   ├── supabase.ts      Cliente + helper de día en TZ
│   ├── types.ts         Tipos espejo de las tablas
│   ├── queries.ts       Hooks SWR (1 por bloque)
│   ├── actions.ts       registrarCierre, actualizarEstadoLead, upload
│   ├── refresh.ts       Reloj global "última actualización"
│   └── time.ts          useRelativeTime
└── pages/
    ├── Inicio.tsx       Bloque A + B + C
    ├── Pipeline.tsx     Kanban con drag & drop
    └── Equipo.tsx       Tarjetas + CierresWidget
```

## Siguientes iteraciones

1. **Auth** — Supabase Auth con roles (Mar admin · Eli/Nat · onboarding). Bloquear `/equipo` para que las asesoras solo vean su propia tarjeta + su widget.
2. **Tendencias** — gráficas de los últimos 30 días para los 3 KPIs principales (usar `cierres_diarios` y `leads` con `GROUP BY date_trunc`).
3. **Eventos live** — pantalla para editar `eventos_live` (calendario de lives + códigos de descuento).
4. **Realtime** — sustituir el polling de 30s por canales realtime de Supabase para `alertas` y `cierres_diarios`.
