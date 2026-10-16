import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import KpiCard from "@/components/kpi-card";
import OwnersManager, { OwnerWithOrg } from "@/components/owners-manager";
import {
  IconBanknotes,
  IconInboxArrowDown,
  IconStore,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Plan } from "@/lib/database.types";
import { walletHealth } from "@/lib/integration-health";
import { requireSuperadminPage } from "@/lib/superadmin";

const ACTIVITY_DAYS = 30;

function activitySince() {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_DAYS);
  return since.toISOString();
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: amount >= 10_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 10_000_000 ? 1 : 0,
  }).format(amount);
}

export default async function SuperadminPage() {
  const { supabase, profile } = await requireSuperadminPage();

  const [
    { data: owners },
    { data: plans },
    { data: employees },
    { data: wallets },
    { data: stats },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, organizations(name, invite_code, plan_id)")
      .eq("role", "owner")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("sort_order").order("created_at"),
    supabase.from("profiles").select("organization_id").eq("role", "employee"),
    supabase
      .from("wallets")
      .select("organization_id, provider, status, last_synced_at, last_error"),
    supabase.rpc("payment_stats", { since: activitySince() }).maybeSingle(),
  ]);

  const usageByOrg: Record<string, OwnerWithOrg["usage"]> = {};
  const usageFor = (orgId: string) =>
    (usageByOrg[orgId] ??= { employees: 0, wallets: 0, walletIssues: 0 });
  for (const e of employees ?? []) usageFor(e.organization_id).employees++;
  for (const w of wallets ?? []) {
    const usage = usageFor(w.organization_id);
    usage.wallets++;
    const health = walletHealth(w);
    if (health === "error" || health === "failing") usage.walletIssues++;
  }

  const ownerList = (owners ?? []) as Omit<OwnerWithOrg, "usage">[];
  const activeOwners = ownerList.filter((o) => o.status === "active").length;
  const activeWallets = (wallets ?? []).filter(
    (w) => w.status === "active"
  ).length;
  const paymentStats = stats as {
    payments: number;
    approved: number;
    approved_amount: number;
  } | null;

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Comercios"
          subtitle="Administración de dueños (owners)"
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
            <KpiCard
              label="Comercios activos"
              value={activeOwners}
              hint={`de ${ownerList.length} en total`}
              icon={<IconStore className="w-5 h-5" />}
            />
            <KpiCard
              label="Cajeros"
              value={employees?.length ?? 0}
              hint="en todos los comercios"
              icon={<IconUsers className="w-5 h-5" />}
            />
            <KpiCard
              label="Billeteras activas"
              value={activeWallets}
              hint={`de ${wallets?.length ?? 0} conectadas`}
              icon={<IconWallet className="w-5 h-5" />}
            />
            <KpiCard
              label="Pagos recibidos"
              value={paymentStats?.payments ?? 0}
              hint={`últimos ${ACTIVITY_DAYS} días`}
              icon={<IconInboxArrowDown className="w-5 h-5" />}
            />
            <KpiCard
              label="Monto acreditado"
              value={formatMoney(Number(paymentStats?.approved_amount ?? 0))}
              hint={`últimos ${ACTIVITY_DAYS} días`}
              icon={<IconBanknotes className="w-5 h-5" />}
            />
          </div>

          <OwnersManager
            plans={(plans ?? []) as Plan[]}
            owners={ownerList.map((owner) => ({
              ...owner,
              usage: usageByOrg[owner.organization_id] ?? {
                employees: 0,
                wallets: 0,
                walletIssues: 0,
              },
            }))}
          />
        </main>
      </div>
    </div>
  );
}
