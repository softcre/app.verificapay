"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error?: string;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá tu email y contraseña." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .single();

  redirect(profile?.role === "superadmin" ? "/superadmin" : "/dashboard");
}

export async function signUpOwner(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !businessName || !email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    { email, password }
  );

  if (signUpError || !signUpData.user) {
    return {
      error: signUpError?.message ?? "No se pudo crear la cuenta.",
    };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: businessName })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: "No se pudo crear el comercio. Probá de nuevo." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: signUpData.user.id,
    organization_id: org.id,
    full_name: fullName,
    email,
    role: "owner",
  });

  if (profileError) {
    return { error: "No se pudo crear tu perfil. Probá de nuevo." };
  }

  redirect("/dashboard");
}

export async function signUpEmployee(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !inviteCode || !email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();

  const { data: org, error: orgLookupError } = await supabase
    .from("organizations")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (orgLookupError || !org) {
    return { error: "El código de invitación no es válido." };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
    { email, password }
  );

  if (signUpError || !signUpData.user) {
    return {
      error: signUpError?.message ?? "No se pudo crear la cuenta.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: signUpData.user.id,
    organization_id: org.id,
    full_name: fullName,
    email,
    role: "employee",
    shift: shift || null,
  });

  if (profileError) {
    return { error: "No se pudo unir al comercio. Probá de nuevo." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
