import { notFound } from "next/navigation";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import WalletLogo from "@/components/wallet-logo";
import WalletHealthList, {
  HealthListWallet,
} from "@/components/wallet-health-list";
import IntegrationEventList, {
  ListedEvent,
} from "@/components/integration-event-list";
import {
  IconBanknotes,
  IconInboxArrowDown,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import {
  DbPayment,
  Plan,
  Profile,
  WALLET_PROVIDER_LABELS,
} from "@/lib/database.types";
import { formatLimit } from "@/lib/plans";
import { requireSuperadminPage } from "@/lib/superadmin";

const ACTIVITY_DAYS = 30;
const RECENT_PAYMENTS = 20;
const RECENT_EVENTS = 20;

function activitySince() {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_DAYS);
  return since.toISOString();
}

function formatMoney(amount: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string, withTime = false) {
  return new Date(date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: withTime ? undefined : "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    hour12: false,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComercioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Un id mal formado haría fallar la consulta con un error de Postgres.
  if (!UUID_RE.test(id)) notFound();

  const { supabase, profile } = await requireSuperadminPage();

  const [
    { data: org },
    { data: members },
    { data: wallets },
    { data: payments },
    { data: stats },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, invite_code, created_at, plans(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", id)
      .order("created_at"),
    supabase
      .from("wallets")
      .select(
        "id, organization_id, provider, alias, status, last_synced_at, last_webhook_at, last_error, last_error_at"
      )
      .eq("organization_id", id)
      .order("created_at"),
    supabase
      .from("payments")
      .select(
        "id, wallet_id, amount, currency, status, payer_name, description, payment_method, provider_created_at"
      )
      .eq("organization_id", id)
      .order("provider_created_at", { ascending: false })
      .limit(RECENT_PAYMENTS),
    supabase
      .rpc("payment_stats", { org: id, since: activitySince() })
      .maybeSingle(),
    supabase
      .from("integration_events")
      .select("*, wallets(alias)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS),
  ]);

  if (!org) notFound();

  const plan = org.plans as unknown as Plan | null;
  const team = (members ?? []) as Profile[];
  const owner = team.find((m) => m.role === "owner");
  const employees = team.filter((m) => m.role === "employee");
  const walletList = (wallets ?? []) as HealthListWallet[];
  const walletAlias = new Map(walletList.map((w) => [w.id, w]));
  const paymentStats = stats as {
    payments: number;
    approved: number;
    approved_amount: number;
  } | null;
  const ownerActive = owner?.status === "active";

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={org.name}
          subtitle="Detalle del comercio"
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <a
            href="/superadmin"
            className="inline-flex text-sm text-muted hover:text-foreground"
          >
            ← Volver a comercios
          </a>

          <section className="bg-card border border-card-border rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{org.name}</h2>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    ownerActive
                      ? "bg-success-bg text-success-fg"
                      : "bg-card-border text-muted"
                  }`}
                >
                  {ownerActive ? "Activo" : "Suspendido"}
                </span>
              </div>
              <p className="text-sm text-muted mt-1">
                {owner ? `${owner.full_name} · ${owner.email ?? "sin email"}` : "Sin dueño"}
              </p>
              <p className="text-xs text-muted mt-1">
                Alta: {formatDate(org.created_at)} · Código de invitación:{" "}
                <span className="font-mono text-foreground">{org.invite_code}</span>
              </p>
            </div>
            <div className="lg:text-right">
              <p className="text-xs text-muted uppercase tracking-wide">Plan</p>
              <p className="text-base font-semibold text-foreground">
                {plan?.name ?? "Sin plan"}
              </p>
              {plan && (
                <p className="text-xs text-muted">
                  {formatLimit(plan.max_employees)} cajeros ·{" "}
                  {formatLimit(plan.max_wallets)} billeteras ·{" "}
                  {plan.allowed_providers
                    .map((p) => WALLET_PROVIDER_LABELS[p])
                    .join(", ")}
                </p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              label="Pagos recibidos"
              value={paymentStats?.payments ?? 0}
              hint={`últimos ${ACTIVITY_DAYS} días`}
              icon={<IconInboxArrowDown className="w-5 h-5" />}
            />
            <KpiCard
              label="Monto acreditado"
              value={formatMoney(Number(paymentStats?.approved_amount ?? 0))}
              hint={`${paymentStats?.approved ?? 0} pagos acreditados`}
              icon={<IconBanknotes className="w-5 h-5" />}
            />
            <KpiCard
              label="Cajeros"
              value={`${employees.length} / ${formatLimit(plan?.max_employees)}`}
              hint={`${employees.filter((e) => e.status === "active").length} activos`}
              icon={<IconUsers className="w-5 h-5" />}
            />
            <KpiCard
              label="Billeteras"
              value={`${walletList.length} / ${formatLimit(plan?.max_wallets)}`}
              hint={`${walletList.filter((w) => w.status === "active").length} activas`}
              icon={<IconWallet className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="space-y-3">
              <SectionTitle>Billeteras</SectionTitle>
              <WalletHealthList
                wallets={walletList}
                emptyText="El comercio todavía no conectó billeteras."
              />
            </section>

            <section className="space-y-3">
              <SectionTitle>Equipo</SectionTitle>
              <div className="bg-card border border-card-border rounded-xl divide-y divide-card-border">
                {team.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.full_name}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {member.role === "owner" ? "Dueño" : "Cajero"}
                          {member.shift ? ` · ${member.shift}` : ""}
                        </span>
                      </p>
                      <p className="text-xs text-muted truncate">
                        {member.email ?? "—"} · alta {formatDate(member.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        member.status === "active"
                          ? "bg-success-bg text-success-fg"
                          : "bg-card-border text-muted"
                      }`}
                    >
                      {member.status === "active" ? "Activo" : "Suspendido"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="space-y-3">
            <SectionTitle>Últimos pagos</SectionTitle>
            {(payments ?? []).length === 0 ? (
              <p className="bg-card border border-card-border rounded-xl p-6 text-sm text-muted text-center">
                Todavía no hay pagos registrados.
              </p>
            ) : (
              <div className="bg-card border border-card-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-card-border">
                      <th className="px-4 py-2.5 font-medium">Fecha</th>
                      <th className="px-4 py-2.5 font-medium">Pagador</th>
                      <th className="px-4 py-2.5 font-medium">Billetera</th>
                      <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                      <th className="px-4 py-2.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {(payments as Pick<
                      DbPayment,
                      | "id"
                      | "wallet_id"
                      | "amount"
                      | "currency"
                      | "status"
                      | "payer_name"
                      | "description"
                      | "payment_method"
                      | "provider_created_at"
                    >[]).map((payment) => {
                      const wallet = walletAlias.get(payment.wallet_id);
                      return (
                        <tr key={payment.id}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                            {formatDate(payment.provider_created_at, true)}
                          </td>
                          <td className="px-4 py-2.5 min-w-40">
                            <p className="text-foreground truncate">
                              {payment.payer_name ?? "—"}
                            </p>
                            {payment.description && (
                              <p className="text-xs text-muted truncate">
                                {payment.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {wallet ? (
                              <span className="inline-flex items-center gap-2 text-muted">
                                <WalletLogo provider={wallet.provider} className="w-5 h-5" />
                                {wallet.alias}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                            {formatMoney(Number(payment.amount), payment.currency)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={payment.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle>Eventos de integración</SectionTitle>
            <IntegrationEventList
              events={(events ?? []) as ListedEvent[]}
              emptyText="Sin fallos registrados para este comercio."
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}
