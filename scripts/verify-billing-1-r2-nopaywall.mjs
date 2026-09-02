/**
 * BILLING-1-R2 no-paywall live Preview check.
 * Existing fixture org must have no org_subscriptions row.
 * Does not run Analyse (no paid AI). Never prints secrets.
 *
 * Usage: node scripts/verify-billing-1-r2-nopaywall.mjs [unique-preview-origin]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const STABLE =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const UNIQUE = (process.argv[2] || STABLE).replace(/\/$/, "");
const ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";
const PROJECT_ID = "a623626f-4e66-44b3-b8ed-c25495fd3457";
const PRICING_ID = "816a1245-88da-4681-b877-4a2fd8ba34bd";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SHOT_DIR = path.join(ROOT, ".tmp-billing-1-r2");
const PAYWALL_RE =
  /upgrade to (builder|business)|subscribe now|billing required|trial expired|choose a plan|paywall/i;
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
  console.error(`[billing-1-r2-nopaywall] ${message}`);
  process.exit(1);
}

function assertNoPaywall(text, label) {
  if (PAYWALL_RE.test(text)) {
    fail(`Paywall copy on ${label}.`);
  }
}

const previewEnv = parseEnvFile(path.join(ROOT, ".env.local"));
const productionEnv = parseEnvFile(path.join(ROOT, ".env.production.local"));
if (!previewEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PREVIEW_REF)) {
  fail("Not Preview ref.");
}
if (!productionEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_REF)) {
  fail("Production env mismatch.");
}
const bypass = previewEnv.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (!bypass) fail("Bypass missing.");
const recipientEmail = previewEnv.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim();
if (!recipientEmail) fail("Recipient email missing.");

const preview = createClient(
  previewEnv.NEXT_PUBLIC_SUPABASE_URL,
  previewEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { count: subCount, error: subError } = await preview
  .from("org_subscriptions")
  .select("id", { count: "exact", head: true })
  .eq("org_id", ORG_ID);
if (subError) fail("Could not count fixture org_subscriptions.");
if ((subCount ?? 0) > 0) {
  fail("Fixture org has an org_subscriptions row; no-paywall proof requires none.");
}

const stamp = Date.now();
const password = `Billing1r2np-${stamp}-Aa`;
const { data: ownerProfile } = await preview
  .from("profiles")
  .select("id")
  .eq("org_id", ORG_ID)
  .eq("role", "owner")
  .maybeSingle();
if (!ownerProfile?.id) fail("Fixture owner missing.");
const owner = await preview.auth.admin.getUserById(ownerProfile.id);
if (owner.error || !owner.data.user?.email) fail("Owner email missing.");
const updated = await preview.auth.admin.updateUserById(ownerProfile.id, {
  password,
});
if (updated.error) fail("Password reset failed.");

fs.mkdirSync(SHOT_DIR, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--window-size=1600,1200"],
  defaultViewport: { width: 1600, height: 1200 },
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);
await page.setUserAgent(HUMAN_UA);
await page.setExtraHTTPHeaders({
  "x-vercel-protection-bypass": bypass,
});
await page.evaluateOnNewDocument(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const text = await response.clone().text();
      const match = text.match(/qt_[A-Za-z0-9_-]{43}/);
      if (match) window.__b1r2PublicToken = match[0];
    } catch {
      // Ignore.
    }
    return response;
  };
});

function withBypass(pathname) {
  const url = new URL(pathname, UNIQUE);
  url.searchParams.set("x-vercel-protection-bypass", bypass);
  return url.toString();
}

async function clickText(text) {
  const clicked = await page.waitForFunction(
    (needle) => {
      const nodes = Array.from(
        document.querySelectorAll("button, a, [role='button']")
      );
      const el = nodes.find((node) => (node.textContent || "").trim() === needle);
      if (!(el instanceof HTMLElement)) return false;
      el.click();
      return true;
    },
    { timeout: 20000 },
    text
  );
  if (!clicked) throw new Error(`clickText missing: ${text}`);
}

async function clickVisibleExact(label) {
  const clicked = await page.evaluate((needle) => {
    const nodes = Array.from(
      document.querySelectorAll("button, a, [role='button']")
    );
    const el = nodes.find((node) => {
      if ((node.textContent || "").trim() !== needle) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!(el instanceof HTMLElement)) return false;
    el.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`clickVisibleExact missing: ${label}`);
}

async function dump(label) {
  const text = await page.evaluate(() => document.body.innerText);
  const pathname = await page.evaluate(() => location.pathname);
  fs.writeFileSync(path.join(SHOT_DIR, `${label}.txt`), `${pathname}\n\n${text}`, "utf8");
  await page.screenshot({
    path: path.join(SHOT_DIR, `${label}.png`),
    fullPage: true,
  });
  return text;
}

const report = {
  org_subscriptions: subCount,
  project: "pending",
  estimate: "pending",
  pricing: "pending",
  quote: "pending",
  send: "pending",
  accept: "pending",
};

try {
  await page.goto(withBypass("/login"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email");
  await page.type("#email", owner.data.user.email);
  await page.type("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith("/app"), {
    timeout: 60000,
  });

  await page.goto(withBypass("/app/dashboard"), { waitUntil: "networkidle2" });
  assertNoPaywall(await page.evaluate(() => document.body.innerText), "dashboard");
  await clickVisibleExact("New project");
  await page.waitForSelector("#project-title");
  await page.type("#project-title", `BILLING-1-R2 ${stamp}`);
  const createBtn = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll("button")).find((b) =>
      /Create project|Create$/i.test((b.textContent || "").trim())
    )
  );
  const createEl = createBtn.asElement();
  if (!createEl) fail("Create project button missing.");
  await createEl.click();
  await page.waitForFunction(
    () => location.pathname.includes("/app/projects/"),
    { timeout: 30000 }
  );
  report.project = "created";
  assertNoPaywall(await page.evaluate(() => document.body.innerText), "new project");
  await page.screenshot({
    path: path.join(SHOT_DIR, "nopaywall-project.png"),
    fullPage: true,
  });

  await page.goto(withBypass(`/app/projects/${PROJECT_ID}`), {
    waitUntil: "networkidle2",
  });
  const projectText = await page.evaluate(() => document.body.innerText);
  assertNoPaywall(projectText, "existing project");
  if (!/Estimate|Pricing|Quote/i.test(projectText)) {
    fail("Existing project did not show Estimate/Pricing/Quote surfaces.");
  }
  report.estimate = "existing_project_estimate_surface_visible";

  await page.goto(withBypass(`/app/projects/${PROJECT_ID}/pricing/${PRICING_ID}`), {
    waitUntil: "networkidle2",
  });
  const pricingText = await dump("nopaywall-pricing");
  assertNoPaywall(pricingText, "pricing");
  report.pricing = "opened";

  const needsReview = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).some((el) =>
      /^Mark as reviewed$/i.test((el.textContent || "").trim())
    )
  );
  if (needsReview) {
    await page.evaluate(() => {
      const box = document.querySelector('[role="checkbox"]');
      if (box instanceof HTMLElement) box.click();
    });
    await clickVisibleExact("Mark as reviewed");
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).some((el) =>
          /^Mark as reviewed$/i.test((el.textContent || "").trim())
        ),
      { timeout: 30000 }
    );
    report.pricing = "marked_reviewed";
  }

  const quoteAction = await page.evaluate(() => {
    const labels = Array.from(
      document.querySelectorAll("button, a, [role='button']")
    ).map((el) => (el.textContent || "").trim());
    if (labels.some((label) => /^Create quote$/i.test(label))) return "create";
    if (labels.some((label) => /^Open quote$/i.test(label))) return "open";
    return "missing";
  });
  if (quoteAction === "missing") fail("Pricing page had neither Create quote nor Open quote.");
  await clickVisibleExact(quoteAction === "open" ? "Open quote" : "Create quote");
  await page.waitForFunction(
    () => /\/quotes\//.test(location.pathname),
    { timeout: 45000 }
  );
  const quotePath = await page.evaluate(() => location.pathname);
  const quoteId = (quotePath.match(/\/quotes\/([0-9a-f-]{36})/i) || [])[1];
  if (!quoteId) fail("Quote navigation did not land on a quote.");
  report.quote = quoteAction === "open" ? "opened_existing" : "created";
  assertNoPaywall(await dump("nopaywall-quote"), "quote");

  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button, a, [role='button']")).some(
        (el) => {
          const label = (el.textContent || "").trim();
          return /^Send quote$/i.test(label) || /^Create revision$/i.test(label);
        }
      ),
    { timeout: 30000 }
  );
  const quoteButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a, [role='button']")).map(
      (el) => (el.textContent || "").trim()
    )
  );
  if (!quoteButtons.some((label) => /^Send quote$/i.test(label))) {
    if (!quoteButtons.some((label) => /^Create revision$/i.test(label))) {
      fail("Quote page had neither Send quote nor Create revision.");
    }
    const beforePath = await page.evaluate(() => location.pathname);
    await clickVisibleExact("Create revision");
    await page.waitForFunction(
      (prev) => {
        const moved =
          /\/quotes\//.test(location.pathname) && location.pathname !== prev;
        const sendReady = Array.from(
          document.querySelectorAll("button, a, [role='button']")
        ).some((el) => /^Send quote$/i.test((el.textContent || "").trim()));
        const alert = document.querySelector("[role='alert']");
        return moved || sendReady || Boolean(alert && alert.textContent?.trim());
      },
      { timeout: 60000 },
      beforePath
    );
    const alertText = await page.evaluate(
      () => document.querySelector("[role='alert']")?.textContent?.trim() ?? ""
    );
    if (alertText) fail(`Create revision failed: ${alertText}`);
    report.quote = "revision_created";
    assertNoPaywall(await dump("nopaywall-revision"), "revision");
  }

  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button, a, [role='button']")).some(
        (el) => /^Send quote$/i.test((el.textContent || "").trim())
      ),
    { timeout: 30000 }
  );
  await clickVisibleExact("Send quote");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#quote-send-email")).some(
        (node) => node instanceof HTMLElement && node.getClientRects().length > 0
      ),
    { timeout: 20000 }
  );
  await page.evaluate(
    (email) => {
      const el = Array.from(document.querySelectorAll("#quote-send-email")).find(
        (node) => node instanceof HTMLInputElement && node.getClientRects().length > 0
      );
      if (!(el instanceof HTMLInputElement)) return;
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      proto?.set?.call(el, email);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    recipientEmail
  );
  await page.evaluate(() => {
    const emails = Array.from(document.querySelectorAll("#quote-send-email"));
    const email = emails.find(
      (node) => node instanceof HTMLElement && node.getClientRects().length > 0
    );
    let root = email?.parentElement ?? null;
    while (root) {
      const btn = Array.from(root.querySelectorAll("button")).find((node) =>
        /^Send quote$/i.test((node.textContent || "").trim())
      );
      if (btn) {
        btn.setAttribute("data-b1r2-confirm", "1");
        break;
      }
      root = root.parentElement;
    }
  });
  await page.$eval("[data-b1r2-confirm='1']", (el) => {
    if (el instanceof HTMLElement) el.click();
  });

  const sendDeadline = Date.now() + 90000;
  let sendText = "";
  while (Date.now() < sendDeadline) {
    sendText = await page.evaluate(() => document.body.innerText);
    if (/Quote sent to |already in progress|Email submitted/i.test(sendText)) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (!/Quote sent to |already in progress|Email submitted/i.test(sendText)) {
    fail("Send did not confirm.");
  }
  report.send = "sent";
  assertNoPaywall(sendText, "after send");

  let publicPath = await page.evaluate(() =>
    typeof window.__b1r2PublicToken === "string"
      ? `/q/${window.__b1r2PublicToken}`
      : null
  );
  const tokenDeadline = Date.now() + 15000;
  while (!publicPath && Date.now() < tokenDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    publicPath = await page.evaluate(() =>
      typeof window.__b1r2PublicToken === "string"
        ? `/q/${window.__b1r2PublicToken}`
        : null
    );
  }
  if (!publicPath) fail("Public quote path missing.");
  await page.goto(withBypass(publicPath), { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => /Accept quote/i.test(document.body.innerText),
    { timeout: 30000 }
  );
  assertNoPaywall(await page.evaluate(() => document.body.innerText), "public quote");
  await clickVisibleExact("Accept quote");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#quote-accept-name")).some(
        (node) => node instanceof HTMLElement && node.getClientRects().length > 0
      ),
    { timeout: 20000 }
  );
  await page.evaluate((email) => {
    const fill = (id, value) => {
      const el = Array.from(document.querySelectorAll(`#${id}`)).find(
        (node) => node instanceof HTMLInputElement && node.getClientRects().length > 0
      );
      if (!(el instanceof HTMLInputElement)) return;
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      proto?.set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    fill("quote-accept-name", "Preview Client");
    fill("quote-accept-email", email);
    const names = Array.from(document.querySelectorAll("#quote-accept-name"));
    const name = names.find(
      (node) => node instanceof HTMLElement && node.getClientRects().length > 0
    );
    let root = name?.parentElement ?? null;
    while (root) {
      const box = root.querySelector("input[type='checkbox']");
      if (box instanceof HTMLInputElement) {
        if (!box.checked) box.click();
        break;
      }
      root = root.parentElement;
    }
  }, recipientEmail);
  const acceptMarked = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#quote-accept-name"));
    const name = names.find(
      (node) => node instanceof HTMLElement && node.getClientRects().length > 0
    );
    if (!(name instanceof HTMLElement)) return false;
    let root = name.parentElement;
    while (root) {
      const hasForm =
        /Your name/i.test(root.innerText) && /Your email/i.test(root.innerText);
      const btn = Array.from(root.querySelectorAll("button")).find((node) =>
        /^Accept quote$/i.test((node.textContent || "").trim())
      );
      if (hasForm && btn instanceof HTMLElement && btn.getClientRects().length > 0) {
        btn.setAttribute("data-b1r2-accept", "1");
        return true;
      }
      root = root.parentElement;
    }
    return false;
  });
  if (!acceptMarked) fail("Accept form confirm button missing.");
  await page.$eval("[data-b1r2-accept='1']", (el) => {
    if (el instanceof HTMLElement) el.click();
  });
  await page.waitForFunction(
    () => /accepted|Thank you|already/i.test(document.body.innerText),
    { timeout: 60000 }
  );
  report.accept = "accepted";
  assertNoPaywall(await page.evaluate(() => document.body.innerText), "accepted quote");

  const { count: subAfter } = await preview
    .from("org_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ORG_ID);
  report.org_subscriptions_after = subAfter;
  if ((subAfter ?? 0) > 0) fail("No-paywall flow wrote an org_subscriptions row.");

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} catch (error) {
  try {
    await dump("nopaywall-error");
  } catch {
    // Ignore dump failures.
  }
  fail(error instanceof Error ? error.message : "No-paywall check failed.");
} finally {
  await browser.close();
}
