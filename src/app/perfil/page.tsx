import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import ProfileForm from "@/components/profile-form";

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, shift, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const orgName =
    (profile.organizations as unknown as { name: string } | null)?.name ??
    null;

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Mi perfil"
          subtitle={orgName}
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ProfileForm
            fullName={profile.full_name}
            email={profile.email ?? user.email ?? ""}
            role={profile.role}
            shift={profile.shift}
            orgName={profile.role === "superadmin" ? null : orgName}
          />
        </main>
      </div>
    </div>
  );
}
