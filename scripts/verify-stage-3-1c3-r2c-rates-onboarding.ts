/**
 * Stage 3.1C.3-R2C — Contractor-native rates onboarding verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2c-rates-onboarding.ts
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  RATE_AUTHORITY,
  RATE_AUTHORITY_LABELS,
  companyRateAuthorityLabel,
} from "../lib/rates/authority";
import {
  buildStarterRateRows,
  CORE_LABOUR_STARTER_RATES,
  LEGACY_SCOPE_STARTER_RATES,
} from "../lib/setup/starter-rates";
import { SCOPE_RATE_CATALOGUE } from "../lib/rates/catalogue";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function migrationsHave033(): boolean {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.startsWith("033"));
}

console.log("=== Stage 3.1C.3-R2C rates onboarding verification ===\n");

section("AUTHORITY");
assert(
  "authority module exists",
  existsSync(join(process.cwd(), "lib/rates/authority.ts"))
);
assert(
  "benchmark label is Quotr benchmark",
  RATE_AUTHORITY_LABELS.BENCHMARK === "Quotr benchmark"
);
assert(
  "explicit company label",
  RATE_AUTHORITY_LABELS.EXPLICIT_COMPANY === "Your company rate"
);
assert(
  "missing cost is not Your company rate",
  companyRateAuthorityLabel({
    hasActiveCostRate: false,
    hasCatalogueBenchmark: true,
  }) === RATE_AUTHORITY_LABELS.BENCHMARK
);
assert(
  "active cost is Your company rate",
  companyRateAuthorityLabel({ hasActiveCostRate: true }) ===
    RATE_AUTHORITY_LABELS.EXPLICIT_COMPANY
);
assert(
  "legacy scope labelled overall benchmark",
  companyRateAuthorityLabel({
    hasActiveCostRate: true,
    isLegacyScopePackage: true,
  }) === RATE_AUTHORITY_LABELS.LEGACY_SCOPE_RATE
);

const calibration = read("lib/rates/calibration.ts");
assert(
  "rates UI source uses authority helper",
  /companyRateAuthorityLabel/.test(calibration)
);
assert(
  "no Your rate for empty rows in calibration helper",
  !/return "Your rate"/.test(calibration)
);

section("CONSUMERS / STARTERS");
assert(
  "core labour includes carpenter",
  CORE_LABOUR_STARTER_RATES.some((r) => r.item_key === "labour.carpenter.hour")
);
assert(
  "primary buildStarterRateRows excludes scope.deck.m2",
  !buildStarterRateRows([
    { work_area_type: "deck", enabled: true },
  ]).rows.some((r) => r.item_key === "scope.deck.m2")
);
assert(
  "deck preference yields component rates",
  buildStarterRateRows([
    { work_area_type: "deck", enabled: true },
  ]).rows.some((r) => r.section === "component" && r.item_key.includes("deck"))
);
assert(
  "legacy scope starters retained",
  Boolean(LEGACY_SCOPE_STARTER_RATES.deck?.item_key === "scope.deck.m2")
);
assert(
  "scope catalogue still present (not deleted)",
  SCOPE_RATE_CATALOGUE.some((e) => e.item_key === "scope.deck.m2")
);

const createStarter = read("lib/rates/actions.ts").slice(
  read("lib/rates/actions.ts").indexOf("createStarterRates"),
  read("lib/rates/actions.ts").indexOf("createStarterRates") + 1200
);
assert(
  "createStarterRates does not copy defaultCostRate into cost_rate",
  /cost_rate: null/.test(createStarter) &&
    !/cost_rate: entry\.defaultCostRate/.test(createStarter)
);

section("SETUP");
const ratesStep = read("components/setup/RatesStep.tsx");
assert("Setup title Set your key rates", /Set your key rates/.test(ratesStep));
assert("Do this later available", /Do this later/.test(ratesStep));
assert("Save rates CTA", /Save rates/.test(ratesStep));
assert("Manage all rates link", /Manage all rates/.test(ratesStep));
assert(
  "no Save and continue mandatory wizard",
  !/Save and continue/.test(ratesStep)
);
assert(
  "generic scope not primary Setup section",
  !/Scope starter rates/.test(ratesStep)
);
assert("cost/sell copy present", /costs your business/.test(ratesStep));

section("PREFERENCES");
assert(
  "buildStarterRateRows personalises components only",
  buildStarterRateRows([
    { work_area_type: "bathroom", enabled: true },
    { work_area_type: "deck", enabled: false },
  ]).preferredWorkTypes.includes("bathroom") &&
    !buildStarterRateRows([
      { work_area_type: "bathroom", enabled: true },
      { work_area_type: "deck", enabled: false },
    ]).rows.some((r) => r.item_key.includes("deck.material"))
);

const ratesPage = read("components/rates/RatesPageContent.tsx");
assert("Show all work types control", /Show all work types/.test(ratesPage));
assert(
  "Legacy package rates under Advanced (not primary nav)",
  /Advanced/.test(ratesPage) &&
    /Legacy package rates/.test(ratesPage) &&
    !/\{ id: "legacy", label: "Legacy benchmarks" \}/.test(ratesPage)
);
assert(
  "preferences personalise order copy",
  /personalise|preferred/i.test(ratesPage)
);

section("COST/SELL / MISSING");
const rateInput = read("components/setup/RateInputRow.tsx");
assert("Cost label clear", /Your cost/.test(rateInput));
assert(
  "Recommended charge-out shown",
  /Recommended charge-out/.test(rateInput)
);
assert(
  "Custom charge-out secondary",
  /Custom charge-out/.test(rateInput)
);
assert(
  "placeholder not fake zero authority",
  /Blank = later/.test(rateInput)
);
assert(
  "Use benchmark adopt on rates table",
  /Use benchmark cost/.test(read("components/rates/RatesTableSection.tsx"))
);

section("SECURITY / BOUNDARIES");
assert(
  "rates actions use getAuthOrgContext",
  /getAuthOrgContext/.test(read("lib/rates/actions.ts"))
);
assert(
  "migration 033 is calibration evidence only",
  migrationsHave033() &&
    read("supabase/migrations/033_calibration_responses.sql").includes(
      "calibration_responses"
    ) &&
    !read("supabase/migrations/033_calibration_responses.sql").includes(
      "alter table public.rates"
    )
);
assert(
  "no Company DNA module",
  !existsSync(join(process.cwd(), "lib/company-dna"))
);
assert(
  "calibration does not write company rates",
  !existsSync(join(process.cwd(), "lib/calibration/actions.ts")) ||
    (!read("lib/calibration/actions.ts").includes('.from("rates").insert') &&
      !read("lib/calibration/actions.ts").includes('.from("rates").update') &&
      !read("lib/calibration/actions.ts").includes('.from("rates").upsert'))
);
assert(
  "estimate rate resolution does not import calibration",
  !read("lib/estimate/rates.ts").includes("lib/calibration")
);
assert(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(read(".env.local.example"))
);
assert(
  "consumer audit doc exists",
  existsSync(
    join(process.cwd(), "docs/audits/STAGE_3_1C3_R2C_RATE_CONSUMER_AUDIT.md")
  )
);
assert(
  "authority architecture doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md"
    )
  )
);
assert(
  "EXPLICIT_COMPANY constant present",
  RATE_AUTHORITY.EXPLICIT_COMPANY === "EXPLICIT_COMPANY"
);

if (failed > 0) {
  console.error(`\nStage 3.1C.3-R2C verification failed (${failed}).`);
  process.exit(1);
}

console.log("\nStage 3.1C.3-R2C rates onboarding verification passed.");
