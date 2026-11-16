import { spawnSync } from "node:child_process";

/**
 * Apply Prisma migrations when DATABASE_URL is present.
 * Soft mode (--soft / PRISMA_MIGRATE_SOFT=1): never fail the caller
 * (used if something still invokes migrate during build).
 */
const soft =
  process.argv.includes("--soft") ||
  process.env.PRISMA_MIGRATE_SOFT === "1" ||
  process.env.PRISMA_MIGRATE_SOFT === "true";

if (!process.env.DATABASE_URL?.trim()) {
  console.log("Skipping prisma migrate deploy (DATABASE_URL unset).");
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

const stdout = `${result.stdout || ""}${result.stderr || ""}`;
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");

if (result.status === 0) {
  process.exit(0);
}

// Local DBs created with `db push` may already have tables without migration history.
if (stdout.includes("P3005")) {
  console.warn(
    "Prisma P3005: schema already present — continuing (baseline or fresh migrate on empty hosts)."
  );
  process.exit(0);
}

// Hosted builds often cannot reach Postgres yet; never block image build.
if (
  soft ||
  stdout.includes("P1001") ||
  stdout.includes("P1000") ||
  stdout.includes("Can't reach database server")
) {
  console.warn(
    "Prisma migrate deploy failed (connection or soft mode) — continuing without failing the process."
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
