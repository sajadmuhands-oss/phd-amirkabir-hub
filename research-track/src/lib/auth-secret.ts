/**
 * NextAuth middleware (Edge) and the Node auth route must share the same secret.
 * Prefer the bound NEXTAUTH_SECRET; otherwise use a stable app fallback so the
 * hosted URL does not die with "Configuration" / Server error.
 */
export const FALLBACK_NEXTAUTH_SECRET =
  "alayen-research-track-hosted-session-v1";

export function resolveAuthSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  return fromEnv || FALLBACK_NEXTAUTH_SECRET;
}

/** Ensure process.env is set before next-auth/middleware reads it. */
export function ensureAuthSecretEnv() {
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = FALLBACK_NEXTAUTH_SECRET;
  }
}
