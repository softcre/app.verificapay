"use client";

import { useActionState, useState } from "react";
import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import {
  signUpOwner,
  signUpEmployee,
  type AuthActionState,
} from "@/app/auth/actions";

const initialState: AuthActionState = {};

export default function SignupPage() {
  const [mode, setMode] = useState<"owner" | "employee">("owner");
  const [ownerState, ownerAction, ownerPending] = useActionState(
    signUpOwner,
    initialState
  );
  const [employeeState, employeeAction, employeePending] = useActionState(
    signUpEmployee,
    initialState
  );

  const state = mode === "owner" ? ownerState : employeeState;
  const pending = mode === "owner" ? ownerPending : employeePending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandLogo className="w-40 h-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Crear cuenta</h1>
        </div>

        <div className="flex gap-1 p-1 bg-card-border/40 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => setMode("owner")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "owner"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted"
            }`}
          >
            Soy dueño/a
          </button>
          <button
            type="button"
            onClick={() => setMode("employee")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "employee"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted"
            }`}
          >
            Soy empleado/a
          </button>
        </div>

        {mode === "owner" ? (
          <form
            action={ownerAction}
            className="bg-card border border-card-border rounded-xl p-6 space-y-4"
          >
            <Field
              id="businessName"
              label="Nombre del comercio"
              placeholder="Kiosco San Martín"
            />
            <Field id="fullName" label="Tu nombre" placeholder="Juan Pérez" />
            <Field
              id="email"
              label="Email"
              type="email"
              placeholder="dueno@comercio.com"
              autoComplete="email"
            />
            <Field
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />

            {state?.error && <ErrorMsg text={state.error} />}

            <SubmitButton pending={pending} label="Crear comercio" />
          </form>
        ) : (
          <form
            action={employeeAction}
            className="bg-card border border-card-border rounded-xl p-6 space-y-4"
          >
            <Field
              id="inviteCode"
              label="Código de invitación"
              placeholder="Te lo pasa el dueño/a"
            />
            <Field id="fullName" label="Tu nombre" placeholder="María García" />
            <Field
              id="shift"
              label="Turno / Caja (opcional)"
              placeholder="Caja 1 — Turno Mañana"
              required={false}
            />
            <Field
              id="email"
              label="Email"
              type="email"
              placeholder="vos@email.com"
              autoComplete="email"
            />
            <Field
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />

            {state?.error && <ErrorMsg text={state.error} />}

            <SubmitButton pending={pending} label="Unirme al comercio" />
          </form>
        )}

        <p className="text-center text-sm text-muted mt-4">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-primary font-medium">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
      {text}
    </p>
  );
}

function SubmitButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
    >
      {pending ? "Creando…" : label}
    </button>
  );
}
