/**
 * COMPANY DNA-01 — productivity calibration architecture verifier.
 * Run: npx tsx scripts/verify-company-dna-01.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  COMPANY_DNA_TASKS,
  getCompanyDnaTask,
  orderCompanyDnaWorkAreas,
} from "../lib/company-dna/catalogue";
import {
  deriveCompanyProductivity,
  validateCompanyDnaInputs,
  companyDnaWorkAreaStatus,
} from "../lib/company-dna/derive";
import { resolveProductivity } from "../lib/estimate/productivity";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY } from "../lib/estimate/deck-productivity";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import { planAllowsCapability, trialAllowsCapability } from "../lib/billing/entitlement-matrix";
import { RATE_SOURCE_FRIENDLY_LABELS } from "../lib/estimate/rate-source-labels";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(facts[0]?.work_area_id ?? "d1")],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function productivityOrgRate(
  itemKey: string,
  unit: string,
  hours: number,
  source: "explicit_company" | "calibrated_productivity" = "calibrated_productivity"
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "productivity",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
    source,
    source_calibration_id: source === "calibrated_productivity" ? "ev-1" : null,
  };
}

function labourOrgRate(costRate: number): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: costRate,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
    source: "explicit_company",
  };
}

console.log("=== COMPANY DNA-01 ===\n");

const migrationDir = join(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
assert("052 migration file present", files.some((name) => name.startsWith("052_")));
assert(
  "053 is role-aware RLS, not DNA economics",
  files.some((name) => name.startsWith("053_role_aware_rls"))
);
const hardening = read("supabase/migrations/053_role_aware_rls_hardening.sql");
assert(
  "053 does not rewrite DNA evidence or catalogue",
  !/create table public\.productivity_calibration_/.test(hardening) &&
    !hardening.includes("save_productivity_calibration")
);

const migration = read("supabase/migrations/052_company_productivity_calibration.sql");
assert("evidence table", migration.includes("create table public.productivity_calibration_responses"));
assert("catalogue table", migration.includes("create table public.productivity_calibration_catalogue"));
assert("033 untouched", !migration.includes("calibration_responses") || !migration.includes("alter table public.calibration_responses"));
assert(
  "033 table not rewritten",
  !/alter table public\.calibration_responses/i.test(migration)
);
assert("scenario version on evidence", migration.includes("scenario_version text not null"));
assert("calibration_task_key", migration.includes("calibration_task_key"));
assert("server-authoritative save RPC", migration.includes("save_productivity_calibration"));
assert("save does not take derived productivity arg", !/p_derived_productivity/.test(migration));
assert("reset RPC", migration.includes("reset_productivity_to_benchmark"));
assert("SECURITY DEFINER save", /save_productivity_calibration[\s\S]*security definer/i.test(migration));
assert("search_path public", migration.includes("set search_path = public"));
assert("auth.uid validation", migration.includes("auth.uid()"));
assert("cost_rate numeric(12, 4)", migration.includes("alter column cost_rate type numeric(12, 4)"));
assert("source explicit_company backfill", migration.includes("source = 'explicit_company'"));
assert("source NOT NULL", /alter column source set not null/i.test(migration));
assert(
  "calibrated requires productivity + FK",
  migration.includes("rates_source_calibration_integrity")
);
assert("no cascade delete evidence", migration.includes("on delete set null"));
assert("no authenticated DELETE on evidence", !/grant delete on table public\.productivity_calibration_responses to authenticated/i.test(migration));
assert("stale by work_area type", migration.includes("mark_estimates_stale_for_work_area_type"));
assert("stale uses work_areas.type", migration.includes("wa.type = btrim(p_work_area_type)"));
assert("live deck framing key", migration.includes("deck.substructure.install.hours_per_framing_lm"));
assert("live decking key", migration.includes("deck.decking.install.hours_per_lm"));
assert("live posts key", migration.includes("deck.posts.install.hours_per_ea"));
assert("live demolition key", migration.includes("deck.demolition_hours_per_m2"));
assert("live fence posts", migration.includes("fence.post.install.hours_per_post"));
assert("live fence boards", migration.includes("fence.board.vertical.hours_per_lm"));
assert("live fence rails", migration.includes("fence.rail.install.hours_per_lm"));
assert("live rw piles", migration.includes("retaining_wall.timber.piles.install.hours_per_ea"));
assert("live rw face", migration.includes("retaining_wall.timber.face_boards.install.hours_per_m2"));
assert("no bathroom calibration seed", !migration.includes("'bathroom'"));
assert("immutability trigger", migration.includes("protect_productivity_calibration_evidence"));
assert("reset does not delete evidence", !/delete from public\.productivity_calibration_responses/i.test(migration));
assert("no Production ref", !migration.includes("lxvnylhsbvudzzupxeqr"));
assert("no Preview fixture ids", !migration.includes("shhpjsoldmqtkdbgrbtm"));

for (const task of COMPANY_DNA_TASKS) {
  assert(
    `SQL seed has ${task.calibrationTaskKey}`,
    migration.includes(`'${task.calibrationTaskKey}'`)
  );
  assert(
    `SQL seed has key ${task.productivityRateKey}`,
    migration.includes(`'${task.productivityRateKey}'`)
  );
}

const framing = getCompanyDnaTask("deck.framing.v1")!;
const derived = deriveCompanyProductivity({
  task: framing,
  crewSize: 2,
  durationHours: 8,
});
assert("20m² framing authority qty 80 lm", framing.authorityQuantity === 80);
assert("2×8h = 16 person-hours", derived.personHours === 16);
assert("derived 0.2 h/lm", derived.productivity === 0.2);
assert("benchmark 0.13", framing.benchmarkProductivity === 0.13);

const warn = validateCompanyDnaInputs({
  crewSize: 2,
  durationHours: 8,
  ratioToBenchmark: derived.ratioToBenchmark,
  outlierConfirmed: false,
});
assert("normal framing save allowed", warn.ok);

const crewReject = validateCompanyDnaInputs({
  crewSize: 0,
  durationHours: 8,
  ratioToBenchmark: 1,
  outlierConfirmed: false,
});
assert("zero crew rejected", !crewReject.ok && crewReject.code === "INVALID_CREW");

const hoursReject = validateCompanyDnaInputs({
  crewSize: 2,
  durationHours: 0,
  ratioToBenchmark: 1,
  outlierConfirmed: false,
});
assert("zero hours rejected", !hoursReject.ok);

const hard = validateCompanyDnaInputs({
  crewSize: 2,
  durationHours: 8,
  ratioToBenchmark: 0.01,
  outlierConfirmed: true,
});
assert("0.01× benchmark hard-rejected even if confirmed", !hard.ok && hard.code === "OUTLIER_HARD");

const confirm = validateCompanyDnaInputs({
  crewSize: 2,
  durationHours: 8,
  ratioToBenchmark: 0.4,
  outlierConfirmed: false,
});
assert(">2× faster requires confirm", !confirm.ok && confirm.code === "OUTLIER_CONFIRM_REQUIRED");

const confirmed = validateCompanyDnaInputs({
  crewSize: 2,
  durationHours: 8,
  ratioToBenchmark: 0.4,
  outlierConfirmed: true,
});
assert("warning range saves after confirm", confirmed.ok);

assert(
  "preferred work areas first",
  orderCompanyDnaWorkAreas(["fence", "deck"])[0] === "fence"
);
assert(
  "unsupported WA not invented",
  !orderCompanyDnaWorkAreas(["bathroom"]).includes("bathroom" as never)
);

const status = companyDnaWorkAreaStatus({
  highImpactTotal: 3,
  highImpactCalibrated: 0,
  anyCalibrated: true,
});
assert("demolition-only is partly not fully calibrated", status === "partly");
assert(
  "two high-impact = calibrated",
  companyDnaWorkAreaStatus({
    highImpactTotal: 3,
    highImpactCalibrated: 2,
    anyCalibrated: true,
  }) === "calibrated"
);

assert("Owner can calibrate", roleAllowsPermission("owner", "company.calibration.manage"));
assert("Admin can calibrate", roleAllowsPermission("admin", "company.calibration.manage"));
assert("Estimator can calibrate", roleAllowsPermission("estimator", "company.calibration.manage"));
assert("Viewer cannot calibrate", !roleAllowsPermission("viewer", "company.calibration.manage"));
assert("Admin can manage rates", roleAllowsPermission("admin", "company.rates.manage"));
assert("Estimator cannot manage commercial rates", !roleAllowsPermission("estimator", "company.rates.manage"));
assert("Viewer cannot manage rates", !roleAllowsPermission("viewer", "company.rates.manage"));

assert("Builder has calibration.basic", planAllowsCapability("builder", "calibration.basic"));
assert("Business has calibration.basic", planAllowsCapability("business", "calibration.basic"));
assert("Trial has calibration.basic", trialAllowsCapability("calibration.basic"));
assert("no new billing key in actions", !read("lib/company-dna/actions.ts").includes("calibration.comprehensive"));

assert(
  "user-facing calibrated label",
  RATE_SOURCE_FRIENDLY_LABELS.calibrated_productivity === "Your calibrated productivity"
);
assert(
  "user-facing benchmark label",
  RATE_SOURCE_FRIENDLY_LABELS.benchmark === "Quotr benchmark"
);
assert(
  "enums not in hub copy",
  !read("components/company-dna/CompanyDnaHub.tsx").includes("explicit_company")
);

const benchmarkResolved = resolveProductivity({
  productivityKey: DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0.13,
});
assert(
  "benchmark fallback hours 0.13",
  benchmarkResolved.hoursPerUnit === 0.13
);
assert(
  "benchmark label is Quotr benchmark",
  benchmarkResolved.sourceLabel === "Quotr benchmark"
);

const calibratedResolved = resolveProductivity({
  productivityKey: DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0.13,
  rates: [productivityOrgRate(DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY, "lm", 0.2)],
});
assert("company calibrated hours win", calibratedResolved.hoursPerUnit === 0.2);
assert(
  "calibrated source label",
  calibratedResolved.sourceLabel === "Your calibrated productivity"
);

const inactive = resolveProductivity({
  productivityKey: DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0.13,
  rates: [
    {
      ...productivityOrgRate(DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY, "lm", 0.2),
      active: false,
    },
  ],
});
assert("reset/inactive falls through to benchmark", inactive.hoursPerUnit === 0.13);

const KWILA = loadCalibrationFixture("OWNER-KWILA-01.json");
const kwilaId = "kwila";
const kwilaFacts = Object.entries(KWILA.facts).map(([key, value]) =>
  fact(key, kwilaId, value)
);
const labour = labourOrgRate(60);
const a = calculateDeck(ctx(kwilaFacts, [labour]), wa(kwilaId));
const b = calculateDeck(
  ctx(kwilaFacts, [
    labour,
    productivityOrgRate(DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY, "lm", 0.2),
  ]),
  wa(kwilaId)
);
const c = calculateDeck(ctx(kwilaFacts, [labour]), wa(kwilaId));

function labourHours(result: ReturnType<typeof calculateDeck>): number {
  return result.lineItems
    .filter((item) => item.category === "labour" && item.includedInTotal !== false)
    .reduce((sum, item) => sum + (item.labourHours ?? 0), 0);
}
function nonLabourCost(result: ReturnType<typeof calculateDeck>): number {
  return result.lineItems
    .filter((item) => item.category !== "labour" && item.includedInTotal !== false)
    .reduce((sum, item) => sum + item.recommendedCost, 0);
}
function materialQty(result: ReturnType<typeof calculateDeck>): number {
  return result.lineItems
    .filter(
      (item) => item.category === "materials" && item.includedInTotal !== false
    )
    .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

function labourCost(result: ReturnType<typeof calculateDeck>): number {
  return result.lineItems
    .filter((item) => item.category === "labour" && item.includedInTotal !== false)
    .reduce((sum, item) => sum + item.recommendedCost, 0);
}

assert("A/B physical material qty unchanged", materialQty(a) === materialQty(b));
assert("A/B non-labour cost unchanged", nonLabourCost(a) === nonLabourCost(b));
assert("B labour hours differ from A", labourHours(b) !== labourHours(a));
assert("B labour cost differs from A", labourCost(b) !== labourCost(a));
assert("A/B margin formula unchanged", a.marginPercent === b.marginPercent);
assert("C reset hours match A", labourHours(c) === labourHours(a));
assert("C reset cost match A", c.recommendedCost === a.recommendedCost);
assert("C reset sell match A", c.recommendedSell === a.recommendedSell);

const actions = read("lib/company-dna/actions.ts");
assert("save RPC from server action", actions.includes("save_productivity_calibration"));
assert("client does not submit derived productivity", !actions.includes("p_derived_productivity"));
assert("legacy 033 not auto-promoted", !actions.includes('.from("calibration_responses")'));

const hub = read("components/company-dna/CompanyDnaHub.tsx");
const flow = read("components/company-dna/CompanyDnaTaskFlow.tsx");
const dnaCopy = read("lib/company-dna/copy.ts");
assert("landing copy", hub.includes("Make Quotr price more like you"));
assert("progress copy", dnaCopy.includes("of") && dnaCopy.includes("calibrated"));
assert("no percent DNA gamification", !hub.includes("% Company DNA"));
assert("crew language", dnaCopy.includes("How many people from your team"));
assert("hours input", flow.includes("hours"));
assert("no raw productivity prompt", !/enter productivity/i.test(flow));
assert("thumb-friendly controls", flow.includes("min-h-11"));
assert("reset CTA", dnaCopy.includes("Use Quotr benchmark"));

const shell = read("components/setup/SetupShell.tsx");
assert("dashboard calibrate uses DNA hub", shell.includes("CompanyDnaHub"));
assert("legacy hub not primary", !shell.includes("CalibrationHub"));

const ratesCompare = read("components/rates/CompanyDnaRatesCompare.tsx");
assert("rates benchmark vs company", ratesCompare.includes("Quotr benchmark"));
assert("used source", ratesCompare.includes("Used:"));

assert(
  "readiness uses DNA evidence",
  read("lib/setup/readiness-actions.ts").includes("productivity_calibration_responses")
);
assert(
  "readiness does not treat 033 as DNA",
  !read("lib/setup/readiness-actions.ts").includes('from("calibration_responses")')
);

if (failed > 0) {
  console.error(`\nFAILED ${failed} checks`);
  process.exit(1);
}
console.log("\nAll COMPANY DNA-01 checks passed.");
