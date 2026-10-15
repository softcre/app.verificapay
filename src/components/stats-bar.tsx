"use client";

import { Payment } from "@/lib/types";
import StatusBadge from "./status-badge";
import {
  IconBanknotes,
  IconBolt,
  IconCheckBadge,
  IconInboxArrowDown,
} from "./icons";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function StatCard({
  label,
  icon,
  iconClass,
  value,
  valueClass = "text-foreground",
  footer,
  featured = false,
}: {
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  value: React.ReactNode;
  valueClass?: string;
  footer?: React.ReactNode;
  /** Tarjeta destacada: fondo con el color principal. */
  featured?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-0 ${
        featured
          ? "bg-linear-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/20"
          : "bg-card border border-card-border shadow-sm"
      }`}
    >
      {featured && (
        // Brillo decorativo en la esquina.
        <div className="pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <p
          className={`text-xs font-medium uppercase tracking-wide truncate ${
            featured ? "text-white/80" : "text-muted"
          }`}
        >
          {label}
        </p>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}
        >
          {icon}
        </div>
      </div>

      <div
        className={`relative text-2xl sm:text-[1.7rem] leading-none font-semibold tracking-tight tabular-nums truncate ${
          featured ? "text-white" : valueClass
        }`}
      >
        {value}
      </div>

      {footer && (
        <div
          className={`relative text-xs min-w-0 ${
            featured ? "text-white/80" : "text-muted"
          }`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Stats del período elegido (no dependen del filtro de estado ni de la búsqueda).
 * Los empleados no ven los totales del comercio: solo el último pago.
 */
export default function StatsBar({
  payments,
  onlyLastPayment = false,
}: {
  payments: Payment[];
  onlyLastPayment?: boolean;
}) {
  const approved = payments.filter((p) => p.status === "approved");
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const rejectedCount = payments.filter((p) => p.status === "rejected").length;
  const totalApproved = approved.reduce((sum, p) => sum + p.amount, 0);
  const approvedPct =
    payments.length > 0
      ? Math.round((approved.length / payments.length) * 100)
      : 0;
  // La API devuelve los pagos ordenados del más nuevo al más viejo.
  const last = payments[0];

  const lastPaymentCard = (
    <StatCard
      label="Último pago"
      icon={<IconBolt className="w-5 h-5" />}
      iconClass="bg-warning-bg text-warning-fg"
      value={
        last ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate">{formatCurrency(last.amount)}</span>
            <StatusBadge status={last.status} />
          </span>
        ) : (
          <span className="text-muted-light">—</span>
        )
      }
      footer={
        last ? (
          <div className="space-y-0.5 min-w-0">
            <p className="truncate text-foreground font-medium">
              {last.payerName}
            </p>
            <p className="truncate font-mono" title={last.externalId}>
              #{last.externalId} · {formatTime(last.createdAt)}
            </p>
          </div>
        ) : (
          "Sin pagos en el período"
        )
      }
    />
  );

  if (onlyLastPayment) {
    return <div className="sm:max-w-sm">{lastPaymentCard}</div>;
  }

  const breakdown = [
    pendingCount > 0 && plural(pendingCount, "pendiente", "pendientes"),
    rejectedCount > 0 && plural(rejectedCount, "rechazado", "rechazados"),
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard
        label="Total acreditado"
        featured
        icon={<IconBanknotes className="w-5 h-5" />}
        iconClass="bg-white/15 text-white"
        value={formatCurrency(totalApproved)}
        footer={
          approved.length > 0
            ? `Promedio ${formatCurrency(totalApproved / approved.length)} por pago`
            : "Todavía no hay pagos acreditados"
        }
      />

      <StatCard
        label="Pagos recibidos"
        icon={<IconInboxArrowDown className="w-5 h-5" />}
        iconClass="bg-primary-light text-primary"
        value={payments.length}
        footer={
          breakdown.length > 0 ? breakdown.join(" · ") : "Todos acreditados"
        }
      />

      <StatCard
        label="Acreditados"
        icon={<IconCheckBadge className="w-5 h-5" />}
        iconClass="bg-success-bg text-success-fg"
        value={approved.length}
        valueClass="text-success-fg"
        footer={
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full bg-card-border overflow-hidden"
              role="progressbar"
              aria-valuenow={approvedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Porcentaje de pagos acreditados"
            >
              <div
                className="h-full rounded-full bg-success transition-[width] duration-500"
                style={{ width: `${approvedPct}%` }}
              />
            </div>
            <span className="tabular-nums">{approvedPct}%</span>
          </div>
        }
      />

      {lastPaymentCard}
    </div>
  );
}
