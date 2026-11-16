/**
 * Hosted Cursor apps need an absolute NEXTAUTH_URL when the secret is present.
 */
export function ensureAuthEnv() {
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL =
      process.env.APP_URL?.trim() ||
      "https://alayen-research-track.apps.grok.bot";
  }
}
