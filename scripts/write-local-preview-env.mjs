#!/usr/bin/env node
/**
 * Rewrites gitignored .env.local to the hosted Preview project.
 * Does not print secrets. Does not touch Vercel Production.
 *
 * Usage: node scripts/write-local-preview-env.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_PRODUCTION_BACKUP = path.join(ROOT, ".env.production.local");

function fail(message) {
  console.error(`[write-local-preview-env] ${message}`);
  process.exit(1);
}

const listed = spawnSync(
  "npx",
  [
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    PREVIEW_REF,
    "--reveal",
    "--output",
    "json",
  ],
  { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }
);

if (listed.status !== 0) {
  fail("api-keys failed. Confirm CLI login and Preview project access.");
}

let payload;
try {
  payload = JSON.parse(listed.stdout);
} catch {
  fail("Could not parse api-keys JSON.");
}

const keys = Array.isArray(payload) ? payload : payload.api_keys ?? payload.keys ?? [];
const byName = new Map(
  keys
    .filter((row) => row && typeof row.name === "string")
    .map((row) => [row.name, row.api_key ?? row.key ?? row.secret ?? ""])
);

const anon = byName.get("anon") || byName.get("publishable") || "";
const service =
  byName.get("service_role") || byName.get("secret") || byName.get("service") || "";

if (!anon) {
  fail("Preview anon/publishable key missing from api-keys response.");
}

const previewUrl = `https://${PREVIEW_REF}.supabase.co`;
let envText = fs.readFileSync(ENV_LOCAL, "utf8");

if (envText.includes(PRODUCTION_REF) && !fs.existsSync(ENV_PRODUCTION_BACKUP)) {
  fs.writeFileSync(ENV_PRODUCTION_BACKUP, envText, "utf8");
  console.error(
    "[write-local-preview-env] Copied previous .env.local to gitignored .env.production.local"
  );
}

function upsertLine(text, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }
  return `${text.trimEnd()}\n${line}\n`;
}

envText = upsertLine(envText, "NEXT_PUBLIC_SUPABASE_URL", previewUrl);
envText = upsertLine(envText, "NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
if (service) {
  envText = upsertLine(envText, "SUPABASE_SERVICE_ROLE_KEY", service);
}

if (envText.includes(PRODUCTION_REF)) {
  fail("Refusing to write .env.local: Production ref would remain.");
}

fs.writeFileSync(ENV_LOCAL, envText, "utf8");
console.error(
  `[write-local-preview-env] .env.local now targets Preview host ${PREVIEW_REF}.supabase.co`
);
