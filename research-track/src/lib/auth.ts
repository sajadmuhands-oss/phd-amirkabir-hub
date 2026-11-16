import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { ensureAuthEnv } from "@/lib/auth-env";
import { hasAuthSecret, resolveAuthSecret } from "@/lib/auth-secret";
import {
  ensureBootstrapped,
  ensureFirstAdminFromEnv,
} from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

ensureAuthEnv();

function ensureProcessSecret() {
  if (!process.env.NEXTAUTH_SECRET?.trim() && hasAuthSecret()) {
    process.env.NEXTAUTH_SECRET = resolveAuthSecret();
  }
}

ensureProcessSecret();

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
        if (!hasAuthSecret()) return null;
        ensureProcessSecret();
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const limited = consumeRateLimit(`login:${email}`, 8, 15 * 60 * 1000);
        if (!limited.ok) return null;

        try {
          await ensureBootstrapped();
        } catch {
          return null;
        }

        const envEmail = (process.env.ADMIN_EMAIL || "admin@alayen.edu.iq")
          .toLowerCase()
          .trim();

        // Always upsert/sync designated admin from ADMIN_* (.env or hosted
        // secrets) on login — recovers missed boots and rotates password.
        if (email === envEmail) {
          try {
            await ensureFirstAdminFromEnv();
          } catch {
            return null;
          }
        }

        const user = await prisma.user.findUnique({ where: { email } });
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
  secret: hasAuthSecret() ? resolveAuthSecret() : undefined,
};
