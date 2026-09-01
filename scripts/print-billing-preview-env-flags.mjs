/**
 * Presence-only flags for a gitignored env file. Never prints secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const file = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, ".env.preview.branch.local");

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

function urlRef(url) {
  try {
    return new URL(url).hostname.replace(/\.supabase\.co$/i, "").toLowerCase();
  } catch {
    return null;
  }
}

function keyLooksTest(value) {
  return typeof value === "string" && value.startsWith("sk_test_");
}
function keyLooksLive(value) {
  return typeof value === "string" && value.startsWith("sk_live_");
}

const env = parseEnvFile(file);
const ref = urlRef(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const billing = (env.BILLING_ENVIRONMENT ?? "").trim();
const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";
const webhook = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

console.log(
  JSON.stringify(
    {
      supabase_ref: ref,
      is_preview_ref: ref === PREVIEW_REF,
      is_production_ref: ref === PRODUCTION_REF,
      vercel_env: env.VERCEL_ENV || null,
      billing_environment: billing || null,
      billing_is_test: billing === "test",
      billing_is_live: billing === "live",
      has_stripe_secret: Boolean(secret),
      stripe_secret_is_test_prefix: keyLooksTest(secret),
      stripe_secret_is_live_prefix: keyLooksLive(secret),
      has_stripe_webhook_secret: Boolean(webhook),
      has_price_builder: Boolean(env.STRIPE_PRICE_BUILDER_MONTHLY?.trim()),
      has_price_business_base: Boolean(
        env.STRIPE_PRICE_BUSINESS_BASE_MONTHLY?.trim()
      ),
      has_price_business_seat: Boolean(
        env.STRIPE_PRICE_BUSINESS_SEAT_MONTHLY?.trim()
      ),
      has_publishable_key: Boolean(
        env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
      ),
      has_automation_bypass: Boolean(
        env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
      ),
    },
    null,
    2
  )
);
