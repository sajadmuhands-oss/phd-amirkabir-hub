import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const AFFILIATION_ID = process.env.SCOPUS_AFFILIATION_ID || "60118739";
const AFFILIATION_URL =
  process.env.SCOPUS_AFFILIATION_URL ||
  "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList";

const DEFAULT_SETTINGS: Array<{ key: string; value: string; isSecret?: boolean }> = [
  { key: "scopus.affiliationId", value: AFFILIATION_ID },
  { key: "scopus.affiliationUrl", value: AFFILIATION_URL },
  { key: "scopus.apiKey", value: process.env.SCOPUS_API_KEY || "", isSecret: true },
  { key: "scopus.instToken", value: process.env.SCOPUS_INST_TOKEN || "", isSecret: true },
  { key: "whatsapp.token", value: process.env.WHATSAPP_TOKEN || "", isSecret: true },
  { key: "whatsapp.phoneNumberId", value: process.env.WHATSAPP_PHONE_NUMBER_ID || "" },
  {
    key: "whatsapp.recipients",
    value: process.env.WHATSAPP_RECIPIENTS || process.env.WHATSAPP_RECIPIENT || "",
  },
  { key: "reports.daily.enabled", value: "true" },
  { key: "reports.daily.time", value: "21:00" },
  { key: "reports.weekly.enabled", value: "true" },
  { key: "reports.weekly.day", value: "friday" },
  { key: "reports.weekly.time", value: "21:00" },
  { key: "reports.monthly.enabled", value: "true" },
  { key: "reports.monthly.day", value: "28" },
  { key: "reports.monthly.time", value: "21:00" },
  {
    key: "monitor.intervalMinutes",
    value: process.env.MONITOR_INTERVAL_MINUTES || "15",
  },
  { key: "alerts.enabled", value: "true" },
  { key: "alerts.newPubsThreshold", value: "5" },
  { key: "alerts.removedThreshold", value: "3" },
  { key: "alerts.citationDropPct", value: "20" },
  { key: "alerts.scanFailStreak", value: "3" },
  { key: "alerts.cooldownMinutes", value: "30" },
  { key: "timezone", value: "Asia/Baghdad" },
];

function resolveAdminPassword() {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim() || "";
  if (fromEnv.length >= 12) return fromEnv;

  if (process.env.ALLOW_GENERATED_ADMIN_PASSWORD === "true") {
    return randomBytes(18).toString("base64url");
  }

  throw new Error(
    "ADMIN_PASSWORD is required (min 12 characters). Set it in the environment before seeding."
  );
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@alayen.edu.iq").toLowerCase().trim();
  const name = process.env.ADMIN_NAME || "مدير النظام";
  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  // Only set/rotate password when ADMIN_PASSWORD is explicitly provided,
  // or when creating the first admin (then require env / generated).
  let password: string | null = null;
  if (process.env.ADMIN_PASSWORD?.trim()) {
    password = resolveAdminPassword();
  } else if (!existingAdmin) {
    password = resolveAdminPassword();
  }

  if (password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "admin" },
      create: { email, name, passwordHash, role: "admin" },
    });
    if (!process.env.ADMIN_PASSWORD?.trim()) {
      console.log("Generated one-time ADMIN_PASSWORD (store securely, not in git):");
      console.log(password);
    }
  } else if (existingAdmin) {
    await prisma.user.update({
      where: { email },
      data: { name, role: "admin" },
    });
  }

  const institution = await prisma.institution.upsert({
    where: { id: "auiq-main" },
    update: {
      affiliationId: AFFILIATION_ID,
      affiliationUrl: AFFILIATION_URL,
    },
    create: {
      id: "auiq-main",
      nameAr: "جامعة العين العراقية",
      nameEn: "Al-Ayen Iraqi University",
      affiliationId: AFFILIATION_ID,
      affiliationUrl: AFFILIATION_URL,
    },
  });

  const sources = [
    { code: "scopus", nameAr: "Scopus", nameEn: "Scopus", enabled: true },
    { code: "wos", nameAr: "Web of Science", nameEn: "Web of Science", enabled: false },
    { code: "scholar", nameAr: "Google Scholar", nameEn: "Google Scholar", enabled: false },
    { code: "crossref", nameAr: "Crossref", nameEn: "Crossref", enabled: false },
    { code: "orcid", nameAr: "ORCID", nameEn: "ORCID", enabled: false },
    { code: "openalex", nameAr: "OpenAlex", nameEn: "OpenAlex", enabled: false },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { code: source.code },
      update: { nameAr: source.nameAr, nameEn: source.nameEn, enabled: source.enabled },
      create: source,
    });
  }

  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: setting.key },
    });

    if (
      existing &&
      setting.isSecret &&
      existing.value &&
      !setting.value.trim()
    ) {
      continue;
    }

    let value = setting.value;
    if (setting.key === "monitor.intervalMinutes") {
      const n = Number(value);
      value = String(Number.isFinite(n) ? Math.max(15, n) : 15);
      if (existing && Number(existing.value) < 15 && !process.env.MONITOR_INTERVAL_MINUTES) {
        value = "15";
      }
    }

    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value, isSecret: setting.isSecret ?? false },
      create: {
        key: setting.key,
        value,
        isSecret: setting.isSecret ?? false,
      },
    });
  }

  console.log("Seed completed.");
  console.log(`Institution: ${institution.nameAr} (AF-ID ${AFFILIATION_ID})`);
  console.log(`Admin email: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
