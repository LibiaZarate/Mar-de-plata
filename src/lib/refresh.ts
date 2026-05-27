// Reloj global de "última actualización" del dashboard.
// Cada query SWR exitosa lo bumpea desde queries.ts (vía middleware).

import { useEffect, useState } from "react";

let lastRefresh: number | null = null;
const listeners = new Set<() => void>();

export function markRefreshed() {
  lastRefresh = Date.now();
  for (const l of listeners) l();
}

export function useLastRefresh(): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((x) => x + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return lastRefresh;
}
