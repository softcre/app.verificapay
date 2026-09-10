export const MP_OAUTH_STATE_COOKIE = "mp_oauth_state";

export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL.");
  }
  return siteUrl.replace(/\/$/, "");
}

export function getMercadoPagoRedirectUri(): string {
  return `${getSiteUrl()}/api/mercadopago/oauth/callback`;
}
