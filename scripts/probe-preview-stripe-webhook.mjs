/**
 * Hosted Preview webhook reachability. Never prints bypass secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const UNIQUE =
  process.argv[2] || "https://quotr-2-0-okznakjsc-quotr1.vercel.app";

function parseEnvFile(filePath) {
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

async function post(url, headers) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: "{}",
    redirect: "manual",
  });
  const text = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location"),
    looks_like_vercel_sso:
      /vercel\.com\/login|Authentication Required|Login – Vercel|login\.vercel\.com/i.test(
        `${response.status} ${text} ${response.headers.get("location") ?? ""}`
      ),
    looks_like_json: text.trim().startsWith("{"),
    ok_field: (() => {
      try {
        return JSON.parse(text).ok === false;
      } catch {
        return null;
      }
    })(),
  };
}

const env = parseEnvFile(path.join(ROOT, ".env.local"));
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
const endpoint = `${ORIGIN}/api/webhooks/stripe`;
const uniqueEndpoint = `${UNIQUE}/api/webhooks/stripe`;

const blocked = await post(endpoint, { "content-type": "application/json" });
const bypassed = bypass
  ? await post(`${endpoint}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`, {
      "content-type": "application/json",
      "x-vercel-protection-bypass": bypass,
    })
  : null;
const uniqueBypassed = bypass
  ? await post(
      `${uniqueEndpoint}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`,
      {
        "content-type": "application/json",
        "x-vercel-protection-bypass": bypass,
      }
    )
  : null;

console.log(
  JSON.stringify(
    {
      stable_url: ORIGIN,
      unique_url: UNIQUE,
      has_bypass_secret: Boolean(bypass),
      without_bypass: blocked,
      with_bypass_unsigned: bypassed,
      unique_with_bypass_unsigned: uniqueBypassed,
    },
    null,
    2
  )
);
