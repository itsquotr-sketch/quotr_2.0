#!/usr/bin/env node
/**
 * Branch Preview preflight. Does not print credentials.
 *
 * 1. Environment identity — .env.local must target the Preview project.
 * 2. Admin-client validity — the service-role value must be a service_role
 *    JWT for that project, and Preview must accept a one-row read.
 * 3. Job creation — pass --deployment <branch-url>. This confirms the URL is
 *    a Preview deployment and is reachable. Creating a job still happens on
 *    that deployment, because only the deployment's admin credential is used
 *    when the app creates a job. Success is a project page. Failure is
 *    "Could not create the job."
 *
 * Optional: --set-branch-service-role
 *   Writes only this Git branch's Preview SUPABASE_SERVICE_ROLE_KEY from
 *   `supabase projects api-keys`. Does not change Production or the shared
 *   Preview value. Does not print the key.
 *
 * Usage:
 *   node scripts/preview-branch-preflight.mjs
 *   node scripts/preview-branch-preflight.mjs --deployment https://<branch>.vercel.app
 *   node scripts/preview-branch-preflight.mjs --set-branch-service-role
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const BRANCH = "estimating/v3-explicit-exclusions";
const VERCEL_SCOPE = "quotr1";
const VERCEL_PROJECT = "prj_fPvYMlTj74oC5vcFolpkCHJJ8s0i";
const PRODUCTION_HOSTS = new Set([
  "get-quotr.com",
  "www.get-quotr.com",
  "app.get-quotr.com",
  "quotr-2-0.vercel.app",
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[preview-branch-preflight] ${message}`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) &&
      value.length >= 2
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function jwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function urlRef(url) {
  try {
    return new URL(url).hostname.replace(/\.supabase\.co$/i, "").toLowerCase();
  } catch {
    return null;
  }
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function revealPreviewServiceRole() {
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
    fail("Could not read Preview API keys. Confirm CLI login and project access.");
  }
  let payload;
  try {
    payload = JSON.parse(listed.stdout);
  } catch {
    fail("Could not parse Preview API keys.");
  }
  const keys = Array.isArray(payload) ? payload : payload.api_keys ?? payload.keys ?? [];
  const service = keys.find(
    (row) => row && (row.name === "service_role" || row.name === "secret")
  );
  const token = service?.api_key ?? service?.key ?? service?.secret ?? "";
  const payloadRole = token ? jwtPayload(token)?.role ?? null : null;
  if (payloadRole !== "service_role") {
    fail("Preview API keys did not return a service_role credential.");
  }
  return token;
}

async function checkLocalAdmin() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) fail(".env.local is missing.");
  const env = parseEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const ref = urlRef(url);
  const payload = key ? jwtPayload(key) : null;
  const role = typeof payload?.role === "string" ? payload.role : null;
  const result = {
    environment_identity: ref === PREVIEW_REF ? "preview" : ref === PRODUCTION_REF ? "production" : "unknown",
    supabase_ref: ref,
    admin_client_valid: false,
    admin_client_role: role,
  };
  if (ref === PRODUCTION_REF) fail("Refusing Production. This preflight is Preview only.");
  if (ref !== PREVIEW_REF) fail("NEXT_PUBLIC_SUPABASE_URL is not the Preview project.");
  if (role !== "service_role") fail("Local admin credential is not a service_role JWT.");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from("organisations").select("id").limit(1);
  if (error) fail("Preview rejected the admin credential.");
  result.admin_client_valid = true;
  return result;
}

async function checkDeployment(deployment) {
  let parsed;
  try {
    parsed = new URL(deployment);
  } catch {
    fail("Deployment URL is not valid.");
  }
  if (PRODUCTION_HOSTS.has(parsed.hostname)) {
    fail("Refusing a Production host. Pass this branch's Preview URL.");
  }
  if (!parsed.hostname.endsWith(".vercel.app")) {
    fail("Deployment host is not a Vercel Preview host.");
  }
  const response = await fetch(parsed.origin, { redirect: "manual" });
  return {
    deployment_host: parsed.hostname,
    deployment_reachable: response.status > 0 && response.status < 500,
    deployment_status: response.status,
    job_creation:
      "Create one job on this deployment. A project page confirms the branch admin credential. 'Could not create the job.' means it is still invalid.",
  };
}

function redact(text) {
  return String(text ?? "").replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[redacted]"
  );
}

function setBranchServiceRole() {
  const token = revealPreviewServiceRole();
  const file = path.join(os.tmpdir(), `quotr-preview-role-${process.pid}.txt`);
  fs.writeFileSync(file, token, { encoding: "utf8" });
  try {
    const command = [
      "npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview",
      `--git-branch "${BRANCH}"`,
      "--sensitive --yes --force",
      `--scope ${VERCEL_SCOPE}`,
      `--project ${VERCEL_PROJECT}`,
      `< "${file}"`,
    ].join(" ");
    const added = spawnSync(command, {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
    });
    if (added.status !== 0) {
      const detail = redact(`${added.stderr ?? ""}\n${added.stdout ?? ""}`).trim();
      fail(detail ? `Could not set this branch's Preview admin credential. ${detail.slice(0, 400)}` : "Could not set this branch's Preview admin credential.");
    }
  } finally {
    fs.rmSync(file, { force: true });
  }
  return { branch_service_role_set: true, git_branch: BRANCH };
}

const local = await checkLocalAdmin();
const deployment = argValue("--deployment");
const hosted = deployment ? await checkDeployment(deployment) : {
  job_creation:
    "Pass --deployment <branch-url> after the Preview deployment is Ready, then create one job there.",
};
const updated = process.argv.includes("--set-branch-service-role")
  ? setBranchServiceRole()
  : { branch_service_role_set: false };

console.log(JSON.stringify({ ...local, ...hosted, ...updated }, null, 2));
