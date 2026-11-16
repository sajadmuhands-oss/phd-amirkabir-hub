import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";

/** Always requires a real NextAuth admin session — never a synthetic user. */
export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user || role !== "admin") {
    return {
      session: null,
      error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }),
    };
  }

  return { session, error: null };
}

/** Rate-limit expensive admin mutations after auth succeeds. */
export function enforceAdminActionLimit(
  action: string,
  userId: string,
  limit = 3,
  windowMs = 5 * 60 * 1000
) {
  const result = consumeRateLimit(`admin:${action}:${userId}`, limit, windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    {
      error: "تم تجاوز حد الطلبات. حاول لاحقاً.",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    }
  );
}
