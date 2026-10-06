import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeMercadoPagoOAuthCode } from "@/lib/mercadopago";
import { saveWalletCredentials } from "@/lib/mercadopago-wallet";
import {
  getMercadoPagoRedirectUri,
  getSiteUrl,
  MP_OAUTH_STATE_COOKIE,
} from "../shared";

export const dynamic = "force-dynamic";

function redirectToWallets(query: string) {
  return Response.redirect(`${getSiteUrl()}/wallets${query}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const mpError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(MP_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(MP_OAUTH_STATE_COOKIE);

  if (mpError) {
    return redirectToWallets("?mp_error=" + encodeURIComponent(mpError));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToWallets("?mp_error=estado_invalido");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectToWallets("?mp_error=sesion_expirada");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return redirectToWallets("?mp_error=solo_owner");
  }

  let tokens;
  try {
    tokens = await exchangeMercadoPagoOAuthCode({
      code,
      redirectUri: getMercadoPagoRedirectUri(),
    });
  } catch {
    return redirectToWallets("?mp_error=canje_fallido");
  }

  const collectorId = String(tokens.user_id);

  const { data: existing } = await supabase
    .from("wallets")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "mercado_pago")
    .eq("collector_id", collectorId)
    .maybeSingle();

  const walletData = {
    organization_id: profile.organization_id,
    provider: "mercado_pago" as const,
    alias: "Mercado Pago",
    public_key: tokens.public_key ?? null,
    collector_id: collectorId,
    status: "active" as const,
    connected_by: user.id,
  };

  // La escritura en `wallets` pasa por RLS (solo el owner); recién con eso
  // confirmado se guardan los tokens con la service key.
  const { data: wallet, error } = existing
    ? await supabase
        .from("wallets")
        .update(walletData)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase.from("wallets").insert(walletData).select("id").single();

  if (error || !wallet) {
    return redirectToWallets("?mp_error=guardado_fallido");
  }

  const { error: credentialsError } = await saveWalletCredentials(wallet.id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
  });

  if (credentialsError) {
    return redirectToWallets("?mp_error=guardado_fallido");
  }

  return redirectToWallets("?mp_connected=1");
}
