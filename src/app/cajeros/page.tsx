import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import EmployeesManager from "@/components/employees-manager";
import { Profile } from "@/lib/database.types";
import { getPlanUsage } from "@/lib/plans";

export default async function CajerosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, organization_id, organizations(name, invite_code)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // El módulo es exclusivo del dueño: un empleado no administra a su equipo.
  if (profile.role !== "owner") {
    redirect(profile.role === "superadmin" ? "/superadmin" : "/pagos");
  }

  const [{ data: employees }, usage] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("role", "employee")
      .order("created_at", { ascending: false }),
    getPlanUsage(supabase, profile.organization_id),
  ]);

  const org = profile.organizations as unknown as {
    name: string;
    invite_code: string;
  } | null;

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Cajeros"
          subtitle={org?.name}
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <EmployeesManager
            employees={(employees ?? []) as Profile[]}
            inviteCode={org?.invite_code ?? ""}
            plan={{
              name: usage.plan?.name ?? null,
              maxEmployees: usage.plan?.max_employees ?? null,
            }}
          />
        </main>
      </div>
    </div>
  );
}
