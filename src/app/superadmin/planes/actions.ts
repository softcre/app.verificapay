"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { WALLET_PROVIDERS, WalletProvider } from "@/lib/database.types";
import { requireSuperadmin } from "@/lib/superadmin";

export interface PlanActionState {
  error?: string;
  success?: string;
}

function revalidatePlans() {
  revalidatePath("/superadmin/planes");
  revalidatePath("/superadmin");
}

/** Campo vacío = ilimitado (null). */
function parseLimit(value: FormDataEntryValue | null): number | null | "invalid" {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

/** Crea un plan, o lo edita si viene `planId`. */
export async function savePlan(
  _prevState: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0").trim() || "0");
  const maxEmployees = parseLimit(formData.get("maxEmployees"));
  const maxWallets = parseLimit(formData.get("maxWallets"));
  const providers = formData
    .getAll("providers")
    .map(String)
    .filter((p): p is WalletProvider =>
      WALLET_PROVIDERS.includes(p as WalletProvider)
    );

  if (!name) return { error: "El plan necesita un nombre." };
  if (name.length > 40) return { error: "Usá un nombre más corto." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El precio tiene que ser un número mayor o igual a 0." };
  if (maxEmployees === "invalid" || maxWallets === "invalid")
    return { error: "Los límites tienen que ser números enteros (o vacío = ilimitado)." };
  if (providers.length === 0)
    return { error: "Elegí al menos un proveedor de billetera." };

  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const values = {
    name,
    description: description || null,
    price,
    max_employees: maxEmployees,
    max_wallets: maxWallets,
    allowed_providers: providers,
  };

  const { error } = planId
    ? await service.from("plans").update(values).eq("id", planId)
    : await service.from("plans").insert(values);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un plan con ese nombre."
          : "No se pudo guardar el plan.",
    };
  }

  revalidatePlans();
  return { success: planId ? "Plan actualizado." : `Plan ${name} creado.` };
}

export async function setPlanActive(
  planId: string,
  isActive: boolean
): Promise<PlanActionState> {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const { data: plan } = await service
    .from("plans")
    .select("is_default")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return { error: "El plan no existe." };
  if (!isActive && plan.is_default)
    return { error: "No podés desactivar el plan por defecto. Elegí otro por defecto antes." };

  const { error } = await service
    .from("plans")
    .update({ is_active: isActive })
    .eq("id", planId);

  if (error) return { error: "No se pudo cambiar el estado del plan." };

  revalidatePlans();
  return {
    success: isActive
      ? "Plan activado: ya se puede asignar."
      : "Plan desactivado: los comercios que lo tienen lo conservan, pero no se ofrece a nuevos.",
  };
}

export async function setDefaultPlan(planId: string): Promise<PlanActionState> {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const { data: plan } = await service
    .from("plans")
    .select("is_active")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return { error: "El plan no existe." };
  if (!plan.is_active) return { error: "Activá el plan antes de hacerlo el por defecto." };

  // El índice único parcial admite un solo default: primero se apaga el actual.
  const { error: clearError } = await service
    .from("plans")
    .update({ is_default: false })
    .eq("is_default", true);
  if (clearError) return { error: "No se pudo cambiar el plan por defecto." };

  const { error } = await service
    .from("plans")
    .update({ is_default: true })
    .eq("id", planId);
  if (error) return { error: "No se pudo cambiar el plan por defecto." };

  revalidatePlans();
  return { success: "Plan por defecto actualizado." };
}

export async function deletePlan(planId: string): Promise<PlanActionState> {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const [{ data: plan }, { count }] = await Promise.all([
    service.from("plans").select("is_default").eq("id", planId).maybeSingle(),
    service
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId),
  ]);

  if (!plan) return { error: "El plan no existe." };
  if (plan.is_default)
    return { error: "No podés eliminar el plan por defecto." };
  if (count)
    return {
      error: `Hay ${count} comercio${count === 1 ? "" : "s"} con este plan. Pasalos a otro plan o desactivalo en lugar de eliminarlo.`,
    };

  const { error } = await service.from("plans").delete().eq("id", planId);
  if (error) return { error: "No se pudo eliminar el plan." };

  revalidatePlans();
  return { success: "Plan eliminado." };
}
