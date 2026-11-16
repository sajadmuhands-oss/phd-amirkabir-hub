export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAuthEnv } = await import("@/lib/auth-env");
    ensureAuthEnv();
    // Best-effort first-admin + infra bootstrap on process start (hosted).
    try {
      const { ensureBootstrapped } = await import("@/lib/bootstrap");
      await ensureBootstrapped();
    } catch {
      // Status/login paths will retry; avoid crashing startup.
    }
  }
}
