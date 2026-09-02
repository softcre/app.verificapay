import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchMercadoPagoPaymentById,
  normalizeMpPayment,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const body: { type?: string; action?: string; user_id?: string | number } =
    await req.json().catch(() => ({}));

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const valid = verifyMercadoPagoSignature({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
      secret,
    });
    if (!valid) {
      return Response.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  const isPaymentEvent = body.type === "payment" || body.action?.startsWith("payment.");
  if (!isPaymentEvent || !dataId) {
    return Response.json({ received: true });
  }

  const collectorId = body.user_id != null ? String(body.user_id) : null;
  if (!collectorId) {
    return Response.json({ received: true });
  }

  const supabase = createServiceClient();

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, organization_id, access_token")
    .eq("provider", "mercado_pago")
    .eq("collector_id", collectorId)
    .maybeSingle();

  if (!wallet?.access_token) {
    return Response.json({ received: true });
  }

  try {
    const mpPayment = await fetchMercadoPagoPaymentById(
      wallet.access_token,
      dataId
    );
    const normalized = normalizeMpPayment(mpPayment);

    if (!normalized.isIncoming) {
      return Response.json({ received: true });
    }

    await supabase.from("payments").upsert(
      {
        organization_id: wallet.organization_id,
        wallet_id: wallet.id,
        provider: "mercado_pago",
        provider_payment_id: normalized.providerId,
        amount: normalized.amount,
        currency: normalized.currency,
        status: normalized.status,
        payer_name: normalized.payerName,
        payer_email: normalized.payerEmail,
        description: normalized.description,
        payment_method: normalized.paymentMethod,
        raw: mpPayment,
        provider_created_at: normalized.createdAt,
        provider_updated_at: normalized.updatedAt,
      },
      { onConflict: "provider,provider_payment_id" }
    );
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}
