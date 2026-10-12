"use client";

import { Suspense, useActionState } from "react";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/app/auth/actions";

const initialState: AuthActionState = {};

/** El callback manda acá con ?expirado=1 si el link ya no sirve. */
function ExpiredNotice() {
  if (useSearchParams().get("expirado") !== "1") return null;
  return (
    <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2 mb-4">
      El link expiró o ya fue usado. Pedí uno nuevo.
    </p>
  );
}

export default function RecoverPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="w-48 h-auto" />
          <h1 className="text-xl font-bold text-foreground mt-4">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-muted mt-1 text-center">
            Te enviamos un link a tu email para crear una nueva.
          </p>
        </div>

        <Suspense fallback={null}>
          <ExpiredNotice />
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

          {state?.error && (
            <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p className="text-sm text-green-800 bg-success-bg rounded-lg px-3 py-2">
              {state.success}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Enviar link"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          <Link href="/login" className="text-primary font-medium">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
