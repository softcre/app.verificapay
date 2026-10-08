"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileActionState {
  error?: string;
  success?: string;
}

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const shift = formData.has("shift")
    ? String(formData.get("shift") ?? "").trim()
    : undefined;

  if (!fullName) {
    return { error: "El nombre no puede quedar vacío." };
  }
  if (fullName.length > 80) {
    return { error: "El nombre es demasiado largo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Solo los campos editables: rol, comercio y estado los protege también la
  // política "profiles: update own".
  const { error } = await supabase
    .from("profiles")
    .update(
      shift === undefined
        ? { full_name: fullName }
        : { full_name: fullName, shift: shift || null }
    )
    .eq("id", user.id);

  if (error) {
    return { error: "No se pudieron guardar los cambios. Probá de nuevo." };
  }

  // El nombre aparece en la barra superior de todas las páginas.
  revalidatePath("/", "layout");
  return { success: "Datos actualizados." };
}

export async function changePassword(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Completá todos los campos." };
  }
  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas nuevas no coinciden." };
  }
  if (newPassword === currentPassword) {
    return { error: "La nueva contraseña tiene que ser distinta de la actual." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  // Confirmamos la contraseña actual para que una sesión abierta en una caja
  // compartida no alcance para cambiarla.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: "No se pudo cambiar la contraseña. Probá de nuevo." };
  }

  return { success: "Contraseña actualizada." };
}
