"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconPayments,
  IconChart,
  IconUsers,
  IconSettings,
  IconShield,
  IconMenu,
  IconClose,
} from "./icons";
import { UserRole } from "@/lib/database.types";

const NAV_ITEMS = [
  { label: "Dashboard", icon: IconDashboard, href: "/" },
  { label: "Pagos", icon: IconPayments, href: "/" },
  { label: "Reportes", icon: IconChart, href: "#" },
  { label: "Cajeros", icon: IconUsers, href: "#" },
  { label: "Seguridad", icon: IconShield, href: "#" },
  { label: "Billeteras", icon: IconSettings, href: "/wallets" },
];

export default function Sidebar({ role }: { role?: UserRole }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

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
        {NAV_ITEMS.map((item) => {
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

      <div className="px-3 pb-4">
        <div className="px-3 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-[11px] text-sidebar-text">
            {role === "owner" ? "Rol" : "Plan Activo"}
          </p>
          <p className="text-sm text-white font-medium mt-0.5">
            {role === "owner" ? "Dueño/a" : role === "employee" ? "Empleado/a" : "MVP — Beta"}
          </p>
          <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full w-1/3" />
          </div>
        </div>
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
