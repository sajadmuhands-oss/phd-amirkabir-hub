import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { runMonitoringScan } from "@/lib/monitoring/engine";
import { setSetting } from "@/lib/settings";

const AFFILIATION_ID = process.env.SCOPUS_AFFILIATION_ID || "60118739";
const AFFILIATION_URL =
  process.env.SCOPUS_AFFILIATION_URL ||
  "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList";

let bootPromise: Promise<void> | null = null;
let scanPromise: Promise<void> | null = null;

/**
 * Ensure hosted/local DB has institution, sources, admin, and Scopus settings
 * synced from environment. Safe to call on every request (runs once).
 */
export function ensureBootstrapped() {
  if (!bootPromise) {
    bootPromise = bootstrap().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

async function bootstrap() {
  const email = (process.env.ADMIN_EMAIL || "admin@alayen.edu.iq")
    .toLowerCase()
    .trim();
  const name = process.env.ADMIN_NAME || "مدير النظام";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    const password =
      adminPassword.length >= 12
        ? adminPassword
        : randomBytes(18).toString("base64url");
    await prisma.user.create({
      data: {
        email,
        name,
        role: "admin",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
  } else if (adminPassword.length >= 12) {
    await prisma.user.update({
      where: { email },
      data: {
        name,
        role: "admin",
        passwordHash: await bcrypt.hash(adminPassword, 12),
      },
    });
  }

  await prisma.institution.upsert({
    where: { id: "auiq-main" },
    update: {
      affiliationId: AFFILIATION_ID,
      affiliationUrl: AFFILIATION_URL,
      nameAr: "جامعة العين العراقية",
      nameEn: "Al-Ayen Iraqi University",
    },
    create: {
      id: "auiq-main",
      nameAr: "جامعة العين العراقية",
      nameEn: "Al-Ayen Iraqi University",
      affiliationId: AFFILIATION_ID,
      affiliationUrl: AFFILIATION_URL,
    },
  });

  await prisma.source.upsert({
    where: { code: "scopus" },
    update: { enabled: true, nameAr: "Scopus", nameEn: "Scopus" },
    create: {
      code: "scopus",
      nameAr: "Scopus",
      nameEn: "Scopus",
      enabled: true,
    },
  });

  const apiKey = process.env.SCOPUS_API_KEY?.trim() || "";
  if (apiKey) {
    await setSetting("scopus.apiKey", apiKey, true);
  }
  const instToken = process.env.SCOPUS_INST_TOKEN?.trim() || "";
  if (instToken) {
    await setSetting("scopus.instToken", instToken, true);
  }
  await setSetting("scopus.affiliationId", AFFILIATION_ID);
  await setSetting("scopus.affiliationUrl", AFFILIATION_URL);
  await setSetting("timezone", "Asia/Baghdad");
  await setSetting(
    "monitor.intervalMinutes",
    process.env.MONITOR_INTERVAL_MINUTES || "5"
  );
}

/**
 * Pull real Scopus data when the DB has none yet (hosted first boot).
 * Non-blocking; overlaps are coalesced.
 */
export function ensureScopusDataLoaded() {
  if (!scanPromise) {
    scanPromise = loadScopusIfEmpty().finally(() => {
      // Allow a later retry if the first attempt failed or key arrived later.
      setTimeout(() => {
        scanPromise = null;
      }, 60_000);
    });
  }
  return scanPromise;
}

async function loadScopusIfEmpty() {
  await ensureBootstrapped();
  const apiKey =
    process.env.SCOPUS_API_KEY?.trim() ||
    (
      await prisma.systemSetting.findUnique({ where: { key: "scopus.apiKey" } })
    )?.value?.trim() ||
    "";
  if (!apiKey) return;

  const count = await prisma.publication.count();
  if (count > 0) return;

  await runMonitoringScan({
    sourceCode: "scopus",
    triggeredBy: "bootstrap",
  });
}
