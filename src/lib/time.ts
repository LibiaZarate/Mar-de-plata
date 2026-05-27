import { useEffect, useState } from "react";

export function useRelativeTime(ts: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return "—";
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "ahora";
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function useLatestUpdate(timestamps: (Date | string | null | undefined)[]): number | null {
  let max: number | null = null;
  for (const t of timestamps) {
    if (!t) continue;
    const v = typeof t === "string" ? Date.parse(t) : t.getTime();
    if (!Number.isFinite(v)) continue;
    if (max == null || v > max) max = v;
  }
  return max;
}
