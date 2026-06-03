import { VERIFICADOR_PROMPT } from "@/lib/agent/prompts/verificador";
import { buildSirenaSystemPrompt } from "@/lib/agent/prompts/agente_sirena";

const SIRENA_SYSTEM_PROMPT = buildSirenaSystemPrompt();

export function PromptsView() {
  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Configuración · Prompts</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">Prompts oficiales</h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Lectura de los prompts en producción. Editar requiere abrir un PR en{" "}
          <code>src/lib/agent/prompts/</code> y validación con Mar/Libi (CLAUDE.md §13).
        </div>
      </div>

      <Section title="Verificador (Haiku 4.5 · JSON · temp 0.1)" file="src/lib/agent/prompts/verificador.ts">
        <PromptBlock text={VERIFICADOR_PROMPT} />
      </Section>

      <Section title="Agente Madre Sirena (Opus 4.6 fast · temp 0.4)" file="src/lib/agent/prompts/agente_sirena.ts">
        <PromptBlock text={SIRENA_SYSTEM_PROMPT} />
      </Section>
    </div>
  );
}

function Section({ title, file, children }: { title: string; file: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-serif-display text-xl">{title}</h2>
        <code className="text-[11px] text-muted-foreground">{file}</code>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PromptBlock({ text }: { text: string }) {
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/40 rounded px-3 py-3 max-h-[480px] overflow-y-auto">
      {text}
    </pre>
  );
}
