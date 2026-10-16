import type { SupabaseClient } from "@supabase/supabase-js";
import { Plan, WalletProvider } from "./database.types";

/** Lo que el plan de un comercio permite y cuánto lleva usado. */
export interface PlanUsage {
  plan: Pick<
    Plan,
    "id" | "name" | "max_employees" | "max_wallets" | "allowed_providers"
  > | null;
  employees: number;
  wallets: number;
}

/** true si ya no entra otro (null = ilimitado). */
export function isAtLimit(limit: number | null | undefined, used: number) {
  return limit != null && used >= limit;
}

export function formatLimit(limit: number | null | undefined) {
  return limit == null ? "∞" : String(limit);
}

export function isProviderAllowed(
  plan: PlanUsage["plan"],
  provider: WalletProvider
) {
  // Sin plan asignado no se restringe: los triggers de la base hacen lo mismo.
  return !plan || plan.allowed_providers.includes(provider);
}

export function formatPrice(price: number, currency: string) {
  if (price === 0) return "Gratis";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Plan y consumo actual de un comercio. Sirve tanto con el cliente del
 * usuario (RLS deja leer lo propio) como con la service_role key.
 */
export async function getPlanUsage(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PlanUsage> {
  const [{ data: org }, employees, wallets] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "plans(id, name, max_employees, max_wallets, allowed_providers)"
      )
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "employee"),
    supabase
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  return {
    plan: (org?.plans ?? null) as unknown as PlanUsage["plan"],
    employees: employees.count ?? 0,
    wallets: wallets.count ?? 0,
  };
}

/** Traduce los errores que levantan los triggers de límites de la base. */
export function planLimitMessage(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("plan_limit_employees"))
    return "Llegaste al máximo de cajeros de tu plan.";
  if (message.includes("plan_limit_wallets"))
    return "Llegaste al máximo de billeteras de tu plan.";
  if (message.includes("plan_provider_not_allowed"))
    return "Tu plan no incluye ese proveedor.";
  return null;
}
