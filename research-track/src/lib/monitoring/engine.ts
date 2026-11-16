import {
  ChangeType,
  ScanStatus,
  type Institution,
  type Publication,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateSuspiciousActivity } from "@/lib/monitoring/alerts";
import { getSourceAdapter } from "@/lib/sources";
import type { SourcePublication } from "@/lib/sources/types";
import {
  firstSeenFromCoverDate,
  hashContent,
  normalizeText,
} from "@/lib/utils";

export type MonitorResult = {
  scanRunId: string;
  status: ScanStatus;
  newCount: number;
  updatedCount: number;
  removedCount: number;
  totalFetched: number;
  errorMessage?: string | null;
};

function publicationHash(pub: SourcePublication) {
  return hashContent([
    pub.title,
    pub.citationCount ?? 0,
    pub.journalName,
    pub.publicationType,
    pub.coverDate,
    pub.publishedYear,
    pub.authors.map((a) => a.name).join(","),
  ]);
}

async function ensureInstitution(): Promise<Institution> {
  const existing = await prisma.institution.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.institution.create({
    data: {
      id: "auiq-main",
      nameAr: "جامعة العين العراقية",
      nameEn: "Al-Ayen Iraqi University",
      affiliationId: process.env.SCOPUS_AFFILIATION_ID || "60118739",
      affiliationUrl:
        process.env.SCOPUS_AFFILIATION_URL ||
        "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList",
    },
  });
}

async function upsertAuthor(
  institutionId: string,
  author: SourcePublication["authors"][number]
) {
  const nameNormalized = normalizeText(author.name);
  if (author.scopusAuthorId) {
    return prisma.author.upsert({
      where: {
        institutionId_scopusAuthorId: {
          institutionId,
          scopusAuthorId: author.scopusAuthorId,
        },
      },
      update: { name: author.name, nameNormalized },
      create: {
        institutionId,
        scopusAuthorId: author.scopusAuthorId,
        name: author.name,
        nameNormalized,
      },
    });
  }

  const existing = await prisma.author.findFirst({
    where: { institutionId, nameNormalized },
  });
  if (existing) {
    return prisma.author.update({
      where: { id: existing.id },
      data: { name: author.name },
    });
  }

  return prisma.author.create({
    data: {
      institutionId,
      name: author.name,
      nameNormalized,
    },
  });
}

async function findExistingPublication(
  institutionId: string,
  pub: SourcePublication
): Promise<Publication | null> {
  if (pub.eid) {
    const byEid = await prisma.publication.findUnique({
      where: {
        institutionId_eid: { institutionId, eid: pub.eid },
      },
    });
    if (byEid) return byEid;
  }

  if (pub.doi) {
    const byDoi = await prisma.publication.findUnique({
      where: {
        institutionId_doi: { institutionId, doi: pub.doi },
      },
    });
    if (byDoi) return byDoi;
  }

  return null;
}

async function syncPublicationAuthors(
  publicationId: string,
  institutionId: string,
  authors: SourcePublication["authors"]
) {
  const linkedAuthorIds: string[] = [];
  for (const author of authors) {
    const row = await upsertAuthor(institutionId, author);
    linkedAuthorIds.push(row.id);
    await prisma.publicationAuthor.upsert({
      where: {
        publicationId_authorId: {
          publicationId,
          authorId: row.id,
        },
      },
      update: { authorOrder: author.order ?? 1 },
      create: {
        publicationId,
        authorId: row.id,
        authorOrder: author.order ?? 1,
      },
    });
  }

  if (linkedAuthorIds.length > 0) {
    await prisma.publicationAuthor.deleteMany({
      where: {
        publicationId,
        authorId: { notIn: linkedAuthorIds },
      },
    });
  }
}

