import { Clock4 } from "lucide-react";

export function Soon({
  crumbs,
  title,
  sub,
  phase,
}: {
  crumbs: string;
  title: string;
  sub: string;
  phase: string;
}) {
  return (
    <div className="px-10 py-6">
      <div className="label-xs mb-2">{crumbs}</div>
      <h1 className="font-serif-display text-5xl leading-none">{title}</h1>
      <div className="text-[13px] text-muted-foreground mt-2">{sub}</div>

      <div className="mt-10 rounded-lg border border-dashed border-border bg-card px-8 py-12 flex flex-col items-center text-center max-w-md mx-auto">
        <Clock4
          className="h-10 w-10 text-muted-foreground mb-4"
          strokeWidth={1.3}
        />
        <div className="font-serif-display text-2xl mb-2">Próximamente</div>
        <p className="text-sm text-muted-foreground">{phase}</p>
        <p className="text-xs text-muted-foreground/70 mt-3">
          Las fases del roadmap viven en{" "}
          <code className="text-foreground">CLAUDE.md §16</code>. Cada fase
          requiere validación con Libi antes de avanzar.
        </p>
      </div>
    </div>
  );
}
