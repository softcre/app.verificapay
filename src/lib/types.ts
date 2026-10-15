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
  // Los colores se adaptan solos al tema (ver globals.css); el borde solo
  // en oscuro, donde el fondo translúcido necesita un poco más de contorno.
  approved: {
    bg: "bg-success-bg dark:ring-1 dark:ring-inset dark:ring-success/30",
    text: "text-success-fg",
    dot: "bg-success",
  },
  pending: {
    bg: "bg-warning-bg dark:ring-1 dark:ring-inset dark:ring-warning/30",
    text: "text-warning-fg",
    dot: "bg-warning",
  },
  rejected: {
    bg: "bg-danger-bg dark:ring-1 dark:ring-inset dark:ring-danger/30",
    text: "text-danger-fg",
    dot: "bg-danger",
  },
};
