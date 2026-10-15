"use client";

import { PaymentPeriod, PERIOD_OPTIONS } from "@/lib/period";

export default function PeriodSelector({
  value,
  onChange,
}: {
  value: PaymentPeriod;
  onChange: (period: PaymentPeriod) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="inline-flex gap-1 p-1 bg-background border border-card-border rounded-lg"
    >
      {PERIOD_OPTIONS.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-card-border"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
