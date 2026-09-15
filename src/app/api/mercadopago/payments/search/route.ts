import { createClient } from "@/lib/supabase/server";
import { generateMockPayments } from "@/lib/mock-data";
import { WALLET_PROVIDER_LABELS } from "@/lib/database.types";
import { PaymentsResponse } from "@/lib/types";
import { normalizeMpPayment, searchMercadoPagoPayments } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

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
    .select("id, access_token, collector_id")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "mercado_pago")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!wallet?.access_token) {
    return Response.json(generateMockPayments(20));
  }

  try {
    const mpPayments = await searchMercadoPagoPayments(wallet.access_token, {
      collectorId: wallet.collector_id ?? undefined,
      limit: 50,
    });

    const payments = mpPayments
      .map(normalizeMpPayment)
      // .filter((p) => p.payerId !== wallet.collector_id) // Excluir pagos enviados por el propio comercio
      .filter((p) => p.isIncoming) // Solo pagos entrantes
      .map((p) => ({
        id: `PAY-${p.providerId}`,
        externalId: p.providerId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payerName: p.payerName,
        payerEmail: p.payerEmail,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        paymentMethod: p.paymentMethod,
        wallet: WALLET_PROVIDER_LABELS.mercado_pago,
      }));

    const response: PaymentsResponse = {
      payments,
      total: payments.length,
      lastSync: new Date().toISOString(),
      connectionStatus: "connected",
      branchName: "",
      currentShift: "",
    };

    return Response.json(response);
  } catch (err) {
    console.error("Error buscando pagos en Mercado Pago:", err);
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
}
