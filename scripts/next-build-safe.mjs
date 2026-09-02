/**
 * Local Next.js production-compile without loading .env.production.local.
 *
 * `next build` otherwise loads .env.production.local (Production Supabase)
 * and page-data collection can fail closed — or worse, point at Production.
 * This wrapper:
 *   1. Reads .env.local only (never .env.production.local)
 *   2. Fails if the URL is Production (lxvnylhsbvudzzupxeqr)
 *   3. Runs `next build` with those values already set so Next does not
 *      overlay Production secrets
 *
 * Does not modify Production data. Does not apply migrations.
 *
 * Run: npm run build:safe
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const LOCAL_ENV = path.join(ROOT, ".env.local");

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx).trim()] = value;
  }
  return env;
}

function supabaseRef(url) {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname.endsWith(".supabase.co")) return null;
    return hostname.replace(/\.supabase\.co$/i, "") || null;
  } catch {
    return null;
  }
}

if (!existsSync(LOCAL_ENV)) {
  console.error("build:safe requires .env.local (Preview or supabase start).");
  process.exit(1);
}

const local = parseEnvFile(LOCAL_ENV);
const url = local.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = supabaseRef(url);

if (ref === PRODUCTION_REF) {
  console.error(
    "build:safe refused: .env.local points at Production Supabase. Use Preview or supabase start."
  );
  process.exit(1);
}

if (!url) {
  console.error("build:safe refused: NEXT_PUBLIC_SUPABASE_URL missing in .env.local.");
  process.exit(1);
}

const childEnv = { ...process.env, ...local };
delete childEnv.VERCEL_ENV;

const result = spawnSync("npx", ["next", "build"], {
  cwd: ROOT,
  env: childEnv,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
