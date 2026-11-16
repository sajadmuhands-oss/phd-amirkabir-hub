import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureAuthEnv } from "@/lib/auth-env";
import { resolveAuthSecretEdge } from "@/lib/auth-secret";

ensureAuthEnv();

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public read-only research pages — no login required.
  const isPublicRead =
    pathname === "/" ||
    pathname.startsWith("/publications") ||
    pathname.startsWith("/changes") ||
    pathname.startsWith("/reports");

  if (isPublicRead) {
    return NextResponse.next();
  }

  // Admin-only pages (settings) require a real session.
  const secret = await resolveAuthSecretEdge();
  if (!secret) {
    const login = new URL("/login", req.url);
    login.searchParams.set("error", "Configuration");
    return NextResponse.redirect(login);
  }

  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = secret;
  }

  const token = await getToken({ req, secret });
  if (!token || token.role !== "admin") {
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
  ],
};
