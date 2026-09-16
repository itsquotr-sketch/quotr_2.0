/**
 * Local Chromium visual QA for Materials families UI.
 * Run with next dev already serving MATERIALS_UI_BROWSER_QA=1.
 *
 * Usage:
 *   MATERIALS_UI_BROWSER_QA=1 npm run dev
 *   npx --yes tsx scripts/visual-qa-materials-ui.ts
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.MATERIALS_UI_QA_ORIGIN ?? "http://localhost:3000";
const PATH = "/materials-ui-browser-qa";

type Viewport = { name: string; width: number; height: number };

const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function measureOverflow(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  overflow: boolean;
}> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const scrollWidth = doc.scrollWidth;
    const clientWidth = doc.clientWidth;
    return {
      scrollWidth,
      clientWidth,
      overflow: scrollWidth > clientWidth + 1,
    };
  });
}

async function run(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const results: string[] = [];
  let failed = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const response = await page.goto(`${BASE}${PATH}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const status = response?.status() ?? 0;
    const root = page.locator("[data-materials-by-product-family]");
    const rootCount = await root.count();
    const categoriesBefore = await page.locator("[data-materials-category]").count();
    const search = page.getByLabel("Search materials");
    await search.click();
    await search.fill("");
    await search.type("Braceline", { delay: 20 });
    await page.waitForTimeout(400);
    const bracelineVisible = await page
      .locator('[data-materials-family="gib-braceline"]')
      .count();
    const plasterboardOpen = await page
      .locator('[data-materials-category="plasterboard"] [data-materials-family]')
      .count();
    await search.fill("");
    await page.getByRole("button", { name: "Expand all" }).click();
    await page.waitForTimeout(400);
    const openFamilies = await page.locator("[data-materials-family]").count();
    const variantRows = await page.locator("[data-materials-key]").count();
    const overflow = await measureOverflow(page);
    const touch = await page.evaluate((isNarrow) => {
      if (!isNarrow) return true;
      const buttons = [...document.querySelectorAll("button")];
      return buttons
        .slice(0, 30)
        .every((button) => button.getBoundingClientRect().height >= 44);
    }, viewport.width < 640);

    const ok =
      status === 200 &&
      rootCount === 1 &&
      categoriesBefore > 0 &&
      bracelineVisible > 0 &&
      plasterboardOpen > 0 &&
      openFamilies > 0 &&
      variantRows > 0 &&
      !overflow.overflow &&
      touch;

    if (!ok) failed += 1;
    results.push(
      [
        `${ok ? "PASS" : "FAIL"} ${viewport.name} ${viewport.width}x${viewport.height}`,
        `status=${status}`,
        `categories=${categoriesBefore}`,
        `braceline=${bracelineVisible}`,
        `familiesAfterExpand=${openFamilies}`,
        `variants=${variantRows}`,
        `overflow=${overflow.overflow} (${overflow.scrollWidth}/${overflow.clientWidth})`,
        `touchOk=${touch}`,
      ].join(" | ")
    );
    await page.close();
  }

  await browser.close();
  for (const line of results) console.log(line);
  console.log(
    failed === 0
      ? `\nMATERIALS UI VISUAL QA: ${VIEWPORTS.length} viewports passed`
      : `\nMATERIALS UI VISUAL QA: ${failed} viewport(s) failed`
  );
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
