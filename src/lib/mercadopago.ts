import crypto from "crypto";
import { PaymentStatus } from "./types";

const STATUS_MAP: Record<string, PaymentStatus> = {
  approved: "approved",
  accredited: "approved",
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  authorized: "pending",
  rejected: "rejected",
  cancelled: "rejected",
  refunded: "rejected",
  charged_back: "rejected",
};

interface MpPayer {
  id?: string | number | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface MpCard {
  cardholder?: { name?: string | null } | null;
}

export interface MpPayment {
  id: number;
  collector_id?: number | null;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id: string;
  status: string;
  payer?: MpPayer | null;
  card?: MpCard | null;
  description?: string | null;
  date_created: string;
  date_approved?: string | null;
  date_last_updated: string;
  payment_method_id?: string;
  payment_type_id?: string;
}

export function isIncomingPayment(mp: MpPayment): boolean {
  return (
    mp.collector_id != null &&
    mp.payer?.id != null &&
    String(mp.collector_id) !== String(mp.payer.id)
  );
}

export interface NormalizedMpPayment {
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payerName: string;
  payerEmail: string;
  description: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  isIncoming: boolean;
}

export function normalizeMpPayment(mp: MpPayment): NormalizedMpPayment {
  const payerId = mp.payer?.id != null ? String(mp.payer.id) : "";

  // 1. Prioridad para el nombre del cliente en un negocio físico/web
  const payerName =
    [mp.payer?.first_name, mp.payer?.last_name].filter(Boolean).join(" ") ||
    mp.card?.cardholder?.name || // <-- El nombre impreso en la tarjeta bancaria
    mp.payer?.email ||
    (payerId ? `Cliente #...${payerId.slice(-4)}` : "") ||
    "Cliente Mercado Pago";

  return {
    providerId: String(mp.id),
    amount: mp.transaction_amount,
    currency: mp.currency_id,
    status: STATUS_MAP[mp.status] ?? "pending",
    payerName: payerName.toUpperCase(), // Normalizado a mayúsculas para la estética de la app
    payerEmail: mp.payer?.email ?? "",

    description: mp.description ?? "Cobro Mercado Pago",

    // 'visa', 'mastercard', 'cvu', etc.
    paymentMethod: mp.payment_method_id ?? mp.payment_type_id ?? "Desconocido",

    createdAt: mp.date_created,
    updatedAt: mp.date_last_updated ?? mp.date_created,
    isIncoming: isIncomingPayment(mp),
  };
}

export async function fetchMercadoPagoPaymentById(
  accessToken: string,
  paymentId: string
): Promise<MpPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al pedir el pago ${paymentId}`);
  }

  return res.json();
}

export async function getMercadoPagoCollectorId(
  accessToken: string
): Promise<string> {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al pedir el usuario`);
  }

  const json: { id: number } = await res.json();
  return String(json.id);
}

export interface MpOAuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token?: string;
  public_key?: string;
  live_mode: boolean;
}

export function getMercadoPagoAuthorizationUrl(params: {
  state: string;
  redirectUri: string;
}): string {
  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) {
    throw new Error("Falta configurar MP_CLIENT_ID.");
  }

  const url = new URL("https://auth.mercadopago.com.ar/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeMercadoPagoOAuthCode(params: {
  code: string;
  redirectUri: string;
}): Promise<MpOAuthTokens> {
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Falta configurar MP_CLIENT_ID / MP_CLIENT_SECRET.");
  }

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al canjear el code por un access token`);
  }

  return res.json();
}

export function verifyMercadoPagoSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key.trim(), value?.trim() ?? ""];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(v1);
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
