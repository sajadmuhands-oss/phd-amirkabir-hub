import { prisma } from "@/lib/prisma";
import {
  getDailyPeriod,
  getMonthlyPeriod,
  getWeeklyPeriod,
} from "@/lib/reports/periods";

export async function getDashboardStats() {
  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!institution) {
    return {
      institution: null,
      metrics: null,
      counts: {
        total: 0,
        currentYear: 0,
        today: 0,
        week: 0,
        month: 0,
        authors: 0,
        citations: 0,
        hIndex: null as number | null,
      },
      yearDistribution: [] as Array<{ year: number; count: number }>,
      typeDistribution: [] as Array<{ type: string; count: number }>,
      topJournals: [] as Array<{ name: string; count: number }>,
      topAuthors: [] as Array<{ name: string; count: number }>,
      recentChanges: [],
      lastScan: null,
    };
  }

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
    total,
    currentYearCount,
    todayCount,
    weekCount,
    monthCount,
    authors,
    citationAgg,
    latestMetric,
    yearGroups,
    typeGroups,
    journals,
    topAuthors,
    recentChanges,
    lastScan,
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
    prisma.publication.aggregate({
      where: { institutionId: institution.id, isActive: true },
      _sum: { citationCount: true },
    }),
    prisma.metricSnapshot.findFirst({
      where: { institutionId: institution.id },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.publication.groupBy({
      by: ["publishedYear"],
      where: {
        institutionId: institution.id,
        isActive: true,
        publishedYear: { not: null },
      },
      _count: { publishedYear: true },
      orderBy: { publishedYear: "asc" },
    }),
    prisma.publication.groupBy({
      by: ["publicationType"],
      where: {
        institutionId: institution.id,
        isActive: true,
        publicationType: { not: null },
      },
      _count: { publicationType: true },
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
      _count: { journalName: true },
      orderBy: { _count: { journalName: "desc" } },
      take: 8,
    }),
    prisma.author.findMany({
      where: { institutionId: institution.id, publicationCount: { gt: 0 } },
      orderBy: { publicationCount: "desc" },
      take: 8,
      select: { name: true, publicationCount: true },
    }),
    prisma.changeEvent.findMany({
      where: { institutionId: institution.id },
      orderBy: { discoveredAt: "desc" },
      take: 10,
    }),
    prisma.scanRun.findFirst({
      where: { institutionId: institution.id },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    institution,
    metrics: latestMetric,
    counts: {
      total,
      currentYear: currentYearCount,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      authors,
      citations: latestMetric?.citationCount ?? citationAgg._sum.citationCount ?? 0,
      hIndex: latestMetric?.hIndex ?? null,
    },
    yearDistribution: yearGroups
      .filter((g) => g.publishedYear != null)
      .map((g) => ({
        year: g.publishedYear as number,
        count: g._count.publishedYear,
      })),
    typeDistribution: typeGroups
      .filter((g) => g.publicationType)
      .map((g) => ({
        type: g.publicationType as string,
        count: g._count.publicationType,
      })),
    topJournals: journals
      .filter((j) => j.journalName)
      .map((j) => ({
        name: j.journalName as string,
        count: j._count.journalName,
      })),
    topAuthors: topAuthors.map((a) => ({
      name: a.name,
      count: a.publicationCount,
    })),
    recentChanges,
    lastScan,
  };
}
