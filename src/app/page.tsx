import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, shift, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "superadmin") {
    redirect("/superadmin");
  }

  const orgName =
    (profile.organizations as unknown as { name: string } | null)?.name ??
    "Mi comercio";

  return (
    <DashboardClient
      orgName={orgName}
      userName={profile.full_name}
      shift={profile.shift}
      role={profile.role}
      organizationId={profile.organization_id}
    />
  );
}
