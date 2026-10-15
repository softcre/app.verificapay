import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export default async function PagosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, shift, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "superadmin") {
    redirect("/superadmin");
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("status")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "mercado_pago")
    .in("status", ["active", "error"])
    .order("status") // "active" antes que "error"
    .limit(1)
    .maybeSingle();

  const orgName =
    (profile.organizations as unknown as { name: string } | null)?.name ??
    "Mi comercio";

  return (
    <DashboardClient
      orgName={orgName}
      userName={profile.full_name}
      userEmail={profile.email}
      shift={profile.shift}
      role={profile.role}
      organizationId={profile.organization_id}
      walletState={
        !wallet ? "missing" : wallet.status === "error" ? "reconnect" : "ok"
      }
      endpoint="/api/payments"
      // Realtime avisa al instante de los pagos nuevos (webhook o
      // sincronización); la consulta periódica trae los cambios de estado.
      enableRealtime
      pollIntervalMs={30_000}
    />
  );
}
