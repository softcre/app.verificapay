"use client";

import { useActionState } from "react";
import {
  updateProfile,
  changePassword,
  type ProfileActionState,
} from "@/app/perfil/actions";
import { UserRole } from "@/lib/database.types";
import { ROLE_LABELS } from "./user-menu";

const initialState: ProfileActionState = {};

const INPUT_CLASS =
  "w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

export default function ProfileForm({
  fullName,
  email,
  role,
  shift,
  orgName,
}: {
  fullName: string;
  email: string;
  role: UserRole;
  shift: string | null;
  orgName: string | null;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    initialState
  );

  return (
    <div className="max-w-2xl space-y-5">
      <section className="bg-card border border-card-border rounded-xl">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-sm font-semibold text-foreground">
            Datos personales
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Así te ven el resto de las personas del comercio.
          </p>
        </div>

        <form action={profileAction} className="p-6 space-y-4">
          <Field label="Nombre completo" htmlFor="fullName">
            <input
              id="fullName"
              name="fullName"
              required
              maxLength={80}
              defaultValue={fullName}
              autoComplete="name"
              className={INPUT_CLASS}
            />
          </Field>

          {role === "employee" && (
            <Field label="Turno / Caja" htmlFor="shift">
              <input
                id="shift"
                name="shift"
                defaultValue={shift ?? ""}
                placeholder="Caja 1 — Turno Mañana"
                className={INPUT_CLASS}
              />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <ReadOnly label="Email" value={email} />
            <ReadOnly label="Rol" value={ROLE_LABELS[role]} />
            {orgName && <ReadOnly label="Comercio" value={orgName} />}
          </div>

          <Feedback state={profileState} />

          <div className="flex justify-end">
            <SubmitButton pending={profilePending} label="Guardar cambios" />
          </div>
        </form>
      </section>

      <section className="bg-card border border-card-border rounded-xl">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-sm font-semibold text-foreground">
            Cambiar contraseña
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Para confirmar que sos vos, ingresá tu contraseña actual.
          </p>
        </div>

        <form action={passwordAction} className="p-6 space-y-4">
          <Field label="Contraseña actual" htmlFor="currentPassword">
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={INPUT_CLASS}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nueva contraseña" htmlFor="newPassword">
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Repetí la nueva contraseña" htmlFor="confirmPassword">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Feedback state={passwordState} />

          <div className="flex justify-end">
            <SubmitButton
              pending={passwordPending}
              label="Actualizar contraseña"
            />
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground mb-1.5"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>
      <p className="px-3 py-2.5 rounded-lg bg-background border border-card-border text-sm text-muted truncate">
        {value}
      </p>
    </div>
  );
}

function Feedback({ state }: { state: ProfileActionState }) {
  if (state.error) {
    return (
      <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-sm text-green-800 bg-success-bg rounded-lg px-3 py-2">
        {state.success}
      </p>
    );
  }
  return null;
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}
