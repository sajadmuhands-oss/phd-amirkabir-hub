import { ReportType, type Report } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  formatBaghdad,
  getDailyPeriod,
  getMonthlyPeriod,
  getWeeklyPeriod,
  type PeriodRange,
} from "@/lib/reports/periods";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

export type ReportPayload = {
  period: PeriodRange;
  reportType: ReportType;
  institutionName: string;
  totals: {
    documents: number;
    citations: number;
    authors: number;
    hIndex: number | null;
  };
  newPublications: Array<{
    title: string;
    year: number | null;
    journal: string | null;
    citations: number;
  }>;
  updates: number;
  removals: number;
  topJournals: Array<{ name: string; count: number }>;
  topAuthors: Array<{ name: string; count: number }>;
};

async function getInstitution() {
  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!institution) throw new Error("لم يتم تهيئة بيانات الجامعة بعد. شغّل prisma db seed.");
  return institution;
}

async function collectPayload(
  reportType: ReportType,
  period: PeriodRange
): Promise<ReportPayload> {
  const institution = await getInstitution();

  const [documents, authors, latestMetric, newPubs, updates, removals, journals, topAuthors] =
    await Promise.all([
      prisma.publication.count({
        where: { institutionId: institution.id, isActive: true },
      }),
      prisma.author.count({
        where: { institutionId: institution.id, publicationCount: { gt: 0 } },
      }),
      prisma.metricSnapshot.findFirst({
        where: { institutionId: institution.id },
        orderBy: { capturedAt: "desc" },
      }),
      prisma.publication.findMany({
        where: {
          institutionId: institution.id,
          firstSeenAt: { gte: period.start, lte: period.end },
        },
        orderBy: { firstSeenAt: "desc" },
        take: 50,
        select: {
          title: true,
          publishedYear: true,
          journalName: true,
          citationCount: true,
        },
      }),
      prisma.changeEvent.count({
        where: {
          institutionId: institution.id,
          changeType: "UPDATED_PUBLICATION",
          discoveredAt: { gte: period.start, lte: period.end },
        },
      }),
      prisma.changeEvent.count({
        where: {
          institutionId: institution.id,
          changeType: "REMOVED_PUBLICATION",
          discoveredAt: { gte: period.start, lte: period.end },
        },
      }),
      prisma.publication.groupBy({
        by: ["journalName"],
        where: {
          institutionId: institution.id,
          isActive: true,
          journalName: { not: null },
        },
        _count: { journalName: true },
        orderBy: { _count: { journalName: "desc" } },
        take: 5,
      }),
      prisma.author.findMany({
        where: { institutionId: institution.id, publicationCount: { gt: 0 } },
        orderBy: { publicationCount: "desc" },
        take: 5,
        select: { name: true, publicationCount: true },
      }),
    ]);

  const citations =
    latestMetric?.citationCount ??
    (
      await prisma.publication.aggregate({
        where: { institutionId: institution.id, isActive: true },
        _sum: { citationCount: true },
      })
    )._sum.citationCount ??
    0;

  return {
    period,
    reportType,
    institutionName: institution.nameAr,
    totals: {
      documents,
      citations,
      authors,
      hIndex: latestMetric?.hIndex ?? null,
    },
    newPublications: newPubs.map((p) => ({
      title: p.title,
      year: p.publishedYear,
      journal: p.journalName,
      citations: p.citationCount,
    })),
    updates,
    removals,
    topJournals: journals
      .filter((j) => j.journalName)
      .map((j) => ({ name: j.journalName!, count: j._count.journalName })),
    topAuthors: topAuthors.map((a) => ({
      name: a.name,
      count: a.publicationCount,
    })),
  };
}

