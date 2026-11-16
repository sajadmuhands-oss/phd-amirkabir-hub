import { clsx, type ClassValue } from "clsx";
import { createHash } from "crypto";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(value?: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
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
