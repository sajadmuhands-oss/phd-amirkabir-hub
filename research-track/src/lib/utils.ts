import { clsx, type ClassValue } from "clsx";
import { createHash } from "crypto";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(value?: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Normalize Scopus author labels for display (strip leading dots, tidy initials). */
export function cleanAuthorDisplayName(value?: string | null) {
  let name = (value || "").trim();
  if (!name) return "";

  // Scopus sometimes yields ".Surname I." or "Surname, .I"
  name = name.replace(/^\.+/, "").replace(/,(\s*)\.+/g, ",$1").replace(/\s+/g, " ").trim();
  // Drop dangling lone punctuation
  name = name.replace(/^[,.;:\-]+|[,.;:\-]+$/g, "").trim();
  // Prefer "Surname, Initials" when we see "Initials Surname" with a trailing initial cluster
  const inverted = name.match(/^([A-Z](?:\.|[A-Z])*(?:\s+[A-Z](?:\.|[A-Z])*)+)\s+([A-Za-z][\w'’-]+)$/);
  if (inverted) {
    name = `${inverted[2]}, ${inverted[1]}`;
  }
  return name;
}

/** Prefer cover-date as academic first-seen for historical baseline imports. */
export function firstSeenFromCoverDate(coverDate?: string | null, fallback = new Date()) {
  if (!coverDate) return fallback;
  // Accept YYYY, YYYY-MM, YYYY-MM-DD
  const m = coverDate.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return fallback;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  const day = m[3] ? Number(m[3]) : 1;
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return fallback;
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function hashContent(parts: Array<string | number | null | undefined>) {
  const payload = parts.map((p) => String(p ?? "")).join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

export function parseYear(coverDate?: string | null, fallback?: number | null) {
  if (!coverDate) return fallback ?? null;
  const match = coverDate.match(/(\d{4})/);
  return match ? Number(match[1]) : fallback ?? null;
}

export function parseRecipients(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((v) => v.replace(/[^\d]/g, ""))
    .filter((v) => v.length >= 8);
}
