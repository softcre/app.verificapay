import type { WalletProvider } from "./database.types";

export type PaymentStatus = "approved" | "pending" | "rejected";

export interface Payment {
  id: string;
  externalId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payerName: string;
  payerEmail: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string;
  wallet: string;
  walletProvider: WalletProvider;
  // Nombre que el dueño le puso a la billetera (wallets.alias).
  walletAlias: string;
}

export interface PaymentsResponse {
  payments: Payment[];
  total: number;
  lastSync: string;
  connectionStatus: "connected" | "disconnected" | "syncing";
  branchName: string;
  currentShift: string;
  // La billetera perdió la autorización y no se pudo renovar el token.
  needsReconnect?: boolean;
}

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  approved: "Acreditado",
  pending: "Pendiente",
  rejected: "Rechazado",
};

export const STATUS_COLORS: Record<
  PaymentStatus,
  { bg: string; text: string; dot: string }
> = {
  approved: {
    bg: "bg-success-bg",
    text: "text-green-800",
    dot: "bg-success",
  },
  pending: {
    bg: "bg-warning-bg",
    text: "text-amber-800",
    dot: "bg-warning",
  },
  rejected: {
    bg: "bg-danger-bg",
    text: "text-red-800",
    dot: "bg-danger",
  },
};