function cleanId(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function processPublication(
  institutionId: string,
  pub: SourcePublication,
  counters: { newCount: number; updatedCount: number },
  options?: { baseline?: boolean }
) {
  const eid = cleanId(pub.eid);
  const doi = cleanId(pub.doi);
  if (!eid && !doi) {
    return;
  }

  const normalized: SourcePublication = { ...pub, eid, doi };
  const contentHash = publicationHash(normalized);
  const existing = await findExistingPublication(institutionId, normalized);
  const now = new Date();
  const baseline = Boolean(options?.baseline);

  if (!existing) {
    // Baseline archive load must not look like "published today".
    const firstSeenAt = baseline
      ? firstSeenFromCoverDate(pub.coverDate, now)
      : now;

    const created = await prisma.publication.create({
      data: {
        institutionId,
        sourceCode: "scopus",
        eid,
        doi,
        title: pub.title,
        publicationType: pub.publicationType || null,
        journalName: pub.journalName || null,
        issn: pub.issn || null,
        volume: pub.volume || null,
        issue: pub.issue || null,
        pageRange: pub.pageRange || null,
        coverDate: pub.coverDate || null,
        publishedYear: pub.publishedYear ?? null,
        citationCount: pub.citationCount ?? 0,
        openAccess: pub.openAccess ?? false,
        scopusUrl: pub.scopusUrl || null,
        contentHash,
        firstSeenAt,
        lastSeenAt: now,
        isActive: true,
        rawPayload: pub.rawPayload as object | undefined,
      },
    });

    await syncPublicationAuthors(created.id, institutionId, pub.authors);

    // Only emit "new publication" alerts after the baseline archive exists.
    if (!baseline) {
      await prisma.changeEvent.create({
        data: {
          institutionId,
          publicationId: created.id,
          changeType: ChangeType.NEW_PUBLICATION,
          severity: "info",
          summaryAr: `بحث جديد: ${pub.title}`,
          summaryEn: `New publication: ${pub.title}`,
          payload: {
            eid: pub.eid,
            doi: pub.doi,
            citations: pub.citationCount ?? 0,
          },
        },
      });
    }

    counters.newCount += 1;
    return;
  }

  const changedFields: Record<string, unknown> = {};
  if ((existing.citationCount ?? 0) !== (pub.citationCount ?? 0)) {
    changedFields.citationCount = {
      from: existing.citationCount,
      to: pub.citationCount ?? 0,
    };
  }
  if (normalizeText(existing.title) !== normalizeText(pub.title)) {
    changedFields.title = { from: existing.title, to: pub.title };
  }
  if ((existing.journalName || "") !== (pub.journalName || "")) {
    changedFields.journalName = {
      from: existing.journalName,
      to: pub.journalName,
    };
  }

  const hashChanged = existing.contentHash !== contentHash;

  await prisma.publication.update({
    where: { id: existing.id },
    data: {
      eid: eid || existing.eid,
      doi: doi || existing.doi,
      title: pub.title,
      publicationType: pub.publicationType || existing.publicationType,
      journalName: pub.journalName || existing.journalName,
      issn: pub.issn || existing.issn,
      volume: pub.volume || existing.volume,
      issue: pub.issue || existing.issue,
      pageRange: pub.pageRange || existing.pageRange,
      coverDate: pub.coverDate || existing.coverDate,
      publishedYear: pub.publishedYear ?? existing.publishedYear,
      citationCount: pub.citationCount ?? existing.citationCount,
      openAccess: pub.openAccess ?? existing.openAccess,
      scopusUrl: pub.scopusUrl || existing.scopusUrl,
      contentHash,
      lastSeenAt: now,
      isActive: true,
      rawPayload: pub.rawPayload as object | undefined,
    },
  });

  await syncPublicationAuthors(existing.id, institutionId, pub.authors);

  if (hashChanged || Object.keys(changedFields).length > 0) {
    await prisma.changeEvent.create({
      data: {
        institutionId,
        publicationId: existing.id,
        changeType: ChangeType.UPDATED_PUBLICATION,
        severity: "info",
        summaryAr: `تحديث بحث: ${pub.title}`,
        summaryEn: `Updated publication: ${pub.title}`,
        payload: changedFields as object,
      },
    });
    counters.updatedCount += 1;
  }
}

async function markMissingAsRemoved(
  institutionId: string,
  seenIds: Set<string>
) {
  const active = await prisma.publication.findMany({
    where: { institutionId, isActive: true, sourceCode: "scopus" },
    select: { id: true, title: true, eid: true, doi: true },
  });

  let removedCount = 0;
  for (const pub of active) {
    if (seenIds.has(pub.id)) continue;
    await prisma.publication.update({
      where: { id: pub.id },
      data: { isActive: false },
    });
    await prisma.changeEvent.create({
      data: {
        institutionId,
        publicationId: pub.id,
        changeType: ChangeType.REMOVED_PUBLICATION,
        severity: "warning",
        summaryAr: `لم يعد البحث ظاهراً في نتائج Scopus: ${pub.title}`,
        summaryEn: `Publication no longer in Scopus feed: ${pub.title}`,
        payload: { eid: pub.eid, doi: pub.doi },
      },
    });
    removedCount += 1;
  }
  return removedCount;
}

async function refreshAuthorCounts(institutionId: string) {
  const authors = await prisma.author.findMany({
    where: { institutionId },
    select: { id: true },
  });
  for (const author of authors) {
    const count = await prisma.publicationAuthor.count({
      where: {
        authorId: author.id,
        publication: { isActive: true },
      },
    });
    await prisma.author.update({
      where: { id: author.id },
      data: { publicationCount: count },
    });
  }
}

function computeLocalHIndex(citationCounts: number[]) {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

async function consecutiveFailStreak(
  institutionId: string,
  sourceCode: string,
  excludeId?: string
) {
  const recent = await prisma.scanRun.findMany({
    where: {
      institutionId,
      sourceCode,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { status: true },
  });

  let streak = 0;
  for (const run of recent) {
    if (run.status === ScanStatus.FAILED) streak += 1;
    else break;
  }
  return streak;
}

export async function runMonitoringScan(options?: {
  triggeredBy?: string;
  sourceCode?: string;
  /** Force full AF-ID pull + removal reconcile (default for baseline/manual). */
  fullReconcile?: boolean;
}): Promise<MonitorResult> {
  const sourceCode = options?.sourceCode || "scopus";
  const triggeredBy = options?.triggeredBy || "scheduler";
  const institution = await ensureInstitution();
  const adapter = getSourceAdapter(sourceCode);

  const previousSnapshot = await prisma.metricSnapshot.findFirst({
    where: { institutionId: institution.id, sourceCode },
    orderBy: { capturedAt: "desc" },
  });

  const priorSuccess = await prisma.scanRun.findFirst({
    where: {
      institutionId: institution.id,
      sourceCode,
      status: ScanStatus.SUCCESS,
    },
    orderBy: { startedAt: "desc" },
  });
  const isBaseline = !priorSuccess;
  const fullReconcile =
    options?.fullReconcile === true ||
    isBaseline ||
    triggeredBy === "manual" ||
    triggeredBy === "reconcile";

  const baghdadYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
    }).format(new Date())
  );
  // Frequent scheduler jobs stay incremental to protect Elsevier quotas.
  const startYear = fullReconcile ? undefined : Math.max(2000, baghdadYear - 1);

  const scanRun = await prisma.scanRun.create({
    data: {
      institutionId: institution.id,
      sourceCode,
      status: ScanStatus.RUNNING,
      triggeredBy,
    },
  });

  const counters = { newCount: 0, updatedCount: 0 };
  const seenIds = new Set<string>();
  let totalFetched = 0;

  try {
    const publications = await adapter.fetchPublications({
      startYear,
      onPage: async () => {
        // progress hook reserved for future UI streaming
      },
    });
    totalFetched = publications.length;

    for (const pub of publications) {
      await processPublication(institution.id, pub, counters, {
        baseline: isBaseline,
      });
      const existing = await findExistingPublication(institution.id, pub);
      if (existing) seenIds.add(existing.id);
    }

    // Re-resolve ids after creates
    for (const pub of publications) {
      const existing = await findExistingPublication(institution.id, pub);
      if (existing) seenIds.add(existing.id);
    }

    // Only mark removals on full reconcile — incremental windows would false-delete.
    const removedCount = fullReconcile
      ? await markMissingAsRemoved(institution.id, seenIds)
      : 0;
    await refreshAuthorCounts(institution.id);

    const activePubs = await prisma.publication.findMany({
      where: { institutionId: institution.id, isActive: true },
      select: { citationCount: true },
    });
    const documentCount = activePubs.length;
    const citationCount = activePubs.reduce(
      (sum, p) => sum + (p.citationCount || 0),
      0
    );
    const authorCount = await prisma.author.count({
      where: { institutionId: institution.id, publicationCount: { gt: 0 } },
    });

    let apiMetrics = null as Awaited<ReturnType<typeof adapter.fetchMetrics>>;
    try {
      apiMetrics = await adapter.fetchMetrics();
    } catch {
      apiMetrics = null;
    }

    const hIndex =
      apiMetrics?.hIndex ??
      computeLocalHIndex(activePubs.map((p) => p.citationCount || 0));

    await prisma.metricSnapshot.create({
      data: {
        institutionId: institution.id,
        documentCount: apiMetrics?.documentCount || documentCount,
        citationCount: apiMetrics?.citationCount || citationCount,
        hIndex,
        authorCount: apiMetrics?.authorCount ?? authorCount,
        sourceCode,
      },
    });

    if (
      previousSnapshot &&
      (previousSnapshot.documentCount !==
        (apiMetrics?.documentCount || documentCount) ||
        previousSnapshot.citationCount !==
          (apiMetrics?.citationCount || citationCount) ||
        previousSnapshot.hIndex !== hIndex)
    ) {
      await prisma.changeEvent.create({
        data: {
          institutionId: institution.id,
          changeType: ChangeType.METRIC_CHANGE,
          severity: "info",
          summaryAr: "تغيّر في مؤشرات المؤسسة البحثية",
          summaryEn: "Institution research metrics changed",
          payload: {
            previous: previousSnapshot,
            current: {
              documentCount: apiMetrics?.documentCount || documentCount,
              citationCount: apiMetrics?.citationCount || citationCount,
              hIndex,
              authorCount: apiMetrics?.authorCount ?? authorCount,
            },
          },
        },
      });
    }

    const finished = await prisma.scanRun.update({
      where: { id: scanRun.id },
      data: {
        status: ScanStatus.SUCCESS,
        finishedAt: new Date(),
        newCount: counters.newCount,
        updatedCount: counters.updatedCount,
        removedCount,
        totalFetched,
      },
    });

    await evaluateSuspiciousActivity({
      institutionId: institution.id,
      newCount: counters.newCount,
      updatedCount: counters.updatedCount,
      removedCount,
      previousCitations: previousSnapshot?.citationCount ?? null,
      currentCitations: apiMetrics?.citationCount || citationCount,
      baselineScan: isBaseline,
    });

    await prisma.auditLog.create({
      data: {
        action: "monitor.scan.success",
        level: "info",
        details: {
          scanRunId: finished.id,
          newCount: counters.newCount,
          updatedCount: counters.updatedCount,
          removedCount,
          totalFetched,
          triggeredBy,
          fullReconcile,
          baselineScan: isBaseline,
          startYear: startYear ?? null,
        },
      },
    });

    return {
      scanRunId: finished.id,
      status: finished.status,
      newCount: finished.newCount,
      updatedCount: finished.updatedCount,
      removedCount: finished.removedCount,
      totalFetched: finished.totalFetched,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "فشل فحص Scopus غير معروف";

    const finished = await prisma.scanRun.update({
      where: { id: scanRun.id },
      data: {
        status: ScanStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
        newCount: counters.newCount,
        updatedCount: counters.updatedCount,
        totalFetched,
      },
    });

    const failStreak =
      (await consecutiveFailStreak(institution.id, sourceCode, finished.id)) + 1;

    await evaluateSuspiciousActivity({
      institutionId: institution.id,
      newCount: counters.newCount,
      updatedCount: counters.updatedCount,
      removedCount: 0,
      scanFailed: true,
      failStreak,
      baselineScan: isBaseline,
    });

    await prisma.auditLog.create({
      data: {
        action: "monitor.scan.failed",
        level: "error",
        details: {
          scanRunId: finished.id,
          error: message,
          triggeredBy,
          failStreak,
        },
      },
    });

    return {
      scanRunId: finished.id,
      status: ScanStatus.FAILED,
      newCount: counters.newCount,
      updatedCount: counters.updatedCount,
      removedCount: 0,
      totalFetched,
      errorMessage: message,
    };
  }
}
