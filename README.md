# Mar de Plata · Taxco Workspace

Dashboard funcional para el taller de plata **Mar de Plata** (Taxco), construido a partir
de los wireframes V2. Por el momento corre **sin base de datos**: los datos viven en un
mock store reactivo en memoria.

## Vistas

| Ruta | Vista |
|---|---|
| `/` | Inicio · Vista general |
| `/resumen` | Inicio · Resumen del día |
| `/kpis` | Pulso del negocio (KPIs y tendencias) |
| `/pipeline` | Pipeline activo (Kanban) |
| `/pipeline/embudo` | Trazabilidad del embudo |
| `/equipo` | Tu equipo |

## Funcional sin backend

- **Registrar pedido** (`⌘N` o el botón) → actualiza facturación, pedidos cerrados y ticket promedio en vivo.
- **Buscar** (`⌘K`) → paleta de comandos para saltar a leads y páginas.
- **Pipeline Kanban** → arrastra una tarjeta entre columnas o usa el botón “→” para avanzar la etapa.
- **Filtros** por canal y por asesora en `/pipeline`.
- **Selector de rango** (Hoy · Semana · Mes) en KPIs, Embudo y Equipo.
- Sidebar resalta la sección activa y muestra contador de leads que requieren atención.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 3
- React Router 6
- Cero dependencias gráficas: las charts (sparkline, área, donut, embudo, barras) están dibujadas a mano con SVG.

## Correr en local

```bash
npm install
npm run dev
```

Servidor: `http://localhost:5173`.

## Estructura

```
src/
├── App.tsx              Router
├── components/          Layout, Sidebar, TopBar, ui, modales
├── data/store.ts        Mock store reactivo + datos semilla
├── pages/
│   ├── Inicio.tsx       Vista general
│   ├── Resumen.tsx      Resumen del día
│   ├── Kpis.tsx         Pulso del negocio
│   ├── Pipeline.tsx     Kanban activo
│   ├── Embudo.tsx       Trazabilidad
│   └── Equipo.tsx       Eli · Nat · Jess
└── index.css            Base Tailwind + tokens
```

## Siguiente paso (cuando se conecte la BD)

El único lugar a tocar es `src/data/store.ts` — reemplazar los `seedLeads`,
`seedAdvisors`, `seedEvents` y las KPIs por llamadas reales (REST / Supabase /
lo que sea). Los componentes ya consumen el store vía el hook `useStore`, así
que solo cambiar la fuente de datos.
