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
    // Default 15 minutes to stay within Elsevier API quotas; override via env/UI.
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

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@alayen.edu.iq";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || "مدير النظام";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash, role: "admin" },
  });

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

    // Never wipe UI-saved secrets when env/seed values are empty.
    if (
      existing &&
      setting.isSecret &&
      existing.value &&
      !setting.value.trim()
    ) {
      continue;
    }

    // Migrate legacy 1-minute default to the safer 15-minute default.
    if (
      existing &&
      setting.key === "monitor.intervalMinutes" &&
      existing.value === "1" &&
      !process.env.MONITOR_INTERVAL_MINUTES
    ) {
      await prisma.systemSetting.update({
        where: { key: setting.key },
        data: { value: "15", isSecret: false },
      });
      continue;
    }

    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, isSecret: setting.isSecret ?? false },
      create: {
        key: setting.key,
        value: setting.value,
        isSecret: setting.isSecret ?? false,
      },
    });
  }

  console.log("Seed completed.");
  console.log(`Institution: ${institution.nameAr} (AF-ID ${AFFILIATION_ID})`);
  console.log(`Admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
