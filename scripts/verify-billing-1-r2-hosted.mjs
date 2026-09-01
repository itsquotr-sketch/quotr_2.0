/**
 * BILLING-1-R2 hosted Preview probes. Never prints secrets, bypass, or Stripe ids.
 *
 * Usage:
 *   node scripts/verify-billing-1-r2-hosted.mjs [unique-preview-origin]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const STABLE =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const UNIQUE = (process.argv[2] || STABLE).replace(/\/$/, "");
const ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";

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

function fail(message) {
  console.error(`[billing-1-r2] ${message}`);
  process.exit(1);
}

async function postWebhook(url, headers, body = "{}") {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
  const text = await response.text();
  return {
    status: response.status,
    looks_like_vercel_sso:
      /vercel\.com\/login|Authentication Required|Login – Vercel|login\.vercel\.com/i.test(
        `${response.status} ${text} ${response.headers.get("location") ?? ""}`
      ),
    looks_like_json: text.trim().startsWith("{"),
  };
}

const previewEnv = parseEnvFile(path.join(ROOT, ".env.local"));
const productionEnv = parseEnvFile(path.join(ROOT, ".env.production.local"));
if (!previewEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PREVIEW_REF)) {
  fail("Local Preview env is not quotr_preview.");
}
if (!productionEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_REF)) {
  fail("Production backup env is not quotr_2.0.");
}
const bypass = previewEnv.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (!bypass) fail("Preview protection bypass is not available to this runner.");

const preview = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const production = createClient(
  productionEnv.NEXT_PUBLIC_SUPABASE_URL,
  productionEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const webhookPath = "/api/webhooks/stripe";
const stableEndpoint = `${STABLE}${webhookPath}`;
const uniqueEndpoint = `${UNIQUE}${webhookPath}`;
const blocked = await postWebhook(stableEndpoint, {
  "content-type": "application/json",
});
const bypassed = await postWebhook(
  `${stableEndpoint}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`,
  {
    "content-type": "application/json",
    "x-vercel-protection-bypass": bypass,
  }
);
const uniqueBypassed = await postWebhook(
  `${uniqueEndpoint}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`,
  {
    "content-type": "application/json",
    "x-vercel-protection-bypass": bypass,
  }
);

const reachability = {
  without_bypass_protected:
    blocked.status === 401 || blocked.looks_like_vercel_sso,
  with_bypass_reachable: bypassed.status === 400 && bypassed.looks_like_json,
  unique_with_bypass_reachable:
    uniqueBypassed.status === 400 && uniqueBypassed.looks_like_json,
  without_bypass_status: blocked.status,
  with_bypass_unsigned_status: bypassed.status,
  unique_with_bypass_unsigned_status: uniqueBypassed.status,
};

if (!reachability.without_bypass_protected) {
  fail(`Webhook without bypass was not protected (status=${blocked.status}).`);
}
if (!reachability.with_bypass_reachable) {
  fail(
    `Stable webhook with bypass did not reach Stripe route (status=${bypassed.status}).`
  );
}
if (!reachability.unique_with_bypass_reachable) {
  fail(
    `Unique webhook with bypass did not reach Stripe route (status=${uniqueBypassed.status}).`
  );
}

const password = `Billing1r2-${Date.now()}-Aa`;
const { data: ownerProfile } = await preview
  .from("profiles")
  .select("id")
  .eq("org_id", ORG_ID)
  .eq("role", "owner")
  .maybeSingle();
if (!ownerProfile?.id) fail("Fixture owner profile not found.");
const owner = await preview.auth.admin.getUserById(ownerProfile.id);
if (owner.error || !owner.data.user?.email) fail("Fixture owner auth user missing.");
const updated = await preview.auth.admin.updateUserById(ownerProfile.id, {
  password,
});
if (updated.error) fail("Could not reset fixture owner password.");

const member = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const signedIn = await member.auth.signInWithPassword({
  email: owner.data.user.email,
  password,
});
if (signedIn.error || !signedIn.data.session?.access_token) {
  fail("Authenticated Preview sign-in failed.");
}
const accessToken = signedIn.data.session.access_token;

async function probe(action, extra = {}) {
  const url = new URL("/api/internal/billing-foundation-probe", UNIQUE);
  url.searchParams.set("x-vercel-protection-bypass", bypass);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-vercel-protection-bypass": bypass,
    },
    body: JSON.stringify({ action, ...extra }),
    redirect: "manual",
  });
  const json = await response.json().catch(() => null);
  return { http_status: response.status, json };
}

const config = await probe("config");
const configResult = config.json?.result ?? {};
if (config.http_status !== 200 || config.json?.ok !== true) {
  console.log(JSON.stringify({ reachability, config }, null, 2));
  fail(`Config probe failed (http=${config.http_status}).`);
}
if (configResult.stripe_secret_is_live) {
  fail("Hosted Preview Stripe secret is live-mode. STOP.");
}
if (configResult.prices_match !== true) {
  console.log(
    JSON.stringify(
      {
        stop: true,
        reason: "price_mismatch_or_unretrieved",
        reachability,
        config: configResult,
      },
      null,
      2
    )
  );
  fail("Stripe TEST Price validation did not match. STOP.");
}

const signed = await probe("signed_checkout");
const checkoutId = signed.json?.result?.stripe_event_id;
const replay = checkoutId
  ? await probe("replay", { stripe_event_id: checkoutId })
  : { http_status: 0, json: { ok: false } };
const livemode = await probe("livemode");
const mirror = await probe("mirror");

const productionEvents = await production
  .from("stripe_processed_events")
  .select("id", { count: "exact", head: true });
const productionHasBillingTable = !productionEvents.error;

const report = {
  origin: UNIQUE,
  reachability,
  config: configResult,
  signed_checkout: signed.json,
  idempotency: replay.json,
  livemode: livemode.json,
  mirror: mirror.json,
  production_billing_table_present: productionHasBillingTable,
  production_event_count_if_table: productionHasBillingTable
    ? productionEvents.count
    : null,
};
console.log(JSON.stringify(report, null, 2));

const green =
  report.reachability.without_bypass_protected &&
  report.reachability.with_bypass_reachable &&
  configResult.billing_environment === "test" &&
  configResult.stripe_secret_prefix === "sk_test" &&
  configResult.webhook_secret_prefix === "whsec" &&
  configResult.prices_match === true &&
  configResult.mapping?.builder === true &&
  configResult.mapping?.business_plus_1_seat === true &&
  configResult.mapping?.business_plus_3_seats === true &&
  configResult.mapping?.business_plus_4_seats === true &&
  configResult.mapping?.unknown_price_rejected === true &&
  signed.json?.ok === true &&
  replay.json?.ok === true &&
  livemode.json?.ok === true &&
  mirror.json?.ok === true &&
  productionHasBillingTable === false;
if (!green) fail("Hosted Stripe TEST foundation probe was not fully green.");
