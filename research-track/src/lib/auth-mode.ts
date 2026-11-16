/**
 * Public deployments allow read-only dashboard pages without login.
 * Admin pages and all mutation APIs always require a real authenticated admin.
 */
export function isPublicReadPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/publications")) return true;
  if (pathname.startsWith("/changes")) return true;
  if (pathname.startsWith("/reports")) return true;
  return false;
}

export function isAdminOnlyPath(pathname: string) {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}
