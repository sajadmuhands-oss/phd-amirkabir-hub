/**
 * One-shot academic data repair:
 * - Backdate firstSeenAt from coverDate (baseline archive must not inflate "today")
 * - Remove NEW_PUBLICATION events created during the initial archive load
 * - Clean author display names from Scopus authname artifacts
 */
import { ChangeType, PrismaClient } from "@prisma/client";
import {
  cleanAuthorDisplayName,
  firstSeenFromCoverDate,
} from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const pubs = await prisma.publication.findMany({
    select: {
      id: true,
      coverDate: true,
      firstSeenAt: true,
      createdAt: true,
      rawPayload: true,
    },
  });

  let firstSeenFixed = 0;
  for (const pub of pubs) {
    const academicDate = firstSeenFromCoverDate(pub.coverDate, pub.firstSeenAt);
    // Only move firstSeenAt earlier (never invent a future "discovery")
    if (academicDate.getTime() < pub.firstSeenAt.getTime() - 60_000) {
      await prisma.publication.update({
        where: { id: pub.id },
        data: { firstSeenAt: academicDate },
      });
      firstSeenFixed += 1;
    }
  }

  // Drop "new publication" spam from the first successful scan day(s).
  const firstSuccess = await prisma.scanRun.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { startedAt: "asc" },
  });

  let removedBaselineEvents = 0;
  if (firstSuccess) {
    const windowEnd = new Date(
      firstSuccess.finishedAt?.getTime() || firstSuccess.startedAt.getTime()
    );
    windowEnd.setHours(windowEnd.getHours() + 6);

    const deleted = await prisma.changeEvent.deleteMany({
      where: {
        changeType: ChangeType.NEW_PUBLICATION,
        discoveredAt: {
          gte: firstSuccess.startedAt,
          lte: windowEnd,
        },
      },
    });
    removedBaselineEvents = deleted.count;
  }

  const authors = await prisma.author.findMany();
  let authorsFixed = 0;
  for (const author of authors) {
    const cleaned = cleanAuthorDisplayName(author.name);
    if (cleaned && cleaned !== author.name) {
      await prisma.author.update({
        where: { id: author.id },
        data: {
          name: cleaned,
          nameNormalized: cleaned.toLowerCase(),
        },
      });
      authorsFixed += 1;
    }
  }

  // Re-derive names from rawPayload when present (richer Scopus fields).
  let authorsFromPayload = 0;
  const withPayload = await prisma.publication.findMany({
    where: { rawPayload: { not: null as unknown as undefined } },
    select: {
      id: true,
      rawPayload: true,
      authors: { include: { author: true }, orderBy: { authorOrder: "asc" } },
    },
    take: 5000,
  });

  for (const pub of withPayload) {
    const entry = pub.rawPayload as Record<string, unknown> | null;
    const list = entry?.author as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(list) || list.length === 0) continue;

    for (let i = 0; i < Math.min(list.length, pub.authors.length); i++) {
      const a = list[i];
      const given = String(a["given-name"] || a.givenName || "").trim();
      const surname = String(a.surname || "").trim();
      const authname = String(a.authname || "").trim();
      let raw = "";
      if (surname && given) raw = `${surname}, ${given}`;
      else if (authname) raw = authname;
      else if (surname) raw = surname;
      const cleaned = cleanAuthorDisplayName(raw);
      const link = pub.authors[i];
      if (cleaned && link && cleaned !== link.author.name) {
        await prisma.author.update({
          where: { id: link.authorId },
          data: {
            name: cleaned,
            nameNormalized: cleaned.toLowerCase(),
            scopusAuthorId:
              String(a.authid || link.author.scopusAuthorId || "") ||
              link.author.scopusAuthorId,
          },
        });
        authorsFromPayload += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        firstSeenFixed,
        removedBaselineEvents,
        authorsFixed,
        authorsFromPayload,
        publications: pubs.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
