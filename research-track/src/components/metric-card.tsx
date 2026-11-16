import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface animate-fade-up rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,33,71,0.06)]",
        className
      )}
    >
      <p className="text-sm text-[var(--auiq-muted)]">{label}</p>
      <p className="metric-value mt-2 text-3xl font-semibold text-[var(--auiq-navy)]">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-[var(--auiq-muted)]">{hint}</p> : null}
    </div>
  );
}
