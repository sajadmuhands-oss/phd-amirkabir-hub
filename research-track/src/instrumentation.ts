export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAuthEnv } = await import("@/lib/auth-env");
    ensureAuthEnv();
    // Process-start only — never from anonymous page views.
    try {
      const { ensureBootstrapped, ensureScopusDataLoaded } = await import(
        "@/lib/bootstrap"
      );
      await ensureBootstrapped();
      void ensureScopusDataLoaded().catch(() => undefined);
    } catch {
      // Login/settings paths will retry admin bootstrap.
    }
  }
}
