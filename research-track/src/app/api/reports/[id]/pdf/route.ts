import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report?.pdfPath) {
    return NextResponse.json(
      { error: "لا يوجد ملف PDF لهذا التقرير" },
      { status: 404 }
    );
  }

  const absolute = path.isAbsolute(report.pdfPath)
    ? report.pdfPath
    : path.join(process.cwd(), report.pdfPath);

  const storageRoot = path.join(process.cwd(), "storage", "reports");
  const normalized = path.normalize(absolute);
  if (!normalized.startsWith(storageRoot)) {
    return NextResponse.json({ error: "مسار PDF غير صالح" }, { status: 400 });
  }

  try {
    const buffer = await readFile(normalized);
    const fileName = path.basename(normalized);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "ملف PDF غير موجود" }, { status: 404 });
  }
}
