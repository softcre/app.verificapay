import Image from "next/image";

/** Logo completo; en modo oscuro usa la variante con el texto claro. */
export default function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/brand/logo.png"
        alt="VerificaPay"
        width={640}
        height={379}
        priority
        className={`${className} dark:hidden`}
      />
      <Image
        src="/brand/logo-dark.png"
        alt="VerificaPay"
        width={640}
        height={379}
        priority
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
