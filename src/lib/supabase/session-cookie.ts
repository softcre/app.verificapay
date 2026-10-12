import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookie de preferencia: si vale "1", el usuario NO marcó "Mantener la sesión".
 * Es de sesión (sin maxAge), así que el browser la borra al cerrarse junto con
 * las cookies de auth.
 */
export const SESSION_ONLY_COOKIE = "vp-session-only";

/**
 * Supabase escribe las cookies de auth con maxAge de 400 días. Si el usuario no
 * quiere mantener la sesión, les sacamos la expiración para que sean cookies
 * de sesión. Los borrados (valor vacío / maxAge 0) se dejan como están.
 */
export function authCookieOptions(
  value: string,
  options: CookieOptions,
  sessionOnly: boolean
): CookieOptions {
  if (!sessionOnly || value === "" || options.maxAge === 0) return options;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...rest } = options;
  return rest;
}
