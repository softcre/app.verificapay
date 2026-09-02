"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WalletProvider } from "@/lib/database.types";
import { getMercadoPagoCollectorId } from "@/lib/mercadopago";

export interface WalletActionState {
  error?: string;
}

export async function addWallet(
  _prevState: WalletActionState,
  formData: FormData
): Promise<WalletActionState> {
  const provider = String(formData.get("provider") ?? "") as WalletProvider;
  const alias = String(formData.get("alias") ?? "").trim();
  const publicKey = String(formData.get("publicKey") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!provider || !alias) {
    return { error: "Completá el proveedor y el alias." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "No se encontró tu perfil." };

  let collectorId: string | null = null;
  if (provider === "mercado_pago" && accessToken) {
    try {
      collectorId = await getMercadoPagoCollectorId(accessToken);
    } catch {
      return { error: "No se pudo validar el access token con Mercado Pago." };
    }
  }

  const { error } = await supabase.from("wallets").insert({
    organization_id: profile.organization_id,
    provider,
    alias,
    public_key: publicKey || null,
    access_token: accessToken || null,
    collector_id: collectorId,
    connected_by: user.id,
  });

  if (error) {
    return { error: "No se pudo agregar la billetera." };
  }

  revalidatePath("/wallets");
  return {};
}

export async function toggleWalletStatus(walletId: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase
    .from("wallets")
    .update({ status: isActive ? "active" : "inactive" })
    .eq("id", walletId);

  revalidatePath("/wallets");
}

export async function deleteWallet(walletId: string) {
  const supabase = await createClient();
  await supabase.from("wallets").delete().eq("id", walletId);
  revalidatePath("/wallets");
}
