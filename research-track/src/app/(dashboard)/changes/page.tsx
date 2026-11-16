import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const changes = await prisma.changeEvent.findMany({
    orderBy: { discoveredAt: "desc" },
    take: 100,
    include: { publication: true },
  });

  return (
    <div className="space-y-6">
      <header className="surface rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[var(--aui-navy)]">سجل التغييرات</h1>
        <p className="mt-1 text-sm text-[var(--aui-slate)]">كل إضافة أو تحديث أو حذف أو تنبيه اضطراري</p>
      </header>
      <div className="space-y-3">
        {changes.map((change) => (
          <article key={change.id} className="surface rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-3 py-1 text-xs ${change.severity === "critical" ? "bg-red-100 text-red-700" : "bg-[var(--aui-mist)] text-[var(--aui-sapphire)]"}`}>
                {change.changeType}
              </span>
              <time className="text-xs text-[var(--aui-slate)]">{change.discoveredAt.toLocaleString("ar-IQ")}</time>
            </div>
            <h2 className="mt-3 font-medium text-[var(--aui-ink)]">{change.summaryAr}</h2>
            {change.publication ? <p className="mt-1 text-sm text-[var(--aui-slate)]">{change.publication.title}</p> : null}
          </article>
        ))}
        {changes.length === 0 ? <p className="surface rounded-2xl p-6 text-[var(--aui-slate)]">لا توجد تغييرات مسجلة بعد.</p> : null}
      </div>
    </div>
  );
}
