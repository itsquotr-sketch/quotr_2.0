/**
 * Production isolation for BILLING-1. Never prints secrets.
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

const preview = parseEnvFile(path.join(ROOT, ".env.local"));
const production = parseEnvFile(path.join(ROOT, ".env.production.local"));
if (urlRef(preview.NEXT_PUBLIC_SUPABASE_URL) !== PREVIEW_REF) {
  console.log(JSON.stringify({ ok: false, error: "preview_env_mismatch" }));
  process.exit(1);
}
if (urlRef(production.NEXT_PUBLIC_SUPABASE_URL) !== PRODUCTION_REF) {
  console.log(JSON.stringify({ ok: false, error: "production_env_mismatch" }));
  process.exit(1);
}

const prod = createClient(
  production.NEXT_PUBLIC_SUPABASE_URL,
  production.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const prev = createClient(
  preview.NEXT_PUBLIC_SUPABASE_URL,
  preview.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function missingRelation(error) {
  const message = error?.message ?? "";
  return /could not find the table|relation .* does not exist|schema cache/i.test(
    message
  );
}

const tables = [
  "org_billing_customers",
  "org_subscriptions",
  "stripe_processed_events",
  "org_billing_overrides",
];
const productionTables = {};
for (const table of tables) {
  const { error } = await prod.from(table).select("id").limit(1);
  productionTables[table] = error
    ? missingRelation(error)
      ? "missing"
      : "error"
    : "present";
}

const previewTables = {};
for (const table of tables) {
  const { error } = await prev.from(table).select("id").limit(1);
  previewTables[table] = error
    ? missingRelation(error)
      ? "missing"
      : "error"
    : "present";
}

const productionStripeConfigured = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_BUILDER_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BASE_MONTHLY",
  "STRIPE_PRICE_BUSINESS_SEAT_MONTHLY",
].some((name) => Boolean(production[name]?.trim()));

const report = {
  preview_tables: previewTables,
  production_tables: productionTables,
  production_billing_046_absent: Object.values(productionTables).every(
    (value) => value === "missing"
  ),
  production_local_env_has_stripe: productionStripeConfigured,
  production_vercel_stripe_names_listed: false,
};
console.log(JSON.stringify(report, null, 2));
if (!report.production_billing_046_absent) process.exit(1);
if (report.production_local_env_has_stripe) process.exit(1);
