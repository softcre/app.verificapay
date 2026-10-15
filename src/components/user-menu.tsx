"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconChevronDown,
  IconLogout,
  IconMonitor,
  IconMoon,
  IconSun,
  IconUser,
} from "./icons";
import { UserRole } from "@/lib/database.types";
import { logout } from "@/app/auth/actions";
import { useTheme, type ThemePreference } from "@/lib/theme";

export interface CurrentUser {
  name: string;
  email: string | null;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Dueño/a",
  employee: "Empleado/a",
  superadmin: "Superadmin",
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof IconSun;
}[] = [
  { value: "light", label: "Claro", icon: IconSun },
  { value: "dark", label: "Oscuro", icon: IconMoon },
  { value: "system", label: "Sistema", icon: IconMonitor },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : parts[0]?.slice(0, 2);
  return (letters ?? "?").toUpperCase();
}

export default function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full sm:rounded-lg p-0.5 sm:pr-2 hover:bg-background border border-transparent hover:border-card-border transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
          {initials(user.name)}
        </span>
        <span className="hidden md:flex flex-col items-start leading-tight max-w-36">
          <span className="text-sm font-medium text-foreground truncate max-w-full">
            {user.name}
          </span>
          <span className="text-[11px] text-muted">{ROLE_LABELS[user.role]}</span>
        </span>
        <IconChevronDown className="hidden sm:block w-4 h-4 text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 z-50 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-card-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name}
            </p>
            {user.email && (
              <p className="text-xs text-muted truncate">{user.email}</p>
            )}
            <span className="inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-light text-primary">
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div className="p-1.5">
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-background"
            >
              <IconUser className="w-4 h-4 text-muted" />
              Mi perfil
            </Link>
          </div>

          <div className="px-4 py-2.5 border-t border-card-border">
            <p className="text-[11px] font-medium text-muted mb-1.5">Tema</p>
            <div className="flex gap-1 p-1 bg-background rounded-lg">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreference(value)}
                  aria-pressed={preference === value}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs transition-colors ${
                    preference === value
                      ? "bg-card text-foreground shadow-sm font-medium"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <form action={logout} className="p-1.5 border-t border-card-border">
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-danger-fg hover:bg-danger-bg"
            >
              <IconLogout className="w-4 h-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
