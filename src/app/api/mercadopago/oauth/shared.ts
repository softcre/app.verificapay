export const MP_OAUTH_STATE_COOKIE = "mp_oauth_state";

export function getSiteUrl(): string {
  // En Vercel, si no se configuró NEXT_PUBLIC_SITE_URL, usamos el dominio de
  // producción que Vercel inyecta (viene sin protocolo).
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : undefined);
  if (!siteUrl) {
    throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL.");
  }
  return siteUrl.replace(/\/$/, "");
}

export function getMercadoPagoRedirectUri(): string {
  return `${getSiteUrl()}/api/mercadopago/oauth/callback`;
}
