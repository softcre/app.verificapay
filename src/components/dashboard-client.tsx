"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import StatsBar from "@/components/stats-bar";
import Filters from "@/components/filters";
import PaymentList from "@/components/payment-list";
import { Payment, PaymentStatus, PaymentsResponse } from "@/lib/types";
import { UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

interface DashboardClientProps {
  orgName: string;
  userName: string;
  shift: string | null;
  role: UserRole;
  organizationId: string;
  endpoint?: string;
  enableRealtime?: boolean;
}

export default function DashboardClient({
  orgName,
  userName,
  shift,
  role,
  organizationId,
  endpoint = "/api/payments",
  enableRealtime = true,
}: DashboardClientProps) {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | PaymentStatus>(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPayments = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(endpoint);
      const json: PaymentsResponse = await res.json();
      setData(json);
    } catch {
      // keep existing data on error
    } finally {
      setIsRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // Initial fetch; the setState inside fetchPayments is intentionally
    // triggered from this effect, not a render side-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (!enableRealtime) return;

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
  }, [organizationId, fetchPayments, enableRealtime]);

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
      <Sidebar role={role} userName={userName} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          branchName={orgName}
          currentShift={shiftLabel}
          connectionStatus={data?.connectionStatus ?? "syncing"}
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
              Verificá los pagos recibidos. Se actualiza solo al recibir un
              aviso de tu billetera, o manualmente con el botón Actualizar.
            </p>
          </div>

          {role !== "employee" && <StatsBar payments={payments} />}

          <Filters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            counts={counts}
          />

          <PaymentList payments={filteredPayments} />
        </main>
      </div>
    </div>
  );
}
