import type { FlowMode } from "@/lib/agent/mode";
import { Radio, Beaker } from "lucide-react";

export function ModeBanner({ mode }: { mode: FlowMode }) {
  if (mode === "production") {
    return (
      <div className="border-b border-rosey-300 bg-rosey-50 px-10 py-2 flex items-center gap-3 text-[12px]">
        <Radio className="h-3.5 w-3.5 text-rosey-500" />
        <span className="font-medium text-rosey-500 tracking-wider uppercase text-[10px]">
          Producción
        </span>
        <span className="text-foreground/70">
          Sirena está enviando mensajes reales a WhatsApp vía ManyChat. El Playground sigue siendo
          simulador.
        </span>
      </div>
    );
  }
  return (
    <div className="border-b border-sage-300 bg-sage-50 px-10 py-2 flex items-center gap-3 text-[12px]">
      <Beaker className="h-3.5 w-3.5 text-sage-600" />
      <span className="font-medium text-sage-600 tracking-wider uppercase text-[10px]">
        Simulador
      </span>
      <span className="text-foreground/70">
        Todo escribe en Supabase real, pero <strong>nada</strong> se envía a WhatsApp. Para activar
        producción: agrega <code className="font-mono text-foreground">MODO_PRODUCCION=true</code> en
        Vercel y redeploy.
      </span>
    </div>
  );
}
