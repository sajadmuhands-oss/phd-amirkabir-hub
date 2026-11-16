import { NextResponse } from "next/server";
import { hasAuthSecret } from "@/lib/auth-secret";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

/** Public readiness flags only — no secret values. */
export async function GET() {
  let bootError: string | null = null;
  try {
    await ensureBootstrapped();
  } catch (err) {
    bootError = err instanceof Error ? err.message : "bootstrap-failed";
  }

  let hasAdmin = false;
  try {
    hasAdmin = (await prisma.user.count()) > 0;
  } catch {
    bootError = bootError || "database-unavailable";
  }

  return NextResponse.json({
    ok: true,
    authConfigured: hasAuthSecret(),
    hasAdmin,
    hasScopusKey: Boolean(process.env.SCOPUS_API_KEY?.trim()),
    bootError,
  });
}
