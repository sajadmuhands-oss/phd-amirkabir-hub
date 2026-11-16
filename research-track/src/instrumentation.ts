export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAuthEnv } = await import("@/lib/auth-env");
    ensureAuthEnv();
  }
}
