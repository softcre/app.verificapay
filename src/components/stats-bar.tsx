"use client";

import { Payment } from "@/lib/types";
import { IconCheck } from "./icons";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function StatsBar({ payments }: { payments: Payment[] }) {
  const approved = payments.filter((p) => p.status === "approved");
  const pending = payments.filter((p) => p.status === "pending");
  const rejected = payments.filter((p) => p.status === "rejected");
  const totalApproved = approved.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    {
      label: "Total Acreditado",
      value: formatCurrency(totalApproved),
      accent: "text-primary",
      bg: "bg-primary-light",
      icon: "💰",
    },
    {
      label: "Acreditados",
      value: String(approved.length),
      accent: "text-green-700",
      bg: "bg-success-bg",
      icon: null,
      iconComponent: <IconCheck className="w-4 h-4 text-success" />,
    },
    {
      label: "Pendientes",
      value: String(pending.length),
      accent: "text-amber-700",
      bg: "bg-warning-bg",
      icon: "⏳",
    },
    {
      label: "Rechazados",
      value: String(rejected.length),
      accent: "text-red-700",
      bg: "bg-danger-bg",
      icon: "✕",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3"
        >
          <div
            className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}
          >
            {stat.iconComponent ?? (
              <span className="text-base">{stat.icon}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{stat.label}</p>
            <p className={`text-lg font-bold ${stat.accent} truncate`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
