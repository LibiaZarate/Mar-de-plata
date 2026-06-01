import { createClient } from "@/lib/supabase/server";

// Server Component que ejecuta SELECT COUNT(*) FROM leads y renderiza.
export async function LeadsCountProbe() {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  if (error) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 rounded px-4 py-3">
        <div className="text-xs font-medium text-destructive mb-1">
          Error al consultar Supabase
        </div>
        <code className="text-[11px] font-mono text-destructive/90 break-all">
          {humanize(error.message)}
        </code>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-4">
      <div>
        <div className="label-xs mb-1">total de leads</div>
        <div className="font-serif-display text-5xl leading-none">
          {(count ?? 0).toLocaleString("es-MX")}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        registros en la tabla <code className="text-foreground">leads</code> ·
        consultado a <code className="text-foreground">nbciljmueoihtzznmvdg.supabase.co</code>
      </div>
    </div>
  );
}

function humanize(m: string): string {
  if (/Failed to fetch|fetch failed|ENOTFOUND|network/i.test(m))
    return "Sin conexión con Supabase. Revisa la red o las credenciales en .env.";
  if (/Invalid API key|JWT/i.test(m))
    return "Credenciales inválidas (NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  if (/permission denied|row-level security|RLS/i.test(m))
    return "RLS bloqueó la lectura. Necesitas una policy SELECT en la tabla leads para anon.";
  return m;
}
