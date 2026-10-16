import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import KpiCard from "@/components/kpi-card";
import WalletHealthList, {
  HealthListWallet,
} from "@/components/wallet-health-list";
import IntegrationEventList, {
  ListedEvent,
} from "@/components/integration-event-list";
import {
  IconBellSlash,
  IconCheckBadge,
  IconClock,
  IconClose,
} from "@/components/icons";
import {
  needsAttention,
  STALE_HOURS,
  walletHealth,
} from "@/lib/integration-health";
import { requireSuperadminPage } from "@/lib/superadmin";

const RECENT_EVENTS = 50;

function since24h() {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  return since.toISOString();
}

export default async function IntegracionesPage() {
  const { supabase, profile } = await requireSuperadminPage();

  const [{ data: walletRows }, { data: events }, { count: recentErrors }] =
    await Promise.all([
      supabase
        .from("wallets")
        .select(
          "id, organization_id, provider, alias, status, last_synced_at, last_webhook_at, last_error, last_error_at, organizations(name)"
        ),
      supabase
        .from("integration_events")
        .select("*, organizations(name), wallets(alias)")
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENTS),
      supabase
        .from("integration_events")
        .select("id", { count: "exact", head: true })
        .eq("level", "error")
        .gte("created_at", since24h()),
    ]);

  const wallets: HealthListWallet[] = (walletRows ?? []).map(
    ({ organizations, ...wallet }) => ({
      ...(wallet as HealthListWallet),
      organizationName: (organizations as unknown as { name: string } | null)
        ?.name,
    })
  );

  const healths = wallets.map((w) => walletHealth(w));
  const broken = healths.filter((h) => h === "error" || h === "failing").length;
  const stale = healths.filter((h) => h === "stale" || h === "never").length;
  const ok = healths.filter((h) => h === "ok").length;
  const attention = wallets.filter((_, i) => needsAttention(healths[i]));

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Integraciones"
          subtitle="Salud de billeteras, sincronización y webhooks"
          user={{
            name: profile.full_name,
            email: profile.email,
            role: profile.role,
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              label="Funcionando"
              value={ok}
              hint="sincronizadas en las últimas 24 h"
              icon={<IconCheckBadge className="w-5 h-5" />}
              tone="bg-success-bg text-success-fg"
            />
            <KpiCard
              label="Con error"
              value={broken}
              hint="desconectadas o fallando"
              icon={<IconClose className="w-5 h-5" />}
              tone="bg-danger-bg text-danger-fg"
            />
            <KpiCard
              label="Desactualizadas"
              value={stale}
              hint={`sin sincronizar en ${STALE_HOURS} h o nunca`}
              icon={<IconClock className="w-5 h-5" />}
              tone="bg-warning-bg text-warning-fg"
            />
            <KpiCard
              label="Errores (24 h)"
              value={recentErrors ?? 0}
              hint="eventos registrados"
              icon={<IconBellSlash className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Requieren atención
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  La sincronización corre cuando alguien abre el panel de
                  pagos: una billetera desactualizada puede ser solo un
                  comercio que no la está usando.
                </p>
              </div>
              <WalletHealthList
                wallets={attention}
                showOrganization
                emptyText="Todas las billeteras están funcionando."
              />

              {wallets.length > attention.length && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-primary hover:underline">
                    Ver todas las billeteras ({wallets.length})
                  </summary>
                  <div className="mt-3">
                    <WalletHealthList
                      wallets={wallets}
                      showOrganization
                      emptyText="No hay billeteras conectadas."
                    />
                  </div>
                </details>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Últimos eventos
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Fallos de sincronización, webhooks, renovación de tokens y
                  conexiones con Mercado Pago.
                </p>
              </div>
              <IntegrationEventList
                events={(events ?? []) as ListedEvent[]}
                showOrganization
                emptyText="No hay eventos registrados."
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
