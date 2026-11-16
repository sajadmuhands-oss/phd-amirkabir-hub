import { ChangeType, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAlertConfig } from "@/lib/settings";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

export type ScanAlertInput = {
  institutionId: string;
  newCount: number;
  updatedCount: number;
  removedCount: number;
  scanFailed?: boolean;
  failStreak?: number;
  previousCitations?: number | null;
  currentCitations?: number | null;
  details?: string[];
};

function windowKey(kind: string) {
  const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
  return `emergency:${kind}:${bucket}`;
}

export async function evaluateSuspiciousActivity(input: ScanAlertInput) {
  const config = await getAlertConfig();
  if (!config.enabled) return null;

  const reasons: string[] = [];

  if (input.newCount >= config.newPubsThreshold) {
    reasons.push(
      `ارتفاع مفاجئ في البحوث الجديدة خلال الفحص: ${input.newCount} (الحد ${config.newPubsThreshold})`
    );
  }

  if (input.removedCount >= config.removedThreshold) {
    reasons.push(
      `إزالة عدد كبير من البحوث من ملف الجامعة: ${input.removedCount} (الحد ${config.removedThreshold})`
    );
  }

  if (
    input.previousCitations != null &&
    input.currentCitations != null &&
    input.previousCitations > 0
  ) {
    const dropPct =
      ((input.previousCitations - input.currentCitations) / input.previousCitations) *
      100;
    if (dropPct >= config.citationDropPct) {
      reasons.push(
        `انخفاض حاد في الاستشهادات بنسبة ${dropPct.toFixed(1)}% (من ${input.previousCitations} إلى ${input.currentCitations})`
      );
    }
  }

  if (input.scanFailed && (input.failStreak || 0) >= config.scanFailStreak) {
    reasons.push(
      `فشل متكرر في فحص Scopus (${input.failStreak} مرات متتالية)`
    );
  }

  if (input.details?.length) reasons.push(...input.details);
  if (reasons.length === 0) return null;

  const kind =
    input.scanFailed
      ? "scan-fail"
      : input.removedCount >= config.removedThreshold
        ? "mass-removal"
        : input.newCount >= config.newPubsThreshold
          ? "new-spike"
          : "metric-anomaly";

  const periodKey = windowKey(kind);
  const existing = await prisma.report.findUnique({
    where: {
      institutionId_reportType_periodKey: {
        institutionId: input.institutionId,
        reportType: ReportType.EMERGENCY,
        periodKey,
      },
    },
  });
  if (existing) return existing;

  const titleAr = "تنبيه اضطراري — نشاط مريب في المسار البحثي";
  const contentText = [
    "جامعة العين العراقية",
    "نظام متابعة المسار البحثي",
    "⚠️ تنبيه اضطراري",
    "",
    "تم رصد نشاط مريب أثناء المراقبة الدقيقة لملف Scopus:",
    ...reasons.map((r) => `- ${r}`),
    "",
    `Affiliation ID: 60118739`,
    `الوقت: ${new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" })}`,
    "",
    "يرجى التحقق فوراً من لوحة التحكم وسجل التغييرات.",
  ].join("\n");

  const change = await prisma.changeEvent.create({
    data: {
      institutionId: input.institutionId,
      changeType: ChangeType.SUSPICIOUS_ACTIVITY,
      severity: "critical",
      summaryAr: titleAr,
      summaryEn: "Emergency suspicious research-track activity",
      payload: {
        reasons,
        newCount: input.newCount,
        removedCount: input.removedCount,
        updatedCount: input.updatedCount,
      },
    },
  });

  const report = await prisma.report.create({
    data: {
      institutionId: input.institutionId,
      reportType: ReportType.EMERGENCY,
      periodKey,
      titleAr,
      titleEn: "Emergency suspicious activity alert",
      contentText,
      contentJson: { reasons, changeId: change.id },
    },
  });

  const message = await sendWhatsAppText({
    body: contentText.slice(0, 4000),
    reportId: report.id,
    idempotencyKey: `emergency:${report.id}`,
  });

  if (message?.status === "SENT") {
    await prisma.report.update({
      where: { id: report.id },
      data: { sentAt: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "alert.emergency",
      level: "error",
      details: { reportId: report.id, reasons },
    },
  });

  return report;
}
