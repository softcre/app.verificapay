/** Tarjeta de indicador del panel de superadmin. */
export default function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "bg-primary-light text-primary",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  /** Clases de fondo y color del ícono. */
  tone?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted truncate">
          {label}
        </p>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground mt-2 truncate">
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
      </p>
      {hint && <p className="text-xs text-muted truncate">{hint}</p>}
    </div>
  );
}
