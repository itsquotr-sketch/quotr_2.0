/**
 * ONBOARDING-01-R1 — the company step's last field and Continue stay reachable
 * inside a short viewport. The document stays locked; the form scrolls.
 *
 * Run: npx --yes tsx scripts/verify-onboarding-01-r1-scroll.ts
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright";

const require = createRequire(import.meta.url);
const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return require("node:fs").readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function bundle(outfile: string): Promise<void> {
  const stub = (name: string) => join(root, "scripts/onboarding-scroll-stubs", name);
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        "esbuild",
        join(root, "scripts/onboarding-scroll-harness.tsx"),
        "--bundle",
        "--format=iife",
        "--platform=browser",
        "--jsx=automatic",
        `--outfile=${outfile}`,
        `--alias:@=${root}`,
        `--alias:next/navigation=${stub("navigation.ts")}`,
        `--alias:next/image=${stub("next-image.tsx")}`,
        `--alias:next/link=${stub("next-link.tsx")}`,
        `--alias:@/lib/setup/actions=${stub("setup-actions.ts")}`,
        `--alias:@/app/(auth)/actions=${stub("auth-actions.ts")}`,
        "--define:process.env.NODE_ENV=\\\"production\\\"",
      ],
      { cwd: root, stdio: "inherit", shell: true }
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`esbuild exited ${code}`))
    );
  });
}

async function compileCss(): Promise<string> {
  const postcss = require("postcss") as typeof import("postcss");
  const tailwind = require("@tailwindcss/postcss") as { default?: () => unknown };
  const plugin = typeof tailwind === "function" ? tailwind : tailwind.default;
  const from = join(root, "app/globals.css");
  const result = await postcss([plugin()]).process(
    require("node:fs").readFileSync(from, "utf8"),
    { from }
  );
  return result.css;
}

type Reach = {
  overflows: boolean;
  buttonInView: boolean;
  taxInView: boolean;
  headerTop: number;
  headerVisible: boolean;
  docScroll: number;
  formScroll: number;
  paddingBottom: number;
  buttonBottom: number;
  viewportHeight: number;
};

async function showGst(page: Page) {
  await page.locator("#basics-gst-yes").click();
  await page.locator("#basics-tax-id").waitFor();
}

async function measure(page: Page): Promise<Reach> {
  await showGst(page);
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const button = document.getElementById("basics-continue");
    const tax = document.getElementById("basics-tax-id");
    const scroll = [...document.querySelectorAll("div")].find((el) => {
      const style = getComputedStyle(el);
      return style.overflowY === "auto" || style.overflowY === "scroll";
    });
    if (!header || !button || !tax || !scroll) {
      return {
        overflows: false,
        buttonInView: false,
        taxInView: false,
        headerTop: -1,
        headerVisible: false,
        docScroll: -1,
        formScroll: -1,
        paddingBottom: 0,
        buttonBottom: 0,
        viewportHeight: window.innerHeight,
      };
    }
    const headerBottom = header.getBoundingClientRect().bottom;
    const inner = scroll.firstElementChild;
    const paddingBottom = inner
      ? Number.parseFloat(getComputedStyle(inner).paddingBottom) || 0
      : 0;
    tax.scrollIntoView({ block: "nearest" });
    const taxRect = tax.getBoundingClientRect();
    const taxInView =
      taxRect.height > 0 &&
      taxRect.top >= headerBottom - 1 &&
      taxRect.bottom <= window.innerHeight + 1;
    button.scrollIntoView({ block: "end" });
    const buttonRect = button.getBoundingClientRect();
    const buttonInView =
      buttonRect.height > 0 &&
      buttonRect.top >= headerBottom - 1 &&
      buttonRect.bottom <= window.innerHeight + 1;
    return {
      overflows: scroll.scrollHeight > scroll.clientHeight + 8,
      buttonInView,
      taxInView,
      headerTop: Math.round(header.getBoundingClientRect().top),
      headerVisible: header.getBoundingClientRect().height >= 40,
      docScroll: document.scrollingElement?.scrollTop ?? 0,
      formScroll: scroll.scrollTop,
      paddingBottom: Math.round(paddingBottom),
      buttonBottom: Math.round(button.getBoundingClientRect().bottom),
      viewportHeight: window.innerHeight,
    };
  });
}

async function main(): Promise<void> {
  console.log("\nONBOARDING-01-R1 setup scroll");
  const frame = read("components/setup/OnboardingFrame.tsx");
  const shell = read("components/setup/SetupShell.tsx");
  const body = read("app/layout.tsx");
  const gate = read("app/(protected)/app/layout.tsx");
  const profile = read("components/setup/RequiredCompanyProfileStep.tsx");
  const labour = read("components/setup/LabourCostsStep.tsx");

  check(
    "1 body still locks the document on desktop",
    body.includes("md:h-dvh md:overflow-hidden")
  );
  check(
    "2 onboarding frame is the viewport column",
    frame.includes("flex h-dvh min-h-0 flex-col overflow-hidden") &&
      frame.includes("h-12 shrink-0") &&
      frame.includes("onboardingLocked: true")
  );
  check(
    "3 setup form is the only scrollport, with end padding",
    shell.includes("onboardingFormScrollClass") &&
      shell.includes("onboardingFormEndPadding") &&
      shell.includes('className="flex min-h-0 flex-1 flex-col overflow-hidden"') &&
      !shell.includes("overflow-y-auto")
  );
  check(
    "4 route gate still renders the focused frame",
    gate.includes("OnboardingFrame") &&
      gate.includes("isRequiredOnboardingAllowedPath")
  );
  check(
    "5 validation focuses the field without clearing typed values",
    profile.includes("useFocusOnboardingError") &&
      profile.includes('id="basics-continue"') &&
      profile.includes("setTradingName(event.target.value)") &&
      !profile.includes('setTradingName("")') &&
      labour.includes("useFocusOnboardingError") &&
      labour.includes('id="labour-continue"')
  );

  const dir = await mkdtemp(join(tmpdir(), "quotr-onboarding-scroll-"));
  const bundlePath = join(dir, "harness.js");
  const css = await compileCss();
  await bundle(bundlePath);
  const script = await readFile(bundlePath, "utf8");
  const html = `<!doctype html><html class="h-full"><head><style>${css}</style></head><body class="min-h-dvh font-sans md:h-dvh md:overflow-hidden"><div id="root"></div><script>${script}</script></body></html>`;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.locator("#basics-trading-name").waitFor();

  const viewports: Array<{
    name: string;
    width: number;
    height: number;
    mustOverflow: boolean;
    minPadding: number;
  }> = [
    { name: "desktop 1440x900", width: 1440, height: 900, mustOverflow: false, minPadding: 90 },
    { name: "short desktop 1366x768", width: 1366, height: 768, mustOverflow: true, minPadding: 90 },
    { name: "tablet 768x1024", width: 768, height: 1024, mustOverflow: false, minPadding: 90 },
    { name: "phone 390x844", width: 390, height: 844, mustOverflow: true, minPadding: 300 },
    { name: "200% zoom 720x450", width: 720, height: 450, mustOverflow: true, minPadding: 180 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const reach = await measure(page);
    check(
      `6 ${viewport.name}: GST field and Continue fit in the viewport`,
      reach.taxInView &&
        reach.buttonInView &&
        reach.headerTop === 0 &&
        reach.headerVisible &&
        reach.docScroll === 0 &&
        reach.buttonBottom <= reach.viewportHeight + 1 &&
        (!viewport.mustOverflow || (reach.overflows && reach.formScroll > 0)),
      JSON.stringify(reach)
    );
    check(
      `7 ${viewport.name}: end padding keeps the action clear`,
      reach.paddingBottom >= viewport.minPadding,
      `padding ${reach.paddingBottom}`
    );
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator("#basics-trading-name").click();
  await page.locator("#basics-trading-name").fill("Harbour Joinery");
  await page.locator("#basics-country").selectOption("NZ");
  await page.locator("#basics-address-1").fill("12 Wharf Street");
  await page.locator("#basics-city").fill("Wellington");
  await page.locator("#basics-postcode").fill("6011");
  await showGst(page);
  await page.locator("#basics-tax-id").fill("bad");

  const tabIds: string[] = [];
  await page.locator("#basics-trading-name").focus();
  for (let i = 0; i < 16; i += 1) {
    const id = await page.evaluate(() =>
      document.activeElement instanceof HTMLElement ? document.activeElement.id : ""
    );
    if (id.startsWith("basics-") && !tabIds.includes(id)) tabIds.push(id);
    const inView = await page.evaluate(() => {
      const el = document.activeElement;
      const header = document.querySelector("header");
      if (!(el instanceof HTMLElement) || !header || !el.id.startsWith("basics-")) {
        return true;
      }
      const rect = el.getBoundingClientRect();
      const headerBottom = header.getBoundingClientRect().bottom;
      return rect.top >= headerBottom - 1 && rect.bottom <= window.innerHeight + 1;
    });
    if (!inView) {
      check("8 focused control stays in view while tabbing", false, id);
      break;
    }
    if (id === "basics-continue") break;
    await page.keyboard.press("Tab");
  }
  check(
    "8 tab order reaches every company field and Continue",
    ["basics-trading-name", "basics-country", "basics-address-1", "basics-city", "basics-postcode", "basics-gst-yes", "basics-tax-id", "basics-continue"].every(
      (id) => tabIds.includes(id)
    ),
    tabIds.join(",")
  );

  await page.locator("#basics-continue").click();
  await page.waitForFunction(
    () => document.activeElement instanceof HTMLElement && document.activeElement.id === "basics-tax-id"
  );
  const afterError = await page.evaluate(() => {
    const tax = document.getElementById("basics-tax-id");
    const name = document.getElementById("basics-trading-name");
    const header = document.querySelector("header");
    if (!tax || !name || !header) return null;
    const rect = tax.getBoundingClientRect();
    const headerBottom = header.getBoundingClientRect().bottom;
    return {
      name: (name as HTMLInputElement).value,
      tax: (tax as HTMLInputElement).value,
      inView: rect.top >= headerBottom - 1 && rect.bottom <= window.innerHeight + 1,
      message: document.querySelector("[data-onboarding-field-error='basics-tax-id']")?.textContent ?? "",
    };
  });
  check(
    "9 GST error scrolls into view and typed values stay",
    afterError?.inView === true &&
      afterError.name === "Harbour Joinery" &&
      afterError.tax === "bad" &&
      afterError.message.includes("GST"),
    JSON.stringify(afterError)
  );

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
