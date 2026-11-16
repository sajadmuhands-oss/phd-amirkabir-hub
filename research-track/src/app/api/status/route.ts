import { NextResponse } from "next/server";
import { hasAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";

/**
 * Public readiness flags only.
 * Does not run bootstrap, expose secret presence details, or return raw errors.
 */
export async function GET() {
  let bootError: string | null = null;
  let hasAdmin = false;

  try {
    hasAdmin = (await prisma.user.count({ where: { role: "admin" } })) > 0;
  } catch {
    bootError = "database-unavailable";
  }

  return NextResponse.json({
    ok: true,
    authConfigured: hasAuthSecret(),
    hasAdmin,
    bootError,
  });
}
