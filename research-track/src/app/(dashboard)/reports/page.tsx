import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  const reports = await prisma.report.findMany({
    orderBy: { generatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="surface rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[var(--aui-navy)]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--aui-slate)]">{t("subtitle")}</p>
      </header>
      <div className="space-y-3">
        {reports.map((report) => (
          <article key={report.id} className="surface rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-[var(--aui-navy)]">{report.titleAr}</h2>
              <span className="text-xs text-[var(--aui-slate)]">
                {report.generatedAt.toLocaleString("ar-IQ")}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--aui-slate)]">
              {t("type")}: {report.reportType} · {t("period")}: {report.periodKey}
              {report.sentAt
                ? ` · ${t("sent")}: ${report.sentAt.toLocaleString("ar-IQ")}`
                : ` · ${t("pending")}`}
            </p>
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--aui-mist)] p-4 text-xs leading-6 text-[var(--aui-ink)]">
              {report.contentText}
            </pre>
            {report.pdfPath ? (
              <p className="mt-3 text-xs">
                <a
                  href={`/api/reports/${report.id}/pdf`}
                  className="text-[var(--aui-sapphire)] underline-offset-2 hover:underline"
                >
                  {t("pdf")}
                </a>
              </p>
            ) : null}
          </article>
        ))}
        {reports.length === 0 ? (
          <p className="surface rounded-2xl p-6 text-[var(--aui-slate)]">{t("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}