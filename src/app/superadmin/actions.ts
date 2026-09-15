"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ProfileStatus } from "@/lib/database.types";

export interface OwnerActionState {
  error?: string;
  success?: string;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Verifica que quien llama sea superadmin. Las escrituras se hacen con la
 * service_role key (hace falta para la API de auth.admin), que ignora RLS:
 * este guard es la única barrera.
 */
async function requireSuperadmin(): Promise<
  { superadminId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión expirada. Volvé a iniciar sesión." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "No se encontró tu perfil." };
  if (profile.role !== "superadmin")
    return { error: "Solo un superadmin puede administrar comercios." };
  if (profile.status !== "active")
    return { error: "Tu cuenta está suspendida." };

  return { superadminId: user.id };
}

/**
 * Confirma que el perfil objetivo sea un owner antes de tocarlo, para que
 * este panel no pueda editar/borrar cajeros ni a otros superadmins.
 */
async function requireTargetOwner(ownerId: string) {
  const auth = await requireSuperadmin();
  if ("error" in auth) return auth;

  const service = createServiceClient();
  const { data: owner } = await service
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", ownerId)
    .maybeSingle();

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

  if (!fullName || !businessName || !email || !password) {
    return { error: "Completá nombre, comercio, email y contraseña." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireSuperadmin();
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
        : "No se pudo crear la cuenta del dueño.",
    };
  }

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name: businessName })
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

  if (!ownerId || !fullName || !businessName) {
    return { error: "El nombre y el comercio no pueden quedar vacíos." };
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const auth = await requireTargetOwner(ownerId);
  if ("error" in auth) return auth;

  const { error: profileError } = await auth.service
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", ownerId);

  if (profileError) return { error: "No se pudieron guardar los cambios." };

  const { error: orgError } = await auth.service
    .from("organizations")
    .update({ name: businessName })
    .eq("id", auth.organizationId);

  if (orgError) return { error: "No se pudo actualizar el comercio." };

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
  return {
    success: password
      ? "Dueño actualizado y contraseña cambiada."
      : "Dueño actualizado.",
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
