"use client";

import { PaymentStatus } from "@/lib/types";
import { IconSearch } from "./icons";

interface FiltersProps {
  activeFilter: "all" | PaymentStatus;
  onFilterChange: (filter: "all" | PaymentStatus) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: { all: number; approved: number; pending: number; rejected: number };
}

const FILTER_OPTIONS: { key: "all" | PaymentStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "approved", label: "Acreditados" },
  { key: "pending", label: "Pendientes" },
  { key: "rejected", label: "Rechazados" },
];

export default function Filters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  counts,
}: FiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-background border border-card-border rounded-lg overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => {
          const count = counts[opt.key];
          const isActive = activeFilter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onFilterChange(opt.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              {opt.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/20" : "bg-card-border"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative flex-1 sm:max-w-xs ml-auto">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre o monto…"
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-card-border bg-card text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
    </div>
  );
}