export function buildWhatsAppText(payload: ReportPayload) {
  const lines = [
    "جامعة العين العراقية",
    "نظام متابعة المسار البحثي",
    payload.period.labelAr,
    `الوقت: ${formatBaghdad(new Date())} (بغداد)`,
    "",
    `إجمالي البحوث: ${payload.totals.documents}`,
    `الاستشهادات: ${payload.totals.citations}`,
    `الباحثون: ${payload.totals.authors}`,
    `H-index: ${payload.totals.hIndex ?? "—"}`,
    "",
    `بحوث جديدة في الفترة: ${payload.newPublications.length}`,
    `تحديثات: ${payload.updates}`,
    `إزالات من التغذية: ${payload.removals}`,
  ];

  if (payload.newPublications.length === 0) {
    lines.push("", "لا توجد إضافات جديدة خلال هذه الفترة.");
  } else {
    lines.push("", "أحدث البحوث:");
    for (const pub of payload.newPublications.slice(0, 10)) {
      lines.push(`• ${pub.title}${pub.year ? ` (${pub.year})` : ""}`);
    }
  }

  lines.push(
    "",
    "Affiliation ID: 60118739",
    "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList"
  );

  return lines.join("\n");
}

async function savePdfIfNeeded(
  reportType: ReportType,
  periodKey: string,
  payload: ReportPayload
) {
  if (reportType !== ReportType.WEEKLY && reportType !== ReportType.MONTHLY) {
    return null;
  }

  const dir = path.join(process.cwd(), "storage", "reports");
  await mkdir(dir, { recursive: true });
  const fileName = `${periodKey.replace(/[:/]/g, "_")}.pdf`;
  const filePath = path.join(dir, fileName);
  // Dynamic import keeps the BullMQ worker bootable if PDF deps mis-resolve under tsx.
  const { renderReportPdf } = await import("@/lib/reports/pdf");
  const buffer = await renderReportPdf(payload);
  await writeFile(filePath, buffer);
  return path.join("storage", "reports", fileName);
}

export async function generateReport(options: {
  reportType: ReportType;
  period?: PeriodRange;
  sendWhatsApp?: boolean;
  force?: boolean;
}): Promise<{ report: Report; payload: ReportPayload; sent: boolean }> {
  const institution = await getInstitution();
  const period =
    options.period ||
    (options.reportType === ReportType.WEEKLY
      ? getWeeklyPeriod()
      : options.reportType === ReportType.MONTHLY
        ? getMonthlyPeriod()
        : getDailyPeriod());

  const existing = await prisma.report.findUnique({
    where: {
      institutionId_reportType_periodKey: {
        institutionId: institution.id,
        reportType: options.reportType,
        periodKey: period.periodKey,
      },
    },
  });

  if (existing && !options.force && existing.sentAt) {
    const payload = await collectPayload(options.reportType, period);
    return { report: existing, payload, sent: true };
  }

  const payload = await collectPayload(options.reportType, period);
  const contentText = buildWhatsAppText(payload);
  const pdfPath = await savePdfIfNeeded(options.reportType, period.periodKey, payload);

  const report = existing
    ? await prisma.report.update({
        where: { id: existing.id },
        data: {
          titleAr: period.labelAr,
          titleEn: period.periodKey,
          contentText,
          contentJson: payload as object,
          pdfPath,
          generatedAt: new Date(),
        },
      })
    : await prisma.report.create({
        data: {
          institutionId: institution.id,
          reportType: options.reportType,
          periodKey: period.periodKey,
          titleAr: period.labelAr,
          titleEn: period.periodKey,
          contentText,
          contentJson: payload as object,
          pdfPath,
        },
      });

  let sent = Boolean(report.sentAt);
  if (options.sendWhatsApp !== false) {
    const message = await sendWhatsAppText({
      body: contentText.slice(0, 4000),
      reportId: report.id,
      idempotencyKey: `report:${options.reportType}:${period.periodKey}`,
    });
    if (message && "status" in message && message.status === "SENT") {
      await prisma.report.update({
        where: { id: report.id },
        data: { sentAt: new Date() },
      });
      sent = true;
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "report.generated",
      level: "info",
      details: {
        reportId: report.id,
        reportType: options.reportType,
        periodKey: period.periodKey,
        sent,
      },
    },
  });

  return { report, payload, sent };
}

export async function generateTestReport() {
  const period = getDailyPeriod();
  return generateReport({
    reportType: ReportType.TEST,
    period: {
      ...period,
      periodKey: `test:${formatBaghdad(new Date(), "yyyy-MM-dd-HHmmss")}`,
      labelAr: "تقرير تجريبي",
    },
    sendWhatsApp: true,
    force: true,
  });
}
