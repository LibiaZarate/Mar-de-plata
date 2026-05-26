// Mock data store for the Mar de Plata Taxco workspace.
// No backend — everything is in-memory. State is exposed via a tiny
// pub-sub so components can re-render when data changes.

import { useEffect, useState } from "react";

export type Stage =
  | "nuevas"
  | "preguntando"
  | "cotizada"
  | "esperando_pago"
  | "pagada";

export type Channel = "meta" | "tiktok" | "grupo" | "recurrente" | "organico";

export type Lead = {
  id: string;
  name: string;
  city: string;
  channel: Channel;
  product: string;
  amount: number;
  stage: Stage;
  assignedTo: "eli" | "nat" | "jess";
  flags: ("urgente" | "objecion" | "fan" | "comprobante" | "parcial")[];
  note?: string;
  lastUpdate: string;
  ageHours: number;
};

export type Advisor = {
  id: "eli" | "nat" | "jess";
  name: string;
  role: string;
  status: "activa" | "cerca_del_tope" | "aprendiendo" | "onboarding";
  since: string;
  conversations: number;
  avgResponseMin: number;
  closed: number;
  selfScore: number | null;
  complaints: number;
  satisfaction: number | null;
  notes?: { learning: string[]; mastered: string[] };
};

export type Event = {
  id: string;
  when: string;
  title: string;
  detail: string;
};

export const STAGE_LABEL: Record<Stage, string> = {
  nuevas: "Nuevas",
  preguntando: "Preguntando",
  cotizada: "Cotizada",
  esperando_pago: "Esperando pago",
  pagada: "Pagada",
};

export const STAGE_TONE: Record<Stage, string> = {
  nuevas: "skyy",
  preguntando: "lila",
  cotizada: "ambr",
  esperando_pago: "ambr",
  pagada: "sage",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  grupo: "Grupo abierto",
  recurrente: "Recurrente",
  organico: "Orgánico",
};

export const CHANNEL_DOT: Record<Channel, string> = {
  meta: "bg-skyy-300",
  tiktok: "bg-lila-300",
  grupo: "bg-sage-300",
  recurrente: "bg-ambr-300",
  organico: "bg-rosey-300",
};

// ---------- Seed data ----------

