/**
 * Force-upsert the designated admin into the same DATABASE_URL the app uses.
 * Prints presence flags only — never prints secret values.
 *
 * Usage (from research-track/): node --env-file=.env scripts/ensure-admin.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@alayen.edu.iq")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD?.trim() || "";
  const name = process.env.ADMIN_NAME || "مدير النظام";
  const dbUrl = process.env.DATABASE_URL?.trim() || "";

  console.info(
    JSON.stringify({
      ADMIN_EMAIL_set: Boolean(process.env.ADMIN_EMAIL?.trim()),
      ADMIN_PASSWORD_ok: password.length >= 8,
      DATABASE_URL_set: Boolean(dbUrl),
      DATABASE_URL_host: dbUrl ? new URL(dbUrl).host : null,
      targetEmail: email,
    })
  );

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD is required (min 8 characters).");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin" },
    create: { email, name, passwordHash, role: "admin" },
  });

  const count = await prisma.user.count();
  console.info(
    JSON.stringify({
      upserted: true,
      id: user.id,
      email: user.email,
      role: user.role,
      userCount: count,
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
