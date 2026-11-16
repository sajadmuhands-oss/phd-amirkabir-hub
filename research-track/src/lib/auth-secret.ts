/**
 * Prefer bound NEXTAUTH_SECRET. If unset on a hosted deploy that already has a
 * unique DATABASE_URL, derive a per-deployment signing secret at runtime.
 * Never ship a fixed fallback string in the repository.
 */
const DERIVE_PREFIX = "alayen-nextauth-v1:";

export function hasAuthSecret(): boolean {
  return Boolean(
    process.env.NEXTAUTH_SECRET?.trim() || process.env.DATABASE_URL?.trim()
  );
}

export function resolveAuthSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "NEXTAUTH_SECRET is required (or DATABASE_URL to derive a per-deploy secret)."
    );
  }

  // Node runtime (API routes / auth options)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256")
    .update(DERIVE_PREFIX + databaseUrl)
    .digest("hex");
}

/** Edge-safe async resolver for middleware. */
export async function resolveAuthSecretEdge(): Promise<string | null> {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const data = new TextEncoder().encode(DERIVE_PREFIX + databaseUrl);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