const seedLeads: Lead[] = [
  // Nuevas (12)
  {
    id: "L-1001",
    name: "Mariana G.",
    city: "Toluca",
    channel: "meta",
    product: "Charms Pandora Día de las Madres",
    amount: 1200,
    stage: "nuevas",
    assignedTo: "eli",
    flags: [],
    note: "Sirena atendiendo — línea Pandora",
    lastUpdate: "hace 8m",
    ageHours: 0.13,
  },
  {
    id: "L-1002",
    name: "Cecilia E.",
    city: "CDMX",
    channel: "tiktok",
    product: "Reel Taxco artesanal",
    amount: 1250,
    stage: "nuevas",
    assignedTo: "nat",
    flags: [],
    note: "Sirena atendiendo · Pidió catálogo",
    lastUpdate: "hace 14m",
    ageHours: 0.23,
  },
  {
    id: "L-1003",
    name: "Daniela P.",
    city: "Querétaro",
    channel: "meta",
    product: "TOWS Réplica MX",
    amount: 950,
    stage: "nuevas",
    assignedTo: "eli",
    flags: [],
    lastUpdate: "hace 22m",
    ageHours: 0.36,
  },
  {
    id: "L-1004",
    name: "Paty R.",
    city: "GDL",
    channel: "meta",
    product: "Anillo de plata 925",
    amount: 780,
    stage: "nuevas",
    assignedTo: "nat",
    flags: [],
    lastUpdate: "hace 31m",
    ageHours: 0.51,
  },

  // Preguntando (18)
  {
    id: "L-2001",
    name: "Lucy M.",
    city: "CDMX",
    channel: "meta",
    product: "Charms Pandora Día de las Madres",
    amount: 0,
    stage: "preguntando",
    assignedTo: "nat",
    flags: ["objecion"],
    note: "Objeción · precio",
    lastUpdate: "hace 2h 14m",
    ageHours: 2.23,
  },
  {
    id: "L-2002",
    name: "Karina V.",
    city: "Cuernavaca",
    channel: "tiktok",
    product: "Reel Taxco artesanal",
    amount: 0,
    stage: "preguntando",
    assignedTo: "eli",
    flags: ["urgente"],
    note: "Sin respuesta hace 2h 14m",
    lastUpdate: "hace 2h 14m",
    ageHours: 2.23,
  },
  {
    id: "L-2003",
    name: "Jimena F.",
    city: "Puebla",
    channel: "grupo",
    product: "Aretes boda 2026",
    amount: 0,
    stage: "preguntando",
    assignedTo: "jess",
    flags: [],
    note: "Pidió cotizando · grupo abierto",
    lastUpdate: "hace 3h",
    ageHours: 3.0,
  },

  // Cotizada
  {
    id: "L-3001",
    name: "Brenda T.",
    city: "Puebla",
    channel: "recurrente",
    product: "3er pedido · línea Taxco",
    amount: 2840,
    stage: "cotizada",
    assignedTo: "eli",
    flags: ["fan"],
    note: "Recurrente · cliente fan",
    lastUpdate: "hace 1h",
    ageHours: 1.0,
  },
  {
    id: "L-3002",
    name: "Pao H.",
    city: "Toluca",
    channel: "meta",
    product: "Reel Taxco artesanal",
    amount: 1450,
    stage: "cotizada",
    assignedTo: "nat",
    flags: [],
    note: "Reenviar cotización",
    lastUpdate: "hace 4h",
    ageHours: 4.0,
  },
  {
    id: "L-3003",
    name: "Vero C.",
    city: "CDMX",
    channel: "grupo",
    product: "Mayoreo · 8 piezas",
    amount: 5120,
    stage: "cotizada",
    assignedTo: "eli",
    flags: [],
    lastUpdate: "hace 6h",
    ageHours: 6.0,
  },

  // Esperando pago
  {
    id: "L-4001",
    name: "Lupita D.",
    city: "GDL",
    channel: "meta",
    product: "Mayoreo · 12 piezas",
    amount: 6240,
    stage: "esperando_pago",
    assignedTo: "nat",
    flags: ["comprobante"],
    note: "Comprobante recibido · revisar",
    lastUpdate: "hace 35m",
    ageHours: 0.58,
  },
  {
    id: "L-4002",
    name: "Karen J.",
    city: "Puebla",
    channel: "recurrente",
    product: "Anillos · 4 pzs",
    amount: 1980,
    stage: "esperando_pago",
    assignedTo: "eli",
    flags: ["parcial"],
    note: "Pagó parcial 50%",
    lastUpdate: "hace 2h",
    ageHours: 2.0,
  },
  {
    id: "L-4003",
    name: "Hefer V.",
    city: "Mérida",
    channel: "recurrente",
    product: "Pulsera personalizada",
    amount: 1280,
    stage: "esperando_pago",
    assignedTo: "nat",
    flags: [],
    note: "Sin pago aún",
    lastUpdate: "hace 1d",
    ageHours: 26.0,
  },

  // Pagada
  {
    id: "L-5001",
    name: "Sofía E.",
    city: "CDMX",
    channel: "meta",
    product: "Charms Pandora Día de las Madres",
    amount: 1840,
    stage: "pagada",
    assignedTo: "eli",
    flags: [],
    note: "Preparación · pasar a envío",
    lastUpdate: "hace 1h",
    ageHours: 1.0,
  },
  {
    id: "L-5002",
    name: "Itzel B.",
    city: "Querétaro",
    channel: "grupo",
    product: "Aretes boda",
    amount: 2220,
    stage: "pagada",
    assignedTo: "nat",
    flags: [],
    note: "Marcar enviado",
    lastUpdate: "hace 3h",
    ageHours: 3.0,
  },
  {
    id: "L-5003",
    name: "Caro M.",
    city: "CDMX",
    channel: "recurrente",
    product: "Anillo boda",
    amount: 1560,
    stage: "pagada",
    assignedTo: "eli",
    flags: [],
    lastUpdate: "hace 5h",
    ageHours: 5.0,
  },
];

const seedAdvisors: Advisor[] = [
  {
    id: "eli",
    name: "Eli",
    role: "Asesora senior",
    status: "activa",
    since: "2024",
    conversations: 142,
    avgResponseMin: 4,
    closed: 38,
    selfScore: 9,
    complaints: 0,
    satisfaction: 94,
  },
  {
    id: "nat",
    name: "Nat",
    role: "Asesora senior",
    status: "cerca_del_tope",
    since: "2024",
    conversations: 156,
    avgResponseMin: 7,
    closed: 41,
    selfScore: 7,
    complaints: 1,
    satisfaction: 89,
  },
  {
    id: "jess",
    name: "Jess",
    role: "Onboarding · día 7 de 30",
    status: "aprendiendo",
    since: "2026",
    conversations: 42,
    avgResponseMin: 12,
    closed: 6,
    selfScore: null,
    complaints: 0,
    satisfaction: null,
    notes: {
      learning: ["Objeciones de precio", "Cierre mayoreo", "Comprobantes"],
      mastered: ["FAQ catálogo", "Envíos"],
    },
  },
];

const seedEvents: Event[] = [
  {
    id: "EV-1",
    when: "11:00 AM hoy",
    title: "Live de mayoreo",
    detail: "Sirena va a invitar al grupo cerrado · 685 miembros",
  },
  {
    id: "EV-2",
    when: "2:30 PM hoy",
    title: "Salen 4 envíos",
    detail: "Paquetería local",
  },
  {
    id: "EV-3",
    when: "Mañana 11 AM",
    title: "Entrega Joyería León",
    detail: "24 piezas · colección Taxco",
  },
  {
    id: "EV-4",
    when: "Jueves",
    title: "Nuevo lote TOWS",
    detail: "Esperado · proveedor CDMX",
  },
];

