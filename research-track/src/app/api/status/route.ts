import { NextResponse } from "next/server";
import { hasAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MONITOR_INTERVAL_MINUTES,
  getReportScheduleConfig,
  getScopusConfig,
  getWhatsAppConfig,
} from "@/lib/settings";

/**
 * Public readiness flags for operators.
 * Never returns secret values — only configured / missing booleans.
 */
export async function GET() {
  let bootError: string | null = null;
  let hasAdmin = false;
  let publicationCount = 0;
  let lastScan: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    newCount: number;
    updatedCount: number;
    removedCount: number;
    totalFetched: number;
    errorMessage: string | null;
    triggeredBy: string;
  } | null = null;

  try {
    hasAdmin = (await prisma.user.count({ where: { role: "admin" } })) > 0;
    publicationCount = await prisma.publication.count({
      where: { isActive: true },
    });
    const scan = await prisma.scanRun.findFirst({
      orderBy: { startedAt: "desc" },
    });
    if (scan) {
      lastScan = {
        status: scan.status,
        startedAt: scan.startedAt.toISOString(),
        finishedAt: scan.finishedAt?.toISOString() ?? null,
        newCount: scan.newCount,
        updatedCount: scan.updatedCount,
        removedCount: scan.removedCount,
        totalFetched: scan.totalFetched,
        errorMessage: scan.errorMessage,
        triggeredBy: scan.triggeredBy,
      };
    }
  } catch {
    bootError = "database-unavailable";
  }

  let scopusConfigured = false;
  let affiliationId = "60118739";
  let whatsappConfigured = false;
  let recipientCount = 0;
  let enabledRecipientCount = 0;
  let monitorIntervalMinutes = DEFAULT_MONITOR_INTERVAL_MINUTES;

  if (!bootError) {
    try {
      const [scopus, wa, schedule] = await Promise.all([
        getScopusConfig(),
        getWhatsAppConfig(),
        getReportScheduleConfig(),
      ]);
      scopusConfigured = Boolean(scopus.apiKey);
      affiliationId = scopus.affiliationId || "60118739";
      whatsappConfigured = Boolean(wa.token && wa.phoneNumberId);
      recipientCount = wa.recipientRecords.length;
      enabledRecipientCount = wa.recipientRecords.filter((r) => r.enabled)
        .length;
      monitorIntervalMinutes = schedule.monitorIntervalMinutes;
    } catch {
      // settings helpers may fail if DB mid-migrate — keep flags false
    }
  }

  const readyForSync = Boolean(!bootError && scopusConfigured);
  const guidance = !scopusConfigured
    ? "ضع SCOPUS_API_KEY في بيئة التشغيل أو من الإعدادات ← Scopus، ثم نفّذ فحصاً يدوياً."
    : publicationCount === 0
      ? "المفتاح موجود لكن لا منشورات بعد — شغّل فحصاً يدوياً من الإعدادات أو انتظر المجدول."
      : "النظام جاهز للمزامنة.";

  return NextResponse.json({
    ok: true,
    authConfigured: hasAuthSecret(),
    hasAdmin,
    bootError,
    scopus: {
      configured: scopusConfigured,
      affiliationId,
    },
    whatsapp: {
      configured: whatsappConfigured,
      recipientCount,
      enabledRecipientCount,
    },
    monitor: {
      intervalMinutes: monitorIntervalMinutes,
      defaultIntervalMinutes: DEFAULT_MONITOR_INTERVAL_MINUTES,
    },
    publications: { activeCount: publicationCount },
    lastScan,
    readyForSync,
    guidance,
  });
}
