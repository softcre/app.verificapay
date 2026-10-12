/**
 * URL pública de la app, sin barra final. Usar esto (y no `request.url`) para
 * armar redirects: detrás del proxy de Hostinger `request.url` trae el host
 * interno del servidor (ej. https://0.0.0.0:3000).
 */
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
