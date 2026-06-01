// Cliente Supabase para Server Components, Route Handlers, Server Actions.
// Hereda la sesión del usuario desde cookies. Sigue usando anon key + RLS.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // En Server Components no se pueden setear cookies. Lo dejamos no-op.
        },
        remove() {
          // Idem.
        },
      },
    },
  );
}
