/**
 * QT-018 concrete path, paved patio, and stated drainage length.
 * Run: npx --yes tsx scripts/verify-qt018-stated-scope.ts
 */
import { buildMinimalExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { validateAndFilterExtraction } from "../lib/ai/schema";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";
import { CONCRETE_PATH_MANUAL_COMPONENT, PAVING_MANUAL_COMPONENT } from "../lib/estimate/stated-outdoor-scope";
import { FENCE_MANUAL_SCOPE_COMPONENT } from "../lib/estimate/fence-manual";
import { RW_DRAINAGE_LABOUR_COMPONENT, RW_NOVACOIL_COMPONENT } from "../lib/estimate/retaining-wall-identities";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import {
  evaluateManualPricingEligibility,
  projectEligibleUnresolvedPricingItems,
} from "../lib/pricing/manual-requirement-promotion";

const BRIEF = `Backyard job: remove 20 m² old concrete path, build a 6 m long retaining wall approximately 900 mm high, install 12 m of drainage behind it, make a 15 m² paved patio and install 8 m of glass pool fencing. Access is through a 900 mm side gate. Excavated soil condition, spoil destination, wall design, drainage outlet and fencing specifications are unknown. Include plant hire and rubbish disposal. Please identify what you can price and what requires measurements, design or specialist quotes.`;

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

const allowed = getAnalysisCapableWorkAreaTypes();
const extracted = buildMinimalExtractionFromBrief(BRIEF, allowed);
const validated = validateAndFilterExtraction(extracted, allowed, allowed);
const types = validated.workAreas.map((row) => row.type);
const fact = (key: string) => validated.facts.find((row) => row.key === key);

check(
  "the brief keeps one work area for each requested item",
  types.filter((type) => type === "demolition").length === 1 &&
    types.filter((type) => type === "paving").length === 1 &&
    types.filter((type) => type === "retaining_wall").length === 1 &&
    types.filter((type) => type === "fence").length === 1
);
check(
  "concrete path area is kept and thickness is not invented",
  fact("demolition.area_m2")?.value === 20 &&
    !validated.facts.some((row) => /thickness/i.test(row.key))
);
check(
  "patio area and drainage length replace the loose facts",
  fact("paving.area_m2")?.value === 15 &&
    fact("retaining_wall.drainage_length_m")?.value === 12 &&
    fact("fence.length_m")?.value === 8 &&
    fact("fence.material")?.value === "Glass" &&
    !validated.facts.some((row) => row.work_area_type == null && /patio|drainage_length/i.test(row.key))
);
check(
  "disposal quantity stays unresolved",
  !validated.facts.some((row) => row.key === "demolition.disposal_quantity_m3" || row.key === "demolition.thickness_mm")
);

const areas: EstimateWorkArea[] = validated.workAreas.map((row, index) => ({
  id: row.type,
  type: row.type,
  name: row.name ?? row.type,
  sort_order: index,
}));
const facts: EstimateFact[] = validated.facts
  .filter((row) => row.work_area_type)
  .map((row) => ({
    key: row.key,
    work_area_id: row.work_area_type as string,
    value: row.value,
  }));
for (const extra of [
  ["retaining_wall.height_m", 0.9],
  ["retaining_wall.material", "Timber"],
  ["retaining_wall.backfill_included", true],
] as const) {
  if (!facts.some((row) => row.key === extra[0])) {
    facts.push({ key: extra[0], work_area_id: "retaining_wall", value: extra[1] });
  }
}

const estimate = calculateEstimate({
  project: { id: "qt018", qualityLevel: "standard" },
  confirmedWorkAreas: areas,
  facts,
  constraints: [],
  materialWastageSettings: { sheetMaterialWastagePercent: 10, defaultMaterialWastagePercent: 10 },
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
  },
} as unknown as EstimateContext);

const concrete = estimate.lineItems.filter((row) => row.componentKey === CONCRETE_PATH_MANUAL_COMPONENT);
const patio = estimate.lineItems.filter((row) => row.componentKey === PAVING_MANUAL_COMPONENT);
const glass = estimate.lineItems.filter((row) => row.componentKey === FENCE_MANUAL_SCOPE_COMPONENT);
const coil = estimate.lineItems.filter((row) => row.componentKey === RW_NOVACOIL_COMPONENT);
check(
  "each requested item is one estimate line",
  concrete.length === 1 && patio.length === 1 && glass.length === 1 && coil.length === 1,
  `concrete ${concrete.length}, patio ${patio.length}, glass ${glass.length}, coil ${coil.length}`
);
check(
  "unpriced scopes keep their stated quantities",
  concrete[0]?.quantity === 20 &&
    concrete[0]?.recommendedCost === 0 &&
    patio[0]?.quantity === 15 &&
    patio[0]?.recommendedCost === 0 &&
    glass[0]?.quantity === 8 &&
    glass[0]?.recommendedCost === 0 &&
    concrete[0]?.notes?.includes("Thickness is not stated") === true &&
    patio[0]?.notes?.includes("No modelled paving rate") === true
);
const drainageLabour = estimate.lineItems.filter(
  (row) => row.componentKey === RW_DRAINAGE_LABOUR_COMPONENT
);
check(
  "stated drainage is priced once on the wall",
  coil[0]?.quantity === 12 &&
    coil[0]?.notes?.includes("Stated drainage length 12 m") === true &&
    coil[0]?.notes?.includes("outlet is not confirmed") === true &&
    drainageLabour.length === 1 &&
    drainageLabour[0]?.quantity === 12 &&
    !estimate.lineItems.some((row) => row.componentKey === RW_NOVACOIL_COMPONENT && row.quantity === 6)
);
const notSureFacts = facts.map((row) =>
  row.key === "retaining_wall.material" ? { ...row, value: "Not sure" } : row
);
const notSureEstimate = calculateEstimate({
  project: { id: "qt018-not-sure", qualityLevel: "standard" },
  confirmedWorkAreas: areas,
  facts: notSureFacts,
  constraints: [],
  materialWastageSettings: { sheetMaterialWastagePercent: 10, defaultMaterialWastagePercent: 10 },
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
  },
} as unknown as EstimateContext);
const notSureWallLines = notSureEstimate.lineItems.filter((row) =>
  String(row.componentKey ?? "").startsWith("retaining_wall.")
);
check(
  "Not sure keeps the independent scope and leaves the wall uncharged",
  notSureEstimate.lineItems.filter((row) => row.componentKey === CONCRETE_PATH_MANUAL_COMPONENT).length === 1 &&
    notSureEstimate.lineItems.filter((row) => row.componentKey === PAVING_MANUAL_COMPONENT).length === 1 &&
    notSureEstimate.lineItems.filter((row) => row.componentKey === FENCE_MANUAL_SCOPE_COMPONENT).length === 1 &&
    notSureWallLines.length === 0 &&
    notSureEstimate.missingInfo.includes("Wall material not confirmed") &&
    classifyReviewNotice("Wall material not confirmed") === "scope_gap" &&
    !notSureEstimate.assumptions.some((row) => /timber|H5|sleeper/i.test(row))
);
check(
  "the glass fence can still take a manual price",
  evaluateManualPricingEligibility(glass[0] ?? null).ok === true &&
    evaluateManualPricingEligibility(concrete[0] ?? null).ok === true &&
    evaluateManualPricingEligibility(patio[0] ?? null).ok === true &&
    projectEligibleUnresolvedPricingItems({
      items: [],
      estimateLines: [glass[0]!, concrete[0]!, patio[0]!],
      orgId: "org",
      projectId: "p",
      pricingDocumentId: "pd",
    }).length === 3
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
