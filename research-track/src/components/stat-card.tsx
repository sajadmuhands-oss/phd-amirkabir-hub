export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="text-sm text-[var(--aui-slate)]">{label}</p>
      <p className="kpi-value mt-2 text-3xl font-bold text-[var(--aui-navy)]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--aui-slate)]">{hint}</p> : null}
    </div>
  );
}
