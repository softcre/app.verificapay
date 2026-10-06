export type UserRole = "owner" | "employee" | "superadmin";
export type WalletProvider =
  | "mercado_pago"
  | "naranja_x"
  | "uala"
  | "cuenta_dni"
  | "modo";
export type WalletStatus = "active" | "inactive" | "error";
export type ProfileStatus = "active" | "inactive";

export interface Organization {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  shift: string | null;
  status: ProfileStatus;
  created_by: string | null;
  created_at: string;
}

export interface Wallet {
  id: string;
  organization_id: string;
  provider: WalletProvider;
  alias: string;
  public_key: string | null;
  external_user_id: string | null;
  collector_id: string | null;
  status: WalletStatus;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  organization_id: string;
  wallet_id: string;
  provider: WalletProvider;
  provider_payment_id: string;
  amount: number;
  currency: string;
  status: "approved" | "pending" | "rejected";
  payer_name: string | null;
  payer_email: string | null;
  description: string | null;
  payment_method: string | null;
  provider_created_at: string;
  provider_updated_at: string;
  created_at: string;
  updated_at: string;
}

export const WALLET_PROVIDER_LABELS: Record<WalletProvider, string> = {
  mercado_pago: "Mercado Pago",
  naranja_x: "Naranja X",
  uala: "Ualá",
  cuenta_dni: "Cuenta DNI",
  modo: "MODO",
};

