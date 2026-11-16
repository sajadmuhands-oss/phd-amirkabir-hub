import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ensureAuthEnv } from "@/lib/auth-env";
import { hasAuthSecret } from "@/lib/auth-secret";

ensureAuthEnv();

export async function middleware(req: NextRequest) {
  // Fail closed without a bound NEXTAUTH_SECRET — do not invent one.
  if (!hasAuthSecret()) {
    const login = new URL("/login", req.url);
    login.searchParams.set("error", "Configuration");
    return NextResponse.redirect(login);
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
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
