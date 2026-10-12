import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { SESSION_ONLY_COOKIE, authCookieOptions } from "./session-cookie";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // El cliente del browser también refresca tokens: respetamos
      // "Mantener la sesión" igual que en el server.
      cookies: {
        getAll() {
          return parseCookieHeader(document.cookie);
        },
        setAll(cookiesToSet) {
          const sessionOnly = parseCookieHeader(document.cookie).some(
            (c) => c.name === SESSION_ONLY_COOKIE && c.value === "1"
          );
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(
              name,
              value,
              authCookieOptions(value, options, sessionOnly)
            );
          });
        },
      },
    }
  );
}
