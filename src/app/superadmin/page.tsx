import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import OwnersManager, { OwnerWithOrg } from "@/components/owners-manager";
import {
  IconInboxArrowDown,
  IconStore,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Plan } from "@/lib/database.types";

const ACTIVITY_DAYS = 30;

function activitySince() {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_DAYS);
  return since.toISOString();
}

export default async function SuperadminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // El módulo es exclusivo del superadmin: un owner o cajero no administra comercios ajenos.
  if (profile.role !== "superadmin") {
    redirect("/pagos");
  }

  const since = activitySince();

  const [
    { data: owners },
    { data: plans },
    { data: employees },
    { data: wallets },
    { count: recentPayments },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, organizations(name, invite_code, plan_id)")
      .eq("role", "owner")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("*").order("sort_order").order("created_at"),
    supabase.from("profiles").select("organization_id").eq("role", "employee"),
    supabase.from("wallets").select("organization_id, status"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("provider_created_at", since),
  ]);

  const usageByOrg: Record<string, { employees: number; wallets: number }> =
    {};
  const usageFor = (orgId: string) =>
    (usageByOrg[orgId] ??= { employees: 0, wallets: 0 });
  for (const e of employees ?? []) usageFor(e.organization_id).employees++;
  for (const w of wallets ?? []) usageFor(w.organization_id).wallets++;

  const ownerList = (owners ?? []) as Omit<OwnerWithOrg, "usage">[];
  const activeOwners = ownerList.filter((o) => o.status === "active").length;
  const activeWallets = (wallets ?? []).filter(
    (w) => w.status === "active"
  ).length;

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
          <div className="max-w-4xl grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Comercios activos"
              value={activeOwners}
              hint={`de ${ownerList.length} en total`}
              icon={<IconStore className="w-5 h-5" />}
            />
            <Kpi
              label="Cajeros"
              value={employees?.length ?? 0}
              hint="en todos los comercios"
              icon={<IconUsers className="w-5 h-5" />}
            />
            <Kpi
              label="Billeteras activas"
              value={activeWallets}
              hint={`de ${wallets?.length ?? 0} conectadas`}
              icon={<IconWallet className="w-5 h-5" />}
            />
            <Kpi
              label="Pagos recibidos"
              value={recentPayments ?? 0}
              hint={`últimos ${ACTIVITY_DAYS} días`}
              icon={<IconInboxArrowDown className="w-5 h-5" />}
            />
          </div>

          <OwnersManager
            plans={(plans ?? []) as Plan[]}
            owners={ownerList.map((owner) => ({
              ...owner,
              usage: usageByOrg[owner.organization_id] ?? {
                employees: 0,
                wallets: 0,
              },
            }))}
          />
        </main>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted truncate">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground mt-2">
        {value.toLocaleString("es-AR")}
      </p>
      <p className="text-xs text-muted truncate">{hint}</p>
    </div>
  );
}
