import { createClient } from "@/lib/supabase/server";
import {
  DbPayment,
  WalletProvider,
  WalletStatus,
  WALLET_PROVIDER_LABELS,
} from "@/lib/database.types";
import { Payment, PaymentsResponse } from "@/lib/types";
import { parsePeriod, periodStart } from "@/lib/period";
import { syncWalletPayments } from "@/lib/payment-sync";

export const dynamic = "force-dynamic";

const MAX_PAYMENTS = 500;

// Columnas explícitas: `raw` (el JSON completo del proveedor) no hace falta acá.
const PAYMENT_COLUMNS =
  "wallet_id, provider, provider_payment_id, amount, currency, status, payer_name, payer_email, description, payment_method, provider_created_at, provider_updated_at, wallets(alias)";

type PaymentRow = Omit<DbPayment, "id" | "organization_id" | "created_at" | "updated_at"> & {
  wallets: { alias: string } | null;
};

function toPayment(row: PaymentRow): Payment {
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
    walletId: row.wallet_id,
    walletProvider: row.provider,
    walletAlias: row.wallets?.alias ?? "",
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("periodo"));
  const walletFilter = params.get("billetera");

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

  // Leídas con el cliente del usuario (RLS): ya queda verificado que son de
  // su comercio antes de usar sus credenciales para sincronizar.
  const { data: walletRows } = await supabase
    .from("wallets")
    .select("id, organization_id, provider, alias, collector_id, status")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "mercado_pago")
    .in("status", ["active", "error"])
    .order("created_at");

  const wallets = (walletRows ?? []) as {
    id: string;
    organization_id: string;
    provider: WalletProvider;
    alias: string;
    collector_id: string | null;
    status: WalletStatus;
  }[];
  const active = wallets.filter((w) => w.status === "active");

  // Sincroniza antes de leer para que la respuesta ya traiga lo nuevo. Cada
  // billetera consulta la API como mucho una vez cada 30 s (ver payment-sync).
  const results = await Promise.all(active.map((w) => syncWalletPayments(w)));
  const lostAuth = new Set(
    active.filter((_, i) => results[i] === "auth_error").map((w) => w.id)
  );
  const reconnectWallets = wallets
    .filter((w) => w.status === "error" || lostAuth.has(w.id))
    .map((w) => w.alias);
  const usable = active.filter((w) => !lostAuth.has(w.id));

  if (usable.length === 0) {
    // Sin billetera conectada no hay pagos: nunca se devuelven datos de ejemplo.
    const response: PaymentsResponse = {
      payments: [],
      total: 0,
      lastSync: new Date().toISOString(),
      connectionStatus: "disconnected",
      branchName: "",
      currentShift: "",
      needsReconnect: wallets.length > 0,
      reconnectWallets,
    };
    return Response.json(response);
  }

  let query = supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("organization_id", profile.organization_id)
    .gte("provider_created_at", periodStart(period).toISOString())
    .order("provider_created_at", { ascending: false })
    .limit(MAX_PAYMENTS);

  if (walletFilter && wallets.some((w) => w.id === walletFilter)) {
    query = query.eq("wallet_id", walletFilter);
  }

  const { data: rows } = await query;
  const payments = ((rows ?? []) as unknown as PaymentRow[]).map(toPayment);

  const response: PaymentsResponse = {
    payments,
    total: payments.length,
    lastSync: new Date().toISOString(),
    connectionStatus: "connected",
    branchName: "",
    currentShift: "",
    truncated: payments.length === MAX_PAYMENTS,
    wallets: wallets.map(({ id, alias, provider }) => ({ id, alias, provider })),
    reconnectWallets,
  };

  return Response.json(response);
}
