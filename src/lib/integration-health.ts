import { Wallet } from "./database.types";

/**
 * Estado de la integración de una billetera, de peor a mejor:
 * - error: el token no sirve; el dueño tiene que reconectarla.
 * - failing: activa, pero la última sincronización o webhook falló.
 * - stale: hace más de STALE_HOURS que no se sincroniza. La sincronización
 *   corre cuando alguien abre el panel de pagos, así que puede ser solo que
 *   nadie lo abrió; si además hay ventas, algo anda mal.
 * - never: activa y todavía no se sincronizó nunca.
 * - ok / manual (proveedor sin API: no se sincroniza) / inactive.
 */
export type WalletHealth =
  | "error"
  | "failing"
  | "stale"
  | "never"
  | "ok"
  | "manual"
  | "inactive";

export const STALE_HOURS = 24;

type HealthWallet = Pick<
  Wallet,
  "provider" | "status" | "last_synced_at" | "last_error"
>;

export function walletHealth(wallet: HealthWallet, now = new Date()): WalletHealth {
  if (wallet.status === "inactive") return "inactive";
  if (wallet.status === "error") return "error";
  if (wallet.last_error) return "failing";
  if (wallet.provider !== "mercado_pago") return "manual";
  if (!wallet.last_synced_at) return "never";
  const hours =
    (now.getTime() - new Date(wallet.last_synced_at).getTime()) / 3_600_000;
  return hours > STALE_HOURS ? "stale" : "ok";
}

/** Orden para listar primero lo más grave. */
export const HEALTH_SEVERITY: Record<WalletHealth, number> = {
  error: 0,
  failing: 1,
  stale: 2,
  never: 3,
  ok: 4,
  manual: 5,
  inactive: 6,
};

export function needsAttention(health: WalletHealth) {
  return HEALTH_SEVERITY[health] <= HEALTH_SEVERITY.never;
}

export const HEALTH_LABELS: Record<WalletHealth, string> = {
  error: "Desconectada",
  failing: "Con fallos",
  stale: "Desactualizada",
  never: "Sin sincronizar",
  ok: "OK",
  manual: "Manual",
  inactive: "Inactiva",
};

export const HEALTH_TONES: Record<WalletHealth, string> = {
  error: "bg-danger-bg text-danger-fg",
  failing: "bg-danger-bg text-danger-fg",
  stale: "bg-warning-bg text-warning-fg",
  never: "bg-warning-bg text-warning-fg",
  ok: "bg-success-bg text-success-fg",
  manual: "bg-card-border text-muted",
  inactive: "bg-card-border text-muted",
};

/** "hace 5 min", "hace 3 h", "hace 2 d"; "nunca" si no hay fecha. */
export function timeAgo(date: string | null | undefined, now = new Date()) {
  if (!date) return "nunca";
  const minutes = Math.floor((now.getTime() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}
