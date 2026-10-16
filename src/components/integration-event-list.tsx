import { IntegrationEvent, IntegrationEventSource } from "@/lib/database.types";
import { timeAgo } from "@/lib/integration-health";

export type ListedEvent = IntegrationEvent & {
  organizations?: { name: string } | null;
  wallets?: { alias: string } | null;
};

const SOURCE_LABELS: Record<IntegrationEventSource, string> = {
  sync: "Sincronización",
  webhook: "Webhook",
  token: "Token",
  oauth: "Conexión",
};

/** Historial de fallos de integración, del más reciente al más viejo. */
export default function IntegrationEventList({
  events,
  showOrganization = false,
  emptyText,
}: {
  events: ListedEvent[];
  showOrganization?: boolean;
  emptyText: string;
}) {
  if (events.length === 0) {
    return (
      <p className="bg-card border border-card-border rounded-xl p-6 text-sm text-muted text-center">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl divide-y divide-card-border">
      {events.map((event) => (
        <div key={event.id} className="p-3 sm:px-4 flex items-start gap-3">
          <span
            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              event.level === "error" ? "bg-danger" : "bg-warning"
            }`}
            title={event.level === "error" ? "Error" : "Advertencia"}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground break-words">{event.message}</p>
            <p className="text-xs text-muted mt-0.5">
              {SOURCE_LABELS[event.source]}
              {event.wallets?.alias && ` · ${event.wallets.alias}`}
              {showOrganization &&
                (event.organization_id ? (
                  <>
                    {" · "}
                    <a
                      href={`/superadmin/comercios/${event.organization_id}`}
                      className="text-primary hover:underline"
                    >
                      {event.organizations?.name ?? "Comercio"}
                    </a>
                  </>
                ) : (
                  " · Sin comercio"
                ))}
            </p>
          </div>
          <time
            dateTime={event.created_at}
            title={new Date(event.created_at).toLocaleString("es-AR")}
            className="text-xs text-muted shrink-0"
          >
            {timeAgo(event.created_at)}
          </time>
        </div>
      ))}
    </div>
  );
}
