"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ProfileStatus } from "@/lib/database.types";

export interface EmployeeActionState {
  error?: string;
  success?: string;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Verifica que quien llama sea el dueño de un comercio y devuelve su
 * organización. Las escrituras se hacen con la service_role key (hace falta
 * para la API de auth.admin), que ignora RLS: este guard es la única barrera.
 */
async function requireOwner(): Promise<
  { organizationId: string; ownerId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión expirada. Volvé a iniciar sesión." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "No se encontró tu perfil." };
  if (profile.role !== "owner")
    return { error: "Solo el dueño del comercio puede administrar cajeros." };
  if (profile.status !== "active")
    return { error: "Tu cuenta está suspendida." };

  return { organizationId: profile.organization_id, ownerId: user.id };
}

/**
 * Confirma que el cajero pertenece al comercio del owner antes de tocarlo.
 * Sin esta verificación, la service_role key permitiría editar empleados de
 * cualquier otra organización.
 */
async function requireOwnEmployee(employeeId: string) {
  const auth = await requireOwner();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const { data: employee } = await service
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", employeeId)
    .maybeSingle();

  if (
    !employee ||
    employee.organization_id !== auth.organizationId ||
    employee.role !== "employee"
  ) {
    return { error: "El cajero no existe o no pertenece a tu comercio." };
  }

  return { ...auth, service };
}

export async function createEmployee(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const shift = String(formData.get("shift") ?? "").trim();

  if (!fullName || !email || !password) {
    return { error: "Completá nombre, email y contraseña." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireOwner();
  if ("error" in auth) return auth;

  const service = createServiceClient();

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    const alreadyExists = createError?.message
      ?.toLowerCase()
      .includes("already");
    return {
      error: alreadyExists
        ? "Ya existe una cuenta con ese email."
        : "No se pudo crear la cuenta del cajero.",
    };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: created.user.id,
    organization_id: auth.organizationId,
    full_name: fullName,
    email,
    role: "employee",
    shift: shift || null,
    status: "active",
    created_by: auth.ownerId,
  });

  if (profileError) {
    // Sin perfil, el usuario de auth quedaría huérfano y bloquearía el email.
    await service.auth.admin.deleteUser(created.user.id);
    return { error: "No se pudo crear el perfil del cajero." };
  }

  revalidatePath("/cajeros");
  return { success: `${fullName} ya puede iniciar sesión con ${email}.` };
}

export async function updateEmployee(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!employeeId || !fullName) {
    return { error: "El nombre no puede quedar vacío." };
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireOwnEmployee(employeeId);
  if ("error" in auth) return auth;

  const { error } = await auth.service
    .from("profiles")
    .update({ full_name: fullName, shift: shift || null })
    .eq("id", employeeId);

  if (error) return { error: "No se pudieron guardar los cambios." };

  if (password) {
    const { error: passwordError } = await auth.service.auth.admin.updateUserById(
      employeeId,
      { password }
    );
    if (passwordError) {
      return { error: "Se guardaron los datos, pero no la nueva contraseña." };
    }
  }

  revalidatePath("/cajeros");
  return {
    success: password
      ? "Cajero actualizado y contraseña cambiada."
      : "Cajero actualizado.",
  };
}

export async function setEmployeeStatus(
  employeeId: string,
  status: ProfileStatus
): Promise<EmployeeActionState> {
  const auth = await requireOwnEmployee(employeeId);
  if ("error" in auth) return auth;

  const { error } = await auth.service
    .from("profiles")
    .update({ status })
    .eq("id", employeeId);

  if (error) return { error: "No se pudo cambiar el estado del cajero." };

  revalidatePath("/cajeros");
  return {
    success:
      status === "active"
        ? "Cajero reactivado."
        : "Cajero suspendido: ya no puede acceder.",
  };
}

export async function deleteEmployee(
  employeeId: string
): Promise<EmployeeActionState> {
  const auth = await requireOwnEmployee(employeeId);
  if ("error" in auth) return auth;

  // Borrar el usuario de auth arrastra el perfil por el on delete cascade.
  const { error } = await auth.service.auth.admin.deleteUser(employeeId);
  if (error) return { error: "No se pudo eliminar el cajero." };

  revalidatePath("/cajeros");
  return { success: "Cajero eliminado." };
}
