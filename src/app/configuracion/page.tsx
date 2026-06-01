import Link from "next/link";
import {
  Webhook,
  Radio,
  Settings2,
  FileText,
  KeyRound,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

type Card = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  phase: number;
  ready: boolean;
};

const cards: Card[] = [
  {
    href: "/configuracion/webhook",
    title: "Inspector del webhook",
    description:
      "Últimos POSTs recibidos en /api/webhook/manychat con payload limpio y body raw.",
    Icon: Webhook,
    phase: 2,
    ready: true,
  },
  {
    href: "/configuracion/lives",
    title: "Lives",
    description: "CRUD de eventos_live · calendario, código de descuento, red social.",
    Icon: Radio,
    phase: 11,
    ready: true,
  },
  {
    href: "/configuracion/sistema",
    title: "Sistema",
    description: "CRUD de config_sistema · URLs de catálogos, link de grupo, montos.",
    Icon: Settings2,
    phase: 11,
    ready: true,
  },
  {
    href: "/configuracion/prompts",
    title: "Prompts",
    description: "Lectura del system prompt del Verificador y del Agente Madre.",
    Icon: FileText,
    phase: 11,
    ready: true,
  },
  {
    href: "/configuracion/credenciales",
    title: "Credenciales",
    description: "Estado de OpenRouter, ManyChat, Whisper, Redis. Sin exponer secrets.",
    Icon: KeyRound,
    phase: 11,
    ready: true,
  },
  {
    href: "/configuracion/playground",
    title: "Playground",
    description: "Chat de prueba contra Sirena con panel de debug (brief + tools).",
    Icon: PlayCircle,
    phase: 12,
    ready: true,
  },
];

export default function ConfiguracionPage() {
  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Inicio · Configuración</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">
          Configuración
        </h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Webhook · Lives · Sistema · Prompts · Credenciales · Playground del Agente
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map(({ href, title, description, Icon, phase, ready }) => (
          <Link
            key={href}
            href={ready ? href : "#"}
            aria-disabled={!ready}
            className={
              "rounded-lg border bg-card p-5 transition-colors block " +
              (ready
                ? "border-border hover:border-primary/40 hover:bg-secondary/40"
                : "border-dashed border-border opacity-60 cursor-not-allowed pointer-events-none")
            }
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-border bg-secondary p-2">
                <Icon className="h-4 w-4" strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-serif-display text-xl leading-none">
                    {title}
                  </div>
                  <span
                    className={
                      "text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border " +
                      (ready
                        ? "border-primary/40 text-primary bg-primary/5"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {ready ? "activo" : `fase ${phase}`}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
