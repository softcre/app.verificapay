import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import OwnersManager from "@/components/owners-manager";
import { Profile } from "@/lib/database.types";

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
    redirect("/dashboard");
  }

  const { data: owners } = await supabase
    .from("profiles")
    .select("*, organizations(name, invite_code)")
    .eq("role", "owner")
    .order("created_at", { ascending: false });

  return (
    <div className="flex h-full">
      <Sidebar
        role={profile.role}
        userName={profile.full_name}
        userEmail={profile.email}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-card-border px-4 sm:px-6 py-3">
          <div className="pl-12 lg:pl-0">
            <h1 className="text-base font-semibold text-foreground">
              Comercios
            </h1>
            <p className="text-xs text-muted">
              Administración de dueños (owners)
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <OwnersManager
            owners={
              (owners ?? []) as (Profile & {
                organizations: { name: string; invite_code: string } | null;
              })[]
            }
          />
        </main>
      </div>
    </div>
  );
}
