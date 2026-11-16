import { ensureAuthEnv } from "@/lib/auth-env";
import { ensureAuthSecretEnv } from "@/lib/auth-secret";

ensureAuthEnv();
ensureAuthSecretEnv();

export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/publications/:path*",
    "/changes/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
