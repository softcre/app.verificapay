import UserMenu, { type CurrentUser } from "./user-menu";

/** Barra superior de las páginas internas: título a la izquierda, usuario a la derecha. */
export default function TopBar({
  title,
  subtitle,
  user,
  children,
}: {
  title: string;
  subtitle?: string | null;
  user: CurrentUser;
  /** Acciones propias de la página, a la izquierda del menú de usuario. */
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-card border-b border-card-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 pl-12 lg:pl-0">
        <h1 className="text-base font-semibold text-foreground truncate">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {children}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
