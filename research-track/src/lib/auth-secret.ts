/**
 * NextAuth signing secret must come from the environment (bound app secret).
 * Fail closed: never ship or invent a fallback secret.
 */
export function resolveAuthSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim() || "";
  if (!fromEnv) {
    throw new Error(
      "NEXTAUTH_SECRET is required. Set a unique secret before starting the app."
    );
  }
  return fromEnv;
}

export function hasAuthSecret(): boolean {
  return Boolean(process.env.NEXTAUTH_SECRET?.trim());
}
