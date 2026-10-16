import { formatLimit, isAtLimit } from "@/lib/plans";

/** Consumo de un recurso contra el límite del plan del comercio. */
export default function PlanUsageBar({
  planName,
  label,
  used,
  limit,
}: {
  planName: string | null;
  label: string;
  used: number;
  /** null = ilimitado. */
  limit: number | null;
}) {
  const full = isAtLimit(limit, used);
  const percent =
    limit == null ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {label} de tu plan
          {planName && (
            <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs font-semibold">
              {planName}
            </span>
          )}
        </p>
        <p className={`font-semibold ${full ? "text-warning-fg" : "text-foreground"}`}>
          {used} / {formatLimit(limit)}
        </p>
      </div>
      {limit != null && (
        <div className="mt-2 h-1.5 rounded-full bg-card-border overflow-hidden">
          <div
            className={`h-full rounded-full ${full ? "bg-warning" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {full && (
        <p className="mt-2 text-xs text-warning-fg">
          Llegaste al máximo de tu plan. Para sumar más, contactá a soporte para
          cambiar de plan.
        </p>
      )}
    </div>
  );
}
