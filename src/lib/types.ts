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
  walletId: string;
  walletProvider: WalletProvider;
  // Nombre que el dueño le puso a la billetera (wallets.alias).
  walletAlias: string;
}

export interface WalletSummary {
  id: string;
  alias: string;
  provider: WalletProvider;
}

export interface PaymentsResponse {
  payments: Payment[];
  total: number;
  lastSync: string;
  connectionStatus: "connected" | "disconnected" | "syncing";
  branchName: string;
  currentShift: string;
  // Ninguna billetera tiene autorización vigente: hay que volver a conectarlas.
  needsReconnect?: boolean;
  // Billeteras del comercio (para el filtro) y las que hay que reconectar.
  wallets?: WalletSummary[];
  reconnectWallets?: string[];
  // El período tenía más pagos que el máximo que se trae por consulta.
  truncated?: boolean;
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
