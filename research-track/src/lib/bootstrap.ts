import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearStaleRunningScans,
  runMonitoringScan,
} from "@/lib/monitoring/engine";
import { setSetting } from "@/lib/settings";

const AFFILIATION_ID = process.env.SCOPUS_AFFILIATION_ID || "60118739";
const AFFILIATION_URL =
  process.env.SCOPUS_AFFILIATION_URL ||
  "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList";

let infraPromise: Promise<void> | null = null;
let scanPromise: Promise<void> | null = null;
let adminPromise: Promise<void> | null = null;

/** True when ADMIN_PASSWORD is present and long enough to provision the admin. */
export function isAdminPasswordConfigured() {
  return (process.env.ADMIN_PASSWORD?.trim() || "").length >= 8;
}

/**
 * Ensure hosted/local DB has institution, sources, and first admin from env.
 * Infra bootstraps once per process; admin provisioning retries while no admin exists
 * (so a late-bound ADMIN_PASSWORD can still create the account).
 */
export async function ensureBootstrapped() {
  await ensureInfraBootstrapped();
  await ensureAdminFromEnv();
}

function ensureInfraBootstrapped() {
  if (!infraPromise) {
    infraPromise = bootstrapInfra().catch((err) => {
      infraPromise = null;
      throw err;
    });
  }
  return infraPromise;
}

/**
 * First admin is provisioned only from bound env secrets (ADMIN_PASSWORD),
 * never via a public HTTP endpoint. The designated ADMIN_EMAIL account is kept
 * in sync with ADMIN_PASSWORD (owner-controlled secret only — not a public API).
 * Other users are never touched.
 */
export function ensureAdminFromEnv() {
  if (!adminPromise) {
    adminPromise = ensureFirstAdminFromEnv()
      .catch((err) => {
        adminPromise = null;
        throw err;
      })
      .then(async () => {
        const count = await prisma.user.count().catch(() => 0);
        if (count === 0) {
          // Secret may still be missing; allow a later request to retry.
          adminPromise = null;
        }
      });
  }
  return adminPromise;
}

async function ensureFirstAdminFromEnv() {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "";
  if (adminPassword.length < 8) {
    const count = await prisma.user.count();
    if (count === 0) {
      console.error(
        "ADMIN_PASSWORD (min 8 characters) is required to create the first admin; skipping user bootstrap."
      );
    }
    return;
  }

  const email = (process.env.ADMIN_EMAIL || "admin@alayen.edu.iq")
    .toLowerCase()
    .trim();
  const name = process.env.ADMIN_NAME || "مدير النظام";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    const matches = await bcrypt.compare(
      adminPassword,
      existingAdmin.passwordHash
    );
    if (!matches) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.update({
        where: { email },
        data: { passwordHash, role: "admin", name },
      });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  try {
    await prisma.$transaction(
      async (tx) => {
        const already = await tx.user.findUnique({ where: { email } });
        if (already) return;

        const adminCount = await tx.user.count({ where: { role: "admin" } });
        if (adminCount > 0) return;

        await tx.user.create({
          data: {
            email,
            name,
            role: "admin",
            passwordHash,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return;
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount > 0) return;
    throw err;
  }
}

async function bootstrapInfra() {
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
      setTimeout(() => {
        scanPromise = null;
      }, 60_000);
    });
  }
  return scanPromise;
}

async function loadScopusIfEmpty() {
  await ensureBootstrapped();
  await clearStaleRunningScans();

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
    fullReconcile: true,
  });
}
