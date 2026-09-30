"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconChart,
  IconUsers,
  IconSettings,
  IconShield,
  IconMenu,
  IconClose,
  IconLogout,
} from "./icons";
import { UserRole } from "@/lib/database.types";
import { logout } from "@/app/auth/actions";

const NAV_ITEMS = [
  { label: "Pagos", icon: IconDashboard, href: "/pagos", hideForSuperadmin: true },
  { label: "Reportes", icon: IconChart, href: "#", hideForSuperadmin: true },
  { label: "Cajeros", icon: IconUsers, href: "/cajeros", ownerOnly: true },
  { label: "Seguridad", icon: IconShield, href: "#", hideForSuperadmin: true },
  { label: "Billeteras", icon: IconSettings, href: "/wallets", hideForSuperadmin: true },
  {
    label: "Comercios",
    icon: IconUsers,
    href: "/superadmin",
    superadminOnly: true,
  },
];

export default function Sidebar({
  role,
  userName,
  userEmail,
}: {
  role?: UserRole;
  userName?: string;
  userEmail?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.superadminOnly) return role === "superadmin";
    if (item.ownerOnly && role !== "owner") return false;
    if (item.hideForSuperadmin && role === "superadmin") return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-lg">
          V
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm tracking-wide">
            VerificaPay
          </span>
          <span className="text-sidebar-text text-[11px]">Panel de control</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === pathname;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white font-medium"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-2">
        {(userName || userEmail) && (
          <div className="px-3 py-3 rounded-lg bg-white/5 border border-white/10 min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {userName}
            </p>
            {userEmail && (
              <p className="text-[11px] text-sidebar-text truncate">
                {userEmail}
              </p>
            )}
          </div>
        )}

        <div className="px-3 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-[11px] text-sidebar-text">
            {role === "owner" || role === "superadmin" ? "Rol" : "Plan Activo"}
          </p>
          <p className="text-sm text-white font-medium mt-0.5">
            {role === "owner"
              ? "Dueño/a"
              : role === "employee"
                ? "Empleado/a"
                : role === "superadmin"
                  ? "Superadmin"
                  : "MVP — Beta"}
          </p>
          <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full w-1/3" />
          </div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-sidebar-text text-sm hover:text-white hover:border-white/20 transition-colors"
          >
            <IconLogout className="w-4 h-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-sidebar-bg text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <IconMenu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-sidebar-text hover:text-white"
          aria-label="Cerrar menú"
        >
          <IconClose className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-sidebar-bg">
        {sidebarContent}
      </aside>
    </>
  );
}
