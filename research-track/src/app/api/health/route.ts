import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "research-track",
      timezone: process.env.TZ || "Asia/Baghdad",
      affiliationId: process.env.SCOPUS_AFFILIATION_ID || "60118739",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "database unavailable",
      },
      { status: 503 }
    );
  }
}
