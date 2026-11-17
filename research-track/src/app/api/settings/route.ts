import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { maskSecret } from "@/lib/utils";
import {
  DEFAULT_MONITOR_INTERVAL_MINUTES,
  MIN_MONITOR_INTERVAL_MINUTES,
  setSettings,
} from "@/lib/settings";
import {
  normalizeRecipientsInput,
  serializeRecipientRecords,
} from "@/lib/whatsapp/recipients";
import { setupRepeatableJobs } from "@/workers/scheduler";

const SECRET_KEYS = new Set([
  "scopus.apiKey",
  "scopus.instToken",
  "whatsapp.token",
]);

const ALLOWED_SETTING_KEYS = new Set([
  "scopus.apiKey",
  "scopus.instToken",
  "scopus.affiliationId",
  "scopus.affiliationUrl",
  "whatsapp.token",
  "whatsapp.phoneNumberId",
  "whatsapp.recipients",
  "monitor.intervalMinutes",
  "timezone",
  "reports.daily.enabled",
  "reports.daily.time",
  "reports.weekly.enabled",
  "reports.weekly.day",
  "reports.weekly.time",
  "reports.monthly.enabled",
  "reports.monthly.day",
  "reports.monthly.time",
  "alerts.enabled",
  "alerts.newPubsThreshold",
  "alerts.removedThreshold",
  "alerts.citationDropPct",
  "alerts.scanFailStreak",
  "alerts.cooldownMinutes",
]);

export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;

  const [settings, sources, institution] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.source.findMany({ orderBy: { code: "asc" } }),
    prisma.institution.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    institution,
    sources,
    settings: settings.map((s) => ({
      key: s.key,
      value: s.isSecret ? maskSecret(s.value) : s.value,
      hasValue: Boolean(s.value),
      isSecret: s.isSecret,
    })),
  });
}

export async function PUT(request: Request) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const updates = (body.settings || {}) as Record<string, string>;
  const entries: Array<{ key: string; value: string; isSecret?: boolean }> = [];

  for (const [key, rawValue] of Object.entries(updates)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) continue;
    if (key === "whatsapp.recipients") continue; // handled via recipients array
    if (typeof rawValue !== "string") continue;
    if (SECRET_KEYS.has(key) && (/^•/.test(rawValue) || rawValue.includes("•"))) {
      continue;
    }
    let value = rawValue.trim();
    if (key === "monitor.intervalMinutes") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < MIN_MONITOR_INTERVAL_MINUTES) {
        return NextResponse.json(
          {
            error: `فاصل الفحص يجب أن يكون ${MIN_MONITOR_INTERVAL_MINUTES} دقائق على الأقل (الافتراضي ${DEFAULT_MONITOR_INTERVAL_MINUTES})`,
          },
          { status: 400 }
        );
      }
      value = String(Math.floor(n));
    }
    entries.push({
      key,
      value,
      isSecret: SECRET_KEYS.has(key),
    });
  }

  if (body.recipients !== undefined) {
    const recipients = normalizeRecipientsInput(body.recipients);
    entries.push({
      key: "whatsapp.recipients",
      value: serializeRecipientRecords(recipients),
      isSecret: false,
    });
  } else if (typeof updates["whatsapp.recipients"] === "string") {
    const recipients = normalizeRecipientsInput(updates["whatsapp.recipients"]);
    entries.push({
      key: "whatsapp.recipients",
      value: serializeRecipientRecords(recipients),
      isSecret: false,
    });
  }

  if (entries.length > 0) {
    await setSettings(entries);
  }

  const affiliationId = updates["scopus.affiliationId"];
  const affiliationUrl = updates["scopus.affiliationUrl"];
  if (affiliationId || affiliationUrl) {
    const institution = await prisma.institution.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (institution) {
      await prisma.institution.update({
        where: { id: institution.id },
        data: {
          ...(affiliationId ? { affiliationId: affiliationId.trim() } : {}),
          ...(affiliationUrl ? { affiliationUrl: affiliationUrl.trim() } : {}),
        },
      });
    }
  }

  if (Array.isArray(body.sources)) {
    for (const source of body.sources as Array<{ code: string; enabled: boolean }>) {
      await prisma.source.updateMany({
        where: { code: source.code },
        data: { enabled: Boolean(source.enabled) },
      });
    }
  }

  let schedule = null;
  try {
    schedule = await setupRepeatableJobs();
  } catch (err) {
    schedule = {
      error:
        err instanceof Error
          ? err.message
          : "تعذر تحديث الجدولة (تحقق من Redis)",
    };
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: "settings.update",
      details: { keys: entries.map((e) => e.key) },
    },
  });

  return NextResponse.json({ ok: true, schedule });
}
