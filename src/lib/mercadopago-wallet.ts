import { createServiceClient } from "@/lib/supabase/service";
import {
  MercadoPagoAuthError,
  refreshMercadoPagoToken,
} from "@/lib/mercadopago";

export interface MercadoPagoWalletTokens {
  id: string;
  access_token: string;
  refresh_token: string | null;
}

// Ejecuta `fn` con el access token de la billetera. Si MP lo rechaza por
// vencido, lo renueva con el refresh token, persiste el par nuevo y reintenta
// una sola vez. Si no se puede renovar, marca la billetera en "error" para que
// el dueño la vuelva a conectar.
//
// Las escrituras usan la service key: la renovación la puede disparar un
// cajero, y RLS solo deja al owner actualizar billeteras.
export async function withMercadoPagoToken<T>(
  wallet: MercadoPagoWalletTokens,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(wallet.access_token);
  } catch (err) {
    if (!(err instanceof MercadoPagoAuthError)) throw err;
  }

  const newAccessToken = await renewAccessToken(wallet);
  return fn(newAccessToken);
}

async function renewAccessToken(
  wallet: MercadoPagoWalletTokens
): Promise<string> {
  const supabase = createServiceClient();

  // Otro request concurrente pudo haberlo renovado mientras tanto: en ese caso
  // se usa el token nuevo en vez de gastar el refresh token otra vez.
  const { data: current } = await supabase
    .from("wallets")
    .select("access_token, refresh_token")
    .eq("id", wallet.id)
    .single();

  if (current?.access_token && current.access_token !== wallet.access_token) {
    return current.access_token;
  }

  const refreshToken = current?.refresh_token ?? wallet.refresh_token;
  if (!refreshToken) {
    await markWalletAsError(wallet.id);
    throw new MercadoPagoAuthError(
      "La billetera no tiene refresh token; hay que volver a conectarla"
    );
  }

  let tokens;
  try {
    tokens = await refreshMercadoPagoToken(refreshToken);
  } catch (err) {
    console.error("No se pudo renovar el token de Mercado Pago:", err);
    await markWalletAsError(wallet.id);
    throw new MercadoPagoAuthError(
      "No se pudo renovar el token; hay que volver a conectar la billetera"
    );
  }

  const { error } = await supabase
    .from("wallets")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? refreshToken,
      status: "active",
    })
    .eq("id", wallet.id);

  if (error) {
    console.error("No se pudo guardar el token renovado de Mercado Pago:", error);
  }

  return tokens.access_token;
}

async function markWalletAsError(walletId: string) {
  const supabase = createServiceClient();
  await supabase.from("wallets").update({ status: "error" }).eq("id", walletId);
}
