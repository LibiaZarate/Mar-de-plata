// Plantillas de seguimientos. Cada tipo tiene un default editable
// desde /configuracion/seguimientos. Soporta {nombre} y {min_restantes}.

import { createAdminClient } from "@/lib/supabase/admin";

export type TipoSeguimiento =
  | "lead_frio_24h"
  | "post_compra_7d"
  | "deposito_pendiente_24h"
  | "reactivacion_30d"
  | "prueba_simulador";

export const SEGUIMIENTOS_DEFAULT: Record<
  TipoSeguimiento,
  { texto: string; descripcion: string; offset_dias: number }
> = {
  lead_frio_24h: {
    texto:
      "¡Hola {nombre}! 💗 ¿Lograste ver el catálogo, linda? Si tienes dudas o te late algo, dime para ayudarte ✨",
    descripcion: "Lead recibió catálogo y no respondió en 24h",
    offset_dias: 1,
  },
  post_compra_7d: {
    texto:
      "¡Hola {nombre}! 💕 Pasaron unos días desde tu pedido — ¿cómo te fueron tus piezas? Nos encantaría ver una foto si gustas etiquetarnos en redes 💗",
    descripcion: "Cliente compró, 7 días después",
    offset_dias: 7,
  },
  deposito_pendiente_24h: {
    texto:
      "¡Hola {nombre}! 💗 ¿Pudiste hacer el depósito de las piezas que apartamos? Aviso para no soltarlas a alguien más ✨",
    descripcion: "Pidió apartar pero no mandó depósito en 24h",
    offset_dias: 1,
  },
  reactivacion_30d: {
    texto:
      "¡Hola {nombre}! 💎 Tenemos piezas nuevas que te encantarían — ¿quieres que te pase el catálogo de novedades? 💗",
    descripcion: "Cliente sin contacto en 30 días",
    offset_dias: 30,
  },
  prueba_simulador: {
    texto: "🧪 Seguimiento de prueba para {nombre} — si ves esto, la cola funciona ✅",
    descripcion: "Disparo manual desde el playground para validar el cron",
    offset_dias: 0,
  },
};

export async function resolverPlantilla(tipo: string): Promise<string> {
  const t = tipo as TipoSeguimiento;
  const def = SEGUIMIENTOS_DEFAULT[t]?.texto ?? `Seguimiento (${tipo})`;
  const sb = createAdminClient();
  const { data } = await sb
    .from("config_sistema")
    .select("valor")
    .eq("clave", `seguimiento_${tipo}_template`)
    .maybeSingle();
  const v = ((data?.valor as string | null) ?? "").trim();
  return v || def;
}

export function renderPlantilla(
  texto: string,
  vars: { nombre?: string | null; min_restantes?: number | null },
): string {
  let out = texto;
  const nombre = (vars.nombre ?? "").trim() || "linda";
  out = out.replace(/\{nombre\}/g, nombre);
  out = out.replace(/\{min_restantes\}/g, String(vars.min_restantes ?? "?"));
  return out;
}
