import { prisma } from "@/lib/prisma";
import {
  getDailyPeriod,
  getMonthlyPeriod,
  getWeeklyPeriod,
} from "@/lib/reports/periods";

export async function getDashboardData() {
  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!institution) return null;

  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
    }).format(now)
  );
  const daily = getDailyPeriod(now);
  const weekly = getWeeklyPeriod(now);
  const monthly = getMonthlyPeriod(now);

  const [
    totalPublications,
    yearPublications,
    todayPublications,
    weekPublications,
    monthPublications,
    authorCount,
    latestMetrics,
    lastScan,
    yearDistribution,
    typeDistribution,
    topJournals,
    topAuthors,
    recentChanges,
    recentPublications,
    citationSum,
  ] = await Promise.all([
    prisma.publication.count({
      where: { institutionId: institution.id, isActive: true },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        isActive: true,
        publishedYear: currentYear,
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: { gte: daily.start, lte: daily.end },
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: { gte: weekly.start, lte: weekly.end },
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: { gte: monthly.start, lte: monthly.end },
      },
    }),
    prisma.author.count({
      where: { institutionId: institution.id, publicationCount: { gt: 0 } },
    }),
    prisma.metricSnapshot.findFirst({
      where: { institutionId: institution.id },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.scanRun.findFirst({
      where: { institutionId: institution.id },
      orderBy: { startedAt: "desc" },
    }),
    prisma.publication.groupBy({
      by: ["publishedYear"],
      where: {
        institutionId: institution.id,
        isActive: true,
        publishedYear: { not: null },
      },
      _count: { _all: true },
      orderBy: { publishedYear: "asc" },
    }),
    prisma.publication.groupBy({
      by: ["publicationType"],
      where: {
        institutionId: institution.id,
        isActive: true,
        publicationType: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { publicationType: "desc" } },
      take: 8,
    }),
    prisma.publication.groupBy({
      by: ["journalName"],
      where: {
        institutionId: institution.id,
        isActive: true,
        journalName: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { journalName: "desc" } },
      take: 8,
    }),
    prisma.author.findMany({
      where: { institutionId: institution.id, publicationCount: { gt: 0 } },
      orderBy: { publicationCount: "desc" },
      take: 8,
    }),
    prisma.changeEvent.findMany({
      where: { institutionId: institution.id },
      orderBy: { discoveredAt: "desc" },
      take: 10,
      include: { publication: true },
    }),
    prisma.publication.findMany({
      where: {
        institutionId: institution.id,
        isActive: true,
      },
      orderBy: { firstSeenAt: "desc" },
      take: 8,
      include: {
        authors: { include: { author: true }, orderBy: { authorOrder: "asc" } },
      },
    }),
    prisma.publication.aggregate({
      where: { institutionId: institution.id, isActive: true },
      _sum: { citationCount: true },
    }),
  ]);

  return {
    institution,
    kpis: {
      totalPublications,
      yearPublications,
      todayPublications,
      weekPublications,
      monthPublications,
      authorCount,
      citationCount:
        latestMetrics?.citationCount ?? citationSum._sum.citationCount ?? 0,
      hIndex: latestMetrics?.hIndex ?? null,
    },
    lastScan,
    charts: {
      years: yearDistribution.map((y) => ({
        year: String(y.publishedYear),
        count: y._count._all,
      })),
      types: typeDistribution.map((t) => ({
        type: t.publicationType || "Unknown",
        count: t._count._all,
      })),
    },
    topJournals: topJournals.map((j) => ({
      name: j.journalName || "",
      count: j._count._all,
    })),
    topAuthors,
    recentChanges,
    recentPublications,
  };
}
