/**
 * EST-BENCHMARK-01A — default benchmark coverage + Project Conditions foundation.
 *
 * Run: npx --yes tsx scripts/verify-est-benchmark-01a.ts
 *
 * Preview only. No Production. Does not invent Category C COST values.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { evaluateClarifyEstimateReadiness } from "../lib/assistant/readiness/clarify-estimate";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import {
  liveQuotrMaterialCost,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import {
  commercializeCeilings,
} from "../lib/estimate/ceilings-commercial";
import { CEILINGS_INSULATION_COMPONENT } from "../lib/estimate/ceilings-insulation";
import {
  CEILINGS_PLASTERBOARD_COMPONENT,
} from "../lib/estimate/ceilings-lining";
import { CEILINGS_PRODUCTIVITY_KEYS } from "../lib/estimate/ceilings-identities";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { PROJECT_CONDITION_PRODUCTIVITY_PATHS } from "../lib/estimate/condition-productivity-paths";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT,
  INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT,
  INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  INTERNAL_WALLS_TIMBER_90_KEY,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
} from "../lib/estimate/internal-walls-wall-types";
import {
  CEILING_INSULATION_THERMAL_KEY,
  ORDINARY_THERMAL_INSULATION_COST,
  WALL_INSULATION_THERMAL_KEY,
} from "../lib/estimate/insulation-fallback";
import { resolveLabourRate } from "../lib/estimate/rates";
import { resolveProductivity } from "../lib/estimate/productivity";
import {
  CEILING_BENCHMARK_REQUIREMENTS,
  INTERNAL_WALLS_BENCHMARK_REQUIREMENTS,
  listIntentionalPricingRequired,
  listOwnerApprovalGaps,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import type {
  EstimateConstraint,
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  evaluateApplicableProjectConditions,
  getUnresolvedRequiredProjectConditionKeys,
  HIGH_LEVEL_ACCESS_KEY,
  PROJECT_CONDITION_LIBRARY,
  toConfirmedInterviewInput,
} from "../lib/project-conditions";
import { PROJECT_CONDITION_DUPLICATE_FACT_KEYS } from "../lib/project-conditions/canonical";
import { scaffoldQuestionWouldBeAsked } from "../lib/project-conditions/relevance";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function near(actual: number | null | undefined, expected: number, tol = 0.05): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 20,
  default_contingency_percent: 0,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function wa(type: string, id = "w1", name?: string): EstimateWorkArea {
  return { id, type, name: name ?? type, sort_order: 1 };
}

function loungePortion(params?: {
  heightM?: number;
  insulation?: "thermal" | "acoustic" | true;
}): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = 2400;
  row.lining.sheet_width_mm = 1200;
  row.geometry.mode = "length_width";
  row.geometry.length_m = 4;
  row.geometry.width_m = 3;
  row.geometry.area_m2 = 12;
  row.height_m = params?.heightM ?? 2.4;
  if (params?.insulation === true || params?.insulation === "thermal") {
    row.finish.insulation_included = true;
    row.finish.insulation_type = "thermal";
  } else if (params?.insulation === "acoustic") {
    row.finish.insulation_included = true;
    row.finish.insulation_type = "acoustic";
  }
  row.has_bulkheads = false;
  return row;
}

function ceilingFacts(portion: CeilingPortion): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: [portion],
  });
}

function ceilingCommercial(portion: CeilingPortion, rates: OrganisationRate[] = []) {
  const facts = ceilingFacts(portion);
  const workArea = wa("ceilings", "c1", "Ceilings");
  const physical = calculateCeilingsPhysical({
    facts,
    workArea,
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
    },
  });
  return commercializeCeilings({
    physical,
    workArea,
    rates,
    organisationSettings: SETTINGS,
  });
}

function orgMaterial(itemKey: string, cost: number, unit = "sheet"): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function orgProductivity(itemKey: string, hours: number, unit: string): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "productivity",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function composeInterior(params: {
  brief: string | null;
  workAreas: Array<{ id: string; type: string; name: string }>;
  facts: EstimateFact[];
  constraints?: Array<{ key: string; value: unknown }>;
}) {
  const workAreas = params.workAreas.map((row) => ({
    ...row,
    status: "confirmed" as const,
  }));
  const constraints = params.constraints ?? [];
  const plan = composeJobPlan({
    workAreas,
    facts: params.facts,
    constraints,
    briefText: params.brief,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: params.brief,
    qualityLevel: "standard",
    workAreas,
    facts: params.facts,
    constraints,
    jobPlan: plan,
  });
}

function pcKeys(view: ReturnType<typeof composeClarifyView>): string[] {
  return [...view.candidates, ...view.deferred]
    .filter((row) => row.writeTarget === "CONSTRAINT" || row.source === "project_condition")
    .map((row) => row.constraintKey)
    .filter((key): key is string => Boolean(key));
}

function iwCtx(
  facts: EstimateFact[],
  constraints: EstimateConstraint[] = [],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "est-benchmark-01a", qualityLevel: "standard" },
    confirmedWorkAreas: [wa("internal_walls", "w1", "Internal walls")],
    facts,
    constraints,
    organisationSettings: SETTINGS,
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function mixedIwFacts(): EstimateFact[] {
  let facts: EstimateFact[] = [];
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
    value: true,
  });
  const writes: Array<{ key: string; value: unknown }> = [
    { key: "internal_walls.wall_type.label", value: "Type A" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 12 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes" },
    { key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Thermal" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4" },
    { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "Level 4" },
  ];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
    });
  }
  return [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
    ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function constraint(key: string, value: string): EstimateConstraint {
  return { key, label: key, value };
}

console.log("=== EST-BENCHMARK-01A ===\n");

console.log("--- A–F coverage classification ---\n");
const ceilingCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("ceilings");
const iwCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("internal_walls");
check("A ceilings inventory classified", ceilingCoverage.ok && ceilingCoverage.unclassified.length === 0);
check("B every Ceiling productivity classified", Object.values(CEILINGS_PRODUCTIVITY_KEYS).every((key) =>
  CEILING_BENCHMARK_REQUIREMENTS.some((row) => row.productivityOperation === key)
));
check("C IW inventory classified", iwCoverage.ok && iwCoverage.unclassified.length === 0);
check(
  "D every IW framing/lining/insulation productivity classified",
  Object.values(INTERNAL_WALLS_PRODUCTIVITY_KEYS).every((key) =>
    INTERNAL_WALLS_BENCHMARK_REQUIREMENTS.some((row) => row.productivityOperation === key)
  ) &&
    [
      INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.standard_gib,
      INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.aqualine,
      INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.fyreline,
    ].every((key) =>
      INTERNAL_WALLS_BENCHMARK_REQUIREMENTS.some((row) => row.productivityOperation === key)
    )
);
check(
  "E no ordinary accidental PR",
  ceilingCoverage.ordinaryAccidentalPr.length === 0 &&
    iwCoverage.ordinaryAccidentalPr.length === 0
);
check(
  "F specialist/custom still PR",
  listIntentionalPricingRequired("ceilings").some((row) =>
    /timber lining|specialist/i.test(row.component)
  ) &&
    listIntentionalPricingRequired("internal_walls").some((row) =>
      /cornice|level 5|acoustic/i.test(row.component)
    )
);
check(
  "live RESOLVES_WITH_QUOTR is actually present",
  ceilingCoverage.resolvesDeclaredButLiveMissing.length === 0 &&
    iwCoverage.resolvesDeclaredButLiveMissing.length === 0
);
check(
  "L5 close blocked while Category C remains",
  !workAreaMayCloseAtL5(ceilingCoverage) && !workAreaMayCloseAtL5(iwCoverage)
);
check(
  "thermal identities have live COST",
  liveQuotrMaterialCost(CEILING_INSULATION_THERMAL_KEY) === ORDINARY_THERMAL_INSULATION_COST &&
    liveQuotrMaterialCost(WALL_INSULATION_THERMAL_KEY) === ORDINARY_THERMAL_INSULATION_COST
);
check(
  "10 mm Standard remains Category C",
  liveQuotrMaterialCost("sheet.plasterboard.standard.10mm.2400x1200.each") == null &&
    listOwnerApprovalGaps("ceilings").some((row) => /10 mm Standard/i.test(row.component))
);

console.log("\n--- G–J rate authority ---\n");
const companyBoard = ceilingCommercial(loungePortion({ insulation: "thermal" }), [
  orgMaterial("sheet.plasterboard.standard.each", 40),
]);
const board = companyBoard.requirements.find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
check("G company material overrides Quotr", board?.rateSource === "company" && board.unitCost === 40);
const companyHours = resolveProductivity({
  productivityKey: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
  unit: "sheet",
  fallbackHoursPerUnit: 0.5,
  rates: [orgProductivity(CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet, 0.9, "sheet")],
});
check(
  "H company productivity overrides Quotr",
  companyHours.hoursPerUnit === 0.9 && companyHours.sourceType === "user_rate"
);
const thermalMat = ceilingCommercial(loungePortion({ insulation: "thermal" })).requirements.find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === CEILINGS_INSULATION_COMPONENT
);
const expectedSell = deriveSellFromCost(ORDINARY_THERMAL_INSULATION_COST, 20);
const thermalLine = ceilingCommercial(loungePortion({ insulation: "thermal" })).lineItems.find(
  (row) => row.componentKey === CEILINGS_INSULATION_COMPONENT
);
check(
  "I thermal insulation cost-first Quotr fallback",
  thermalMat?.priced === true &&
    thermalMat.unitCost === 12 &&
    thermalMat.materialKey === CEILING_INSULATION_THERMAL_KEY &&
    thermalMat.purchaseQuantity === 12
);
check(
  "J margin once — sell from cost / (1-GM), not FITOUT sell 18",
  thermalLine?.sellDerivedFromMargin === true &&
    near(thermalLine?.recommendedSell, expectedSell * 12) &&
    !near(thermalLine?.recommendedSell, 18 * 12)
);
const labour = resolveLabourRate({ rates: [], organisationSettings: SETTINGS });
check(
  "global labour COST fallback exists",
  labour.costRate === 60 && near(labour.sellRate, deriveSellFromCost(60, 20))
);
const acoustic = ceilingCommercial(loungePortion({ insulation: "acoustic" })).requirements.find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === CEILINGS_INSULATION_COMPONENT
);
check("acoustic insulation remains PR", acoustic?.priced === false && acoustic.materialKey == null);

console.log("\n--- K–R Project Conditions ---\n");
const ordinaryBrief =
  "4x3 lounge ceiling, existing framing, 13mm Standard GIB, 2.4m ceiling height, normal access";
const ordinaryFacts = ceilingFacts(loungePortion({ heightM: 2.4, insulation: "thermal" }));
const ordinaryView = composeInterior({
  brief: ordinaryBrief,
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: ordinaryFacts,
});
const ordinaryPc = pcKeys(ordinaryView);
check("O ordinary 2.4m does not ask scaffold / high-level access", !ordinaryPc.includes(HIGH_LEVEL_ACCESS_KEY));
check(
  "O scaffoldQuestionWouldBeAsked is false",
  scaffoldQuestionWouldBeAsked(ordinaryFacts) === false
);
check(
  "K Project Conditions group is first in Details",
  ordinaryView.groups[0]?.workAreaName === "Project Conditions"
);
check(
  "K Access group is used",
  ordinaryView.groups[0]?.sections.some((row) => /access/i.test(row.label)) === true ||
    ordinaryPc.includes("site_access") === false
);
check(
  "L site_slope stays hidden on interior-only",
  !ordinaryPc.includes("site_slope") &&
    !evaluateApplicableProjectConditions(
      toConfirmedInterviewInput({
        workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
        facts: ordinaryFacts,
        constraints: [],
      })
    ).some((row) => row.key === "site_slope")
);
check(
  "Q normal access from brief is not re-asked",
  !ordinaryPc.includes("site_access")
);

const highFacts = ceilingFacts(loungePortion({ heightM: 4.8 }));
const highView = composeInterior({
  brief: "4x3 ceiling at 4.8m working height",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: highFacts,
});
check("N 4.8m triggers high-level access", pcKeys(highView).includes(HIGH_LEVEL_ACCESS_KEY));
const highHigh = [...highView.candidates, ...highView.deferred].find(
  (row) => row.constraintKey === HIGH_LEVEL_ACCESS_KEY
);
check(
  "P unresolved high-level access is initial capture",
  highHigh != null && isInitialCaptureQuestion(highHigh)
);
const highReady = evaluateClarifyEstimateReadiness({
  stage: "quality",
  briefText: "4x3 ceiling at 4.8m working height",
  qualityLevel: "standard",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  facts: highFacts,
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    facts: highFacts,
    constraints: [],
  }),
});
check("P unresolved relevant condition blocks Ready", highReady.ready === false);
const knownHighView = composeInterior({
  brief: "4x3 ceiling at 4.8m working height",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: highFacts,
  constraints: [{ key: HIGH_LEVEL_ACCESS_KEY, value: "Mobile scaffold" }],
});
check("Q known high-level access is not re-asked", !pcKeys(knownHighView).includes(HIGH_LEVEL_ACCESS_KEY));
check(
  "R height stays a Work Area fact, not a constraint key",
  !PROJECT_CONDITION_DUPLICATE_FACT_KEYS.includes("ceilings.portion.height_m") &&
    highFacts.some((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
);

const multiView = composeInterior({
  brief: ordinaryBrief,
  workAreas: [
    { id: "c1", type: "ceilings", name: "Ceilings" },
    { id: "w1", type: "internal_walls", name: "Internal walls" },
    { id: "p1", type: "painting", name: "Painting" },
  ],
  facts: ordinaryFacts,
});
const multiKeys = pcKeys(multiView);
check(
  "M each Project Condition asked once",
  multiKeys.every((key) => multiKeys.filter((row) => row === key).length === 1)
);
check(
  "M no Work Area-scoped duplicate access questions",
  ![...multiView.candidates, ...multiView.deferred].some((row) =>
    Boolean(row.factKey && /\.access$/.test(row.factKey) && row.factKey !== "deck.access_type")
  )
);

const libraryKeys = PROJECT_CONDITION_LIBRARY.map((row) => row.key);
check("condition library covers high_level_access", libraryKeys.includes(HIGH_LEVEL_ACCESS_KEY));
check(
  "condition → productivity paths exist",
  PROJECT_CONDITION_PRODUCTIVITY_PATHS.some((row) => row.condition === "site_access") &&
    PROJECT_CONDITION_PRODUCTIVITY_PATHS.some((row) => row.condition === "material_carry_distance")
);

const unresolvedHigh = getUnresolvedRequiredProjectConditionKeys(
  toConfirmedInterviewInput({
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    facts: highFacts,
    constraints: [],
  })
);
check("Ready contract lists unresolved high_level_access", unresolvedHigh.includes(HIGH_LEVEL_ACCESS_KEY));
check(
  "ordinary ceiling does not require high_level_access",
  !getUnresolvedRequiredProjectConditionKeys(
    toConfirmedInterviewInput({
      workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
      facts: ordinaryFacts,
      constraints: [],
    })
  ).includes(HIGH_LEVEL_ACCESS_KEY)
);

console.log("\n--- Fixtures ---\n");
const lounge = ceilingCommercial(loungePortion({ heightM: 2.4, insulation: "thermal" }));
const gib = lounge.requirements.find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
check("22 Standard GIB resolves", gib?.priced === true && (gib.unitCost ?? 0) > 0);
check(
  "22 thermal insulation resolves",
  thermalMat?.priced === true && thermalMat.materialKey === CEILING_INSULATION_THERMAL_KEY
);
check(
  "22 no accidental PR on ordinary plasterboard/insulation",
  gib?.priced === true && thermalMat?.priced === true
);
const readyPortion = loungePortion({ heightM: 2.4, insulation: "thermal" });
readyPortion.finish.painting_included = false;
readyPortion.finish.stopping_included = false;
const readyFacts = ceilingFacts(readyPortion);
const ordinaryReadyView = composeInterior({
  brief: ordinaryBrief,
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings" }],
  facts: readyFacts,
});
const ordinaryReady = evaluateClarifyEstimateReadiness({
  stage: "quality",
  briefText: ordinaryBrief,
  qualityLevel: "standard",
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  facts: readyFacts,
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    facts: readyFacts,
    constraints: [],
  }),
});
check(
  "22 ordinary 2.4m ceiling can become Ready",
  ordinaryReady.ready === true &&
    ordinaryReadyView.enoughToEstimate === true &&
    !pcKeys(ordinaryReadyView).includes("material_carry_distance") &&
    !pcKeys(ordinaryReadyView).includes(HIGH_LEVEL_ACCESS_KEY)
);

const iwEasy = calculateInternalWalls(
  iwCtx(mixedIwFacts(), [
    constraint("site_access", "Easy"),
    constraint("material_carry_distance", "< 10m"),
  ]),
  wa("internal_walls", "w1", "Internal walls")
);
const iwHard = calculateInternalWalls(
  iwCtx(mixedIwFacts(), [
    constraint("site_access", "Difficult"),
    constraint("material_carry_distance", "> 30m"),
  ]),
  wa("internal_walls", "w1", "Internal walls")
);
const timberEasy = (iwEasy.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY
);
const timberHard = (iwHard.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.materialKey === INTERNAL_WALLS_TIMBER_90_KEY
);
check(
  "24 quantities unchanged under restricted access",
  timberEasy?.purchaseQuantity === timberHard?.purchaseQuantity &&
    (timberEasy?.purchaseQuantity ?? 0) > 0
);
const hoursEasy = iwEasy.lineItems
  .filter((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT)
  .reduce((sum, row) => sum + (row.labourHours ?? row.quantity ?? 0), 0);
const hoursHard = iwHard.lineItems
  .filter((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_LABOUR_COMPONENT)
  .reduce((sum, row) => sum + (row.labourHours ?? row.quantity ?? 0), 0);
check("24 restricted access increases labour hours only", hoursHard > hoursEasy && near(hoursHard / hoursEasy, 1.2, 0.02));
const iwIns = (iwEasy.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT
);
const iwInsLab = (iwEasy.requirements ?? []).find(
  (row): row is LabourRequirement =>
    row.kind === "labour" && row.componentKey === INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT
);
const iwSkirt = (iwEasy.requirements ?? []).find(
  (row): row is MaterialRequirement =>
    row.kind === "material" && row.componentKey === INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT
);
const iwStop = (iwEasy.requirements ?? []).find(
  (row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT
);
check(
  "24 ordinary thermal insulation material resolves",
  iwIns?.priced === true && iwIns.materialKey === WALL_INSULATION_THERMAL_KEY
);
check("24 ordinary thermal insulation labour resolves", iwInsLab?.priced === true);
check("24 ordinary skirting material resolves", iwSkirt?.priced === true);
check("24 ordinary Level 4 stopping resolves", iwStop?.priced === true);
check(
  "24 skirting labour remains PR (Category C)",
  (iwEasy.requirements ?? []).some(
    (row) =>
      row.kind === "labour" &&
      row.componentKey === INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT &&
      row.priced === false
  )
);

console.log("\n--- Architecture notes ---\n");
const factory = read("docs/architecture/QUOTR_WORK_AREA_FACTORY.md");
check("maturity rule documented", /cannot be \*\*L5 \/ CLOSED\*\*/.test(factory));
check("high_level_access in factory WA-6", /high_level_access/.test(factory));
check(
  "no Ceiling-specific conditions store",
  !read("lib/project-conditions/library.ts").includes("ceilings.site_conditions") &&
    read("lib/project-conditions/library.ts").includes("Persistence remains the `constraints` table")
);
check(
  "verifier is generic",
  read("lib/estimate/benchmark-coverage.ts").includes("verifyWorkAreaBenchmarkCoverage")
);

const unknownWa = verifyRegisteredWorkAreaBenchmarkCoverage("kitchen");
check(
  "future Work Area without inventory fails closure",
  unknownWa.ok === false && /no registered ordinary V1/.test(unknownWa.failures[0] ?? "")
);

console.log("\n--- Category C owner-approval list ---\n");
for (const row of [...listOwnerApprovalGaps("ceilings"), ...listOwnerApprovalGaps("internal_walls")]) {
  console.log(`  C  ${row.workAreaType} · ${row.component} · ${row.materialIdentity ?? row.productivityOperation}`);
}

console.log("\n--- S/T regressions ---\n");
const prior = [
  "scripts/verify-ceilings-wa-05a.ts",
  "scripts/verify-ceilings-wa-05b.ts",
  "scripts/verify-ceilings-wa-08-r1-details.ts",
  "scripts/verify-work-area-internal-walls-07.ts",
  "scripts/verify-work-area-internal-walls-08.ts",
  "scripts/verify-work-area-internal-walls-maturity.ts",
  "scripts/verify-foundation-r1-project-conditions-support.ts",
  "scripts/verify-foundation-r2r1-material-rate-authority.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
