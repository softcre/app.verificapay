import { createServiceClient } from "@/lib/supabase/service";
import { IntegrationEventSource } from "@/lib/database.types";

// Registro de fallos de las integraciones para el panel de superadmin. Nunca
// tira: un problema al loguear no puede romper la sincronización ni el webhook.

export function errorMessage(err: unknown): string {
  // Los errores de Supabase son objetos planos con `message`, no instancias de Error.
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
  return message.slice(0, 500);
}

export async function logIntegrationEvent(event: {
  source: IntegrationEventSource;
  level?: "error" | "warning";
  message: string;
  organizationId?: string | null;
  walletId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("integration_events").insert({
      source: event.source,
      level: event.level ?? "error",
      message: event.message,
      organization_id: event.organizationId ?? null,
      wallet_id: event.walletId ?? null,
      detail: event.detail ?? null,
    });
    if (error) console.error("No se pudo registrar el evento de integración:", error);
  } catch (err) {
    console.error("No se pudo registrar el evento de integración:", err);
  }
}

/** Marca el último error en la billetera y lo deja en el historial. */
export async function recordWalletError(
  wallet: { id: string; organization_id: string },
  source: IntegrationEventSource,
  err: unknown
) {
  const message = errorMessage(err);
  try {
    const supabase = createServiceClient();
    await supabase
      .from("wallets")
      .update({ last_error: message, last_error_at: new Date().toISOString() })
      .eq("id", wallet.id);
  } catch (updateErr) {
    console.error("No se pudo guardar el error de la billetera:", updateErr);
  }
  await logIntegrationEvent({
    source,
    message,
    organizationId: wallet.organization_id,
    walletId: wallet.id,
  });
}
