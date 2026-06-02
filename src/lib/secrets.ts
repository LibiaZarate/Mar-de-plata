// Lectura/escritura de secretos desde Supabase config_sistema con
// fallback a env vars. Solo server-side.
//
// Precedencia: config_sistema > env var > null
//
// Razón: Mar quiere meter credenciales desde el dashboard sin tocar
// archivos. config_sistema es la fuente de verdad operativa. Si está
// vacío, usamos lo que esté en env vars (útil para arranque y para
// SUPABASE_SERVICE_ROLE_KEY que NO puede vivir en config_sistema porque
// se necesita para leer config_sistema).

import { createAdminClient } from "@/lib/supabase/admin";

export async function getSecret(clave: string): Promise<string | null> {
  // 1. Intentar Supabase
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("config_sistema")
      .select("valor")
      .eq("clave", clave)
      .maybeSingle();
    const v = (data?.valor as string | null) ?? null;
    if (v && v.trim() !== "") return v.trim();
  } catch {
    // Si createAdminClient falla (no hay service role), caemos a env
  }

  // 2. Fallback a env var (uppercase)
  const envKey = clave.toUpperCase();
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();

  return null;
}

export async function setSecret(
  clave: string,
  valor: string,
  descripcion?: string,
): Promise<void> {
  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("config_sistema")
    .select("clave")
    .eq("clave", clave)
    .maybeSingle();
  const payload = {
    valor,
    descripcion: descripcion ?? null,
    actualizado_en: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await sb
      .from("config_sistema")
      .update(payload)
      .eq("clave", clave);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("config_sistema").insert({
      clave,
      ...payload,
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteSecret(clave: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("config_sistema").delete().eq("clave", clave);
  if (error) throw new Error(error.message);
}

// Enmascara un secret para mostrar en UI sin exponerlo completo.
// "EAAODkff5zoAB..." → "EAAO...sQFTwqTECG"
export function mascaraSecret(valor: string | null | undefined): string {
  if (!valor) return "";
  if (valor.length <= 12) return "•".repeat(valor.length);
  return valor.slice(0, 4) + "…" + valor.slice(-8);
}
