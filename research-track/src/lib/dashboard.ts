import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";

const TIMEZONE = "Asia/Baghdad";

export async function getDashboardData() {
  const now = toZonedTime(new Date(), TIMEZONE);
  const institution = await prisma.institution.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!institution) return null;

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
  ] = await Promise.all([
    prisma.publication.count({
      where: { institutionId: institution.id, isActive: true },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        isActive: true,
        publishedYear: now.getFullYear(),
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: {
          gte: startOfWeek(now, { weekStartsOn: 6 }),
          lte: endOfWeek(now, { weekStartsOn: 6 }),
        },
      },
    }),
    prisma.publication.count({
      where: {
        institutionId: institution.id,
        firstSeenAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
    }),
    prisma.author.count({ where: { institutionId: institution.id } }),
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
      where: { institutionId: institution.id },
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
        firstSeenAt: { gte: startOfYear(now) },
      },
      orderBy: { firstSeenAt: "desc" },
      take: 8,
      include: {
        authors: { include: { author: true }, orderBy: { authorOrder: "asc" } },
      },
    }),
  ]);

  const citationSum = await prisma.publication.aggregate({
    where: { institutionId: institution.id, isActive: true },
    _sum: { citationCount: true },
  });

  return {
    institution,
    kpis: {
      totalPublications,
      yearPublications,
      todayPublications,
      weekPublications,
      monthPublications,
      authorCount,
      citationCount: latestMetrics?.citationCount ?? citationSum._sum.citationCount ?? 0,
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
