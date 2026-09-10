import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMercadoPagoAuthorizationUrl } from "@/lib/mercadopago";
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return Response.redirect(`${getSiteUrl()}/wallets?mp_error=solo_owner`);
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
