import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import EmployeesManager from "@/components/employees-manager";
import { Profile } from "@/lib/database.types";

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
    .select("role, organization_id, organizations(name, invite_code)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // El módulo es exclusivo del dueño: un empleado no administra a su equipo.
  if (profile.role !== "owner") {
    redirect("/dashboard");
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("role", "employee")
    .order("created_at", { ascending: false });

  const org = profile.organizations as unknown as {
    name: string;
    invite_code: string;
  } | null;

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-card-border px-4 sm:px-6 py-3">
          <div className="pl-12 lg:pl-0">
            <h1 className="text-base font-semibold text-foreground">Cajeros</h1>
            <p className="text-xs text-muted">{org?.name}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <EmployeesManager
            employees={(employees ?? []) as Profile[]}
            inviteCode={org?.invite_code ?? ""}
          />
        </main>
      </div>
    </div>
  );
}
