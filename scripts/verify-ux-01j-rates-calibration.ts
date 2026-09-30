/**
 * UX-01J.1 — Rates and Calibration information architecture.
 *
 * Run: npx --yes tsx scripts/verify-ux-01j-rates-calibration.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { buildRatesWorkspaceSummary, labourRatesCatalogue } from "../lib/rates/rates-workspace-summary";
import { parseRatesSection } from "../lib/setup/recommendation-destinations";

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

console.log("=== UX-01J.1 Rates and Calibration ===\n");

const page = read("components/rates/RatesPageContent.tsx");
const server = read("app/(protected)/app/rates/page.tsx");
const sections = read("components/rates/RatesNonDefaultSections.tsx");
const overview = read("components/rates/RatesOverview.tsx");
const calibration = read("components/rates/RatesCalibrationPanel.tsx");
const access = read("components/rates/RatesCalibrationAccess.tsx");
const table = read("components/rates/RatesTableSection.tsx");
const dialog = read("components/rates/RateEditDialog.tsx");
const summary = read("lib/rates/rates-workspace-summary.ts");
const materials = read("components/rates/MaterialsByProductFamily.tsx");
const productivity = read("components/rates/ProductivityByWorkArea.tsx");

check(
  "landing is Overview and existing section URLs still parse",
  server.includes('parseRatesSection(params.section) ?? "overview"') &&
    parseRatesSection("overview") === "overview" &&
    parseRatesSection("materials") === "materials" &&
    parseRatesSection("labour") === "labour" &&
    parseRatesSection("core") === "core" &&
    parseRatesSection("productivity") === "productivity" &&
    parseRatesSection("defaults") === "defaults" &&
    parseRatesSection("calibration") === "calibration"
);
check(
  "primary sections are Materials, Labour, Productivity, Subcontract, Plant, Calibration",
  page.includes('{ id: "materials", label: "Materials" }') &&
    page.includes('{ id: "labour", label: "Labour" }') &&
    page.includes('{ id: "productivity", label: "Productivity" }') &&
    page.includes('{ id: "subcontract", label: "Subcontract" }') &&
    page.includes('{ id: "plant", label: "Plant" }') &&
    page.includes('{ id: "calibration", label: "Calibration" }') &&
    !page.includes("Labour & Productivity") &&
    !page.includes('href: "/app/setup"')
);
check(
  "core deep link opens Labour; productivity is its own view",
  page.includes('if (section === "core") return "labour"') &&
    page.includes('if (section === "work_types") return "materials"') &&
    sections.includes('view === "labour" || view === "core"') &&
    sections.includes('view === "productivity"') &&
    sections.includes("<ProductivityByWorkArea") &&
    sections.includes("labourRatesCatalogue()")
);
check(
  "carpenter and labourer stay separate catalogue roles",
  labourRatesCatalogue().some((entry) => entry.item_key === "labour.carpenter.hour") &&
    labourRatesCatalogue().some((entry) => entry.item_key === "labour.labourer.hour") &&
    labourRatesCatalogue().length >= 3 &&
    !sections.includes("labour.carpenter.hour ||")
);
check(
  "materials stay on the product-family registry",
  sections.includes("<MaterialsByProductFamily") &&
    sections.includes("data-rates-materials-live") &&
    materials.includes("aria-expanded") &&
    materials.includes("data-materials-family") &&
    !materials.includes("<table")
);
check(
  "overview uses live coverage and one next action",
  overview.includes("data-rates-overview") &&
    overview.includes("Company rates") &&
    overview.includes("Quotr benchmarks") &&
    overview.includes("Pricing Required") &&
    overview.includes("nextAction.label") &&
    summary.includes("buildMaterialRegistry") &&
    summary.includes("buildProductivityRegistry") &&
    summary.includes("buildCalibrationSummary")
);
check(
  "calibration explains future estimates without a second setup flow",
  calibration.includes("does not rewrite Quotes you have already issued") &&
    calibration.includes("accepted commercial records") &&
    calibration.includes("created") &&
    calibration.includes("regenerated") &&
    calibration.includes("<CompanyDefaultsSection") &&
    calibration.includes("<RatesCalibrationAccess") &&
    access.includes("calibrationWorkAreaHref") &&
    !calibration.includes("start onboarding")
);
check(
  "subcontract and plant stay grouped, searchable, and collapsed",
  sections.includes('variant="grouped"') &&
    table.includes("groupCatalogueByWorkArea") &&
    table.includes("aria-expanded") &&
    table.includes("Search ${title}") &&
    table.includes("data-rates-compact-list") &&
    table.includes("Pricing Required") &&
    table.includes("Your rate") &&
    table.includes("Quotr benchmark") &&
    !table.includes("<table")
);
check(
  "phone edit dialog and touch targets",
  dialog.includes("max-h-[min(85dvh,40rem)]") &&
    dialog.includes("overflow-y-auto") &&
    page.includes("touchTargets") &&
    page.includes('label="Rates sections"') &&
    materials.includes("min-h-11") &&
    productivity.includes("aria-expanded")
);
check(
  "no schema migration in this phase",
  !existsSync("supabase/migrations/069_rates_calibration_ui.sql") &&
    readdirSync("supabase/migrations").every(
      (name) => !name.toLowerCase().includes("ux-01j")
    )
);

const empty = buildRatesWorkspaceSummary({
  rates: [],
  settings: null,
  preferredWorkAreaTypes: [],
});
check(
  "empty company book still reports benchmarks and pricing gaps",
  empty.coverage.benchmark > 0 &&
    empty.coverage.pricingRequired > 0 &&
    empty.coverage.company === 0 &&
    empty.nextAction.section.length > 0
);
const carpenter = empty.sections.find((section) => section.id === "labour");
check(
  "labour coverage keeps a benchmark for carpenter when unset",
  (carpenter?.benchmark ?? 0) > 0 && (carpenter?.company ?? 0) === 0
);

const seeded = buildRatesWorkspaceSummary({
  rates: [
    {
      id: "labour-carpenter",
      item_key: "labour.carpenter.hour",
      rate_type: "labour",
      label: "Carpenter",
      unit: "hour",
      cost_rate: 75,
      sell_rate: null,
      markup_percent: null,
      active: true,
      trade: "carpenter",
      work_area_type: null,
      source: null,
      source_calibration_id: null,
      updated_at: null,
    },
  ],
  settings: null,
  preferredWorkAreaTypes: [],
});
check(
  "company carpenter cost is counted as a company rate",
  seeded.coverage.company >= 1 &&
    (seeded.sections.find((section) => section.id === "labour")?.company ?? 0) === 1
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
