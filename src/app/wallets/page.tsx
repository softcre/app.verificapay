import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
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
    .select("role, organization_id, organizations(name, invite_code)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const { data: wallets } = await supabase
    .from("wallets")
    .select("*")
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
            <h1 className="text-base font-semibold text-foreground">
              Billeteras virtuales
            </h1>
            <p className="text-xs text-muted">{org?.name}</p>
          </div>
        </header>

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
