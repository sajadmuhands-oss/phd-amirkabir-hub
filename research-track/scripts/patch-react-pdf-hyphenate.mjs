#!/usr/bin/env node
/**
 * @react-pdf/textkit imports `@react-pdf/hyphenate/en-us`.
 * That package only declares the `import` export condition for `./*`,
 * which breaks CJS/tsx resolution used by `npm run worker`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let pkgPath;
try {
  pkgPath = require.resolve("@react-pdf/hyphenate/package.json");
} catch {
  process.exit(0);
}

if (!existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const star = pkg.exports?.["./*"];
if (!star || typeof star !== "object") process.exit(0);

const nextStar = {
  types: star.types || "./lib/*.d.ts",
  import: star.import || "./lib/*.js",
  require: star.require || star.import || "./lib/*.js",
  default: star.default || star.import || "./lib/*.js",
};

const changed =
  star.require !== nextStar.require || star.default !== nextStar.default;

if (!changed) process.exit(0);

pkg.exports["./*"] = nextStar;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log("[patch] @react-pdf/hyphenate exports updated for worker/tsx");
