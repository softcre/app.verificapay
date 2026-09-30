"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Profile } from "@/lib/database.types";
import {
  createEmployee,
  deleteEmployee,
  setEmployeeStatus,
  updateEmployee,
  EmployeeActionState,
} from "@/app/cajeros/actions";
import { IconUsers, IconCheck, IconClose } from "./icons";

const initialState: EmployeeActionState = {};

export default function EmployeesManager({
  employees,
  inviteCode,
}: {
  employees: Profile[];
  inviteCode: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [rowFeedback, setRowFeedback] = useState<EmployeeActionState>({});

  const active = employees.filter((e) => e.status === "active").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            Cajeros del comercio
          </h2>
          <p className="text-sm text-muted">
            Cada cajero entra con su propia cuenta y ve los pagos que le
            ingresan a tu comercio.
            {employees.length > 0 &&
              ` ${active} activo${active === 1 ? "" : "s"} de ${employees.length}.`}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
        >
          {showForm ? "Cancelar" : "Agregar cajero"}
        </button>
      </div>

      {showForm && <CreateEmployeeForm />}

      {rowFeedback.error && (
        <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
          {rowFeedback.error}
        </p>
      )}
      {rowFeedback.success && (
        <p className="text-sm text-green-800 bg-success-bg rounded-lg px-3 py-2">
          {rowFeedback.success}
        </p>
      )}

      {employees.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <IconUsers className="w-8 h-8 text-muted-light mx-auto mb-2" />
          <p className="text-sm text-muted">
            Todavía no cargaste ningún cajero.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              onFeedback={setRowFeedback}
            />
          ))}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-4">
        <p className="text-xs text-muted">
          Código de invitación (alta autogestionada)
        </p>
        <p className="text-lg font-mono font-bold text-primary tracking-wider mt-1">
          {inviteCode}
        </p>
        <p className="text-xs text-muted mt-1">
          Alternativa al alta manual: con este código un cajero puede crearse la
          cuenta solo desde la pantalla de registro.
        </p>
      </div>
    </div>
  );
}

function CreateEmployeeForm() {
  const [state, formAction, pending] = useActionState(
    createEmployee,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Nuevo cajero
      </h3>
      <form ref={formRef} action={formAction} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre y apellido">
            <input
              name="fullName"
              required
              placeholder="Ana Gómez"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Turno (opcional)">
            <input name="shift" placeholder="Mañana" className={INPUT_CLASS} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="ana@comercio.com"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Contraseña inicial">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {state.error && (
          <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-green-800 bg-success-bg rounded-lg px-3 py-2">
            {state.success}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear cajero"}
        </button>
      </form>
    </div>
  );
}

function EmployeeRow({
  employee,
  onFeedback,
}: {
  employee: Profile;
  onFeedback: (state: EmployeeActionState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const closeEdit = useCallback(() => setEditing(false), []);

  const isActive = employee.status === "active";

  const run = (action: () => Promise<EmployeeActionState>) => {
    startTransition(async () => {
      onFeedback(await action());
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0 text-primary text-xs font-bold">
            {initials(employee.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {employee.full_name}
            </p>
            <p className="text-xs text-muted truncate">
              {employee.email ?? "—"}
              {employee.shift ? ` · ${employee.shift}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isActive
                ? "bg-success-bg text-green-800"
                : "bg-card-border text-muted"
            }`}
          >
            {isActive ? "Activo" : "Suspendido"}
          </span>

          <button
            onClick={() => setEditing((v) => !v)}
            disabled={pending}
            className="px-2.5 py-1.5 rounded-lg border border-card-border text-xs text-muted hover:text-foreground disabled:opacity-60"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>

          <button
            onClick={() =>
              run(() =>
                setEmployeeStatus(employee.id, isActive ? "inactive" : "active")
              )
            }
            disabled={pending}
            title={isActive ? "Suspender acceso" : "Reactivar acceso"}
            className="p-1.5 rounded-lg border border-card-border text-muted hover:text-foreground disabled:opacity-60"
          >
            <IconCheck className="w-4 h-4" />
          </button>

          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => run(() => deleteEmployee(employee.id))}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-60"
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
              title="Eliminar cajero"
              className="p-1.5 rounded-lg border border-card-border text-muted hover:text-red-700 hover:border-red-200 disabled:opacity-60"
            >
              <IconClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <EditEmployeeForm employee={employee} onDone={closeEdit} />
      )}
    </div>
  );
}

function EditEmployeeForm({
  employee,
  onDone,
}: {
  employee: Profile;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateEmployee,
    initialState
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form
      action={formAction}
      className="mt-4 pt-4 border-t border-card-border space-y-3"
    >
      <input type="hidden" name="employeeId" value={employee.id} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Nombre y apellido">
          <input
            name="fullName"
            required
            defaultValue={employee.full_name}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Turno">
          <input
            name="shift"
            defaultValue={employee.shift ?? ""}
            placeholder="Mañana"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Nueva contraseña (opcional)">
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Dejar vacío para no cambiar"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      {state.error && (
        <p className="text-sm text-red-700 bg-danger-bg rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
