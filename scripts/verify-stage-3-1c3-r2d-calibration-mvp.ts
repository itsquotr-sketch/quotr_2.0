/**
 * Stage 3.1C.3-R2D — Calibration Scenario MVP verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2d-calibration-mvp.ts
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  getCalibrationScenario,
  listCalibrationScenarios,
  orderCalibrationScenarios,
} from "../lib/calibration/catalogue";
import {
  compareCalibrationAnswers,
  resolveYourExpectedCost,
} from "../lib/calibration/compare";
import {
  CALIBRATION_EVIDENCE_LABEL,
} from "../lib/calibration/types";
import { FUTURE_RATE_AUTHORITY_STACK } from "../lib/rates/authority";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";

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

console.log("=== Stage 3.1C.3-R2D calibration MVP verification ===\n");

section("SCENARIOS");
const scenarios = listCalibrationScenarios();
assert("exactly two MVP scenarios", scenarios.length === 2);
assert(
  "Deck + Bathroom only",
  scenarios.every((s) => s.workAreaType === "deck" || s.workAreaType === "bathroom")
);
assert(
  "versioned ids",
  scenarios.every((s) => s.version.length > 0 && s.id.includes(`.v${s.version}`))
);
const deck = getCalibrationScenario("deck.standard_pine.v1");
const bathroom = getCalibrationScenario("bathroom.standard_reno.v1");
assert("deck scenario present", Boolean(deck));
assert("bathroom scenario present", Boolean(bathroom));
assert(
  "deck has canonical area facts",
  Boolean(
    deck?.facts.some((f) => f.key === "deck.area_m2" && f.value === 15)
  )
);
assert(
  "bathroom has area fact",
  Boolean(
    bathroom?.facts.some((f) => f.key === "bathroom.area_m2" && f.value === 8)
  )
);

const ordered = orderCalibrationScenarios(["bathroom", "deck"]);
assert(
  "preference orders Bathroom first when preferred",
  ordered[0]?.workAreaType === "bathroom"
);
assert(
  "Show all still returns both",
  orderCalibrationScenarios([]).length === 2
);

section("ENGINE COMPARISON");
assert("deck scenario loaded for compare", Boolean(deck));
if (deck) {
  const comparison = compareCalibrationAnswers({
    scenario: deck,
    answers: {
      labour_hours: 24,
      materials_cost: 4500,
      other_cost: 200,
      expected_total_cost: 8200,
      expected_sell: 12000,
      confidence: "medium",
    },
  });
  assert(
    "compare uses deterministic estimate totals",
    Number.isFinite(comparison.quotrRecommendedCost) &&
      comparison.quotrRecommendedCost > 0
  );
  assert(
    "compare returns sell",
    Number.isFinite(comparison.quotrRecommendedSell) &&
      comparison.quotrRecommendedSell > 0
  );
  assert(
    "your expected cost uses override",
    comparison.yourExpectedCost === 8200
  );
  assert(
    "narrative avoids wrong/right framing",
    !comparison.narrative.toLowerCase().includes("wrong")
  );
  assert(
    "scenario version preserved on compare",
    comparison.scenarioVersion === deck.version
  );
}

assert(
  "total without override sums cost fields",
  resolveYourExpectedCost({
    materials_cost: 100,
    other_cost: 50,
  }) === 150
);

section("UX / OPTIONAL");
const readiness = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Test Co",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 30,
  hasLabourRate: true,
  hasWorkTypePreferences: true,
  tradingName: "Test",
  legalName: null,
  contactEmail: "a@b.co",
  contactPhone: null,
  addressLine1: null,
  city: null,
});
const calibrateTip = readiness.recommendedSetup.find((s) => s.id === "calibrate");
assert("calibrate tip after basics", Boolean(calibrateTip));
assert(
  "calibrate tip ~3 min copy",
  Boolean(calibrateTip?.reason.includes("~3 min"))
);
assert(
  "calibrate deep-links section",
  calibrateTip?.href.includes("section=calibrate") === true
);
assert(
  "calibrate not required severity",
  calibrateTip?.severity === "optional"
);

const hub = read("components/calibration/CalibrationHub.tsx");
assert("hub has Do this later", hub.includes("Do this later"));
assert("hub has Show all", hub.includes("Show all"));
assert(
  "evidence label used",
  CALIBRATION_EVIDENCE_LABEL === "Calibration evidence"
);

const shell = read("components/setup/SetupShell.tsx");
assert("SetupShell has Calibrate section", shell.includes('"calibrate"'));
assert(
  "SetupShell mounts Company DNA hub as primary calibrate",
  shell.includes("CompanyDnaHub")
);
assert("legacy CalibrationHub preserved", hub.includes("Do this later"));

section("AUTHORITY");
const actions = read("lib/calibration/actions.ts");
assert("save does not write rates", !actions.includes('.from("rates")\n') || !actions.includes(".insert("));
assert(
  "actions never update rates table",
  !actions.includes('.from("rates").update') &&
    !actions.includes('.from("rates").upsert') &&
    !actions.includes('.from("rates").insert')
);
assert(
  "actions never mutate projects",
  !actions.includes('.from("projects")')
);
assert(
  "actions never mutate estimates",
  !actions.includes('.from("estimates")')
);
assert(
  "compare imports calculateEstimate path",
  read("lib/calibration/compare.ts").includes("calculateEstimate")
);
assert(
  "future stack keeps DNA below explicit rates",
  FUTURE_RATE_AUTHORITY_STACK.indexOf("COMPANY_EXPLICIT_RATE") <
    FUTURE_RATE_AUTHORITY_STACK.findIndex((x) =>
      x.includes("COMPANY_DNA_OR_CALIBRATION")
    )
);
assert(
  "rate resolution consumers do not import calibration catalogue",
  !read("lib/estimate/rates.ts").includes("lib/calibration") &&
    !read("lib/estimate/calculate-estimate.ts").includes("lib/calibration")
);

section("SECURITY / PERSISTENCE GATE");
assert(
  "org derived via getAuthOrgContext",
  actions.includes("getAuthOrgContext")
);
assert(
  "save uses atomic RPC not direct commercial mutate of rates",
  actions.includes("persistCalibrationResponse") &&
    !actions.includes('.from("rates").insert') &&
    !actions.includes('.from("rates").update')
);
assert(
  "save persists via save_calibration_response RPC path",
  read("lib/calibration/persistence.ts").includes("save_calibration_response")
);
assert("migration 033 created", migrationsHave033());
assert(
  "033 is calibration_responses",
  read("supabase/migrations/033_calibration_responses.sql").includes(
    "calibration_responses"
  )
);
assert(
  "persistence proposal exists",
  existsSync(
    join(
      process.cwd(),
      "docs/architecture/STAGE_3_1C3_R2D_CALIBRATION_PERSISTENCE_PROPOSAL.md"
    )
  )
);
assert(
  "security review exists",
  existsSync(
    join(
      process.cwd(),
      "docs/security/STAGE_3_1C3_R2D_CALIBRATION_SECURITY_REVIEW.md"
    )
  )
);
assert(
  "owner approval gate exists",
  existsSync(
    join(
      process.cwd(),
      "docs/decisions/STAGE_3_1C3_R2D_CALIBRATION_OWNER_APPROVAL.md"
    )
  )
);
assert(
  "no commercial amounts in save log path",
  !actions.includes("expected_sell") ||
    actions.includes("// Never log commercial answers")
);

section("BOUNDARIES");
assert(
  "033 calibration remains evidence-only; DNA is a separate module",
  existsSync(join(process.cwd(), "lib/company-dna")) &&
    existsSync(join(process.cwd(), "lib/calibration/actions.ts"))
);
assert(
  "Production Scope Discovery remains disabled docs",
  read("docs/product/QUOTR_PRODUCT_BACKLOG.md").includes(
    "Production Scope Discovery **Disabled**"
  ) ||
    read("docs/product/QUOTR_PRODUCT_BACKLOG.md").includes(
      "Scope Discovery"
    )
);
assert(
  "no AI in calibration actions",
  !actions.includes("anthropic") && !actions.includes("openai")
);

section("DOCS");
assert(
  "MVP architecture doc",
  existsSync(
    join(process.cwd(), "docs/architecture/QUOTR_CALIBRATION_MVP_ARCHITECTURE.md")
  )
);
assert(
  "completion doc",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1C3_R2D_CALIBRATION_MVP_COMPLETION.md"
    )
  )
);
assert(
  "preview runbook",
  existsSync(
    join(
      process.cwd(),
      "docs/runbooks/STAGE_3_1C3_R2D_CALIBRATION_PREVIEW_TEST.md"
    )
  )
);

console.log(`\n=== Done: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===\n`);
process.exit(failed === 0 ? 0 : 1);
