import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import PlansManager from "@/components/plans-manager";
import { Plan } from "@/lib/database.types";
import { requireSuperadminPage } from "@/lib/superadmin";

export default async function PlanesPage() {
  const { supabase, profile } = await requireSuperadminPage();

  const [{ data: plans }, { data: orgs }] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .order("sort_order")
      .order("created_at"),
    supabase.from("organizations").select("plan_id"),
  ]);

  const organizationsByPlan: Record<string, number> = {};
  for (const org of orgs ?? []) {
    if (org.plan_id) {
      organizationsByPlan[org.plan_id] =
        (organizationsByPlan[org.plan_id] ?? 0) + 1;
    }
  }

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Planes"
          subtitle="Paquetes y límites por comercio"
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PlansManager
            plans={(plans ?? []) as Plan[]}
            organizationsByPlan={organizationsByPlan}
          />
        </main>
      </div>
    </div>
  );
}
