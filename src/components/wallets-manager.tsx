"use client";

import { useActionState, useState } from "react";
import {
  Wallet,
  WalletProvider,
  UserRole,
  WALLET_PROVIDERS,
  WALLET_PROVIDER_LABELS,
} from "@/lib/database.types";
import { isAtLimit } from "@/lib/plans";
import PlanUsageBar from "./plan-usage-bar";
import {
  addWallet,
  deleteWallet,
  renameWallet,
  toggleWalletStatus,
  WalletActionState,
} from "@/app/wallets/actions";
import { IconWallet, IconCheck, IconClose, IconPencil } from "./icons";
import WalletLogo from "./wallet-logo";

const initialState: WalletActionState = {};

const MP_ERROR_MESSAGES: Record<string, string> = {
  solo_owner: "Solo el dueño del comercio puede conectar billeteras.",
  estado_invalido: "La conexión con Mercado Pago expiró o no es válida. Probá de nuevo.",
  sesion_expirada: "Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.",
  canje_fallido: "No se pudo validar la autorización con Mercado Pago.",
  guardado_fallido: "No se pudo guardar la conexión con Mercado Pago.",
  limite_plan: "Llegaste al máximo de billeteras de tu plan.",
  proveedor_no_incluido: "Tu plan no incluye Mercado Pago.",
};

export default function WalletsManager({
  wallets,
  role,
  inviteCode,
  plan,
  mpNotice,
}: {
  wallets: Wallet[];
  role: UserRole;
  inviteCode: string;
  plan: {
    name: string | null;
    maxWallets: number | null;
    /** null = sin plan asignado, no se restringe. */
    allowedProviders: WalletProvider[] | null;
  };
  mpNotice?: { connected?: boolean; error?: string };
}) {
  const [state, formAction, pending] = useActionState(
    addWallet,
    initialState
  );
  const isOwner = role === "owner";
  const atLimit = isAtLimit(plan.maxWallets, wallets.length);
  const providers = WALLET_PROVIDERS.filter(
    (p) => !plan.allowedProviders || plan.allowedProviders.includes(p)
  );
  const mpAllowed = providers.includes("mercado_pago");

  return (
    <div className="max-w-3xl space-y-6">
      {mpNotice?.connected && (
        <p className="text-sm text-success-fg bg-success-bg rounded-lg px-3 py-2">
          Tu cuenta de Mercado Pago se conectó correctamente.
        </p>
      )}
      {mpNotice?.error && (
        <p className="text-sm text-danger-fg bg-danger-bg rounded-lg px-3 py-2">
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

        {isOwner && (
          <div className="mb-4">
            <PlanUsageBar
              planName={plan.name}
              label="Billeteras"
              used={wallets.length}
              limit={plan.maxWallets}
            />
          </div>
        )}

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

      {isOwner && mpAllowed && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Conectar Mercado Pago
          </h3>
          <p className="text-sm text-muted mb-3">
            Vinculá tu cuenta de Mercado Pago para que VerificaPay lea tus
            pagos automáticamente, sin tener que copiar ningún token.
          </p>
          <p className="text-xs text-muted mb-3">
            ¿Tenés más de una cuenta? Conectalas de a una. Antes de sumar otra,
            cerrá sesión en mercadopago.com.ar para que te pida la nueva
            cuenta; si no, se vuelve a conectar la misma.
          </p>
          <a
            href="/api/mercadopago/oauth/start"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
          >
            {/* Con el tope alcanzado igual se puede reconectar una cuenta existente. */}
            {atLimit ? "Reconectar cuenta de Mercado Pago" : "Conectar con Mercado Pago"}
          </a>
        </div>
      )}

      {isOwner && !atLimit && providers.length > 0 && (
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
                  {providers.map((p) => (
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
              <p className="text-sm text-danger-fg bg-danger-bg rounded-lg px-3 py-2">
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
  const [alias, setAlias] = useState(wallet.alias);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(wallet.alias);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (removed) return null;

  async function saveAlias() {
    if (draft.trim() === alias) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await renameWallet(wallet.id, draft);
    setSaving(false);
    if (result.error) {
      setRenameError(result.error);
      return;
    }
    setAlias(draft.trim());
    setRenameError(null);
    setEditing(false);
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <WalletLogo provider={wallet.provider} className="w-9 h-9" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveAlias();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                autoFocus
                value={draft}
                maxLength={60}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDraft(alias);
                    setRenameError(null);
                    setEditing(false);
                  }
                }}
                aria-label="Nombre de la billetera"
                className="w-full max-w-xs px-2 py-1 rounded-md border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="submit"
                disabled={saving}
                title="Guardar"
                className="p-1.5 rounded-lg border border-card-border text-muted hover:text-foreground disabled:opacity-60"
              >
                <IconCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Cancelar"
                onClick={() => {
                  setDraft(alias);
                  setRenameError(null);
                  setEditing(false);
                }}
                className="p-1.5 rounded-lg border border-card-border text-muted hover:text-foreground"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {alias}
              </p>
              {isOwner && (
                <button
                  onClick={() => setEditing(true)}
                  title="Cambiar nombre"
                  className="p-1 rounded text-muted-light hover:text-foreground shrink-0"
                >
                  <IconPencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {renameError ? (
            <p className="text-xs text-danger-fg mt-1">{renameError}</p>
          ) : (
            <p className="text-xs text-muted">
              {WALLET_PROVIDER_LABELS[wallet.provider]}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            status === "active"
              ? "bg-success-bg text-success-fg"
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
              className="p-1.5 rounded-lg border border-card-border text-muted hover:text-danger-fg hover:border-danger/40"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
