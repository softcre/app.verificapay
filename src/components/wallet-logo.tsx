import Image from "next/image";
import { WalletProvider, WALLET_PROVIDER_LABELS } from "@/lib/database.types";

// Logos oficiales en /public/wallets/<provider>.svg. Al sumar uno nuevo,
// agregarlo acá; mientras tanto se muestra la insignia con los colores.
const WALLET_LOGOS: Partial<Record<WalletProvider, string>> = {
  mercado_pago: "/wallets/mercado_pago.svg",
};

const WALLET_BADGES: Record<WalletProvider, { initials: string; className: string }> = {
  mercado_pago: { initials: "MP", className: "bg-[#00B1EA] text-white" },
  naranja_x: { initials: "NX", className: "bg-[#FE5000] text-white" },
  uala: { initials: "U", className: "bg-[#3E6BFF] text-white" },
  cuenta_dni: { initials: "DNI", className: "bg-[#00A859] text-white" },
  modo: { initials: "M", className: "bg-[#00C389] text-white" },
};

export default function WalletLogo({
  provider,
  className = "w-6 h-6",
}: {
  provider: WalletProvider;
  /** Tamaño del logo (por defecto w-6 h-6). */
  className?: string;
}) {
  const label = WALLET_PROVIDER_LABELS[provider] ?? provider;
  const logo = WALLET_LOGOS[provider];

  if (logo) {
    return (
      <Image
        src={logo}
        alt={label}
        title={label}
        width={36}
        height={36}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  const badge = WALLET_BADGES[provider] ?? {
    initials: "?",
    className: "bg-card-border text-muted",
  };

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center shrink-0 rounded-md text-[9px] font-bold leading-none ${badge.className} ${className}`}
    >
      {badge.initials}
    </span>
  );
}
