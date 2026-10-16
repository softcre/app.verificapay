import { createServiceClient } from "@/lib/supabase/service";
import {
  MercadoPagoAuthError,
  refreshMercadoPagoToken,
} from "@/lib/mercadopago";
import { errorMessage, logIntegrationEvent } from "@/lib/integration-events";

// Los tokens viven en `wallet_credentials`, que no tiene policies de RLS: solo
// se leen y escriben acá, server-side, con la service key. Quien llame a estas
// funciones tiene que haber verificado antes que el usuario puede usar esa
// billetera (por ejemplo, leyéndola de `wallets` con el cliente del usuario).

export interface WalletCredentials {
  access_token: string | null;
  refresh_token: string | null;
}

export async function getWalletCredentials(
  walletId: string
): Promise<WalletCredentials | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("wallet_credentials")
    .select("access_token, refresh_token")
    .eq("wallet_id", walletId)
    .maybeSingle();
  return data;
}

export async function saveWalletCredentials(
  walletId: string,
  credentials: WalletCredentials
) {
  const supabase = createServiceClient();
  return supabase
    .from("wallet_credentials")
    .upsert({ wallet_id: walletId, ...credentials }, { onConflict: "wallet_id" });
}

// Ejecuta `fn` con el access token de la billetera. Si MP lo rechaza por
// vencido, lo renueva con el refresh token, persiste el par nuevo y reintenta
// una sola vez. Si no se puede renovar, marca la billetera en "error" para que
// el dueño la vuelva a conectar.
export async function withMercadoPagoToken<T>(
  walletId: string,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const credentials = await getWalletCredentials(walletId);
  if (!credentials?.access_token) {
    throw new MercadoPagoAuthError("La billetera no tiene access token");
  }

  try {
    return await fn(credentials.access_token);
  } catch (err) {
    if (!(err instanceof MercadoPagoAuthError)) throw err;
  }

  const newAccessToken = await renewAccessToken(
    walletId,
    credentials.access_token
  );
  return fn(newAccessToken);
}

async function renewAccessToken(
  walletId: string,
  rejectedAccessToken: string
): Promise<string> {
  // Otro request concurrente pudo haberlo renovado mientras tanto: en ese caso
  // se usa el token nuevo en vez de gastar el refresh token otra vez.
  const current = await getWalletCredentials(walletId);
  if (current?.access_token && current.access_token !== rejectedAccessToken) {
    return current.access_token;
  }

  if (!current?.refresh_token) {
    const reason =
      "La billetera no tiene refresh token; hay que volver a conectarla";
    await markWalletAsError(walletId, reason);
    throw new MercadoPagoAuthError(reason);
  }

  let tokens;
  try {
    tokens = await refreshMercadoPagoToken(current.refresh_token);
  } catch (err) {
    console.error("No se pudo renovar el token de Mercado Pago:", err);
    const reason =
      "No se pudo renovar el token; hay que volver a conectar la billetera";
    await markWalletAsError(walletId, `${reason} (${errorMessage(err)})`);
    throw new MercadoPagoAuthError(reason);
  }

  const { error } = await saveWalletCredentials(walletId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? current.refresh_token,
  });
  if (error) {
    console.error("No se pudo guardar el token renovado de Mercado Pago:", error);
  }

  return tokens.access_token;
}

async function markWalletAsError(walletId: string, reason: string) {
  const supabase = createServiceClient();
  const { data: wallet } = await supabase
    .from("wallets")
    .update({
      status: "error",
      last_error: reason,
      last_error_at: new Date().toISOString(),
    })
    .eq("id", walletId)
    .select("organization_id")
    .maybeSingle();

  await logIntegrationEvent({
    source: "token",
    message: reason,
    organizationId: wallet?.organization_id,
    walletId,
  });
}
