/**
 * Hosted Preview retry of pending acceptance notification deliveries.
 * Does not re-accept. Resets the fixture owner password only in Preview.
 * Never prints emails, passwords, tokens, or secrets.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const ORIGIN =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const QUOTE_ID = "7fb61174-30f1-4ff4-a012-1884c5a25214";
const ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";
const CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
  console.error(`[notify-fix] ${message}`);
  process.exit(1);
}

function admin(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function deliverySnapshot(client) {
  const { data: notifications } = await client
    .from("notifications")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("resource_id", QUOTE_ID);
  const ids = (notifications ?? []).map((row) => row.id);
  const { data } = ids.length
    ? await client
        .from("notification_deliveries")
        .select("email_kind, status, attempt_count, provider, provider_message_id")
        .in("notification_id", ids)
        .order("email_kind")
    : { data: [] };
  return (data ?? []).map((row) => ({
    kind: row.email_kind,
    status: row.status,
    attempt_count: row.attempt_count,
    provider: row.provider,
    has_provider_message_id: Boolean(row.provider_message_id),
  }));
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

const preview = admin(previewEnv);
const production = admin(productionEnv);
const { count: productionQuoteCount } = await production
  .from("quotes")
  .select("id", { count: "exact", head: true })
  .eq("id", QUOTE_ID);
if ((productionQuoteCount ?? 0) !== 0) {
  fail("Fixture quote exists in Production.");
}

const { data: quote } = await preview
  .from("quotes")
  .select("id, org_id, created_by, status")
  .eq("id", QUOTE_ID)
  .maybeSingle();
if (!quote || quote.org_id !== ORG_ID || quote.status !== "accepted") {
  fail("Preview fixture quote is missing or not accepted.");
}

const before = await deliverySnapshot(preview);
const stamp = Date.now();
const password = `NotifyFix01-${stamp}-Aa`;
const owner = await preview.auth.admin.getUserById(quote.created_by);
if (owner.error || !owner.data.user?.email) fail("Fixture owner user not found.");
const ownerEmail = owner.data.user.email;
const updated = await preview.auth.admin.updateUserById(quote.created_by, {
  password,
  email_confirm: true,
});
if (updated.error) fail("Could not reset fixture owner password.");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--window-size=1280,900"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.setUserAgent(HUMAN_UA);
await page.setExtraHTTPHeaders({
  "x-vercel-protection-bypass": bypass,
});
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);

let flush = null;
try {
  await page.goto(`${ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email");
  await page.type("#email", ownerEmail);
  await page.type("#password", password);
  await page.click("button[type='submit']");
  await page.waitForFunction(
    () => location.pathname.startsWith("/app"),
    { timeout: 60000 }
  );

  flush = await page.evaluate(async (quoteId) => {
    const response = await fetch(`/api/quotes/${quoteId}/notification-flush`, {
      method: "POST",
      credentials: "same-origin",
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  }, QUOTE_ID);
} finally {
  await browser.close();
}

const after = await deliverySnapshot(preview);
const productionAfter = await deliverySnapshot(production);

console.log(
  JSON.stringify(
    {
      origin: ORIGIN,
      supabase_ref: PREVIEW_REF,
      production_quote_count: productionQuoteCount ?? 0,
      before,
      flush,
      after,
      production_after_count: productionAfter.length,
    },
    null,
    2
  )
);

if (flush?.status !== 200 || flush?.body?.ok !== true) {
  fail("Hosted flush did not succeed.");
}
if (after.some((row) => row.status !== "submitted" || !row.has_provider_message_id)) {
  fail("Preview notification deliveries did not reach submitted with provider ids.");
}
if (productionAfter.length !== 0) fail("Production notification deliveries were mutated.");
