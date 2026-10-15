import { createClient } from "@/lib/supabase/server";
import { DbPayment, WALLET_PROVIDER_LABELS } from "@/lib/database.types";
import { PaymentsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

type PaymentRow = DbPayment & { wallets: { alias: string } | null };

function toPayment(row: PaymentRow) {
  return {
    id: `PAY-${row.provider_payment_id}`,
    externalId: row.provider_payment_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    payerName: row.payer_name ?? "Sin datos",
    payerEmail: row.payer_email ?? "",
    description: row.description ?? "",
    createdAt: row.provider_created_at,
    updatedAt: row.provider_updated_at,
    paymentMethod: row.payment_method ?? "",
    wallet: WALLET_PROVIDER_LABELS[row.provider] ?? row.provider,
    walletProvider: row.provider,
    walletAlias: row.wallets?.alias ?? "",
  };
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Perfil no encontrado" }, { status: 403 });
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "mercado_pago")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!wallet) {
    // Sin billetera conectada no hay pagos: nunca se devuelven datos de ejemplo.
    const response: PaymentsResponse = {
      payments: [],
      total: 0,
      lastSync: new Date().toISOString(),
      connectionStatus: "disconnected",
      branchName: "",
      currentShift: "",
    };
    return Response.json(response);
  }

  const { data: rows } = await supabase
    .from("payments")
    .select("*, wallets(alias)")
    .eq("organization_id", profile.organization_id)
    .order("provider_created_at", { ascending: false })
    .limit(100);

  const payments = ((rows ?? []) as PaymentRow[]).map(toPayment);

  const response: PaymentsResponse = {
    payments,
    total: payments.length,
    lastSync: new Date().toISOString(),
    connectionStatus: "connected",
    branchName: "",
    currentShift: "",
  };

  return Response.json(response);
}
