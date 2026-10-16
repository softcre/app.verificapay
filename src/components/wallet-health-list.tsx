import { Wallet, WALLET_PROVIDER_LABELS } from "@/lib/database.types";
import {
  HEALTH_LABELS,
  HEALTH_SEVERITY,
  HEALTH_TONES,
  timeAgo,
  walletHealth,
} from "@/lib/integration-health";
import WalletLogo from "./wallet-logo";

export type HealthListWallet = Pick<
  Wallet,
  | "id"
  | "organization_id"
  | "provider"
  | "alias"
  | "status"
  | "last_synced_at"
  | "last_webhook_at"
  | "last_error"
  | "last_error_at"
> & { organizationName?: string | null };

/**
 * Billeteras con el estado de su integración, de la más grave a la mejor.
 * Con `showOrganization`, cada fila lleva el comercio y linkea a su detalle.
 */
export default function WalletHealthList({
  wallets,
  showOrganization = false,
  emptyText,
}: {
  wallets: HealthListWallet[];
  showOrganization?: boolean;
  emptyText: string;
}) {
  if (wallets.length === 0) {
    return (
      <p className="bg-card border border-card-border rounded-xl p-6 text-sm text-muted text-center">
        {emptyText}
      </p>
    );
  }

  const rows = wallets
    .map((wallet) => ({ wallet, health: walletHealth(wallet) }))
    .sort((a, b) => HEALTH_SEVERITY[a.health] - HEALTH_SEVERITY[b.health]);

  return (
    <div className="bg-card border border-card-border rounded-xl divide-y divide-card-border">
      {rows.map(({ wallet, health }) => (
        <div key={wallet.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <WalletLogo provider={wallet.provider} className="w-9 h-9" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {wallet.alias}
              </p>
              <p className="text-xs text-muted truncate">
                {WALLET_PROVIDER_LABELS[wallet.provider]}
                {showOrganization && (
                  <>
                    {" · "}
                    <a
                      href={`/superadmin/comercios/${wallet.organization_id}`}
                      className="text-primary hover:underline"
                    >
                      {wallet.organizationName ?? "Comercio"}
                    </a>
                  </>
                )}
              </p>
              {wallet.last_error && (
                <p className="text-xs text-danger-fg mt-1 break-words">
                  {wallet.last_error}
                  {wallet.last_error_at && (
                    <span className="text-muted"> · {timeAgo(wallet.last_error_at)}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 text-xs text-muted">
            {wallet.provider === "mercado_pago" && (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-wide">Sincronizó</p>
                  <p className="text-foreground">{timeAgo(wallet.last_synced_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide">Webhook</p>
                  <p className="text-foreground">{timeAgo(wallet.last_webhook_at)}</p>
                </div>
              </>
            )}
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${HEALTH_TONES[health]}`}
            >
              {HEALTH_LABELS[health]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
