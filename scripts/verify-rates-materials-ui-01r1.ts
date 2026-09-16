/**
 * RATES-MATERIALS-UI-01R1 — prove the live Rates → Materials route wiring.
 *
 * Run: npx --yes tsx scripts/verify-rates-materials-ui-01r1.ts
 */
import { readFileSync } from "node:fs";

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
  return readFileSync(path, "utf8");
}

console.log("=== RATES-MATERIALS-UI-01R1 live route wiring ===\n");

const ratesPageServer = read("app/(protected)/app/rates/page.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");
const ratesNonDefault = read("components/rates/RatesNonDefaultSections.tsx");
const materialsUi = read("components/rates/MaterialsByProductFamily.tsx");
const specificSection = read("components/rates/SpecificMaterialRatesSection.tsx");
const harnessLayout = read("app/materials-ui-browser-qa/layout.tsx");
const harnessPage = read("app/materials-ui-browser-qa/page.tsx");

const materialsBranch =
  ratesNonDefault.match(
    /if \(view === "materials"\) \{([\s\S]*?)(?=\n  if \(view === |\n  if \(activeSection === |\n  return null;)/
  )?.[1] ?? "";

check(
  "authenticated rates page mounts RatesPageContent",
  ratesPageServer.includes('from "@/components/rates/RatesPageContent"') &&
    ratesPageServer.includes("<RatesPageContent")
);
check(
  "RatesPageContent loads RatesNonDefaultSections for non-default tabs",
  ratesPage.includes("<RatesNonDefaultSections") &&
    ratesPage.includes('import("./RatesNonDefaultSections")') &&
    ratesPage.includes('viewFor(activeSection)') &&
    ratesPage.includes('if (section === "work_types") return "materials"')
);
check(
  "Materials tab branch renders MaterialsByProductFamily with live state",
  materialsBranch.includes("<MaterialsByProductFamily") &&
    materialsBranch.includes("data-rates-materials-live") &&
    materialsBranch.includes("rates={state.rates}") &&
    materialsBranch.includes("readOnly={!state.canManageRates}") &&
    materialsBranch.includes("onRatesChange={onRatesChange}") &&
    materialsBranch.includes("companyGrossMarginPercent={companyGrossMarginPercent}")
);
check(
  "Materials tab does not mount legacy RatesTableSection list",
  materialsBranch.length > 0 &&
    !materialsBranch.includes("RatesTableSection") &&
    !materialsBranch.includes("materialQuery") &&
    !materialsBranch.includes('placeholder="Search rates"') &&
    !materialsBranch.includes("filteredMaterialGroups")
);
check(
  "one ordinary Materials renderer marker",
  (ratesNonDefault.match(/data-rates-materials-live/g) ?? []).length === 1 &&
    (ratesNonDefault.match(/<MaterialsByProductFamily/g) ?? []).length === 1
);
check(
  "SpecificMaterialRatesSection is no longer a competing RatesTable list",
  specificSection.includes("<MaterialsByProductFamily") &&
    !specificSection.includes("<RatesTableSection")
);
check(
  "QA harness remains gated and is not the Rates route",
  harnessLayout.includes('MATERIALS_UI_BROWSER_QA !== "1"') &&
    harnessLayout.includes("notFound()") &&
    harnessPage.includes("<MaterialsByProductFamily") &&
    !ratesPageServer.includes("materials-ui-browser-qa") &&
    !ratesPage.includes("materials-ui-browser-qa")
);
check(
  "live Materials controls exist on the real component",
  materialsUi.includes('aria-label="Search materials"') &&
    materialsUi.includes('aria-label="Filter by category"') &&
    materialsUi.includes('aria-label="Filter by work area"') &&
    materialsUi.includes('aria-label="Filter by material status"') &&
    materialsUi.includes("Expand all") &&
    materialsUi.includes("data-materials-family") &&
    materialsUi.includes("data-materials-by-product-family")
);
check(
  "Add/Edit targets catalogueEntry.item_key via RateEditDialog",
  materialsUi.includes("catalogueEntry={editingItem.catalogueEntry}") &&
    materialsUi.includes("item_key: editingItem.catalogueEntry.item_key") &&
    materialsUi.includes("upsertRate")
);
check(
  "Productivity path still separate from Materials branch",
  ratesNonDefault.includes("<ProductivityByWorkArea") &&
    !materialsBranch.includes("ProductivityByWorkArea") &&
    ratesPage.includes('{ id: "core", label: "Labour & Productivity" }')
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
