import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Para las páginas del panel: devuelve el cliente y el perfil del superadmin,
 * o redirige si no hay sesión o el usuario no es superadmin.
 */
export async function requireSuperadminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // El panel es exclusivo del superadmin: un owner o cajero no administra comercios ajenos.
  if (profile.role !== "superadmin") redirect("/pagos");

  return { supabase, profile };
}

/**
 * Verifica que quien llama sea superadmin. Las escrituras del panel se hacen
 * con la service_role key, que ignora RLS: este guard es la única barrera.
 *
 * Vive fuera de los archivos "use server" para no quedar expuesto como
 * Server Action invocable desde el cliente.
 */
export async function requireSuperadmin(): Promise<
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
