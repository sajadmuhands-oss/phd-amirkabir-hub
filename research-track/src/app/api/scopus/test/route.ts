import { NextResponse } from "next/server";
import {
  enforceAdminActionLimit,
  requireAdminSession,
} from "@/lib/api-auth";
import { scopusClient } from "@/lib/scopus/client";

export async function POST() {
  const { session, error } = await requireAdminSession();
  if (error || !session) return error;

  const limited = enforceAdminActionLimit(
    "scopus-test",
    session.user.id,
    5,
    5 * 60 * 1000
  );
  if (limited) return limited;

  const result = await scopusClient.testConnection();
  return NextResponse.json(result);
}
