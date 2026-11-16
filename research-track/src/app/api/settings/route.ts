import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { maskSecret } from "@/lib/utils";
import { setSettings } from "@/lib/settings";
import { setupRepeatableJobs } from "@/workers/scheduler";

const SECRET_KEYS = new Set([
  "scopus.apiKey",
  "scopus.instToken",
  "whatsapp.token",
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

  const updates = body.settings as Record<string, string> | undefined;
  if (!updates) {
    return NextResponse.json({ error: "settings مطلوبة" }, { status: 400 });
  }

  const entries: Array<{ key: string; value: string; isSecret?: boolean }> = [];

  for (const [key, rawValue] of Object.entries(updates)) {
    if (typeof rawValue !== "string") continue;
    if (SECRET_KEYS.has(key) && (/^•/.test(rawValue) || rawValue.includes("•"))) {
      continue;
    }
    let value = rawValue.trim();
    if (key === "monitor.intervalMinutes") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 15) {
        return NextResponse.json(
          { error: "فاصل الفحص يجب أن يكون 15 دقيقة على الأقل" },
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
