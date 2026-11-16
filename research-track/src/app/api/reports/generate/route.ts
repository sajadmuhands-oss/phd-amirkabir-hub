import { ReportType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { generateReport, generateTestReport } from "@/lib/reports/builder";
import { enqueueReport } from "@/lib/queue";

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type || "TEST").toUpperCase();
  const asyncMode = Boolean(body?.async);
  const force = body?.force !== false;

  try {
    if (asyncMode) {
      const job = await enqueueReport(
        type as "DAILY" | "WEEKLY" | "MONTHLY" | "TEST",
        force
      );
      return NextResponse.json({ ok: true, mode: "queued", jobId: job.id });
    }

    if (type === "TEST") {
      const result = await generateTestReport();
      return NextResponse.json({
        ok: true,
        reportId: result.report.id,
        sent: result.sent,
      });
    }

    const reportType =
      type === "WEEKLY"
        ? ReportType.WEEKLY
        : type === "MONTHLY"
          ? ReportType.MONTHLY
          : ReportType.DAILY;

    const result = await generateReport({
      reportType,
      sendWhatsApp: true,
      force,
    });

    return NextResponse.json({
      ok: true,
      reportId: result.report.id,
      sent: result.sent,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل توليد التقرير",
      },
      { status: 500 }
    );
  }
}
