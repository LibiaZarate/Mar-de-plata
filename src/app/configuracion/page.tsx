import Link from "next/link";
import {
  Webhook,
  Settings2,
  FileText,
  KeyRound,
  ExternalLink,
  Link2,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

type Card = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

const cards: Card[] = [
  {
    href: "/configuracion/tracking",
    title: "Tracking de origen",
    description: "Genera un link de WhatsApp distinto por cada lugar (Instagram, anuncios, web) y mide de dónde vienen tus leads.",
    Icon: Link2,
  },
  {
    href: "/configuracion/meta-ads",
    title: "Meta Marketing API",
    description: "Conexión directa con Meta Ads: importa campañas, mide gasto y ROAS real cruzando con la facturación del dashboard.",
    Icon: Megaphone,
  },
  {
    href: "/configuracion/webhook",
    title: "Inspector del webhook",
    description: "Últimos POSTs recibidos en /api/webhook/manychat con payload limpio y body raw.",
    Icon: Webhook,
  },
  {
    href: "/configuracion/sistema",
    title: "Sistema",
    description: "CRUD de config_sistema · URLs de catálogos, link de grupo, montos.",
    Icon: Settings2,
  },
  {
    href: "/configuracion/prompts",
    title: "Prompts",
    description: "Lectura del system prompt del Verificador y del Agente Madre.",
    Icon: FileText,
  },
  {
    href: "/configuracion/credenciales",
    title: "Credenciales",
    description: "Conexiones a OpenRouter, ManyChat, Supabase y Whisper. Cómo configurarlas en Vercel.",
    Icon: KeyRound,
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Inicio · Configuración</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Configuración</h1>
        <div className="text-[13px] text-foreground/60 mt-2">
          Webhook · Sistema · Prompts · Credenciales
        </div>
      </div>

      <div className="border border-foreground/15 bg-cream-50 rounded-md px-5 py-3 text-[13px] text-foreground/70 flex items-start gap-3">
        <span className="font-italic-serif text-rosey-500 mt-0.5">tip →</span>
        <p>
          <span className="font-medium text-foreground">Lives</span> y{" "}
          <span className="font-medium text-foreground">Playground</span> ahora están en la barra
          lateral porque son las cosas que más vas a tocar. Aquí abajo quedan las cosas técnicas que
          se ven menos seguido.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-foreground/15 bg-cream-50 p-5 transition-colors block hover:border-rosey-300 hover:bg-rosey-50/30 group"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-foreground/15 bg-cream-100 p-2">
                <Icon className="h-4 w-4" strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-serif-display text-[22px] leading-none">{title}</div>
                  <ExternalLink className="h-3.5 w-3.5 text-foreground/40 group-hover:text-rosey-500 transition-colors" />
                </div>
                <p className="text-[12px] text-foreground/65 mt-2 leading-relaxed">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
