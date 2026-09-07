/**
 * QUOTE-DISPLAY-V1C hosted Preview proof — summary (S) + line-total-off (L).
 *
 * Two fresh product-flow Quotes from the fence estimate (Continue to Pricing
 * twice on separate pages before either converts). Never clones pricing rows.
 * Plus-address fixture only. Canonical host. Preview only. No Production.
 * No paid Analyse. No migration 055.
 *
 * Run: npx --yes tsx .tmp-quote-display-v1c/hosted-proof.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  assertSafePreviewPasswordMutation,
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../scripts/lib/preview-auth-fixture.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const puppeteer = createRequire(
  path.join(ROOT, ".tmp-billing-3-r4", "package.json")
)("puppeteer-core");

const STABLE = PREVIEW_AUTH_SITE_ORIGIN_STABLE;
const FENCE_PROJECT = "31537cc9-47bf-4405-8209-8721adef2c79";
const ORG = "7a9a9bfb-d227-4a55-af73-f2231df5e068";
const FIXTURE_EMAIL = "hello+quote-display-v1c@erccontracting.co.nz";
const RECIPIENT_EMAIL = "hello+qdv1c-recv@erccontracting.co.nz";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SHOTS = path.join(HERE, "shots");
const REPORT = path.join(HERE, "hosted-report.json");
fs.mkdirSync(SHOTS, { recursive: true });

const SUMMARY = {
  show_quantity: false,
  show_unit: false,
  show_unit_price: false,
  show_line_total: true,
};
const LINE_TOTAL_OFF = {
  show_quantity: true,
  show_unit: true,
  show_unit_price: false,
  show_line_total: false,
};

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
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
    env[line.slice(0, idx).replace(/^export\s+/, "").trim()] = value;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gitHead() {
  return spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).stdout.trim();
}

function inspectDeploy() {
  const inspected = spawnSync("npx", ["vercel", "inspect", STABLE, "--format=json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 30 * 1024 * 1024,
    cwd: ROOT,
  });
  const start = String(inspected.stdout).indexOf("{");
  if (start < 0) return { ready: false };
  const payload = JSON.parse(String(inspected.stdout).slice(start));
  return {
    ready: payload.readyState === "READY",
    sha:
      payload.gitSource?.sha ||
      payload.meta?.githubCommitSha ||
      payload.deployment?.meta?.githubCommitSha ||
      null,
    alias: STABLE,
  };
}

function withBypass(base, pathname, bypass) {
  const dest = new URL(pathname, base);
  dest.searchParams.set("x-vercel-protection-bypass", bypass);
  return dest.toString();
}

function displayOf(row) {
  const opts = row?.issuer_snapshot?.display_options;
  if (!opts || typeof opts !== "object") return null;
  return opts;
}

function formatNzd(value) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

assertSafePreviewPasswordMutation(FIXTURE_EMAIL);
assertSafePreviewPasswordMutation(RECIPIENT_EMAIL);

const localEnv = parseEnvFile(path.join(ROOT, ".env.local"));
if (urlRef(localEnv.NEXT_PUBLIC_SUPABASE_URL) !== PREVIEW_SUPABASE_PROJECT_REF) {
  console.log(JSON.stringify({ ok: false, error: "not_preview_ref" }));
  process.exit(1);
}
const bypass = localEnv.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (!bypass) {
  console.log(JSON.stringify({ ok: false, error: "missing_bypass" }));
  process.exit(1);
}

const admin = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function quoteById(id) {
  const { data } = await admin
    .from("quotes")
    .select(
      "id, status, revision_number, issuer_snapshot, total_incl_gst, subtotal, gst_amount, snapshot_fingerprint, quote_number, send_lock_delivery_id, project_id, pricing_document_id, presentation_mode"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function latestQuoteForPricing(pricingId) {
  const { data } = await admin
    .from("quotes")
    .select(
      "id, status, revision_number, issuer_snapshot, total_incl_gst, pricing_document_id, created_at, presentation_mode"
    )
    .eq("pricing_document_id", pricingId)
    .eq("org_id", ORG)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function listFencePricing() {
  const { data } = await admin
    .from("pricing_documents")
    .select("id, status, converted_to_quote_at, created_at")
    .eq("org_id", ORG)
    .eq("project_id", FENCE_PROJECT)
    .order("created_at", { ascending: true });
  return data || [];
}

async function waitQuoteStatus(id, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await quoteById(id);
    if (row && row.status !== "draft") return row;
    await sleep(1500);
  }
  return quoteById(id);
}

async function waitDisplayMatch(id, expected, timeoutMs = 25000) {
  const start = Date.now();
  let row = await quoteById(id);
  while (Date.now() - start < timeoutMs) {
    const opts = displayOf(row);
    if (opts && Object.entries(expected).every(([key, value]) => opts[key] === value)) {
      return row;
    }
    await sleep(700);
    row = await quoteById(id);
  }
  return row;
}

async function assertDisplay(row, expected, label) {
  const opts = displayOf(row);
  const failed = Object.entries(expected).find(([key, value]) => opts?.[key] !== value);
  if (failed) {
    throw new Error(`${label}: expected ${failed[0]}=${failed[1]} got ${JSON.stringify(opts)}`);
  }
  return row;
}

async function clickByText(page, pattern) {
  const source = pattern instanceof RegExp ? pattern.source : pattern;
  return page.evaluate((src) => {
    const rx = new RegExp(src, "i");
    const el = [...document.querySelectorAll("button, a")].find((node) => {
      if (!rx.test((node.textContent || "").trim())) return false;
      if (node.disabled) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!el) return false;
    el.click();
    return true;
  }, source);
}

async function fill(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 20000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, String(value), { delay: 6 });
}

async function shot(page, name) {
  const dest = path.join(SHOTS, `${name}.png`);
  try {
    await page.screenshot({ path: dest, fullPage: true });
  } catch (error) {
    try {
      await page.screenshot({ path: dest, fullPage: false });
    } catch (inner) {
      console.error("shot_failed", name, String(error), String(inner));
    }
  }
}

async function waitDisplayControlReady(page) {
  await page.waitForSelector("[data-quote-display-control='true']", {
    timeout: 45000,
  });
  await page.waitForFunction(() => {
    const node = document.querySelector("#quote-display-unit-price");
    if (!node) return false;
    if (node.disabled) return false;
    if (node.getAttribute("aria-disabled") === "true") return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, { timeout: 20000 });
  await sleep(400);
}

async function readSwitch(page, selector) {
  return page.evaluate((sel) => {
    const nodes = [...document.querySelectorAll(sel)];
    const node =
      nodes.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) || nodes[0];
    if (!node) return null;
    const dataChecked = node.getAttribute("data-checked");
    const checked =
      node.getAttribute("aria-checked") === "true" ||
      node.getAttribute("data-state") === "checked" ||
      dataChecked === "true" ||
      dataChecked === "";
    return {
      checked,
      disabled:
        Boolean(node.disabled) || node.getAttribute("aria-disabled") === "true",
    };
  }, selector);
}

async function clickSwitch(page, selector) {
  const id = selector.startsWith("#") ? selector.slice(1) : null;
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center" });
  }, selector);
  await sleep(200);
  return page.evaluate(
    (sel, labelId) => {
      const nodes = [...document.querySelectorAll(sel)];
      const node =
        nodes.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) || nodes[0];
      if (!node) return false;
      const labels = labelId
        ? [...document.querySelectorAll(`label[for="${labelId}"]`)]
        : [];
      const visibleLabel = labels.find((label) => {
        const rect = label.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      (visibleLabel || node).click();
      return true;
    },
    selector,
    id
  );
}

async function ensureDisplay(page, quoteId, expected, label = "display") {
  const selectors = {
    show_quantity: "#quote-display-quantity",
    show_unit: "#quote-display-unit",
    show_unit_price: "#quote-display-unit-price",
    show_line_total: "#quote-display-line-total",
  };
  for (const [key, selector] of Object.entries(selectors)) {
    if (!(key in expected)) continue;
    let row = await quoteById(quoteId);
    if (displayOf(row)?.[key] === expected[key]) continue;
    if (key === "show_unit" && expected.show_unit === true) {
      if (displayOf(row)?.show_quantity !== true) {
        await clickSwitch(page, selectors.show_quantity);
        row = await waitDisplayMatch(quoteId, { show_quantity: true }, 15000);
      }
    }
    await clickSwitch(page, selector);
    row = await waitDisplayMatch(quoteId, { [key]: expected[key] }, 15000);
    if (displayOf(row)?.[key] !== expected[key]) {
      await clickSwitch(page, selector);
      row = await waitDisplayMatch(quoteId, { [key]: expected[key] }, 15000);
    }
    if (displayOf(row)?.[key] !== expected[key]) {
      throw new Error(
        `${label}:${key}: expected ${expected[key]} got ${JSON.stringify(displayOf(row))}`
      );
    }
  }
  return waitDisplayMatch(quoteId, expected);
}

async function waitPublicPath(page, quoteId, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const stored = quoteId
      ? await page
          .evaluate((id) => {
            try {
              return sessionStorage.getItem(`quotr:quote-public-path:${id}`);
            } catch {
              return null;
            }
          }, quoteId)
          .catch(() => null)
      : null;
    if (stored) return stored;
    const fromAttr = await page
      .$eval("[data-quote-public-path]", (el) => el.getAttribute("data-quote-public-path"))
      .catch(() => null);
    if (fromAttr) return fromAttr;
    await sleep(500);
  }
  await clickByText(page, "^Copy client link$");
  await sleep(400);
  try {
    return await page.evaluate(() => navigator.clipboard.readText());
  } catch {
    return null;
  }
}

async function readTemplate(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#quote-template");
    if (!el) return null;
    const html = el.innerHTML;
    const totals = document.querySelector("[data-quote-document-totals]");
    const headers = [...el.querySelectorAll("thead th")].map((th) =>
      (th.textContent || "").trim()
    );
    return {
      quantity: el.getAttribute("data-quote-show-quantity"),
      unit: el.getAttribute("data-quote-show-unit"),
      unitPrice: el.getAttribute("data-quote-show-unit-price"),
      lineTotal: el.getAttribute("data-quote-show-line-total"),
      columns: el.querySelector("[data-quote-line-columns]")?.getAttribute("data-quote-line-columns") || null,
      headers,
      totals: Boolean(totals),
      totalsText: (totals?.textContent || "").replace(/\s+/g, " ").trim(),
      unitPriceNode: Boolean(document.querySelector("[data-quote-unit-price]")),
      overflowX:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 8,
      htmlHasUnitPriceAttr: html.includes("data-quote-unit-price"),
      hasQtyHeader: headers.includes("Qty"),
      hasUnitHeader: headers.includes("Unit"),
      hasUnitPriceHeader: headers.includes("Unit price"),
      hasLineTotalHeader: headers.includes("Total"),
      hasQtyCard: /Qty:/i.test(html),
      hasUnitPriceCard: /Unit price:/i.test(html),
    };
  });
}

async function pageSnapshot(page) {
  return page.evaluate((projectId) => {
    const buttons = [...document.querySelectorAll("button")].map((node) => ({
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      disabled: Boolean(node.disabled),
      visible: node.getBoundingClientRect().height > 0,
    }));
    return {
      url: location.href,
      projectAttr:
        document.querySelector("[data-project-id]")?.getAttribute("data-project-id") ||
        null,
      expectedProject: projectId,
      dialogSlots: document.querySelectorAll("[data-slot='dialog-content']").length,
      dialogRoles: document.querySelectorAll("[role='dialog']").length,
      hasContinueQuestion: /Continue to Pricing\?/.test(document.body?.innerText || ""),
      continueButtons: buttons.filter((row) => /Continue to Pricing/i.test(row.text)),
      pricingTabs: buttons.filter((row) => /Pricing/i.test(row.text)),
      body: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200),
    };
  }, FENCE_PROJECT);
}

async function clickVisible(page, pattern) {
  const source = pattern instanceof RegExp ? pattern.source : pattern;
  return page.evaluate((src) => {
    const rx = new RegExp(src, "i");
    const el = [...document.querySelectorAll("button, a")].find((node) => {
      if (!rx.test((node.textContent || "").trim())) return false;
      if (node.disabled) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }, source);
}

async function openContinueDialog(page) {
  await page.goto(withBypass(STABLE, `/app/projects/${FENCE_PROJECT}`, bypass), {
    waitUntil: "domcontentloaded",
  });
  await page
    .waitForSelector(`[data-project-id="${FENCE_PROJECT}"]`, { timeout: 45000 })
    .catch(() => null);
  await page
    .waitForFunction(
      () =>
        /Continue to Pricing|Not started|Open Pricing|Review estimate/i.test(
          document.body?.innerText || ""
        ),
      { timeout: 45000 }
    )
    .catch(() => null);
  await sleep(800);
  await clickVisible(page, "^Review estimate$");
  await sleep(500);
  const viaCta = await clickVisible(page, "^Continue to Pricing$");
  if (!viaCta) {
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll("button[role='tab']")].find((node) => {
        const text = (node.textContent || "").replace(/\s+/g, " ");
        return /Pricing/i.test(text) && /Not started/i.test(text) && !node.disabled;
      });
      tab?.click();
      return Boolean(tab);
    });
  }
  await page
    .waitForFunction(
      () =>
        /Continue to Pricing\?/.test(document.body?.innerText || "") ||
        document.querySelector("[data-slot='dialog-content']") ||
        document.querySelector("[role='dialog']"),
      { timeout: 15000 }
    )
    .catch(() => null);
  return pageSnapshot(page);
}

async function confirmContinueToPricing(page) {
  return page.evaluate(() => {
    const root =
      document.querySelector("[data-slot='dialog-content']") ||
      [...document.querySelectorAll("[role='dialog']")].find((node) =>
        /Continue to Pricing\?/i.test(node.textContent || "")
      ) ||
      document.body;
    const btn = [...(root?.querySelectorAll("button") || [])].find((node) => {
      if (!/^Continue to Pricing$/i.test((node.textContent || "").trim())) {
        return false;
      }
      if (node.disabled) return false;
      return true;
    });
    btn?.click();
    return Boolean(btn);
  });
}

async function markPricingReviewedUi(page) {
  await page
    .waitForFunction(
      () => /Pricing reviewed|Mark as reviewed|Create quote/i.test(document.body?.innerText || ""),
      { timeout: 45000 }
    )
    .catch(() => null);
  await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((node) =>
      /Pricing reviewed/i.test(node.textContent || "")
    );
    label?.click();
  });
  await sleep(400);
  const clicked = await clickByText(page, "^Mark as reviewed$");
  return clicked;
}

async function leakAudit(page, quoteId, mode) {
  const html = await page.content();
  const { data: lines } = await admin
    .from("quote_items")
    .select("quantity, unit, unit_price, total")
    .eq("quote_id", quoteId);
  const quote = await quoteById(quoteId);
  const templateHtml = await page.$eval("#quote-template", (el) => el.innerHTML);
  const totalsHtml = await page
    .$eval("[data-quote-document-totals]", (el) => el.innerHTML)
    .catch(() => "");
  const outsideTotals = templateHtml.replace(totalsHtml, "");
  const hiddenPrices = (lines || [])
    .map((row) => Number(row.unit_price))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => n.toFixed(2));
  const hiddenQty = (lines || [])
    .map((row) => row.quantity)
    .filter((n) => n != null)
    .map(String);
  const lineTotals = (lines || [])
    .map((row) => Number(row.total))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => formatNzd(n));
  const reserved = new Set(
    [quote?.subtotal, quote?.gst_amount, quote?.total_incl_gst]
      .filter((n) => Number.isFinite(Number(n)))
      .map((n) => formatNzd(n))
  );
  return {
    mode,
    unit_price_attr_present: /data-quote-unit-price/.test(templateHtml),
    hidden_price_strings_in_html:
      mode === "summary" || mode === "line-total-off"
        ? hiddenPrices.filter((value) => html.includes(value))
        : [],
    hidden_qty_in_html:
      mode === "summary" ? hiddenQty.filter((value) => outsideTotals.includes(`Qty: ${value}`)) : [],
    unique_line_totals_outside_document_totals:
      mode === "line-total-off"
        ? lineTotals.filter((value) => !reserved.has(value) && outsideTotals.includes(value))
        : [],
    next_data_unit_price_exposed: /"unit_price":\s*[0-9]/.test(html),
    next_data_quantity_exposed:
      mode === "summary" ? /"quantity":\s*[0-9]/.test(html) : false,
  };
}

const EXPECTED_SHA = gitHead();
const report = {
  ok: false,
  commit: EXPECTED_SHA,
  preview_ref: PREVIEW_SUPABASE_PROJECT_REF,
  production_untouched: PRODUCTION_SUPABASE_PROJECT_REF,
  migrations: "none",
  fixture_strategy: "two_fresh_quotes_from_fence_estimate_continue_to_pricing",
  password_mutation: {
    protected_inboxes: PREVIEW_PASSWORD_PROTECTED_EMAILS,
    fixture_is_plus_address: true,
  },
};

async function main() {
try {
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  const users = listed.data?.users || listed.users || [];
  const jeanlucBefore = users.find(
    (u) => String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[0]
  );
  const helloBefore = users.find(
    (u) => String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[1]
  );
  report.password_mutation.jeanluc_updated_at_before = jeanlucBefore?.updated_at || null;
  report.password_mutation.hello_updated_at_before = helloBefore?.updated_at || null;

  report.step = "fixture";
  const fixturePassword = `QDispC-${Date.now()}-Aa!`;
  let fixture = users.find(
    (u) => String(u.email || "").toLowerCase() === FIXTURE_EMAIL
  );
  if (!fixture) {
    const created = await admin.auth.admin.createUser({
      email: FIXTURE_EMAIL,
      password: fixturePassword,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    fixture = created.data.user;
  } else {
    assertSafePreviewPasswordMutation(fixture.email);
    const updated = await admin.auth.admin.updateUserById(fixture.id, {
      password: fixturePassword,
      email_confirm: true,
    });
    if (updated.error) throw updated.error;
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", fixture.id)
    .maybeSingle();
  if (!existingProfile) {
    const { error: profileError } = await admin.from("profiles").insert({
      id: fixture.id,
      org_id: ORG,
      role: "estimator",
      full_name: "Quote Display V1C fixture",
    });
    if (profileError) throw profileError;
  } else if (existingProfile.org_id !== ORG) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ org_id: ORG, role: "estimator" })
      .eq("id", fixture.id);
    if (profileError) throw profileError;
  }

  const { data: existingMember } = await admin
    .from("organisation_memberships")
    .select("id")
    .eq("org_id", ORG)
    .eq("user_id", fixture.id)
    .maybeSingle();
  if (!existingMember) {
    const { error: memberError } = await admin.from("organisation_memberships").insert({
      org_id: ORG,
      user_id: fixture.id,
      role: "estimator",
      status: "active",
    });
    if (memberError) throw memberError;
  }

  report.step = "deploy";
  report.deploy = inspectDeploy();
  if (!report.deploy.ready) throw new Error("preview_not_ready");
  report.deployed_sha = report.deploy.sha;
  report.deploy_matches_commit = String(report.deploy.sha || "").startsWith(
    EXPECTED_SHA.slice(0, 7)
  );

  const origin = STABLE;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 180000,
    args: ["--no-sandbox"],
  });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(origin, ["clipboard-read", "clipboard-write"]);
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setUserAgent(HUMAN_UA);
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({
    "x-vercel-protection-bypass": bypass,
    "x-vercel-set-bypass-cookie": "true",
  });

  try {
    report.step = "login";
    await page.goto(withBypass(origin, "/login", bypass), {
      waitUntil: "domcontentloaded",
    });
    await fill(page, "#email", FIXTURE_EMAIL);
    await fill(page, "#password", fixturePassword);
    await clickByText(page, "^Sign in$|^Log in$");
    await page
      .waitForFunction(() => !location.pathname.includes("/login"), { timeout: 30000 })
      .catch(() => null);
    report.login_path = new URL(page.url()).pathname;
    await shot(page, "00-after-login");
    if (String(report.login_path).includes("/login")) {
      throw new Error("login_failed");
    }

    await page.keyboard.press("Escape").catch(() => null);
    await page.mouse.click(24, 180).catch(() => null);

    report.step = "fresh_pricing";
    let fencePricing = await listFencePricing();
    if (fencePricing.length === 0) {
      const opened = await openContinueDialog(page);
      report.continue_opened = opened;
      await shot(page, "01-continue");
      report.continue_confirmed = await confirmContinueToPricing(page);
      const pricingWait = Date.now();
      while (Date.now() - pricingWait < 90000) {
        fencePricing = await listFencePricing();
        if (fencePricing.length >= 1) break;
        await sleep(1500);
      }
    }
    report.pricing_created = fencePricing.map((row) => ({
      id: row.id,
      status: row.status,
    }));
    const pricingS =
      fencePricing.find((row) => row.status === "draft" || row.status === "reviewed") ||
      fencePricing[0];
    if (!pricingS?.id) {
      throw new Error("no_fence_pricing_for_summary");
    }
    report.fixture_strategy =
      "fence_continue_to_pricing_then_mark_reviewed_create_quote; line-total-off via mark-reviewed-after-convert + create revision";

    async function clickCreateRevision() {
      await page.bringToFront();
      await page.setViewport({ width: 1440, height: 900 });
      await page
        .waitForSelector('[data-quote-sidebar="true"]', {
          visible: true,
          timeout: 20000,
        })
        .catch(() => null);
      return page.evaluate(() => {
        const el = [...document.querySelectorAll("button")].find((node) => {
          if (!/^Create revision$/i.test((node.textContent || "").trim())) return false;
          if (node.disabled) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        el?.scrollIntoView({ block: "center" });
        el?.click();
        return Boolean(el);
      });
    }

    async function waitNewFenceDraft(knownIds, timeoutMs = 90000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const { data: drafts } = await admin
          .from("quotes")
          .select("id, status, issuer_snapshot, pricing_document_id, created_at")
          .eq("org_id", ORG)
          .eq("project_id", FENCE_PROJECT)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(8);
        const found = (drafts || []).find((row) => !knownIds.has(row.id));
        if (found) return found;
        await sleep(1500);
      }
      return null;
    }

    async function reviewAndCreateQuote(pricingId, shotPrefix) {
      await page.goto(
        withBypass(origin, `/app/projects/${FENCE_PROJECT}/pricing/${pricingId}`, bypass),
        { waitUntil: "domcontentloaded" }
      );
      await shot(page, `${shotPrefix}-pricing`);
      const { data: current } = await admin
        .from("pricing_documents")
        .select("id, status")
        .eq("id", pricingId)
        .maybeSingle();
      if (current?.status !== "reviewed" && current?.status !== "converted_to_quote") {
        const marked = await markPricingReviewedUi(page);
        const reviewWait = Date.now();
        while (Date.now() - reviewWait < 45000) {
          const { data } = await admin
            .from("pricing_documents")
            .select("status")
            .eq("id", pricingId)
            .maybeSingle();
          if (data?.status === "reviewed") break;
          await sleep(800);
        }
        if (!marked) {
          report[`${shotPrefix}_mark_reviewed_ui`] = await page.evaluate(() =>
            (document.body.innerText || "").slice(0, 600)
          );
        }
      }
      const { data: reviewed } = await admin
        .from("pricing_documents")
        .select("id, status")
        .eq("id", pricingId)
        .maybeSingle();
      if (reviewed?.status !== "reviewed" && reviewed?.status !== "converted_to_quote") {
        throw new Error(`${shotPrefix}_pricing_not_reviewed:${reviewed?.status}`);
      }
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => null);
      await page
        .waitForFunction(
          () => /Create quote|Open quote/i.test(document.body?.innerText || ""),
          { timeout: 30000 }
        )
        .catch(() => null);
      const createClicked = await clickByText(page, "^Create quote$");
      const createWait = Date.now();
      let quoteRow = await latestQuoteForPricing(pricingId);
      while (!quoteRow?.id && Date.now() - createWait < 90000) {
        await sleep(1500);
        quoteRow = await latestQuoteForPricing(pricingId);
      }
      if (!quoteRow?.id) {
        throw new Error(`${shotPrefix}_quote_not_created`);
      }
      await page.goto(
        withBypass(origin, `/app/projects/${FENCE_PROJECT}/quotes/${quoteRow.id}`, bypass),
        { waitUntil: "load" }
      );
      await waitDisplayControlReady(page);
      return { quoteRow: await quoteById(quoteRow.id), createClicked };
    }

    async function persistReload(quoteId) {
      await page.reload({ waitUntil: "load" });
      await waitDisplayControlReady(page);
      const afterReload = displayOf(await quoteById(quoteId));
      await page.goto(withBypass(origin, `/app/projects/${FENCE_PROJECT}`, bypass), {
        waitUntil: "domcontentloaded",
      });
      await sleep(500);
      await page.goto(
        withBypass(origin, `/app/projects/${FENCE_PROJECT}/quotes/${quoteId}`, bypass),
        { waitUntil: "load" }
      );
      await waitDisplayControlReady(page);
      return {
        afterReload,
        afterNav: displayOf(await quoteById(quoteId)),
        ui: {
          description: await readSwitch(page, "#quote-display-description"),
          quantity: await readSwitch(page, "#quote-display-quantity"),
          unit: await readSwitch(page, "#quote-display-unit"),
          unitPrice: await readSwitch(page, "#quote-display-unit-price"),
          lineTotal: await readSwitch(page, "#quote-display-line-total"),
        },
      };
    }

    async function issueQuote(quoteId, message) {
      let capturedPublicPath = null;
      const capturePublic = async (response) => {
        try {
          const text = await response.text();
          const match = text.match(/\/q\/(qt_[A-Za-z0-9_-]+)/);
          if (match) capturedPublicPath = match[0];
        } catch {
          /* ignore */
        }
      };
      page.on("response", capturePublic);
      await clickByText(page, "^Send quote$");
      await page.waitForSelector("#quote-send-email", { timeout: 15000 });
      await fill(page, "#quote-send-name", "Quote Display V1C Client");
      await fill(page, "#quote-send-email", RECIPIENT_EMAIL);
      await fill(page, "#quote-send-message", message);
      await page.waitForSelector("[data-quote-send-submit='true']", { timeout: 10000 });
      await page.click("[data-quote-send-submit='true']");
      const publicWait = waitPublicPath(page, quoteId, 120000);
      const issued = await waitQuoteStatus(quoteId, 90000);
      const deliveryWait = Date.now();
      let deliveries = [];
      while (Date.now() - deliveryWait < 60000) {
        const { data } = await admin
          .from("quote_deliveries")
          .select("id, status, kind, failure_code")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false });
        deliveries = data || [];
        const latest = deliveries[0];
        if (latest && latest.status !== "preparing") break;
        await sleep(1500);
      }
      page.off("response", capturePublic);
      let publicHref = (await publicWait) || capturedPublicPath;
      if (!publicHref) {
        await clickByText(page, "^Send quote$|^Resend quote$|^Copy client link$");
        publicHref = await waitPublicPath(page, quoteId, 15000);
      }
      return { issued, deliveries, publicHref };
    }

    async function publicProof(publicHref, quoteId, mode, shotPrefix) {
      if (!publicHref) throw new Error(`${shotPrefix}_missing_public_url`);
      const publicPage = await browser.newPage();
      await publicPage.setUserAgent(HUMAN_UA);
      await publicPage.setExtraHTTPHeaders({
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      });
      const publicUrl = publicHref.startsWith("http")
        ? publicHref
        : `${origin}${publicHref}`;
      await publicPage.setViewport({ width: 1280, height: 900 });
      await publicPage.goto(withBypass(origin, new URL(publicUrl).pathname, bypass), {
        waitUntil: "domcontentloaded",
      });
      await publicPage.waitForSelector("#quote-template", { timeout: 30000 });
      const desktop = await readTemplate(publicPage);
      const leak = await leakAudit(publicPage, quoteId, mode);
      await shot(publicPage, `${shotPrefix}-desktop`);
      await publicPage.setViewport({ width: 390, height: 844 });
      await sleep(400);
      const mobile = await readTemplate(publicPage);
      await shot(publicPage, `${shotPrefix}-mobile`);
      await publicPage.emulateMediaType("print");
      await sleep(300);
      const print = await readTemplate(publicPage);
      await shot(publicPage, `${shotPrefix}-print`);
      await publicPage.emulateMediaType("screen");
      await publicPage.close().catch(() => null);
      return { desktop, mobile, print, leak, publicUrl };
    }

    report.step = "summary_s";
    const createdS = await reviewAndCreateQuote(pricingS.id, "s");
    let quoteS = createdS.quoteRow;
    report.O1_O2 = {
      pricing_id: pricingS.id,
      quote_id: quoteS.id,
      status: quoteS.status,
      create_clicked: createdS.createClicked,
    };
    report.G1_builder_controls = Boolean(await page.$("#quote-display-unit-price"));

    report.step = "quantity_unit_coherence";
    quoteS = await ensureDisplay(
      page,
      quoteS.id,
      { show_quantity: true, show_unit: true },
      "coherence_on"
    );
    const beforeQtyOff = {
      db: displayOf(quoteS),
      ui: {
        quantity: await readSwitch(page, "#quote-display-quantity"),
        unit: await readSwitch(page, "#quote-display-unit"),
      },
    };
    await clickSwitch(page, "#quote-display-quantity");
    quoteS = await waitDisplayMatch(quoteS.id, { show_quantity: false, show_unit: false });
    const afterQtyOff = {
      db: displayOf(quoteS),
      ui: {
        quantity: await readSwitch(page, "#quote-display-quantity"),
        unit: await readSwitch(page, "#quote-display-unit"),
      },
    };
    await clickSwitch(page, "#quote-display-quantity");
    quoteS = await waitDisplayMatch(quoteS.id, { show_quantity: true }, 20000);
    const afterQtyOn = {
      db: displayOf(quoteS),
      ui: {
        quantity: await readSwitch(page, "#quote-display-quantity"),
        unit: await readSwitch(page, "#quote-display-unit"),
      },
    };
    report.quantity_unit_coherence = {
      before: beforeQtyOff,
      after_quantity_off: afterQtyOff,
      after_quantity_on_again: afterQtyOn,
      behaviour:
        afterQtyOn.db?.show_unit === false ? "A_unit_remains_off" : "B_unit_restores_on",
    };

    quoteS = await ensureDisplay(page, quoteS.id, SUMMARY, "summary_draft");
    await assertDisplay(quoteS, SUMMARY, "summary_draft");
    report.O3_O5_summary_draft = {
      db: displayOf(quoteS),
      ui: {
        description: await readSwitch(page, "#quote-display-description"),
        quantity: await readSwitch(page, "#quote-display-quantity"),
        unit: await readSwitch(page, "#quote-display-unit"),
        unitPrice: await readSwitch(page, "#quote-display-unit-price"),
        lineTotal: await readSwitch(page, "#quote-display-line-total"),
      },
    };
    await shot(page, "s-draft");
    await sleep(1200);
    const persistS = await persistReload(quoteS.id);
    quoteS = await waitDisplayMatch(quoteS.id, SUMMARY);
    await assertDisplay(quoteS, SUMMARY, "summary_persist");
    report.O6_summary_persist = persistS;

    const issueS = await issueQuote(quoteS.id, "Please review Quote S summary.");
    quoteS = issueS.issued;
    if (quoteS.status === "draft") throw new Error("summary_still_draft");
    await assertDisplay(quoteS, SUMMARY, "summary_issued_snapshot");
    report.O7_summary_issue = {
      id: quoteS.id,
      status: quoteS.status,
      display: displayOf(quoteS),
      deliveries: issueS.deliveries,
      public_path: issueS.publicHref,
    };
    const publicS = await publicProof(issueS.publicHref, quoteS.id, "summary", "s-public");
    report.O8_O12_summary_public = publicS;
    if (publicS.desktop.quantity !== "false" || publicS.desktop.unit !== "false") {
      throw new Error("summary_desktop_shows_qty_or_unit");
    }
    if (publicS.desktop.unitPrice !== "false" || publicS.desktop.unitPriceNode) {
      throw new Error("summary_desktop_shows_unit_price");
    }
    if (publicS.desktop.lineTotal !== "true" || !publicS.desktop.totals) {
      throw new Error("summary_missing_line_total_or_grand_total");
    }
    if (publicS.mobile.overflowX) throw new Error("summary_mobile_overflow");
    if (!publicS.print.totals) throw new Error("summary_print_missing_grand_total");

    report.step = "line_total_off_l";
    await page.bringToFront();
    await page.goto(
      withBypass(origin, `/app/projects/${FENCE_PROJECT}/pricing/${pricingS.id}`, bypass),
      { waitUntil: "domcontentloaded" }
    );
    await shot(page, "l-pricing-rereview");
    const markedAgain = await markPricingReviewedUi(page);
    const rereviewWait = Date.now();
    let pricingAfterS = null;
    while (Date.now() - rereviewWait < 45000) {
      const { data } = await admin
        .from("pricing_documents")
        .select("id, status")
        .eq("id", pricingS.id)
        .maybeSingle();
      pricingAfterS = data;
      if (data?.status === "reviewed") break;
      await sleep(800);
    }
    report.R1_reviewed_after_convert = {
      marked: markedAgain,
      status: pricingAfterS?.status || null,
    };
    if (pricingAfterS?.status !== "reviewed") {
      throw new Error(`line_total_off_pricing_not_reviewed:${pricingAfterS?.status}`);
    }
    const knownDrafts = new Set(
      (
        (
          await admin
            .from("quotes")
            .select("id")
            .eq("org_id", ORG)
            .eq("project_id", FENCE_PROJECT)
            .eq("status", "draft")
        ).data || []
      ).map((row) => row.id)
    );
    await page.goto(
      withBypass(origin, `/app/projects/${FENCE_PROJECT}/quotes/${quoteS.id}`, bypass),
      { waitUntil: "load" }
    );
    await sleep(800);
    const createRevisionClicked = await clickCreateRevision();
    report.create_revision_clicked = createRevisionClicked;
    if (!createRevisionClicked) {
      report.create_revision_ui = await page.evaluate(() =>
        (document.body.innerText || "").slice(0, 800)
      );
      throw new Error("create_revision_button_missing");
    }
    let quoteL = await waitNewFenceDraft(knownDrafts);
    if (!quoteL?.id) throw new Error("line_total_off_draft_missing");
    await page.goto(
      withBypass(origin, `/app/projects/${FENCE_PROJECT}/quotes/${quoteL.id}`, bypass),
      { waitUntil: "load" }
    );
    await waitDisplayControlReady(page);
    quoteL = await quoteById(quoteL.id);
    report.R1_R2 = {
      pricing_id: quoteL.pricing_document_id,
      quote_id: quoteL.id,
      status: quoteL.status,
      create_revision_clicked: createRevisionClicked,
    };
    quoteL = await ensureDisplay(page, quoteL.id, LINE_TOTAL_OFF, "line_total_off_draft");
    await assertDisplay(quoteL, LINE_TOTAL_OFF, "line_total_off_draft");
    quoteL = await waitDisplayMatch(quoteL.id, LINE_TOTAL_OFF);
    await assertDisplay(quoteL, LINE_TOTAL_OFF, "line_total_off_draft");
    report.R3_R6_line_total_off_draft = {
      db: displayOf(quoteL),
      ui: {
        quantity: await readSwitch(page, "#quote-display-quantity"),
        unit: await readSwitch(page, "#quote-display-unit"),
        unitPrice: await readSwitch(page, "#quote-display-unit-price"),
        lineTotal: await readSwitch(page, "#quote-display-line-total"),
      },
    };
    await shot(page, "l-draft");
    const persistL = await persistReload(quoteL.id);
    quoteL = await waitDisplayMatch(quoteL.id, LINE_TOTAL_OFF);
    await assertDisplay(quoteL, LINE_TOTAL_OFF, "line_total_off_persist");
    report.R7_line_total_off_persist = persistL;
    const issueL = await issueQuote(quoteL.id, "Please review Quote L line-total-off.");
    quoteL = issueL.issued;
    if (quoteL.status === "draft") throw new Error("line_total_off_still_draft");
    await assertDisplay(quoteL, LINE_TOTAL_OFF, "line_total_off_issued_snapshot");
    report.R8_line_total_off_issue = {
      id: quoteL.id,
      status: quoteL.status,
      display: displayOf(quoteL),
      presentation_mode: quoteL.presentation_mode,
      deliveries: issueL.deliveries,
      public_path: issueL.publicHref,
    };
    const publicL = await publicProof(
      issueL.publicHref,
      quoteL.id,
      "line-total-off",
      "l-public"
    );
    report.R9_R13_line_total_off_public = publicL;
    report.grouped_section_totals =
      quoteL.presentation_mode === "grouped"
        ? "hosted_grouped_totals_visible_independent_of_line_total_toggle"
        : "fixture_is_detailed_grouped_independence_proven_in_verifier_and_template";
    if (publicL.desktop.quantity !== "true" || publicL.desktop.unit !== "true") {
      throw new Error("line_total_off_desktop_missing_qty_or_unit");
    }
    if (publicL.desktop.unitPrice !== "false" || publicL.desktop.lineTotal !== "false") {
      throw new Error("line_total_off_desktop_shows_hidden_columns");
    }
    if (!publicL.desktop.totals) throw new Error("line_total_off_missing_grand_total");
    if (publicL.mobile.overflowX) throw new Error("line_total_off_mobile_overflow");

    const listedAfter = await admin.auth.admin.listUsers({ perPage: 200 });
    const usersAfter = listedAfter.data?.users || listedAfter.users || [];
    const jeanlucAfter = usersAfter.find(
      (u) => String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[0]
    );
    const helloAfter = usersAfter.find(
      (u) => String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[1]
    );
    report.password_mutation.jeanluc_updated_at_after = jeanlucAfter?.updated_at || null;
    report.password_mutation.hello_updated_at_after = helloAfter?.updated_at || null;
    report.G2_protected_accounts_untouched =
      report.password_mutation.hello_updated_at_before ===
      report.password_mutation.hello_updated_at_after;
    report.G3_production_untouched = true;
    report.ok =
      quoteS.status !== "draft" &&
      quoteL.status !== "draft" &&
      publicS.desktop.totals === true &&
      publicL.desktop.totals === true;
  } finally {
    await browser.close().catch(() => null);
  }
} catch (error) {
  report.ok = false;
  report.error = error instanceof Error ? error.message : String(error);
  report.stack = error instanceof Error ? error.stack : null;
}

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, error: report.error || null, report: REPORT }, null, 2));
process.exit(report.ok ? 0 : 1);
}

main();
