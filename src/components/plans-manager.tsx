"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Plan,
  WALLET_PROVIDERS,
  WALLET_PROVIDER_LABELS,
} from "@/lib/database.types";
import {
  deletePlan,
  savePlan,
  setDefaultPlan,
  setPlanActive,
  PlanActionState,
} from "@/app/superadmin/planes/actions";
import { formatLimit, formatPrice } from "@/lib/plans";
import { IconCube, IconClose, IconPencil } from "./icons";
import WalletLogo from "./wallet-logo";

const initialState: PlanActionState = {};

export default function PlansManager({
  plans,
  organizationsByPlan,
}: {
  plans: Plan[];
  organizationsByPlan: Record<string, number>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [rowFeedback, setRowFeedback] = useState<PlanActionState>({});
  const closeForm = useCallback(() => setShowForm(false), []);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            Planes del servicio
          </h2>
          <p className="text-sm text-muted">
            Cada comercio tiene un plan que define cuántos cajeros y billeteras
            puede cargar, y qué proveedores puede conectar.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
        >
          {showForm ? "Cancelar" : "Nuevo plan"}
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Nuevo plan
          </h3>
          <PlanForm onDone={closeForm} />
        </div>
      )}

      {rowFeedback.error && (
        <p className="text-sm text-danger-fg bg-danger-bg rounded-lg px-3 py-2">
          {rowFeedback.error}
        </p>
      )}
      {rowFeedback.success && (
        <p className="text-sm text-success-fg bg-success-bg rounded-lg px-3 py-2">
          {rowFeedback.success}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <IconCube className="w-8 h-8 text-muted-light mx-auto mb-2" />
          <p className="text-sm text-muted">Todavía no hay planes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              organizations={organizationsByPlan[plan.id] ?? 0}
              onFeedback={setRowFeedback}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  organizations,
  onFeedback,
}: {
  plan: Plan;
  organizations: number;
  onFeedback: (state: PlanActionState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const closeEdit = useCallback(() => setEditing(false), []);

  const run = (action: () => Promise<PlanActionState>) => {
    startTransition(async () => {
      onFeedback(await action());
    });
  };

  return (
    <div
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 ${
        plan.is_default ? "border-primary/50" : "border-card-border"
      } ${plan.is_active ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-foreground">{plan.name}</p>
            {plan.is_default && (
              <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-[11px] font-semibold">
                Por defecto
              </span>
            )}
            {!plan.is_active && (
              <span className="px-2 py-0.5 rounded-full bg-card-border text-muted text-[11px] font-semibold">
                Inactivo
              </span>
            )}
          </div>
          {plan.description && (
            <p className="text-xs text-muted mt-0.5">{plan.description}</p>
          )}
        </div>
        <p className="text-sm font-bold text-foreground shrink-0">
          {formatPrice(plan.price, plan.currency)}
          {plan.price > 0 && (
            <span className="text-xs font-normal text-muted">/mes</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Limit label="Cajeros" value={formatLimit(plan.max_employees)} />
        <Limit label="Billeteras" value={formatLimit(plan.max_wallets)} />
        <Limit label="Comercios" value={String(organizations)} />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {plan.allowed_providers.map((p) => (
          <span
            key={p}
            title={WALLET_PROVIDER_LABELS[p]}
            className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full border border-card-border text-[11px] text-muted"
          >
            <WalletLogo provider={p} className="w-5 h-5" />
            {WALLET_PROVIDER_LABELS[p]}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-card-border">
        <button
          onClick={() => setEditing((v) => !v)}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-card-border text-xs text-muted hover:text-foreground disabled:opacity-60"
        >
          <IconPencil className="w-3.5 h-3.5" />
          {editing ? "Cerrar" : "Editar"}
        </button>
        {!plan.is_default && (
          <button
            onClick={() => run(() => setPlanActive(plan.id, !plan.is_active))}
            disabled={pending}
            className="mt-2 px-2.5 py-1.5 rounded-lg border border-card-border text-xs text-muted hover:text-foreground disabled:opacity-60"
          >
            {plan.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
        {!plan.is_default && plan.is_active && (
          <button
            onClick={() => run(() => setDefaultPlan(plan.id))}
            disabled={pending}
            className="mt-2 px-2.5 py-1.5 rounded-lg border border-card-border text-xs text-muted hover:text-foreground disabled:opacity-60"
          >
            Hacer por defecto
          </button>
        )}
        {!plan.is_default &&
          (confirmingDelete ? (
            <div className="mt-2 ml-auto flex items-center gap-1">
              <button
                onClick={() => run(() => deletePlan(plan.id))}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-600/85 text-white text-xs font-medium disabled:opacity-60"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg border border-card-border text-xs text-muted"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              title="Eliminar plan"
              className="mt-2 ml-auto p-1.5 rounded-lg border border-card-border text-muted hover:text-danger-fg hover:border-danger/40 disabled:opacity-60"
            >
              <IconClose className="w-4 h-4" />
            </button>
          ))}
      </div>

      {editing && (
        <div className="pt-3 border-t border-card-border">
          <PlanForm plan={plan} onDone={closeEdit} />
        </div>
      )}
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className="text-[11px] text-muted uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
    </div>
  );
}

function PlanForm({ plan, onDone }: { plan?: Plan; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(savePlan, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onDone();
    }
  }, [state.success, onDone]);

  const allowed = plan?.allowed_providers ?? WALLET_PROVIDERS;

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {plan && <input type="hidden" name="planId" value={plan.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre">
          <input
            name="name"
            required
            maxLength={40}
            defaultValue={plan?.name}
            placeholder="Profesional"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Precio mensual (ARS)">
          <input
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={plan?.price ?? 0}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label="Descripción (opcional)">
        <input
          name="description"
          defaultValue={plan?.description ?? ""}
          placeholder="Para comercios con varias cajas"
          className={INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Máximo de cajeros">
          <input
            name="maxEmployees"
            type="number"
            min={0}
            step={1}
            defaultValue={plan?.max_employees ?? ""}
            placeholder="Vacío = ilimitado"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Máximo de billeteras">
          <input
            name="maxWallets"
            type="number"
            min={0}
            step={1}
            defaultValue={plan?.max_wallets ?? ""}
            placeholder="Vacío = ilimitado"
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label="Proveedores incluidos">
        <div className="flex flex-wrap gap-2">
          {WALLET_PROVIDERS.map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-card-border text-sm text-foreground cursor-pointer has-checked:border-primary has-checked:bg-primary-light"
            >
              <input
                type="checkbox"
                name="providers"
                value={p}
                defaultChecked={allowed.includes(p)}
                className="accent-primary"
              />
              {WALLET_PROVIDER_LABELS[p]}
            </label>
          ))}
        </div>
      </Field>

      {state.error && (
        <p className="text-sm text-danger-fg bg-danger-bg rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending ? "Guardando…" : plan ? "Guardar cambios" : "Crear plan"}
      </button>
    </form>
  );
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
