"use client";

import { IconRefresh, IconLogout } from "./icons";
import { logout } from "@/app/auth/actions";

interface HeaderProps {
  branchName: string;
  currentShift: string;
  connectionStatus: "connected" | "disconnected" | "syncing";
  lastSync: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const CONNECTION_CONFIG = {
  connected: { label: "Conectado", dotClass: "bg-success", textClass: "text-green-700" },
  disconnected: { label: "Desconectado", dotClass: "bg-danger", textClass: "text-red-700" },
  syncing: { label: "Sincronizando…", dotClass: "bg-warning animate-pulse", textClass: "text-amber-700" },
};

export default function Header({
  branchName,
  currentShift,
  connectionStatus,
  lastSync,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  const conn = CONNECTION_CONFIG[connectionStatus];
  const syncTime = new Date(lastSync).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <header className="bg-card border-b border-card-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0 pl-12 lg:pl-0">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">
            {branchName}
          </h1>
          <p className="text-xs text-muted">{currentShift}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Connection indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-card-border">
          <span className={`w-2 h-2 rounded-full ${conn.dotClass}`} />
          <span className={`text-xs font-medium ${conn.textClass}`}>
            {conn.label}
          </span>
          <span className="text-[11px] text-muted-light ml-1">
            {syncTime}
          </span>
        </div>

        {/* Mobile connection dot */}
        <span className={`sm:hidden w-2.5 h-2.5 rounded-full ${conn.dotClass}`} />

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          <IconRefresh
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

        {/* Logout */}
        <form action={logout}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="flex items-center justify-center p-2 rounded-lg border border-card-border text-muted hover:text-red-700 hover:border-red-200 hover:bg-danger-bg transition-colors"
          >
            <IconLogout className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
