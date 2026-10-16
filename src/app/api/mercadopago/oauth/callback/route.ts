import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeMercadoPagoOAuthCode,
  getMercadoPagoUser,
} from "@/lib/mercadopago";
import { saveWalletCredentials } from "@/lib/mercadopago-wallet";
import { getPlanUsage, isAtLimit, planLimitMessage } from "@/lib/plans";
import {
  getMercadoPagoRedirectUri,
  getSiteUrl,
  MP_OAUTH_STATE_COOKIE,
} from "../shared";

export const dynamic = "force-dynamic";

function redirectToWallets(query: string) {
  return Response.redirect(`${getSiteUrl()}/wallets${query}`);
}

/** Con varias cuentas de MP, el apodo de la cuenta las distingue de entrada. */
async function defaultMercadoPagoAlias(accessToken: string): Promise<string> {
  try {
    const { nickname, email } = await getMercadoPagoUser(accessToken);
    const account = nickname ?? email;
    return account ? `Mercado Pago · ${account}` : "Mercado Pago";
  } catch {
    return "Mercado Pago";
  }
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

  if (!existing) {
    const usage = await getPlanUsage(supabase, profile.organization_id);
    if (isAtLimit(usage.plan?.max_wallets, usage.wallets)) {
      return redirectToWallets("?mp_error=limite_plan");
    }
  }

  const walletData = {
    organization_id: profile.organization_id,
    provider: "mercado_pago" as const,
    public_key: tokens.public_key ?? null,
    collector_id: collectorId,
    status: "active" as const,
    connected_by: user.id,
  };

  // La escritura en `wallets` pasa por RLS (solo el owner); recién con eso
  // confirmado se guardan los tokens con la service key. Al reconectar una
  // cuenta se conserva el nombre que le haya puesto el dueño.
  const { data: wallet, error } = existing
    ? await supabase
        .from("wallets")
        .update(walletData)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase
        .from("wallets")
        .insert({
          ...walletData,
          alias: await defaultMercadoPagoAlias(tokens.access_token),
        })
        .select("id")
        .single();

  if (error || !wallet) {
    return redirectToWallets(
      planLimitMessage(error) ? "?mp_error=limite_plan" : "?mp_error=guardado_fallido"
    );
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
