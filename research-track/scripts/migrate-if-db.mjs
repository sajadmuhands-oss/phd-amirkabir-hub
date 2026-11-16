import { spawnSync } from "node:child_process";

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
    "Prisma P3005: schema already present — continuing build (baseline or fresh migrate on empty hosts)."
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
