import { NextResponse } from "next/server";
import { hasAuthSecret } from "@/lib/auth-secret";
import {
  ensureBootstrapped,
  isAdminPasswordConfigured,
} from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

/** Public readiness flags only — no secret values or raw exception text. */
export async function GET() {
  let bootError: string | null = null;
  try {
    await ensureBootstrapped();
  } catch {
    bootError = "bootstrap-failed";
  }

  let hasAdmin = false;
  try {
    hasAdmin = (await prisma.user.count({ where: { role: "admin" } })) > 0;
  } catch {
    bootError = bootError || "database-unavailable";
  }

  return NextResponse.json({
    ok: true,
    authConfigured: hasAuthSecret(),
    hasAdmin,
    adminPasswordConfigured: isAdminPasswordConfigured(),
    hasScopusKey: Boolean(process.env.SCOPUS_API_KEY?.trim()),
    bootError,
  });
}
