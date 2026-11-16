import { randomBytes } from "crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { ensureAuthEnv } from "@/lib/auth-env";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

ensureAuthEnv();

/** Prefer bound NEXTAUTH_SECRET; fall back so hosted boot does not Configuration-error. */
let runtimeAuthSecret: string | undefined;
function resolveAuthSecret() {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (!runtimeAuthSecret) {
    runtimeAuthSecret = randomBytes(32).toString("hex");
  }
  return runtimeAuthSecret;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const limited = consumeRateLimit(`login:${email}`, 8, 15 * 60 * 1000);
        if (!limited.ok) return null;

        await ensureBootstrapped();

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role === "admin" ? "admin" : "viewer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const role = (user as { role?: string }).role;
        token.role = role === "admin" ? "admin" : "viewer";
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        const role = token.role as string | undefined;
        (session.user as { id?: string; role?: string }).role =
          role === "admin" ? "admin" : "viewer";
      }
      return session;
    },
  },
  secret: resolveAuthSecret(),
};
