import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { runMonitoringScan } from "@/lib/monitoring/engine";
import { enqueueMonitorScan } from "@/lib/queue";

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const asyncMode = Boolean(body?.async);

  try {
    if (asyncMode) {
      const job = await enqueueMonitorScan("manual");
      return NextResponse.json({ ok: true, mode: "queued", jobId: job.id });
    }

    const scan = await runMonitoringScan({
      sourceCode: body.sourceCode || "scopus",
      triggeredBy: "manual",
    });
    return NextResponse.json({ ok: true, mode: "inline", scan });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل تشغيل الفحص",
      },
      { status: 500 }
    );
  }
}
