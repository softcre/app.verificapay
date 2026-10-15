"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import StatsBar from "@/components/stats-bar";
import Filters from "@/components/filters";
import PaymentList from "@/components/payment-list";
import PeriodSelector from "@/components/period-selector";
import { IconBell, IconBellSlash, IconWallet } from "@/components/icons";
import { Payment, PaymentStatus, PaymentsResponse } from "@/lib/types";
import { DEFAULT_PERIOD, PaymentPeriod } from "@/lib/period";
import { UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { playChime, unlockAudio } from "@/lib/chime";

const HIGHLIGHT_MS = 10_000;
const REALTIME_DEBOUNCE_MS = 1_000;
const SOUND_STORAGE_KEY = "verificapay:sonido";

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
  const [period, setPeriod] = useState<PaymentPeriod>(DEFAULT_PERIOD);
  const [walletFilter, setWalletFilter] = useState<"all" | string>("all");
  // URL del pedido en curso y de la vista actual: al cambiar de período o de
  // billetera se pide de nuevo aunque haya otro pedido en vuelo, y una
  // respuesta vieja no pisa la de la vista elegida.
  const inFlight = useRef<string | null>(null);
  const currentUrl = useRef("");
  const lastFetchAt = useRef(0);
  // Si llega un aviso mientras hay un pedido en vuelo, ese pedido pudo haber
  // leído la tabla antes del pago nuevo: se repite al terminar.
  const refetchAfter = useRef(false);
  const fetchRef = useRef<() => void>(() => {});

  // Pagos nuevos: se resaltan unos segundos y suenan (si el sonido está activo).
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  const seenIds = useRef<Set<string>>(new Set());
  const baselineUrl = useRef<string | null>(null);

  const effectiveWalletState =
    walletState === "ok" && data?.needsReconnect ? "reconnect" : walletState;
  const hasWallet = effectiveWalletState === "ok";
  const url =
    `${endpoint}?periodo=${period}` +
    (walletFilter !== "all"
      ? `&billetera=${encodeURIComponent(walletFilter)}`
      : "");

  useEffect(() => {
    currentUrl.current = url;
  }, [url]);

  const announceNewPayments = useCallback((fresh: Payment[]) => {
    const ids = fresh.map((p) => p.id);
    setHighlightIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, HIGHLIGHT_MS);

    // Un rechazado se resalta pero no suena: el sonido significa "entró plata".
    if (soundOnRef.current && fresh.some((p) => p.status !== "rejected")) {
      playChime();
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!hasWallet) return;
    if (inFlight.current === url) {
      refetchAfter.current = true;
      return;
    }
    inFlight.current = url;
    setIsRefreshing(true);
    try {
      const res = await fetch(url);
      const json: PaymentsResponse = await res.json();
      if (currentUrl.current === url) {
        setData(json);

        // La primera respuesta de cada vista (período/billetera) es la base:
        // lo que ya estaba no cuenta como nuevo.
        const isBaseline = baselineUrl.current !== url;
        baselineUrl.current = url;
        const fresh = json.payments.filter((p) => !seenIds.current.has(p.id));
        fresh.forEach((p) => seenIds.current.add(p.id));
        if (!isBaseline && fresh.length > 0) announceNewPayments(fresh);
      }
    } catch {
      // keep existing data on error
    } finally {
      if (inFlight.current === url) {
        inFlight.current = null;
        setIsRefreshing(false);
      }
      lastFetchAt.current = Date.now();
      if (refetchAfter.current) {
        refetchAfter.current = false;
        setTimeout(() => fetchRef.current(), 0);
      }
    }
  }, [url, hasWallet, announceNewPayments]);

  useEffect(() => {
    fetchRef.current = fetchPayments;
  }, [fetchPayments]);

  useEffect(() => {
    // Initial fetch; the setState inside fetchPayments is intentionally
    // triggered from this effect, not a render side-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  // Preferencia de sonido por dispositivo, y desbloqueo del audio en la
  // primera interacción (los navegadores lo exigen).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SOUND_STORAGE_KEY);
    } catch {
      // sin storage: queda el valor por defecto
    }
    if (stored === "off") {
      soundOnRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoundOn(false);
    }

    const unlock = () => unlockAudio();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    soundOnRef.current = next;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // la preferencia dura solo esta sesión
    }
    if (next) {
      unlockAudio();
      playChime(); // muestra cómo suena
    }
  };

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

  // Tiempo real solo para pagos NUEVOS (INSERT): la sincronización vuelve a
  // guardar pagos existentes (UPDATE) en cada pasada, y escuchar eso dispararía
  // recargas en ráfaga. Los cambios de estado llegan con la consulta periódica.
  // Varios inserts juntos (p. ej. una sincronización) se agrupan en una recarga.
  useEffect(() => {
    if (!enableRealtime || !hasWallet) return;

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();
    const channel = supabase
      .channel(`payments-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payments",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => fetchRef.current(), REALTIME_DEBOUNCE_MS);
        }
      )
      .subscribe((status, err) => {
        if (err) console.error("[realtime] payments:", status, err);
      });

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [organizationId, enableRealtime, hasWallet]);

  const payments = data?.payments ?? [];

  const filteredPayments = payments.filter((p: Payment) => {
    if (activeFilter !== "all" && p.status !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const amountStr = String(p.amount);
      return (
        p.payerName.toLowerCase().includes(q) ||
        amountStr.includes(q) ||
        p.externalId.includes(q) ||
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
          hasWallet={hasWallet}
          onRefresh={fetchPayments}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Estado de Pagos
              </h2>
              {hasWallet && (
                <p className="text-sm text-muted mt-0.5">
                  Verificá los pagos recibidos. Se actualiza sola cada 30
                  segundos, o manualmente con el botón Actualizar.
                </p>
              )}
            </div>
            {hasWallet && (
              <div className="flex flex-wrap items-center gap-2">
                {/* El filtro solo aparece si hay más de una billetera. */}
                {(data?.wallets?.length ?? 0) > 1 && (
                  <select
                    aria-label="Billetera"
                    value={walletFilter}
                    onChange={(e) => setWalletFilter(e.target.value)}
                    className="h-[42px] px-3 rounded-lg border border-card-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="all">Todas las billeteras</option>
                    {data?.wallets?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.alias}
                      </option>
                    ))}
                  </select>
                )}
                <PeriodSelector value={period} onChange={setPeriod} />
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={soundOn}
                  title={
                    soundOn
                      ? "Sonido de pago nuevo activado"
                      : "Sonido de pago nuevo desactivado"
                  }
                  className={`h-[42px] w-[42px] flex items-center justify-center rounded-lg border border-card-border transition-colors ${
                    soundOn
                      ? "bg-primary-light text-primary"
                      : "bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {soundOn ? (
                    <IconBell className="w-5 h-5" />
                  ) : (
                    <IconBellSlash className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {hasWallet ? (
            <>
              {(data?.reconnectWallets?.length ?? 0) > 0 && (
                <p className="text-sm text-danger-fg bg-danger-bg rounded-lg px-3 py-2">
                  {role === "owner"
                    ? "Hay que volver a conectar: "
                    : "El dueño tiene que volver a conectar: "}
                  <strong>{data?.reconnectWallets?.join(", ")}</strong>. Sus
                  pagos nuevos no se están mostrando.
                  {role === "owner" && (
                    <>
                      {" "}
                      <a href="/wallets" className="underline font-medium">
                        Ir a billeteras
                      </a>
                    </>
                  )}
                </p>
              )}

              {data?.truncated && (
                <p className="text-sm text-warning-fg bg-warning-bg rounded-lg px-3 py-2">
                  Hay demasiados pagos en este período: se muestran solo los
                  más recientes. Elegí un período más corto para ver todo.
                </p>
              )}

              <StatsBar
                payments={payments}
                onlyLastPayment={role === "employee"}
              />

              <Filters
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                counts={counts}
              />

              <PaymentList
                payments={filteredPayments}
                highlightIds={highlightIds}
              />
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
