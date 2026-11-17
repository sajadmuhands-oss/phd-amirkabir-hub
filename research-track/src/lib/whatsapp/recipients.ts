export type WhatsAppRecipient = {
  id: string;
  name: string;
  phone: string;
  enabled: boolean;
  /** Immediate / emergency / change digests */
  notifyAlerts: boolean;
  notifyDaily: boolean;
  notifyWeekly: boolean;
  notifyMonthly: boolean;
};

export type RecipientChannel =
  | "alerts"
  | "daily"
  | "weekly"
  | "monthly"
  | "test";

function normalizePhone(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

function asBool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "false" || v === "0" || v === "no") return false;
    if (v === "true" || v === "1" || v === "yes") return true;
  }
  return fallback;
}

/** Works in Node and the browser (client settings form). */
function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRecipient(
  partial: Partial<WhatsAppRecipient> & { phone: string }
): WhatsAppRecipient {
  const phone = normalizePhone(partial.phone);
  return {
    id: partial.id || newId(),
    name: (partial.name || "").trim() || phone,
    phone,
    enabled: partial.enabled !== false,
    notifyAlerts: partial.notifyAlerts !== false,
    notifyDaily: partial.notifyDaily !== false,
    notifyWeekly: partial.notifyWeekly !== false,
    notifyMonthly: partial.notifyMonthly !== false,
  };
}

/** Parse stored setting: JSON array preferred; legacy comma-separated still supported. */
export function parseRecipientRecords(raw?: string | null): WhatsAppRecipient[] {
  if (!raw?.trim()) return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const phone = normalizePhone(String(row.phone ?? row.number ?? ""));
          if (phone.length < 8) return null;
          return createRecipient({
            id: typeof row.id === "string" ? row.id : undefined,
            name: typeof row.name === "string" ? row.name : phone,
            phone,
            enabled: asBool(row.enabled, true),
            notifyAlerts: asBool(
              row.notifyAlerts ?? row.alerts ?? row.notifyInstant,
              true
            ),
            notifyDaily: asBool(row.notifyDaily ?? row.daily, true),
            notifyWeekly: asBool(row.notifyWeekly ?? row.weekly, true),
            notifyMonthly: asBool(row.notifyMonthly ?? row.monthly, true),
          });
        })
        .filter((r): r is WhatsAppRecipient => Boolean(r));
    } catch {
      // fall through to legacy parser
    }
  }

  return trimmed
    .split(/[,;\n]+/)
    .map((v) => normalizePhone(v))
    .filter((v) => v.length >= 8)
    .map((phone) => createRecipient({ phone }));
}

export function serializeRecipientRecords(recipients: WhatsAppRecipient[]) {
  return JSON.stringify(
    recipients.map((r) => ({
      id: r.id,
      name: r.name,
      phone: normalizePhone(r.phone),
      enabled: Boolean(r.enabled),
      notifyAlerts: Boolean(r.notifyAlerts),
      notifyDaily: Boolean(r.notifyDaily),
      notifyWeekly: Boolean(r.notifyWeekly),
      notifyMonthly: Boolean(r.notifyMonthly),
    }))
  );
}

export function phonesForChannel(
  recipients: WhatsAppRecipient[],
  channel: RecipientChannel
): string[] {
  return recipients
    .filter((r) => r.enabled && r.phone.length >= 8)
    .filter((r) => {
      if (channel === "test") return true;
      if (channel === "alerts") return r.notifyAlerts;
      if (channel === "daily") return r.notifyDaily;
      if (channel === "weekly") return r.notifyWeekly;
      if (channel === "monthly") return r.notifyMonthly;
      return true;
    })
    .map((r) => r.phone);
}

export function normalizeRecipientsInput(raw: unknown): WhatsAppRecipient[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const phone = normalizePhone(String(row.phone ?? ""));
        if (phone.length < 8) return null;
        return createRecipient({
          id: typeof row.id === "string" ? row.id : undefined,
          name: typeof row.name === "string" ? row.name : phone,
          phone,
          enabled: asBool(row.enabled, true),
          notifyAlerts: asBool(row.notifyAlerts, true),
          notifyDaily: asBool(row.notifyDaily, true),
          notifyWeekly: asBool(row.notifyWeekly, true),
          notifyMonthly: asBool(row.notifyMonthly, true),
        });
      })
      .filter((r): r is WhatsAppRecipient => Boolean(r));
  }

  if (typeof raw === "string") {
    return parseRecipientRecords(raw);
  }

  return [];
}
