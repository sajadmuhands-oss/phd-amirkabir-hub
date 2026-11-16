import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { generateTestReport } from "@/lib/reports/builder";

export async function POST() {
  const { error } = await requireAdminSession();
  if (error) return error;

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
