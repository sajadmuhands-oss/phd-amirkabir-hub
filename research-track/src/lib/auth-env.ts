import { ensureAuthSecretEnv } from "@/lib/auth-secret";

/**
 * Hosted Cursor apps need an absolute NEXTAUTH_URL; without it NextAuth
 * returns Configuration errors and the home route looks "broken".
 */
export function ensureAuthEnv() {
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL =
      process.env.APP_URL?.trim() ||
      "https://alayen-research-track.apps.grok.bot";
  }
  ensureAuthSecretEnv();
}
