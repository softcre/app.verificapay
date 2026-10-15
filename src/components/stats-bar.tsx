"use client";

import { Payment, STATUS_LABELS } from "@/lib/types";
import { IconCheck, IconClock, IconWallet } from "./icons";

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
  const totalApproved = approved.reduce((sum, p) => sum + p.amount, 0);
  // La API devuelve los pagos ordenados del más nuevo al más viejo.
  const last = payments[0];

  const lastPaymentStat = {
    label: "Último pago",
    value: last ? formatCurrency(last.amount) : "—",
    detail: last
      ? `#${last.externalId} · ${formatTime(last.createdAt)} · ${STATUS_LABELS[last.status]}`
      : "Sin pagos en el período",
    accent: "text-foreground",
    bg: "bg-background",
    icon: <IconClock className="w-4 h-4 text-muted" />,
  };

  const stats = onlyLastPayment ? [lastPaymentStat] : [
    {
      label: "Pagos recibidos",
      value: String(payments.length),
      detail: null,
      accent: "text-foreground",
      bg: "bg-primary-light",
      icon: <IconWallet className="w-4 h-4 text-primary" />,
    },
    {
      label: "Acreditados",
      value: String(approved.length),
      detail:
        payments.length > 0
          ? `${Math.round((approved.length / payments.length) * 100)}% del total`
          : null,
      accent: "text-success-fg",
      bg: "bg-success-bg",
      icon: <IconCheck className="w-4 h-4 text-success" />,
    },
    {
      label: "Total acreditado",
      value: formatCurrency(totalApproved),
      detail: null,
      accent: "text-primary",
      bg: "bg-primary-light",
      icon: <span className="text-base">💰</span>,
    },
    lastPaymentStat,
  ];

  return (
    <div
      className={
        onlyLastPayment
          ? "grid grid-cols-1 sm:max-w-sm"
          : "grid grid-cols-2 lg:grid-cols-4 gap-3"
      }
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 min-w-0"
        >
          <div
            className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}
          >
            {stat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{stat.label}</p>
            <p className={`text-lg font-bold ${stat.accent} truncate`}>
              {stat.value}
            </p>
            {stat.detail && (
              <p
                className="text-[11px] text-muted truncate"
                title={stat.detail}
              >
                {stat.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
