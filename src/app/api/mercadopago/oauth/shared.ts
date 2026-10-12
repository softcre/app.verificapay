import { getSiteUrl } from "@/lib/site-url";

export { getSiteUrl };

export const MP_OAUTH_STATE_COOKIE = "mp_oauth_state";

export function getMercadoPagoRedirectUri(): string {
  return `${getSiteUrl()}/api/mercadopago/oauth/callback`;
}
