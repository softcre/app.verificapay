import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchMercadoPagoPaymentById,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago";
import { withMercadoPagoToken } from "@/lib/mercadopago-wallet";
import { toPaymentRow } from "@/lib/payment-sync";

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
    .select("id, organization_id")
    .eq("provider", "mercado_pago")
    .eq("collector_id", collectorId)
    .maybeSingle();

  if (!wallet) {
    return Response.json({ received: true });
  }

  try {
    const mpPayment = await withMercadoPagoToken(wallet.id, (accessToken) =>
      fetchMercadoPagoPaymentById(accessToken, dataId)
    );
    const { isIncoming, ...row } = toPaymentRow(wallet, mpPayment);

    if (!isIncoming) {
      return Response.json({ received: true });
    }

    await supabase
      .from("payments")
      .upsert(row, { onConflict: "provider,provider_payment_id" });
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}
