import { prisma } from "@/lib/prisma";
import { parseRecipients } from "@/lib/utils";

export async function getSetting(key: string, fallback = "") {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function getSettings(keys: string[]) {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}

export async function setSetting(key: string, value: string, isSecret = false) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value, isSecret },
    create: { key, value, isSecret },
  });
}

export async function setSettings(
  entries: Array<{ key: string; value: string; isSecret?: boolean }>
) {
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.systemSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value, isSecret: entry.isSecret ?? false },
        create: {
          key: entry.key,
          value: entry.value,
          isSecret: entry.isSecret ?? false,
        },
      })
    )
  );
}

export async function getScopusConfig() {
  const settings = await getSettings([
    "scopus.apiKey",
    "scopus.instToken",
    "scopus.affiliationId",
    "scopus.affiliationUrl",
  ]);

  return {
    apiKey: settings["scopus.apiKey"] || process.env.SCOPUS_API_KEY || "",
    instToken: settings["scopus.instToken"] || process.env.SCOPUS_INST_TOKEN || "",
    affiliationId:
      settings["scopus.affiliationId"] ||
      process.env.SCOPUS_AFFILIATION_ID ||
      "60118739",
    affiliationUrl:
      settings["scopus.affiliationUrl"] ||
      process.env.SCOPUS_AFFILIATION_URL ||
      "https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList",
  };
}

export async function getWhatsAppConfig() {
  const settings = await getSettings([
    "whatsapp.token",
    "whatsapp.phoneNumberId",
    "whatsapp.recipients",
    "whatsapp.recipient",
  ]);

  const recipientsRaw =
    settings["whatsapp.recipients"] ||
    settings["whatsapp.recipient"] ||
    process.env.WHATSAPP_RECIPIENTS ||
    process.env.WHATSAPP_RECIPIENT ||
    "";

  return {
    token: settings["whatsapp.token"] || process.env.WHATSAPP_TOKEN || "",
    phoneNumberId:
      settings["whatsapp.phoneNumberId"] || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    recipients: parseRecipients(recipientsRaw),
    recipientsRaw,
  };
}

export async function getReportScheduleConfig() {
  const settings = await getSettings([
    "reports.daily.enabled",
    "reports.daily.time",
    "reports.weekly.enabled",
    "reports.weekly.day",
    "reports.weekly.time",
    "reports.monthly.enabled",
    "reports.monthly.day",
    "reports.monthly.time",
    "monitor.intervalMinutes",
    "timezone",
  ]);

  return {
    timezone: settings["timezone"] || "Asia/Baghdad",
    monitorIntervalMinutes: Math.max(
      1,
      Number(
        settings["monitor.intervalMinutes"] ||
          process.env.MONITOR_INTERVAL_MINUTES ||
          1
      )
    ),
    daily: {
      enabled: settings["reports.daily.enabled"] !== "false",
      time: settings["reports.daily.time"] || "21:00",
    },
    weekly: {
      enabled: settings["reports.weekly.enabled"] !== "false",
      day: settings["reports.weekly.day"] || "friday",
      time: settings["reports.weekly.time"] || "21:00",
    },
    monthly: {
      enabled: settings["reports.monthly.enabled"] !== "false",
      day: Number(settings["reports.monthly.day"] || 28),
      time: settings["reports.monthly.time"] || "21:00",
    },
  };
}

export async function getAlertConfig() {
  const settings = await getSettings([
    "alerts.enabled",
    "alerts.newPubsThreshold",
    "alerts.removedThreshold",
    "alerts.citationDropPct",
    "alerts.scanFailStreak",
    "alerts.cooldownMinutes",
  ]);

  return {
    enabled: settings["alerts.enabled"] !== "false",
    newPubsThreshold: Number(settings["alerts.newPubsThreshold"] || 5),
    removedThreshold: Number(settings["alerts.removedThreshold"] || 3),
    citationDropPct: Number(settings["alerts.citationDropPct"] || 20),
    scanFailStreak: Number(settings["alerts.scanFailStreak"] || 3),
    cooldownMinutes: Number(settings["alerts.cooldownMinutes"] || 30),
  };
}
