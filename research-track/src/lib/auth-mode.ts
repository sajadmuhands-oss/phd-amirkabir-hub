/**
 * Auth gate for the research-track app.
 * Default is open access (no login) so the hosted dashboard is usable
 * without ADMIN_PASSWORD. Set AUTH_REQUIRED=true to restore login.
 */
export function isAuthRequired() {
  const value = process.env.AUTH_REQUIRED?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function openAccessAdminUser() {
  return {
    id: "open-access",
    email: "open-access@local",
    name: "وصول مفتوح",
    role: "admin" as const,
  };
}
