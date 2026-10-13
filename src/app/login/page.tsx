"use client";

import { Suspense, useActionState } from "react";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

/** El proxy manda acá con ?suspendido=1 cuando el dueño suspendió al cajero. */
function SuspendedNotice() {
  if (useSearchParams().get("suspendido") !== "1") return null;
  return (
    <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2 mb-4">
      Tu acceso fue suspendido por el dueño del comercio.
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1>
            <BrandLogo className="w-48 h-auto" />
          </h1>
          <p className="text-sm text-muted mt-4">
            Iniciá sesión para verificar pagos
          </p>
        </div>

        <Suspense fallback={null}>
          <SuspendedNotice />
        </Suspense>

        <form
          action={formAction}
          className="bg-card border border-card-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="tu@comercio.com"
            />
          </div>

          {/* El link va después del input en el DOM para que el Tab pase de
              email a contraseña; se posiciona arriba a la derecha con CSS. */}
          <div className="relative">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="••••••••"
            />
            <Link
              href="/recuperar"
              className="absolute top-0.5 right-0 text-xs text-primary font-medium hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="size-4 rounded border-card-border accent-primary"
            />
            Mantener la sesión iniciada
          </label>

          {state?.error && (
            <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-6">
          © {new Date().getFullYear()} VerificaPay by Softcre. Todos los
          derechos reservados.
        </p>
      </div>
    </div>
  );
}
