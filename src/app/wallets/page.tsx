import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import WalletsManager from "@/components/wallets-manager";

export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ mp_connected?: string; mp_error?: string }>;
}) {
  const params = await searchParams;
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

  if (profile.role === "superadmin") {
    redirect("/superadmin");
  }

  const { data: wallets } = await supabase
    .from("wallets")
    // Columnas explícitas: todo lo que se lee acá termina en el navegador.
    .select(
      "id, organization_id, provider, alias, public_key, external_user_id, collector_id, status, connected_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  const org = profile.organizations as unknown as {
    name: string;
    invite_code: string;
  } | null;

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Billeteras virtuales"
          subtitle={org?.name}
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <WalletsManager
            wallets={wallets ?? []}
            role={profile.role}
            inviteCode={org?.invite_code ?? ""}
            mpNotice={{
              connected: params.mp_connected === "1",
              error: params.mp_error,
            }}
          />
        </main>
      </div>
    </div>
  );
}
