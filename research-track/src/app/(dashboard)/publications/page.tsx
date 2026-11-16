import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const year = params.year ? Number(params.year) : undefined;

  const publications = await prisma.publication.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { journalName: { contains: q, mode: "insensitive" } },
              { doi: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(year ? { publishedYear: year } : {}),
    },
    include: {
      authors: {
        include: { author: true },
        orderBy: { authorOrder: "asc" },
        take: 5,
      },
    },
    orderBy: [{ publishedYear: "desc" }, { firstSeenAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <header className="surface rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[var(--aui-navy)]">الأبحاث العلمية</h1>
        <p className="mt-1 text-sm text-[var(--aui-slate)]">
          الأرشيف المحلي للمنشورات (AF-ID 60118739)
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-4">
          <input name="q" defaultValue={q} placeholder="بحث بالعنوان أو DOI أو المجلة" className="rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2 md:col-span-2" />
          <input name="year" defaultValue={year || ""} placeholder="السنة" className="rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2" />
          <button className="rounded-xl bg-[var(--aui-navy)] px-4 py-2 text-white">تصفية</button>
        </form>
      </header>
      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--aui-mist)] text-[var(--aui-slate)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">العنوان</th>
                <th className="px-4 py-3 text-start font-medium">الباحثون</th>
                <th className="px-4 py-3 text-start font-medium">المجلة</th>
                <th className="px-4 py-3 text-start font-medium">السنة</th>
                <th className="px-4 py-3 text-start font-medium">الاستشهادات</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((pub) => (
                <tr key={pub.id} className="border-t border-[var(--aui-line)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--aui-ink)]">{pub.title}</p>
                    {pub.doi ? (
                      <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--aui-sapphire)]">{pub.doi}</a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--aui-slate)]">{pub.authors.map((a) => a.author.name).join("، ")}</td>
                  <td className="px-4 py-3">{pub.journalName || "—"}</td>
                  <td className="px-4 py-3">{pub.publishedYear || "—"}</td>
                  <td className="px-4 py-3">{pub.citationCount}</td>
                </tr>
              ))}
              {publications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--aui-slate)]">لا توجد أبحاث مطابقة حالياً.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
