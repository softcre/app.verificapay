"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import StatsBar from "@/components/stats-bar";
import Filters from "@/components/filters";
import PaymentList from "@/components/payment-list";
import { IconWallet } from "@/components/icons";
import { Payment, PaymentStatus, PaymentsResponse } from "@/lib/types";
import { UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

interface DashboardClientProps {
  orgName: string;
  userName: string;
  userEmail: string | null;
  shift: string | null;
  role: UserRole;
  organizationId: string;
  // "reconnect": la billetera perdió la autorización y hay que volver a conectarla.
  walletState: "ok" | "missing" | "reconnect";
  endpoint?: string;
  enableRealtime?: boolean;
  // Cada cuánto se vuelve a consultar mientras la pestaña está visible.
  pollIntervalMs?: number;
}

export default function DashboardClient({
  orgName,
  userName,
  userEmail,
  shift,
  role,
  organizationId,
  walletState,
  endpoint = "/api/payments",
  enableRealtime = true,
  pollIntervalMs,
}: DashboardClientProps) {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | PaymentStatus>(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const inFlight = useRef(false);
  const lastFetchAt = useRef(0);

  const effectiveWalletState =
    walletState === "ok" && data?.needsReconnect ? "reconnect" : walletState;
  const hasWallet = effectiveWalletState === "ok";

  const fetchPayments = useCallback(async () => {
    if (!hasWallet || inFlight.current) return;
    inFlight.current = true;
    setIsRefreshing(true);
    try {
      const res = await fetch(endpoint);
      const json: PaymentsResponse = await res.json();
      setData(json);
    } catch {
      // keep existing data on error
    } finally {
      inFlight.current = false;
      lastFetchAt.current = Date.now();
      setIsRefreshing(false);
    }
  }, [endpoint, hasWallet]);

  useEffect(() => {
    // Initial fetch; the setState inside fetchPayments is intentionally
    // triggered from this effect, not a render side-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  // Consulta periódica solo con la pestaña visible, para no gastar pedidos a
  // la API de la billetera cuando nadie está mirando la pantalla.
  useEffect(() => {
    if (!pollIntervalMs || !hasWallet) return;

    const tick = () => {
      if (document.visibilityState === "visible") fetchPayments();
    };
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetchAt.current >= pollIntervalMs
      ) {
        fetchPayments();
      }
    };

    const id = setInterval(tick, pollIntervalMs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pollIntervalMs, hasWallet, fetchPayments]);

  useEffect(() => {
    if (!enableRealtime || !hasWallet) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`payments-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log("[realtime] payments change:", payload);
          fetchPayments();
        }
      )
      .subscribe((status, err) => {
        console.log("[realtime] channel status:", status, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, fetchPayments, enableRealtime, hasWallet]);

  const payments = data?.payments ?? [];

  const filteredPayments = payments.filter((p: Payment) => {
    if (activeFilter !== "all" && p.status !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const amountStr = String(p.amount);
      return (
        p.payerName.toLowerCase().includes(q) ||
        amountStr.includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: payments.length,
    approved: payments.filter((p: Payment) => p.status === "approved").length,
    pending: payments.filter((p: Payment) => p.status === "pending").length,
    rejected: payments.filter((p: Payment) => p.status === "rejected").length,
  };

  const shiftLabel = shift ? `${userName} · ${shift}` : userName;

  return (
    <div className="flex h-full">
      <Sidebar role={role} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          branchName={orgName}
          currentShift={shiftLabel}
          user={{ name: userName, email: userEmail, role }}
          connectionStatus={
            hasWallet ? (data?.connectionStatus ?? "syncing") : "disconnected"
          }
          lastSync={data?.lastSync ?? "2000-01-01T00:00:00Z"}
          onRefresh={fetchPayments}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Estado de Pagos
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Verificá los pagos recibidos. Se actualiza sola cada 30
              segundos, o manualmente con el botón Actualizar.
            </p>
          </div>

          {hasWallet ? (
            <>
              {role !== "employee" && <StatsBar payments={payments} />}

              <Filters
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                counts={counts}
              />

              <PaymentList payments={filteredPayments} />
            </>
          ) : (
            <NoWalletNotice
              isOwner={role === "owner"}
              reconnect={effectiveWalletState === "reconnect"}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NoWalletNotice({
  isOwner,
  reconnect,
}: {
  isOwner: boolean;
  reconnect: boolean;
}) {
  const title = reconnect
    ? "Hay que volver a conectar la billetera"
    : "Todavía no hay una billetera asociada";
  const description = reconnect
    ? isOwner
      ? "Mercado Pago dejó de autorizar el acceso a tu cuenta. Volvé a conectarla para seguir viendo los pagos."
      : "Mercado Pago dejó de autorizar el acceso a la cuenta del comercio. Avisale al dueño para que la vuelva a conectar."
    : isOwner
      ? "Asociá tu billetera virtual para empezar a ver y verificar los pagos que recibe tu comercio."
      : "El dueño del comercio tiene que asociar una billetera virtual para que puedas verificar los pagos.";
  const cta = !isOwner
    ? "Ver billeteras"
    : reconnect
      ? "Reconectar billetera"
      : "Asociar billetera";

  return (
    <div className="bg-card border border-card-border rounded-xl p-8 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mb-4">
        <IconWallet className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted mt-1 max-w-md">{description}</p>
      <a
        href="/wallets"
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
      >
        <IconWallet className="w-4 h-4" />
        {cta}
      </a>
    </div>
  );
}
