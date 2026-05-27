export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-cream-200"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const text = humanize(message);
  return (
    <div className="border border-rosey-300 bg-rosey-50/40 rounded-md px-3 py-2 text-[12px] text-rosey-400">
      {text}
    </div>
  );
}

function humanize(m: string): string {
  if (/Failed to fetch|NetworkError/i.test(m))
    return "Sin conexión con Supabase. Revisa la red o las credenciales en .env.";
  if (/Invalid API key|JWT/i.test(m))
    return "Credenciales de Supabase inválidas.";
  if (/permission denied|RLS/i.test(m))
    return "RLS te bloqueó: necesitas políticas de lectura para esta tabla.";
  return m;
}
