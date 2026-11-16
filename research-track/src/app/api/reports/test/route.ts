import { NextResponse } from "next/server";
import {
  enforceAdminActionLimit,
  requireAdminSession,
} from "@/lib/api-auth";
import { generateTestReport } from "@/lib/reports/builder";

export async function POST() {
  const { session, error } = await requireAdminSession();
  if (error || !session) return error;

  const limited = enforceAdminActionLimit(
    "reports-test",
    session.user.id,
    3,
    10 * 60 * 1000
  );
  if (limited) return limited;

  try {
    const result = await generateTestReport();
    return NextResponse.json({
      ok: true,
      report: result.report,
      message: result.report.titleAr,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل إنشاء التقرير التجريبي",
      },
      { status: 500 }
    );
  }
}
