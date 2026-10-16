import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMercadoPagoAuthorizationUrl } from "@/lib/mercadopago";
import { getPlanUsage, isProviderAllowed } from "@/lib/plans";
import {
  getMercadoPagoRedirectUri,
  getSiteUrl,
  MP_OAUTH_STATE_COOKIE,
} from "../shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.redirect(`${getSiteUrl()}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return Response.redirect(`${getSiteUrl()}/wallets?mp_error=solo_owner`);
  }

  // El tope de billeteras se valida en el callback: acá todavía no se sabe
  // si es una cuenta nueva o una reconexión (que no suma).
  const usage = await getPlanUsage(supabase, profile.organization_id);
  if (!isProviderAllowed(usage.plan, "mercado_pago")) {
    return Response.redirect(
      `${getSiteUrl()}/wallets?mp_error=proveedor_no_incluido`
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(MP_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = getMercadoPagoAuthorizationUrl({
    state,
    redirectUri: getMercadoPagoRedirectUri(),
  });

  return Response.redirect(authorizationUrl);
}
