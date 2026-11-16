import { getTranslations } from "next-intl/server";
import { TypeChart, YearChart } from "@/components/charts";
import { StatCard } from "@/components/stat-card";
import {
  ensureBootstrapped,
  ensureScopusDataLoaded,
} from "@/lib/bootstrap";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tApp = await getTranslations("app");

  await ensureBootstrapped();
  // Full Scopus baseline can take minutes — start in background, never block SSR.
  void ensureScopusDataLoaded().catch(() => undefined);

  const data = await getDashboardData();
  const importing =
    Boolean(process.env.SCOPUS_API_KEY?.trim()) &&
    (!data || data.kpis.totalPublications === 0);

  if (!data) {
    return (
      <p className="surface rounded-2xl p-6">
        {importing
          ? "جاري سحب بيانات Scopus الحقيقية لأول مرة…"
          : t("noData")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {importing ? (
        <p className="rounded-2xl border border-[var(--aui-gold)]/40 bg-[var(--aui-gold)]/10 px-4 py-3 text-sm text-[var(--aui-navy)]">
          جاري سحب بيانات Scopus الحقيقية لأول مرة — حدّث الصفحة بعد دقائق.
        </p>
      ) : null}
      <header className="surface overflow-hidden rounded-3xl">
        <div className="relative bg-[linear-gradient(120deg,#002147_0%,#0D4377_55%,#1b5f95_100%)] px-6 py-8 text-white md:px-8">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_0%,#c4a35a_0,transparent_25%)]" />
          <div className="relative">
            <p className="text-sm text-white/80">{tApp("subtitle")}</p>
            <h1 className="mt-2 font-[family-name:var(--font-amiri)] text-3xl font-bold md:text-4xl">
              {tApp("university")}
            </h1>
            <p className="mt-2 text-lg text-white/90">{tApp("system")}</p>
            <p className="mt-4 text-sm text-white/75">
              {t("lastScan")}:{" "}
              {data.lastScan
                ? `${data.lastScan.status} — ${data.lastScan.startedAt.toLocaleString("ar-IQ")}`
                : "—"}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("total")} value={data.kpis.totalPublications} />
        <StatCard label={t("year")} value={data.kpis.yearPublications} />
        <StatCard label={t("today")} value={data.kpis.todayPublications} />
        <StatCard label={t("week")} value={data.kpis.weekPublications} />
        <StatCard label={t("month")} value={data.kpis.monthPublications} />
        <StatCard label={t("citations")} value={data.kpis.citationCount} />
        <StatCard label={t("hindex")} value={data.kpis.hIndex ?? "—"} />
        <StatCard label={t("authors")} value={data.kpis.authorCount} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("byYear")}</h2>
          <YearChart data={data.charts.years} />
        </div>
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("byType")}</h2>
          <TypeChart data={data.charts.types} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("topJournals")}</h2>
          <ul className="space-y-3">
            {data.topJournals.map((journal) => (
              <li key={journal.name} className="flex items-center justify-between text-sm">
                <span>{journal.name}</span>
                <span className="font-semibold text-[var(--aui-sapphire)]">{journal.count}</span>
              </li>
            ))}
            {data.topJournals.length === 0 ? (
              <li className="text-sm text-[var(--aui-slate)]">{t("noData")}</li>
            ) : null}
          </ul>
        </div>
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("topAuthors")}</h2>
          <ul className="space-y-3">
            {data.topAuthors.map((author) => (
              <li key={author.id} className="flex items-center justify-between text-sm">
                <span>{author.name}</span>
                <span className="font-semibold text-[var(--aui-sapphire)]">
                  {author.publicationCount}
                </span>
              </li>
            ))}
            {data.topAuthors.length === 0 ? (
              <li className="text-sm text-[var(--aui-slate)]">{t("noData")}</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("recentChanges")}</h2>
          <ul className="space-y-3">
            {data.recentChanges.map((change) => (
              <li
                key={change.id}
                className="border-b border-[var(--aui-line)] pb-3 text-sm last:border-0"
              >
                <p className="font-medium text-[var(--aui-ink)]">{change.summaryAr}</p>
                <p className="mt-1 text-xs text-[var(--aui-slate)]">
                  {change.discoveredAt.toLocaleString("ar-IQ")}
                </p>
              </li>
            ))}
            {data.recentChanges.length === 0 ? (
              <li className="text-sm text-[var(--aui-slate)]">{t("noData")}</li>
            ) : null}
          </ul>
        </div>
        <div className="surface rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--aui-navy)]">{t("recentPubs")}</h2>
          <ul className="space-y-3">
            {data.recentPublications.map((pub) => (
              <li
                key={pub.id}
                className="border-b border-[var(--aui-line)] pb-3 text-sm last:border-0"
              >
                <p className="font-medium text-[var(--aui-ink)]">{pub.title}</p>
                <p className="mt-1 text-xs text-[var(--aui-slate)]">
                  {pub.journalName || "—"} · {pub.publishedYear || "—"}
                </p>
              </li>
            ))}
            {data.recentPublications.length === 0 ? (
              <li className="text-sm text-[var(--aui-slate)]">{t("noData")}</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
