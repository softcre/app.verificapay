"use client";

import { useActionState, useState } from "react";
import {
  Wallet,
  WalletProvider,
  UserRole,
  WALLET_PROVIDER_LABELS,
} from "@/lib/database.types";
import {
  addWallet,
  deleteWallet,
  toggleWalletStatus,
  WalletActionState,
} from "@/app/wallets/actions";
import { IconWallet, IconCheck, IconClose } from "./icons";

const PROVIDERS: WalletProvider[] = [
  "mercado_pago",
  "naranja_x",
  "uala",
  "cuenta_dni",
  "modo",
];

const initialState: WalletActionState = {};

const MP_ERROR_MESSAGES: Record<string, string> = {
  solo_owner: "Solo el dueño del comercio puede conectar billeteras.",
  estado_invalido: "La conexión con Mercado Pago expiró o no es válida. Probá de nuevo.",
  sesion_expirada: "Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.",
  canje_fallido: "No se pudo validar la autorización con Mercado Pago.",
  guardado_fallido: "No se pudo guardar la conexión con Mercado Pago.",
};

export default function WalletsManager({
  wallets,
  role,
  inviteCode,
  mpNotice,
}: {
  wallets: Wallet[];
  role: UserRole;
  inviteCode: string;
  mpNotice?: { connected?: boolean; error?: string };
}) {
  const [state, formAction, pending] = useActionState(
    addWallet,
    initialState
  );
  const isOwner = role === "owner";

  return (
    <div className="max-w-3xl space-y-6">
      {mpNotice?.connected && (
        <p className="text-sm text-green-800 bg-success-bg rounded-lg px-3 py-2">
          Tu cuenta de Mercado Pago se conectó correctamente.
        </p>
      )}
      {mpNotice?.error && (
        <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
          {MP_ERROR_MESSAGES[mpNotice.error] ??
            "No se pudo conectar con Mercado Pago."}
        </p>
      )}

      {isOwner && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-xs text-muted">Código de invitación para empleados</p>
          <p className="text-lg font-mono font-bold text-primary tracking-wider mt-1">
            {inviteCode}
          </p>
          <p className="text-xs text-muted mt-1">
            Compartí este código con tu equipo para que se unan al comercio
            desde la pantalla de registro.
          </p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">
          Billeteras configuradas
        </h2>
        <p className="text-sm text-muted mb-4">
          {isOwner
            ? "Conectá las billeteras virtuales que tu comercio acepta."
            : "Estas son las billeteras activas para verificar pagos."}
        </p>

        {wallets.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <IconWallet className="w-8 h-8 text-muted-light mx-auto mb-2" />
            <p className="text-sm text-muted">
              {isOwner
                ? "Todavía no configuraste ninguna billetera."
                : "El dueño todavía no configuró billeteras."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <WalletRow key={wallet.id} wallet={wallet} isOwner={isOwner} />
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Conectar Mercado Pago
          </h3>
          <p className="text-sm text-muted mb-3">
            Vinculá tu cuenta de Mercado Pago para que VerificaPay lea tus
            pagos automáticamente, sin tener que copiar ningún token.
          </p>
          <a
            href="/api/mercadopago/oauth/start"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
          >
            Conectar con Mercado Pago
          </a>
        </div>
      )}

      {isOwner && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Agregar billetera manualmente
          </h3>
          <form action={formAction} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Proveedor
                </label>
                <select
                  name="provider"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {WALLET_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Alias
                </label>
                <input
                  name="alias"
                  required
                  placeholder="Caja principal"
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Public Key (opcional)
                </label>
                <input
                  name="publicKey"
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Access Token (opcional)
                </label>
                <input
                  name="accessToken"
                  type="password"
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {state?.error && (
              <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {pending ? "Agregando…" : "Agregar billetera"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function WalletRow({
  wallet,
  isOwner,
}: {
  wallet: Wallet;
  isOwner: boolean;
}) {
  const [status, setStatus] = useState(wallet.status);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
          <IconWallet className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {wallet.alias}
          </p>
          <p className="text-xs text-muted">
            {WALLET_PROVIDER_LABELS[wallet.provider]}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            status === "active"
              ? "bg-success-bg text-green-800"
              : "bg-card-border text-muted"
          }`}
        >
          {status === "active" ? "Activa" : "Inactiva"}
        </span>

        {isOwner && (
          <>
            <button
              onClick={() => {
                const next = status === "active" ? "inactive" : "active";
                setStatus(next);
                toggleWalletStatus(wallet.id, next === "active");
              }}
              title={status === "active" ? "Desactivar" : "Activar"}
              className="p-1.5 rounded-lg border border-card-border text-muted hover:text-foreground"
            >
              <IconCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setRemoved(true);
                deleteWallet(wallet.id);
              }}
              title="Eliminar"
              className="p-1.5 rounded-lg border border-card-border text-muted hover:text-red-700 hover:border-red-200"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
