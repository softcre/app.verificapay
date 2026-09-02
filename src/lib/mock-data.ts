import { Payment, PaymentsResponse } from "./types";

const PAYER_NAMES = [
  "María García",
  "Juan Pérez",
  "Carlos López",
  "Ana Martínez",
  "Roberto Fernández",
  "Laura Sánchez",
  "Diego Rodríguez",
  "Valentina Torres",
  "Martín González",
  "Sofía Ramírez",
  "Lucas Díaz",
  "Camila Morales",
  "Mateo Ruiz",
  "Isabella Flores",
  "Tomás Herrera",
];

const DESCRIPTIONS = [
  "Compra en mostrador",
  "Pago de servicio",
  "Venta de producto",
  "Consumo en local",
  "Pago de factura",
  "Compra online retiro en tienda",
  "Pago parcial de cuenta",
  "Combo almuerzo",
  "Pedido delivery",
  "Reserva anticipada",
];

const WALLETS = ["Mercado Pago", "Naranja X", "Ualá", "Cuenta DNI", "MODO"];

const PAYMENT_METHODS = ["QR", "Link de pago", "Transferencia", "CVU"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(): number {
  const amounts = [150, 280, 450, 750, 1200, 1850, 2500, 3400, 5000, 7500, 12000, 15000, 25000];
  return randomFrom(amounts) + Math.floor(Math.random() * 100);
}

function generatePayment(index: number): Payment {
  const now = Date.now();
  const minutesAgo = Math.floor(Math.random() * 180);
  const createdAt = new Date(now - minutesAgo * 60 * 1000);

  const statuses: Array<Payment["status"]> = [
    "approved", "approved", "approved", "approved", "approved",
    "approved", "approved", "pending", "pending", "rejected",
  ];

  const status = randomFrom(statuses);
  const payer = randomFrom(PAYER_NAMES);

  return {
    id: `PAY-${String(1000 + index).padStart(6, "0")}`,
    externalId: `MP-${Date.now()}-${index}`,
    amount: randomAmount(),
    currency: "ARS",
    status,
    payerName: payer,
    payerEmail: `${payer.toLowerCase().replace(" ", ".")}@email.com`,
    description: randomFrom(DESCRIPTIONS),
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    paymentMethod: randomFrom(PAYMENT_METHODS),
    wallet: randomFrom(WALLETS),
  };
}

export function generateMockPayments(count: number = 20): PaymentsResponse {
  const payments: Payment[] = Array.from({ length: count }, (_, i) =>
    generatePayment(i)
  ).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    payments,
    total: payments.length,
    lastSync: new Date().toISOString(),
    connectionStatus: "connected",
    branchName: "Sucursal Centro",
    currentShift: "Turno Mañana",
  };
}
