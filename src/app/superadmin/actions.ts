"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { ProfileStatus } from "@/lib/database.types";
import { requireSuperadmin } from "@/lib/superadmin";
import { formatLimit, getPlanUsage } from "@/lib/plans";

export interface OwnerActionState {
  error?: string;
  success?: string;
}

const MIN_PASSWORD_LENGTH = 8;

/** Confirma que el plan exista antes de asignarlo a un comercio. */
async function findPlan(service: SupabaseClient, planId: string) {
  const { data } = await service
    .from("plans")
    .select("id, name, max_employees, max_wallets")
    .eq("id", planId)
    .maybeSingle();
  return data;
}

/**
 * Confirma que el perfil objetivo sea un owner antes de tocarlo, para que
 * este panel no pueda editar/borrar cajeros ni a otros superadmins.
 */
async function requireTargetOwner(ownerId: string) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const { data: owner, error } = await service
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("Error buscando el dueño con service_role:", error);
    return { error: "No se pudo verificar el dueño. Revisá la configuración del servidor." };
  }
  
  if (!owner || owner.role !== "owner") {
    return { error: "El dueño no existe o ya fue eliminado." };
  }

  return { ...auth, service, organizationId: owner.organization_id };
}

export async function createOwner(
  _prevState: OwnerActionState,
  formData: FormData
): Promise<OwnerActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const planId = String(formData.get("planId") ?? "");

  if (!fullName || !businessName || !email || !password) {
    return { error: "Completá nombre, comercio, email y contraseña." };
  }
  if (!planId) return { error: "Elegí un plan para el comercio." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();

  if (!(await findPlan(service, planId))) {
    return { error: "El plan elegido ya no existe." };
  }

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    console.error("Error creando el usuario del dueño:", createError);
    const alreadyExists = createError?.message
      ?.toLowerCase()
      .includes("already");
    return {
      error: alreadyExists
        ? "Ya existe una cuenta con ese email."
        : "No se pudo crear la cuenta del dueño.",
    };
  }

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name: businessName, plan_id: planId })
    .select("id")
    .single();

  if (orgError || !org) {
    await service.auth.admin.deleteUser(created.user.id);
    return { error: "No se pudo crear el comercio." };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: created.user.id,
    organization_id: org.id,
    full_name: fullName,
    email,
    role: "owner",
    status: "active",
    created_by: auth.superadminId,
  });

  if (profileError) {
    // Sin perfil, el usuario de auth quedaría huérfano y bloquearía el email.
    await service.auth.admin.deleteUser(created.user.id);
    await service.from("organizations").delete().eq("id", org.id);
    return { error: "No se pudo crear el perfil del dueño." };
  }

  revalidatePath("/superadmin");
  return { success: `${fullName} ya puede iniciar sesión con ${email}.` };
}

export async function updateOwner(
  _prevState: OwnerActionState,
  formData: FormData
): Promise<OwnerActionState> {
  const ownerId = String(formData.get("ownerId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const planId = String(formData.get("planId") ?? "");

  if (!ownerId || !fullName || !businessName) {
    return { error: "El nombre y el comercio no pueden quedar vacíos." };
  }
  if (!planId) return { error: "Elegí un plan para el comercio." };
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireTargetOwner(ownerId);
  if ("error" in auth) return auth;

  const plan = await findPlan(auth.service, planId);
  if (!plan) return { error: "El plan elegido ya no existe." };

  const { error: profileError } = await auth.service
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", ownerId);

  if (profileError) return { error: "No se pudieron guardar los cambios." };

  const { error: orgError } = await auth.service
    .from("organizations")
    .update({ name: businessName, plan_id: planId })
    .eq("id", auth.organizationId);

  if (orgError) return { error: "No se pudo actualizar el comercio." };

  // Bajar de plan no borra nada: el comercio conserva lo que tiene, pero no
  // puede sumar más hasta quedar dentro del límite. Se avisa para que el
  // superadmin lo sepa.
  const usage = await getPlanUsage(auth.service, auth.organizationId);
  const overages = [
    plan.max_employees != null && usage.employees > plan.max_employees
      ? `${usage.employees}/${formatLimit(plan.max_employees)} cajeros`
      : null,
    plan.max_wallets != null && usage.wallets > plan.max_wallets
      ? `${usage.wallets}/${formatLimit(plan.max_wallets)} billeteras`
      : null,
  ].filter(Boolean);

  if (password) {
    const { error: passwordError } = await auth.service.auth.admin.updateUserById(
      ownerId,
      { password }
    );
    if (passwordError) {
      return { error: "Se guardaron los datos, pero no la nueva contraseña." };
    }
  }

  revalidatePath("/superadmin");
  const base = password
    ? "Dueño actualizado y contraseña cambiada."
    : "Dueño actualizado.";
  return {
    success: overages.length
      ? `${base} Ojo: el comercio supera el plan ${plan.name} (${overages.join(", ")}); no podrá sumar más hasta liberar.`
      : base,
  };
}

export async function setOwnerStatus(
  ownerId: string,
  status: ProfileStatus
): Promise<OwnerActionState> {
  const auth = await requireTargetOwner(ownerId);
  if ("error" in auth) return auth;

  const { error } = await auth.service
    .from("profiles")
    .update({ status })
    .eq("id", ownerId);

  if (error) return { error: "No se pudo cambiar el estado del dueño." };

  revalidatePath("/superadmin");
  return {
    success:
      status === "active"
        ? "Dueño reactivado."
        : "Dueño suspendido: ya no puede acceder.",
  };
}

export async function deleteOwner(ownerId: string): Promise<OwnerActionState> {
  const auth = await requireTargetOwner(ownerId);
  if ("error" in auth) return auth;

  // Eliminar un owner se lleva puesto todo su comercio: cajeros, billeteras
  // y pagos. Se borran primero las cuentas de auth de todo el equipo (arrastra
  // sus perfiles por el on delete cascade) y recién después la organización,
  // para no dejar usuarios de auth huérfanos sin perfil.
  const { data: teamProfiles } = await auth.service
    .from("profiles")
    .select("id")
    .eq("organization_id", auth.organizationId);

  for (const member of teamProfiles ?? []) {
    await auth.service.auth.admin.deleteUser(member.id);
  }

  const { error } = await auth.service
    .from("organizations")
    .delete()
    .eq("id", auth.organizationId);

  if (error) return { error: "No se pudo eliminar el comercio." };

  revalidatePath("/superadmin");
  return { success: "Dueño y comercio eliminados." };
}
