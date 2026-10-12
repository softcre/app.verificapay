import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Destino del link del template de mail personalizado
 * (supabase/templates/recovery.html). A diferencia de /auth/callback, valida
 * el token_hash y no depende de la cookie PKCE, así que funciona aunque el
 * mail se abra en otro navegador o dispositivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/pagos";
  // Solo rutas internas, para que el link no sirva de open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/pagos";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, getSiteUrl()));
    }
  }

  return NextResponse.redirect(new URL("/recuperar?expirado=1", getSiteUrl()));
}
