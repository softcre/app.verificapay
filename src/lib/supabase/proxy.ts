import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_ONLY_COOKIE, authCookieOptions } from "./session-cookie";

/** Solo para usuarios sin sesión: con sesión se redirige a /pagos. */
const PUBLIC_ROUTES = ["/login", "/recuperar"];
/** Accesibles con o sin sesión (ej. el callback del mail de recuperación). */
const OPEN_ROUTES = ["/auth/"];

export async function updateSession(request: NextRequest) {
  // Si Supabase no acepta el redirectTo (no está en "Redirect URLs"), el link
  // del mail cae en el Site URL con ?code= o ?token_hash=. Lo mandamos al
  // handler que corresponde en vez de perderlo en el login.
  const { pathname, searchParams } = request.nextUrl;
  if (!OPEN_ROUTES.some((route) => pathname.startsWith(route))) {
    const target = searchParams.has("token_hash")
      ? "/auth/confirm"
      : searchParams.has("code")
        ? "/auth/callback"
        : null;
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      // Hoy el único mail con link que manda la app es el de recuperación.
      if (!url.searchParams.has("next")) url.searchParams.set("next", "/restablecer");
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });
  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              authCookieOptions(value, options, sessionOnly)
            )
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => path.startsWith(route));
  const isOpenRoute = OPEN_ROUTES.some((route) => path.startsWith(route));

  if (isOpenRoute) return response;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/pagos";
    return NextResponse.redirect(url);
  }

  // Un cajero suspendido por el dueño pierde el acceso en el siguiente request,
  // aunque su sesión siga siendo válida.
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "inactive") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?suspendido=1";
      const redirectResponse = NextResponse.redirect(url);
      // signOut escribe las cookies borradas en `response`; hay que arrastrarlas
      // al redirect o la sesión seguiría viva en el browser.
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  return response;
}
