// Período de pagos que muestra el visor. Se resuelve en el servidor para que
// la API de la billetera devuelva solo los movimientos de esa ventana.

export type PaymentPeriod = "today" | "24h" | "7d";

export const DEFAULT_PERIOD: PaymentPeriod = "24h";

export const PERIOD_OPTIONS: { key: PaymentPeriod; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "24h", label: "Últimas 24 h" },
  { key: "7d", label: "7 días" },
];

// Argentina no tiene horario de verano: el offset es fijo.
const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";
const AR_OFFSET = "-03:00";
const HOUR_MS = 60 * 60 * 1000;

export function parsePeriod(value: string | null): PaymentPeriod {
  return PERIOD_OPTIONS.some((o) => o.key === value)
    ? (value as PaymentPeriod)
    : DEFAULT_PERIOD;
}

/** Inicio del período; "Hoy" arranca a las 00:00 hora de Argentina. */
export function periodStart(period: PaymentPeriod, now = new Date()): Date {
  switch (period) {
    case "today": {
      // en-CA formatea como YYYY-MM-DD.
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: AR_TIME_ZONE,
      }).format(now);
      return new Date(`${ymd}T00:00:00${AR_OFFSET}`);
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * HOUR_MS);
    case "24h":
    default:
      return new Date(now.getTime() - 24 * HOUR_MS);
  }
}

/** Fecha en el formato que usa Mercado Pago: 2026-10-15T00:00:00.000-03:00 */
export function toMercadoPagoDate(date: Date): string {
  return new Date(date.getTime() - 3 * HOUR_MS)
    .toISOString()
    .replace("Z", AR_OFFSET);
}
