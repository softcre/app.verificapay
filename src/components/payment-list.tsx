"use client";

import { Payment } from "@/lib/types";
import StatusBadge from "./status-badge";
import { IconClock, IconWallet } from "./icons";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mb-4">
          <IconWallet className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No se encontraron pagos
        </h3>
        <p className="text-sm text-muted mt-1">
          Ajustá los filtros o esperá nuevos movimientos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop table header */}
      <div className="hidden md:grid md:grid-cols-[1fr_120px_140px_150px_100px] gap-4 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">
        <span>Pagador</span>
        <span>Monto</span>
        <span>Método</span>
        <span>Tiempo</span>
        <span>Estado</span>
      </div>

      {payments.map((payment) => (
        <div
          key={payment.id}
          className="bg-card border border-card-border rounded-xl p-4 hover:shadow-md transition-shadow"
        >
          {/* Desktop row */}
          <div className="hidden md:grid md:grid-cols-[1fr_120px_140px_150px_100px] gap-4 items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {payment.payerName}
              </p>
              <p className="text-xs text-muted truncate">
                {payment.description}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {formatCurrency(payment.amount)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <IconWallet className="w-3.5 h-3.5 text-muted-light" />
              <span className="text-xs text-muted">{payment.wallet}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IconClock className="w-3.5 h-3.5 text-muted-light" />
              <span className="text-xs text-muted">
                {timeAgo(payment.createdAt)}
              </span>
            </div>
            <div>
              <StatusBadge status={payment.status} />
            </div>
          </div>

          {/* Mobile card */}
          <div className="md:hidden space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {payment.payerName}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {payment.description}
                </p>
              </div>
              <StatusBadge status={payment.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(payment.amount)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <IconClock className="w-3.5 h-3.5" />
                {timeAgo(payment.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted border-t border-card-border pt-2">
              <IconWallet className="w-3.5 h-3.5" />
              {payment.wallet} · {payment.paymentMethod}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
