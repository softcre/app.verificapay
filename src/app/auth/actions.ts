"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/session-cookie";

export interface AuthActionState {
  error?: string;
  success?: string;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Completá tu email y contraseña." };
  }

  const supabase = await createClient({ sessionOnly: !remember });
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  // El proxy y el cliente del browser leen esta preferencia al refrescar el
  // token, para no volver a escribir cookies persistentes.
  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(SESSION_ONLY_COOKIE);
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .single();

  redirect(profile?.role === "superadmin" ? "/superadmin" : "/pagos");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Ingresá tu email." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/restablecer`,
  });

  if (error?.status === 429) {
    return { error: "Hiciste muchos pedidos seguidos. Esperá unos minutos." };
  }

  // Misma respuesta exista o no la cuenta, para no revelar qué emails están
  // registrados.
  return {
    success:
      "Si el email está registrado, te enviamos un link para restablecer tu contraseña.",
  };
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword || !confirmPassword) {
    return { error: "Completá todos los campos." };
  }
  if (newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error?.code === "same_password") {
    return { error: "La nueva contraseña tiene que ser distinta de la actual." };
  }
  if (error) {
    return { error: "No se pudo cambiar la contraseña. Probá de nuevo." };
  }

  redirect("/pagos");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  redirect("/login");
}
