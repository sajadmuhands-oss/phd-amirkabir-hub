import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureAuthEnv } from "@/lib/auth-env";
import { resolveAuthSecretEdge } from "@/lib/auth-secret";

ensureAuthEnv();

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes (no session required)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  const secret = await resolveAuthSecretEdge();
  if (!secret) {
    const login = new URL("/login", req.url);
    login.searchParams.set("error", "Configuration");
    return NextResponse.redirect(login);
  }

  // Ensure Edge JWT verification uses the same secret as Node auth.
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = secret;
  }

  const token = await getToken({ req, secret });
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/publications/:path*",
    "/changes/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/setup",
    "/api/setup",
  ],
};
