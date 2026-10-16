import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchMercadoPagoPaymentById,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago";
import { withMercadoPagoToken } from "@/lib/mercadopago-wallet";
import { toPaymentRow } from "@/lib/payment-sync";
import { logIntegrationEvent, recordWalletError } from "@/lib/integration-events";

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
      // Puede ser un intento de falsificar avisos o un MP_WEBHOOK_SECRET mal
      // configurado: en los dos casos el superadmin tiene que enterarse.
      await logIntegrationEvent({
        source: "webhook",
        level: "warning",
        message: "Webhook de Mercado Pago con firma inválida",
        detail: { dataId },
      });
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
    await logIntegrationEvent({
      source: "webhook",
      level: "warning",
      message: "Webhook de una cuenta de Mercado Pago que no está conectada a ningún comercio",
      detail: { collectorId, dataId },
    });
    return Response.json({ received: true });
  }

  try {
    const mpPayment = await withMercadoPagoToken(wallet.id, (accessToken) =>
      fetchMercadoPagoPaymentById(accessToken, dataId)
    );
    const { isIncoming, ...row } = toPaymentRow(wallet, mpPayment);

    if (isIncoming) {
      const { error } = await supabase
        .from("payments")
        .upsert(row, { onConflict: "provider,provider_payment_id" });
      if (error) throw error;
    }

    await supabase
      .from("wallets")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("id", wallet.id);
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    await recordWalletError(wallet, "webhook", err);
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}
