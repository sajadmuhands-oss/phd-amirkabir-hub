import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { scopusClient } from "@/lib/scopus/client";

export async function POST() {
  const { error } = await requireAdminSession();
  if (error) return error;

  const result = await scopusClient.testConnection();
  return NextResponse.json(result);
}