// ---------- Reactive store ----------

type Listener = () => void;
const listeners = new Set<Listener>();

const state = {
  leads: [...seedLeads],
  advisors: [...seedAdvisors],
  events: [...seedEvents],
  // running KPIs (stay close to wireframe values)
  facturacionHoy: 11240,
  pedidosHoy: 8,
  ticketPromedio: 1405,
  pedidosMayoreo: 5,
  pedidosMenudeo: 3,
  leadsHoy: 47,
  leadsPorCanal: { meta: 23, tiktok: 8, grupo: 12, organico: 4 },
  enCancha: { comprobantes: 5, cotizaciones: 3, reclamos: 1 },
  conversionGlobal: 12.5,
  facturacion30d: 286400,
  facturacion30dDelta: 23,
  mejorDia: 14820,
  peorDia: 3140,
  promDiario: 9547,
  cuelloBotella: { from: "Preguntando", to: "Cotizada", fuga: 59, tiempo: "18h" },
  tiempoLeadVenta: { mediana: "2.4 días", p90: "5.2 días", p10: "3h" },
  funnel: [
    { stage: "nuevas", count: 120 },
    { stage: "preguntando", count: 78 },
    { stage: "cotizada", count: 32 },
    { stage: "esperando_pago", count: 22 },
    { stage: "pagada", count: 15 },
  ] as { stage: Stage; count: number }[],
  tiempoEnEtapa: [
    { stage: "Nuevas", label: "2h 18m", w: 18 },
    { stage: "Preguntando", label: "18h pr", w: 95 },
    { stage: "Cotizada", label: "6h 04m", w: 38 },
    { stage: "Esperando pago", label: "9h 12m", w: 52 },
    { stage: "Pagada → enviado", label: "12h 30m", w: 64 },
  ],
  conversionPorCanal: [
    { channel: "recurrente", pct: 64, leads: 18, ventas: 12 },
    { channel: "grupo", pct: 23, leads: 62, ventas: 14 },
    { channel: "meta", pct: 18, leads: 142, ventas: 26 },
    { channel: "tiktok", pct: 9, leads: 98, ventas: 9 },
  ] as { channel: Channel; pct: number; leads: number; ventas: number }[],
  topAds: [
    { rank: 1, name: "Charms Pandora Día de las Madres", channel: "meta", leads: 142, sales: 38, revenue: 48200 },
    { rank: 2, name: "Reel Taxco artesanal", channel: "tiktok", leads: 98, sales: 21, revenue: 26400 },
    { rank: 3, name: "TOWS Réplica MX", channel: "meta", leads: 84, sales: 16, revenue: 21800 },
    { rank: 4, name: "Grupo abierto · organic post", channel: "grupo", leads: 62, sales: 14, revenue: 18600 },
    { rank: 5, name: "Anillos boda 2026", channel: "meta", leads: 48, sales: 8, revenue: 11200 },
  ],
  respuestaPct: 96,
  respuestaTotal: 1846,
  facturacionSpark: [8.4, 9.1, 7.5, 11.2, 12.6, 9.8, 13.4, 10.1, 11.9, 13.8, 14.8, 12.2, 12.9, 11.0, 13.6, 12.4, 11.7, 10.8, 12.8, 14.0, 13.1, 11.6, 12.0, 9.4, 10.2, 11.1, 12.5, 13.9, 12.6, 14.2],
};

export type State = typeof state;

function emit() {
  for (const l of listeners) l();
}

export const store = {
  get: () => state,
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  moveLead(id: string, to: Stage) {
    const lead = state.leads.find((l) => l.id === id);
    if (!lead || lead.stage === to) return;
    lead.stage = to;
    lead.lastUpdate = "ahora";
    lead.ageHours = 0;
    emit();
  },
  registerOrder(input: { name: string; city: string; amount: number; product: string; channel: Channel; advisor: Lead["assignedTo"] }) {
    const id = `L-${Math.floor(Math.random() * 9000 + 1000)}`;
    state.leads.unshift({
      id,
      name: input.name,
      city: input.city,
      channel: input.channel,
      product: input.product,
      amount: input.amount,
      stage: "pagada",
      assignedTo: input.advisor,
      flags: [],
      note: "Recién registrado",
      lastUpdate: "ahora",
      ageHours: 0,
    });
    state.pedidosHoy += 1;
    state.facturacionHoy += input.amount;
    state.ticketPromedio = Math.round(state.facturacionHoy / state.pedidosHoy);
    emit();
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  const [value, setValue] = useState(() => selector(state));
  useEffect(() => {
    return store.subscribe(() => setValue(selector(state)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export function formatMxn(n: number): string {
  return "$" + n.toLocaleString("es-MX");
}
