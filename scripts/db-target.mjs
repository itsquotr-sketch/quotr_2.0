#!/usr/bin/env node
/**
 * Safe remote Supabase CLI wrapper (ENVIRONMENT-01).
 *
 * Never uses --linked.
 * Never defaults the target to Production.
 * Always passes --project-ref and --skip-vault.
 *
 * Usage:
 *   node scripts/db-target.mjs preview status
 *   node scripts/db-target.mjs preview push-dry
 *   node scripts/db-target.mjs preview push
 *   node scripts/db-target.mjs production status
 *   node scripts/db-target.mjs production push-dry
 *   node scripts/db-target.mjs production push
 *
 * Preview ref (canonical): shhpjsoldmqtkdbgrbtm (quotr_preview).
 * Override: QUOTR_SUPABASE_PREVIEW_PROJECT_REF or supabase/.preview-project-ref
 * Production push: CONFIRM_PRODUCTION_DB=<production ref>
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const PRODUCTION_NAME = "quotr_2.0";
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PREVIEW_NAME = "quotr_preview";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF_FILE = path.join(ROOT, "supabase", ".preview-project-ref");

const target = (process.argv[2] ?? "").trim().toLowerCase();
const action = (process.argv[3] ?? "").trim().toLowerCase();

function fail(message) {
  console.error(`[db-target] ${message}`);
  process.exit(1);
}

function readPreviewRefFile() {
  try {
    const value = fs.readFileSync(PREVIEW_REF_FILE, "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function resolvePreviewRef() {
  const fromEnv = process.env.QUOTR_SUPABASE_PREVIEW_PROJECT_REF?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const fromFile = readPreviewRefFile();
  if (fromFile) {
    return fromFile;
  }
  return PREVIEW_REF;
}

function assertRefShape(ref, label) {
  if (!/^[a-z]{20}$/.test(ref)) {
    fail(`${label} project ref is not a 20-character lowercase ref: ${ref}`);
  }
}

if (target !== "preview" && target !== "production") {
  fail('Target must be "preview" or "production".');
}

if (!["status", "push-dry", "push"].includes(action)) {
  fail('Action must be "status", "push-dry", or "push".');
}

const ref =
  target === "production" ? PRODUCTION_REF : resolvePreviewRef();
assertRefShape(ref, target);

if (target === "preview" && ref === PRODUCTION_REF) {
  fail(
    `Preview ref must not be Production (${PRODUCTION_NAME} / ${PRODUCTION_REF}).`
  );
}

if (target === "production" && action === "push") {
  const confirm = process.env.CONFIRM_PRODUCTION_DB?.trim();
  if (confirm !== PRODUCTION_REF) {
    fail(
      [
        "Refusing Production db push.",
        `Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF} in the same command.`,
        "ENVIRONMENT-01 forbids Production migrations in this programme.",
      ].join("\n")
    );
  }
}

if (target === "preview") {
  console.error(
    `[db-target] TARGET=PREVIEW project=${PREVIEW_NAME} ref=${ref}`
  );
} else {
  console.error(
    `[db-target] TARGET=PRODUCTION project=${PRODUCTION_NAME} ref=${ref}`
  );
}

const supabaseArgs =
  action === "status"
    ? ["migration", "list", "--project-ref", ref]
    : [
        "db",
        "push",
        "--project-ref",
        ref,
        "--skip-vault",
        ...(action === "push-dry" ? ["--dry-run"] : []),
        ...(action === "push" ? ["--yes"] : []),
      ];

const result = spawnSync("npx", ["supabase", ...supabaseArgs], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status === null ? 1 : result.status);
