import { createServiceClient } from "@/lib/supabase/service";
import { WalletProvider } from "@/lib/database.types";
import {
  MercadoPagoAuthError,
  MpPayment,
  normalizeMpPayment,
  searchAllMercadoPagoPayments,
} from "@/lib/mercadopago";
import { withMercadoPagoToken } from "@/lib/mercadopago-wallet";
import { toMercadoPagoDate } from "@/lib/period";
import { recordWalletError } from "@/lib/integration-events";

// La API de la billetera es la fuente de los pagos (el webhook de MP no avisa
// de las transferencias que llegan desde otras billeteras). Para que el costo
// no crezca con la cantidad de pantallas abiertas, cada billetera se consulta
// como mucho una vez cada SYNC_INTERVAL_MS y solo por lo que cambió desde la
// última vez; los visores leen siempre de la tabla `payments`.

const SYNC_INTERVAL_MS = 30_000;
// Margen hacia atrás en cada consulta, por pagos que MP indexa con demora.
const OVERLAP_MS = 2 * 60_000;
// La primera vez se traen los 7 días del período más largo del visor.
const BACKFILL_MS = 7 * 24 * 60 * 60_000;

export interface SyncableWallet {
  id: string;
  organization_id: string;
  provider: WalletProvider;
  collector_id: string | null;
}

export type SyncResult = "synced" | "skipped" | "auth_error" | "error";

/** Fila de `payments` para un pago de MP; la usan la sincronización y el webhook. */
export function toPaymentRow(
  wallet: { id: string; organization_id: string },
  mpPayment: MpPayment
) {
  const normalized = normalizeMpPayment(mpPayment);
  return {
    organization_id: wallet.organization_id,
    wallet_id: wallet.id,
    provider: "mercado_pago" as const,
    provider_payment_id: normalized.providerId,
    amount: normalized.amount,
    currency: normalized.currency,
    status: normalized.status,
    payer_name: normalized.payerName,
    payer_email: normalized.payerEmail,
    description: normalized.description,
    payment_method: normalized.paymentMethod,
    raw: mpPayment,
    provider_created_at: normalized.createdAt,
    provider_updated_at: normalized.updatedAt,
    isIncoming: normalized.isIncoming,
  };
}

/**
 * Trae de la API los pagos nuevos o modificados de la billetera y los guarda.
 * Quien llama tiene que haber verificado que el usuario puede ver la billetera.
 */
export async function syncWalletPayments(
  wallet: SyncableWallet
): Promise<SyncResult> {
  // Por ahora solo Mercado Pago tiene API para leer los cobros.
  if (wallet.provider !== "mercado_pago") return "skipped";

  const supabase = createServiceClient();
  const now = new Date();

  // Toma el turno con un único UPDATE condicional: si otro pedido sincronizó
  // hace menos de SYNC_INTERVAL_MS, no devuelve fila y no se consulta la API.
  const claimBefore = new Date(now.getTime() - SYNC_INTERVAL_MS).toISOString();
  const { data: claimed } = await supabase
    .from("wallets")
    .update({ sync_started_at: now.toISOString() })
    .eq("id", wallet.id)
    .eq("status", "active")
    .or(`sync_started_at.is.null,sync_started_at.lt."${claimBefore}"`)
    .select("last_synced_at")
    .maybeSingle();

  if (!claimed) return "skipped";

  const floor = now.getTime() - BACKFILL_MS;
  const cursor = claimed.last_synced_at
    ? new Date(claimed.last_synced_at).getTime() - OVERLAP_MS
    : floor;
  const since = new Date(Math.max(cursor, floor));

  try {
    const { payments, truncated } = await withMercadoPagoToken(
      wallet.id,
      (accessToken) =>
        searchAllMercadoPagoPayments(accessToken, {
          collectorId: wallet.collector_id ?? undefined,
          // Por fecha de modificación: entran los pagos nuevos y también los
          // que cambiaron de estado (pendiente → acreditado).
          rangeField: "date_last_updated",
          sort: "date_last_updated",
          criteria: "asc",
          beginDate: toMercadoPagoDate(since),
          endDate: toMercadoPagoDate(now),
        })
    );

    const rows = payments.flatMap((p) => {
      const { isIncoming, ...row } = toPaymentRow(wallet, p);
      return isIncoming ? [row] : [];
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("payments")
        .upsert(rows, { onConflict: "provider,provider_payment_id" });
      if (error) throw error;
    }

    // Vienen ordenados por modificación ascendente: si se cortó por el máximo,
    // la próxima sincronización sigue desde el último que se guardó.
    const nextCursor =
      truncated && payments.length > 0
        ? payments[payments.length - 1].date_last_updated
        : now.toISOString();

    await supabase
      .from("wallets")
      .update({ last_synced_at: nextCursor, last_error: null, last_error_at: null })
      .eq("id", wallet.id);

    return "synced";
  } catch (err) {
    // El turno queda tomado: una billetera que falla se reintenta recién en
    // el próximo intervalo, no en cada pedido de cada pantalla.
    console.error(`Error sincronizando la billetera ${wallet.id}:`, err);
    await recordWalletError(wallet, "sync", err);
    return err instanceof MercadoPagoAuthError ? "auth_error" : "error";
  }
}
