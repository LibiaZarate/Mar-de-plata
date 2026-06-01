import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { LeadsCountProbe } from "@/components/inicio/leads-count-probe";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="px-10 py-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="label-xs">Inicio · vista general</div>
          <h1 className="font-serif-display text-5xl leading-none mt-2">
            <Greeting />, Mar
          </h1>
          <div className="text-[12px] text-muted-foreground mt-2 capitalize">
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
        <Sparkles
          className="h-5 w-5 text-primary mt-3"
          strokeWidth={1.5}
        />
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="label-xs mb-3">Fase 1 · validación de conexión</div>
        <h2 className="font-serif-display text-2xl mb-4">
          Query de prueba a Supabase
        </h2>
        <pre className="text-xs font-mono bg-muted rounded px-3 py-2 mb-4 overflow-x-auto">
          SELECT COUNT(*) FROM leads;
        </pre>

        <Suspense fallback={<ProbeSkeleton />}>
          <LeadsCountProbe />
        </Suspense>

        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Esta tarjeta valida que el cliente de Supabase está bien configurado
          y que la tabla <code className="text-foreground">leads</code> es
          legible con la <code className="text-foreground">anon key</code>. Si
          ves un error de RLS, hay que crear políticas de lectura para esta
          tabla. Si ves un error de red, revisa{" "}
          <code className="text-foreground">.env</code>.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="label-xs mb-3">Roadmap activo (ver CLAUDE.md §16)</div>
        <ol className="text-sm space-y-2 text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">
              ✓ 1. Setup Next.js + Tailwind + Supabase + layout
            </span>{" "}
            — esta entrega
          </li>
          <li>2. Webhook receptor /api/webhook/manychat</li>
          <li>3. Capa guardrails con keywords</li>
          <li>4. Lookup y registro de lead</li>
          <li>5. Llamada Verificador (Haiku) vía OpenRouter</li>
          <li>6. Llamada Agente Madre (Opus) con 5 tools</li>
          <li>7. Implementar 5 tools una por una</li>
          <li>8. Pantalla Inicio (KPIs, operativos, embudo)</li>
          <li>9. Pantalla Pipeline</li>
          <li>10. Pantalla Equipo + cierres diarios</li>
          <li>11. Pantalla Configuración (lives, sistema, prompts, credenciales, playground)</li>
          <li>12. Migración final (cambiar webhook URL en ManyChat)</li>
        </ol>
      </section>
    </div>
  );
}

function Greeting() {
  // En SSR usa la hora del servidor — basta para el saludo.
  const hour = new Date().getHours();
  if (hour < 12) return <>Buenos días</>;
  if (hour < 19) return <>Buenas tardes</>;
  return <>Buenas noches</>;
}

function ProbeSkeleton() {
  return (
    <div className="h-16 rounded bg-muted animate-pulse" />
  );
}
