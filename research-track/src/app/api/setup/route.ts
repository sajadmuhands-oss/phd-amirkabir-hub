import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { consumeRateLimit } from "@/lib/rate-limit";

/** Create the first admin only when the users table is empty. */
export async function GET() {
  try {
    await ensureBootstrapped();
    const count = await prisma.user.count();
    return NextResponse.json({ needsSetup: count === 0 });
  } catch (err) {
    return NextResponse.json(
      {
        needsSetup: false,
        error: err instanceof Error ? err.message : "setup-status-failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const limited = consumeRateLimit("setup:create-admin", 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "تم تجاوز حد المحاولات. حاول لاحقاً." },
      { status: 429 }
    );
  }

  try {
    await ensureBootstrapped();
    const count = await prisma.user.count();
    if (count > 0) {
      return NextResponse.json(
        { error: "تم إعداد المدير مسبقاً. استخدم صفحة الدخول." },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "")
      .toLowerCase()
      .trim();
    const password = String(body.password || "");
    const name = String(body.name || "مدير النظام").trim() || "مدير النظام";

    if (!email.includes("@") || password.length < 12) {
      return NextResponse.json(
        {
          error:
            "البريد غير صالح أو كلمة المرور أقصر من 12 حرفاً.",
        },
        { status: 400 }
      );
    }

    await prisma.user.create({
      data: {
        email,
        name,
        role: "admin",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "فشل إنشاء المدير",
      },
      { status: 500 }
    );
  }
}
