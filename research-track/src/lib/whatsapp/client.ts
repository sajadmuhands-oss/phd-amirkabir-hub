import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWhatsAppConfig } from "@/lib/settings";

type SendResult = {
  ok: boolean;
  providerId?: string;
  response?: unknown;
  error?: string;
};

async function callWhatsAppApi(
  phoneNumberId: string,
  token: string,
  recipient: string,
  body: string
): Promise<SendResult> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient.replace(/[^\d]/g, ""),
      type: "text",
      text: { body, preview_url: true },
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      response: json,
      error:
        (json as { error?: { message?: string } })?.error?.message ||
        `WhatsApp API error (${response.status})`,
    };
  }

  const providerId =
    (json as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id || undefined;
  return { ok: true, providerId, response: json };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppText(options: {
  body: string;
  recipient?: string;
  recipients?: string[];
  reportId?: string;
  idempotencyKey: string;
  maxAttempts?: number;
}) {
  const config = await getWhatsAppConfig();
  const recipients =
    options.recipients ||
    (options.recipient ? [options.recipient] : config.recipients);

  if (!config.token || !config.phoneNumberId || recipients.length === 0) {
    return prisma.whatsAppMessage.create({
      data: {
        reportId: options.reportId,
        recipient: recipients[0] || "unknown",
        body: options.body,
        status: MessageStatus.FAILED,
        attempts: 0,
        maxAttempts: options.maxAttempts || 3,
        errorMessage:
          "إعدادات واتساب غير مكتملة (token / phoneNumberId / recipients).",
        idempotencyKey: options.idempotencyKey,
      },
    });
  }

  const results = [];
  for (const [index, recipient] of recipients.entries()) {
    const key =
      recipients.length === 1
        ? options.idempotencyKey
        : `${options.idempotencyKey}:to:${recipient}`;

    const existing = await prisma.whatsAppMessage.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing?.status === MessageStatus.SENT) {
      results.push(existing);
      continue;
    }

    let message =
      existing ||
      (await prisma.whatsAppMessage.create({
        data: {
          reportId: options.reportId,
          recipient,
          body: options.body,
          status: MessageStatus.PENDING,
          attempts: 0,
          maxAttempts: options.maxAttempts || 3,
          idempotencyKey: key,
        },
      }));

    const maxAttempts = message.maxAttempts;
    for (let attempt = message.attempts + 1; attempt <= maxAttempts; attempt++) {
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: { status: MessageStatus.RETRYING, attempts: attempt },
      });

      const result = await callWhatsAppApi(
        config.phoneNumberId,
        config.token,
        recipient,
        options.body
      );

      if (result.ok) {
        message = await prisma.whatsAppMessage.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.SENT,
            providerId: result.providerId,
            responseJson: result.response as object,
            sentAt: new Date(),
            errorMessage: null,
            attempts: attempt,
          },
        });
        break;
      }

      message = await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status:
            attempt >= maxAttempts ? MessageStatus.FAILED : MessageStatus.RETRYING,
          errorMessage: result.error,
          responseJson: result.response as object,
          attempts: attempt,
        },
      });

      if (attempt < maxAttempts) await sleep(1000 * 2 ** (attempt - 1));
    }

    results.push(message);
    if (index < recipients.length - 1) await sleep(250);
  }

  return results[0];
}
