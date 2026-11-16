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
 * Ensure hosted/local DB has institution, sources, and (out-of-band) first admin.
 * Safe to call on every request (runs once per process).
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

/** True when ADMIN_PASSWORD is set and long enough to provision/sync admin. */
export function hasAdminPasswordEnv(): boolean {
  return (process.env.ADMIN_PASSWORD?.trim() || "").length >= 8;
}

/**
 * First admin is provisioned from ADMIN_PASSWORD / ADMIN_EMAIL (.env or hosted
 * secrets), never via a public HTTP endpoint. The designated ADMIN_EMAIL account
 * is upserted and kept in sync with ADMIN_PASSWORD. Other users are never touched.
 */
export async function ensureFirstAdminFromEnv() {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "";
  if (adminPassword.length < 8) {
    const count = await prisma.user.count();
    if (count === 0) {
      console.error(
        "ADMIN_PASSWORD (min 8 characters) is required to create the first admin; set it in .env or Cursor secrets."
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
    } else if (existingAdmin.role !== "admin" || existingAdmin.name !== name) {
      await prisma.user.update({
        where: { email },
        data: { role: "admin", name },
      });
    }
    return;
  }

  // Create the designated admin even if other users already exist.
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  try {
    await prisma.user.create({
      data: {
        email,
        name,
        role: "admin",
        passwordHash,
      },
    });
  } catch (err) {
    // Concurrent bootstrap or unique conflict — admin may already exist.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const matches = await bcrypt.compare(adminPassword, existing.passwordHash);
      if (!matches) {
        await prisma.user.update({
          where: { email },
          data: {
            passwordHash: await bcrypt.hash(adminPassword, 12),
            role: "admin",
            name,
          },
        });
      }
      return;
    }
    throw err;
  }
}

function logAdminEnvPresence() {
  const emailSet = Boolean(process.env.ADMIN_EMAIL?.trim());
  const passwordLen = (process.env.ADMIN_PASSWORD?.trim() || "").length;
  console.info(
    `[bootstrap] ADMIN_EMAIL set=${emailSet}; ADMIN_PASSWORD set=${passwordLen >= 8} (len=${passwordLen >= 8 ? ">=8" : passwordLen})`
  );
}

async function bootstrap() {
  logAdminEnvPresence();
  await ensureFirstAdminFromEnv();

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
