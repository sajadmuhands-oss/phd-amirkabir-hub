/**
 * Ensure NextAuth has an absolute public URL.
 * Canonical public host (Cloudflare zone ol-ui-ac.net): research.ol-ui-ac.net
 */
export const PUBLIC_APP_URL = "https://research.ol-ui-ac.net";

export function ensureAuthEnv() {
  const fromEnv =
    process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim();
  if (!fromEnv) {
    process.env.NEXTAUTH_URL = PUBLIC_APP_URL;
  } else if (!process.env.NEXTAUTH_URL?.trim() && process.env.APP_URL?.trim()) {
    process.env.NEXTAUTH_URL = process.env.APP_URL.trim();
  }
}
