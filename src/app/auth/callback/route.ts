import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Destino del link que manda Supabase por mail (recuperación de contraseña).
 * Canjea el código por una sesión y sigue a `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/pagos";
  // Solo rutas internas, para que el link no sirva de open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/pagos";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, getSiteUrl()));
    }
  }

  return NextResponse.redirect(new URL("/recuperar?expirado=1", getSiteUrl()));
}
