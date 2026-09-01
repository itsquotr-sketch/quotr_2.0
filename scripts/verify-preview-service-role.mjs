/**
 * Presence/shape check for hosted Preview service_role. Never prints secrets.
 * Confirms JWT role and that Preview Supabase accepts the key.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) &&
      value.length >= 2
    ) {
      value = value.slice(1, -1);
    } else if (
      value.startsWith("'") &&
      value.endsWith("'") &&
      value.length >= 2
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    );
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function jwtRef(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    );
    const iss = typeof payload.iss === "string" ? payload.iss : "";
    const match = iss.match(/https:\/\/([a-z]{20})\.supabase\.co/i);
    return match ? match[1].toLowerCase() : null;
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

const envPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, ".env.local");
const env = parseEnvFile(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const ref = urlRef(url);
const role = key ? jwtRole(key) : null;
const keyRef = key ? jwtRef(key) : null;
const looksJwt = key.split(".").length === 3;

const result = {
  env_file: path.relative(ROOT, envPath).replaceAll("\\", "/"),
  supabase_ref: ref,
  is_preview_ref: ref === PREVIEW_REF,
  is_production_ref: ref === PRODUCTION_REF,
  has_service_role_value: Boolean(key),
  service_role_is_jwt: looksJwt,
  service_role_jwt_role: role,
  service_role_jwt_ref: keyRef,
  jwt_ref_matches_url: Boolean(keyRef && ref && keyRef === ref),
  accepted_by_preview_api: false,
  error_code: null,
};

if (!result.is_preview_ref) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}
result.service_role_value_length = key.length;
result.service_role_starts_eyJ = key.startsWith("eyJ");

if (role !== "service_role") {
  result.error_code = key ? "not_service_role_jwt" : "missing_service_role_value";
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await admin.from("organisations").select("id").limit(1);
if (error) {
  result.error_code = error.message.includes("Invalid API key")
    ? "invalid_api_key"
    : "query_failed";
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}
result.accepted_by_preview_api = true;
console.log(JSON.stringify(result, null, 2));
