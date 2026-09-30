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

interface MpCollector {
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
  payer_id?: number | null;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id: string;
  status: string;
  payer?: MpPayer | null;
  collector?: MpCollector | null;
  card?: MpCard | null;
  point_of_interaction?: {
    business_info?: {
      sub_unit?: string | null;
    } | null;
  } | null;
  description?: string | null;
  date_created: string;
  date_approved?: string | null;
  date_last_updated: string;
  operation_type?: string;
  payment_method_id?: string;
  payment_type_id?: string;
}

// export function isIncomingPayment(mp: MpPayment): boolean {
//   return (
//     mp.collector_id != null &&
//     mp.payer?.id != null &&
//     String(mp.collector_id) !== String(mp.payer.id)
//   );
// }
//Bien pero considera incluso el dinero que me mando
export function isIncomingPayment(mp: MpPayment): boolean {
  const payerId = mp.payer?.id != null ? String(mp.payer.id) : null;
  const collectorId = mp.collector_id != null ? String(mp.collector_id) : null;

  // 3. CASO ESPECIAL: Si por casualidad el pagador eres TÚ mismo 
  // (como pasa en algunas acreditaciones de CVU externo donde el sistema te pone a ti de ambos lados),
  // nos fijamos si operation_type o payment_type_id indica que es una plata que te mandaste de afuera.
  if (payerId && collectorId && payerId === collectorId) {
    // Si vino de una transferencia bancaria externa (CVU/CBU), es un ingreso legítimo tuyo.
    if (mp.payment_type_id === 'bank_transfer' || mp.operation_type === 'account_fund') {
      return true;
    }
    // Si es un auto-pago interno raro, lo descartamos
    return false;
  }

  // 4. Si el pagador es otra persona distinta a ti, es un ingreso 100% seguro (transferencia de otro o cobro).
  return true;
}

// export function isIncomingPayment(mp: MpPayment, myUserId: string = "216417742"): boolean {
//   // 1. El monto debe ser mayor a 0
//   if (mp.transaction_amount <= 0) return false;

//   // 2. Descartar estados no deseados (rechazados, cancelados, etc.)
//   const invalidStatuses = ['rejected', 'cancelled', 'refunded', 'charged_back'];
//   if (invalidStatuses.includes(mp.status)) return false;

//   const subUnit = mp.point_of_interaction?.business_info?.sub_unit;
//   const operationType = mp.operation_type;
//   const paymentTypeId = mp.payment_type_id;

//   const payerId = mp.payer?.id != null ? String(mp.payer.id) : null;
//   const collectorId = mp.collector_id != null ? String(mp.collector_id) : null;

//   // 3. SI ES UNA TRANSFERENCIA BANCARIA / CVU ENTRANTE (Account Fund):
//   // Aunque la API ponga tu ID en el payer por error o diseño interno, 
//   // si vino de afuera hacia tu cuenta y el sub_unit NO es una salida, es un INGRESO.
//   if (operationType === 'account_fund' || paymentTypeId === 'bank_transfer') {
//     if (subUnit === 'money_outflows') return false;
//     return true; // Es plata que te mandaron de afuera
//   }

//   // 4. PARA EL RESTO DE MOVIMIENTOS INTERNOS DE MP (ej. transferencias P2P comunes):
//   // Acá sí validamos que si el pagador y el colector son exactamente el mismo ID, 
//   // es porque te estás transfiriendo a ti mismo entre cuentas propias y lo descartamos.
//   if (payerId && collectorId && payerId === collectorId) {
//     return false;
//   }

//   // 5. Todo lo demás que llegue a tu collector_id es un ingreso válido
//   return true;
// }

export interface NormalizedMpPayment {
  providerId: string;
  payerId: string;
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
    payerId: payerId,
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

// MP responde 401 cuando el access token venció o fue revocado; se distingue
// del resto de los errores para poder renovarlo con el refresh token.
export class MercadoPagoAuthError extends Error {}

export async function fetchMercadoPagoPaymentById(
  accessToken: string,
  paymentId: string
): Promise<MpPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new MercadoPagoAuthError("Mercado Pago rechazó el access token");
  }
  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al pedir el pago ${paymentId}`);
  }

  return res.json();
}

export async function searchMercadoPagoPayments(
  accessToken: string,
  params: { collectorId?: string; limit?: number; offset?: number } = {}
): Promise<MpPayment[]> {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  if (params.collectorId) {
    url.searchParams.set("collector.id", params.collectorId);
  }
  url.searchParams.set("limit", String(params.limit ?? 50));
  url.searchParams.set("offset", String(params.offset ?? 0));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new MercadoPagoAuthError("Mercado Pago rechazó el access token");
  }
  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al buscar pagos`);
  }

  const json: { results: MpPayment[] } = await res.json();
  return json.results;
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

export async function refreshMercadoPagoToken(
  refreshToken: string
): Promise<MpOAuthTokens> {
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago respondió ${res.status} al renovar el access token`);
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
