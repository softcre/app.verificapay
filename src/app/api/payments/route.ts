import { createClient } from "@/lib/supabase/server";
import { generateMockPayments } from "@/lib/mock-data";
import { DbPayment, WALLET_PROVIDER_LABELS } from "@/lib/database.types";
import { PaymentsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function toPayment(row: DbPayment) {
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
  };
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(generateMockPayments(20));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json(generateMockPayments(20));
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
    return Response.json(generateMockPayments(20));
  }

  const { data: rows } = await supabase
    .from("payments")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("provider_created_at", { ascending: false })
    .limit(100);

  const payments = (rows ?? []).map(toPayment);

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
