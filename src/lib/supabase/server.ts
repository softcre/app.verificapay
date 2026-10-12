import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_ONLY_COOKIE, authCookieOptions } from "./session-cookie";

/**
 * `sessionOnly` fuerza la preferencia de "Mantener la sesión" (lo usa el login,
 * cuando la cookie de preferencia todavía no llegó en el request).
 */
export async function createClient(opts: { sessionOnly?: boolean } = {}) {
  const cookieStore = await cookies();
  const sessionOnly =
    opts.sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                authCookieOptions(value, options, sessionOnly)
              )
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura.
            // El proxy.ts se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    }
  );
}
