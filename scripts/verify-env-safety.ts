/**
 * Environment variable safety audit.
 *
 * Run: npx tsx scripts/verify-env-safety.ts
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const FORBIDDEN_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
  "NEXT_PUBLIC_SUPABASE_SERVICE",
  "NEXT_PUBLIC_SERVICE_ROLE_KEY",
];

const SERVER_ONLY_ENV = ["SUPABASE_SERVICE_ROLE_KEY"];

const CLIENT_DIRS = ["components", "app"];
const CLIENT_FILE_PATTERN = /\.(tsx|ts|jsx|js)$/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(fullPath, files);
    } else if (CLIENT_FILE_PATTERN.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function main() {
  console.log("=== Environment variable safety audit ===\n");

  for (const name of FORBIDDEN_PUBLIC_ENV) {
    assert(`Forbidden public env not set: ${name}`, !process.env[name]);
  }

  for (const name of SERVER_ONLY_ENV) {
    if (process.env[`NEXT_PUBLIC_${name}`]) {
      assert(`Service role key not exposed as NEXT_PUBLIC_${name}`, false);
    }
  }

  const examplePath = join(process.cwd(), ".env.local.example");
  const example = readFileSync(examplePath, "utf8");
  assert(".env.local.example documents SUPABASE_SERVICE_ROLE_KEY", /SUPABASE_SERVICE_ROLE_KEY/.test(example));
  assert(".env.local.example does not expose service role as NEXT_PUBLIC", !/NEXT_PUBLIC.*SERVICE_ROLE/.test(example));

  const adminPath = join(process.cwd(), "lib", "supabase", "admin.ts");
  const adminSource = readFileSync(adminPath, "utf8");
  assert("admin client uses SUPABASE_SERVICE_ROLE_KEY (not NEXT_PUBLIC)", /SUPABASE_SERVICE_ROLE_KEY/.test(adminSource));
  assert("admin client file marked server-only pattern", /Never import this from client/.test(adminSource));

  const clientPath = join(process.cwd(), "lib", "supabase", "client.ts");
  const clientSource = readFileSync(clientPath, "utf8");
  assert("browser client uses anon key only", /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(clientSource));
  assert("browser client does not reference service role", !/SERVICE_ROLE/.test(clientSource));

  const violations: string[] = [];
  for (const dir of CLIENT_DIRS) {
    const root = join(process.cwd(), dir);
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf8");
    if (source.includes('"use server"') || source.includes("'use server'")) {
      continue;
    }
    if (
      source.includes("createAdminClient") ||
      source.includes("SUPABASE_SERVICE_ROLE_KEY") ||
      source.includes("@/lib/supabase/admin")
    ) {
      violations.push(relative(process.cwd(), file));
    }
  }
  }

  assert(
    violations.length === 0
      ? "No client/app files import admin client or service role key"
      : `Client files must not import admin: ${violations.join(", ")}`,
    violations.length === 0
  );

  if (!process.exitCode) {
    console.log("\nEnvironment safety audit passed.");
  } else {
    console.log("\nEnvironment safety audit failed.");
  }
}

main();
