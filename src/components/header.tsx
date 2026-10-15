"use client";

import { IconRefresh } from "./icons";
import TopBar from "./top-bar";
import { type CurrentUser } from "./user-menu";

interface HeaderProps {
  branchName: string;
  currentShift: string;
  user: CurrentUser;
  connectionStatus: "connected" | "disconnected" | "syncing";
  lastSync: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const CONNECTION_CONFIG = {
  connected: { label: "Conectado", dotClass: "bg-success", textClass: "text-success-fg" },
  disconnected: { label: "Desconectado", dotClass: "bg-danger", textClass: "text-danger-fg" },
  syncing: { label: "Sincronizando…", dotClass: "bg-warning animate-pulse", textClass: "text-warning-fg" },
};

export default function Header({
  branchName,
  currentShift,
  user,
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
    <TopBar title={branchName} subtitle={currentShift} user={user}>
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
    </TopBar>
  );
}
