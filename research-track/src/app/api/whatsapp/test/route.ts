import { NextResponse } from "next/server";
import {
  enforceAdminActionLimit,
  requireAdminSession,
} from "@/lib/api-auth";
import { formatBaghdad } from "@/lib/reports/periods";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

export async function POST() {
  const { session, error } = await requireAdminSession();
  if (error || !session) return error;

  const limited = enforceAdminActionLimit(
    "whatsapp-test",
    session.user.id,
    3,
    15 * 60 * 1000
  );
  if (limited) return limited;

  const body = [
    "جامعة العين العراقية",
    "نظام متابعة المسار البحثي",
    "رسالة تجريبية من النظام",
    `الوقت: ${formatBaghdad(new Date())} (بغداد)`,
  ].join("\n");

  const message = await sendWhatsAppText({
    body,
    idempotencyKey: `whatsapp-test:${Date.now()}`,
  });

  return NextResponse.json({
    ok: message?.status === "SENT",
    message,
  });
}
