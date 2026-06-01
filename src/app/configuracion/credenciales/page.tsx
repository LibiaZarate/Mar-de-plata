import { CredencialesPanel } from "@/components/configuracion/credenciales-panel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function probeSupabase(): Promise<"ok" | "warn" | "missing"> {
  try {
    const sb = createClient();
    const { error } = await sb.from("leads").select("*", { count: "exact", head: true });
    if (error) return "warn";
    return "ok";
  } catch {
    return "missing";
  }
}

export default async function CredencialesPage() {
  const supaProbe = await probeSupabase();
  const statuses = {
    supabasePublic:
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? supaProbe
        : "missing",
    supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "missing",
    openrouter: process.env.OPENROUTER_API_KEY ? "ok" : "warn",
    manychat: process.env.MANYCHAT_API_KEY ? "ok" : "warn",
    openai: process.env.OPENAI_API_KEY ? "ok" : "warn",
  } as const;
  return <CredencialesPanel statuses={statuses} />;
}
