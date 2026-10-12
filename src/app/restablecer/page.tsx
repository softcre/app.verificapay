"use client";

import { useActionState } from "react";
import BrandLogo from "@/components/brand-logo";
import { resetPassword, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

const inputClassName =
  "w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

/** Destino del link de recuperación: el callback ya dejó la sesión iniciada. */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="w-48 h-auto" />
          <h1 className="text-xl font-bold text-foreground mt-4">
            Nueva contraseña
          </h1>
        </div>

        <form
          action={formAction}
          className="bg-card border border-card-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClassName}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Repetir contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClassName}
              placeholder="••••••••"
            />
          </div>

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
            {pending ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
