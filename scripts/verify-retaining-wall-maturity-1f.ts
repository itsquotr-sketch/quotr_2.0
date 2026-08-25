/**
 * RETAINING-WALL-MATURITY-1F / 1F-R1 — spoil removal + all-in rate semantic lock.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-1f.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { packageXorDetailedHolds } from "../lib/estimate/retaining-wall-commercial";
import {
  RW_BACKFILL_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_FACE_BOARD_150_H4_KEY,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_SPOIL_DISPOSAL_M3_KEY,
  RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_FACE_LABOUR_COMPONENT,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  isRwTimberPileStockComponent,
} from "../lib/estimate/retaining-wall-identities";
import {
  RW_SPOIL_REMOVAL_EXCEEDS_MEASURED,
  RW_SPOIL_REMOVAL_MISSING_QUANTITY,
  RW_SPOIL_REMOVAL_MISSING_RATE,
  RW_SPOIL_REMOVAL_OPTIONS,
  RW_SPOIL_REMOVAL_QUESTION,
  RW_SPOIL_REMOVAL_RATE_HELPER,
  resolveSpoilRemoval,
} from "../lib/estimate/retaining-wall-spoil-removal";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import { buildFactLookup } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";

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

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

function wa(id = "rw1") {
  return { id, type: "retaining_wall", name: "Retaining wall", sort_order: 1 };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "rw1", value, source: "user" };
}

function testRate(
  itemKey: string,
  unit: string,
  cost: number,
  rateType: "material" | "project_material" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}.${rateType}`,
    rate_type: rateType,
    trade: null,
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: `TEST_ONLY ${itemKey}`,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const OWNER_CONSTRAINTS = [
  { key: "site_access", value: "Moderate" },
  { key: "material_carry_distance", value: "10–30m" },
];

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  constraints: { key: string; value: unknown }[] = OWNER_CONSTRAINTS,
  margin = 20
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: margin,
    },
    materialWastageSettings: { defaultMaterialWastagePercent: 10 },
    rates,
  } as unknown as EstimateContext;
}

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("retaining_wall.material", "Timber"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.face_board_section", "150×50 H4"),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function previewFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return ownerFacts([
    fact("retaining_wall.post_spacing_m", 1),
    fact("retaining_wall.pile_embedment_m", 1),
    fact("retaining_wall.excavation_volume_m3", 6),
    ...extra,
  ]);
}

function mat(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): MaterialRequirement | undefined {
  return reqs?.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function lab(
  reqs: readonly EstimateRequirement[] | undefined,
  key: string
): LabourRequirement | undefined {
  return reqs?.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === key
  );
}

function plantLine(items: readonly EstimateLineItemInput[]) {
  return items.find((item) => /mini-excavator/i.test(item.label));
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, RW_SKIP_NESTED_SPAWN: "1" },
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

function reviewOf(result: ReturnType<typeof calculateRetainingWall>) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: result.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      recommendedSell: result.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      marginPercent: 20,
      confidence: result.confidence,
      assumptions: result.assumptions,
      missingInfo: result.missingInfo,
      lineItems: result.lineItems as never,
    },
    workAreas: [wa()],
    requirements: result.requirements,
  });
}

function hidden(factKey: string, facts: Array<{ key: string; value: unknown }>): boolean {
  const template = getScopeQuestions("retaining_wall").find((q) => q.factKey === factKey);
  if (!template) return true;
  const records = facts.map((row) => ({
    key: row.key,
    work_area_id: "rw1",
    value: row.value,
  }));
  return shouldHideConditionalQuestion(
    template,
    "rw1",
    buildFactLookup(records)
  );
}

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Retaining wall labour" ||
      item.label === "Retaining wall materials" ||
      item.label === "Backfill allowance" ||
      item.label === "Drainage labour"
  );
}

const REMOVAL_RATE = 40;
const none = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", false)])),
  wa()
);
const allRemoval = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)]), [
    testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", REMOVAL_RATE),
  ]),
  wa()
);
const someRemoval = calculateRetainingWall(
  ctx(
    previewFacts([
      fact("retaining_wall.disposal_included", true),
      fact("retaining_wall.spoil_removal_portion", "Some"),
      fact("retaining_wall.spoil_removal_volume_m3", 2.5),
    ]),
    [testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", REMOVAL_RATE)]
  ),
  wa()
);
const missingRate = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)])),
  wa()
);
const missingQty = calculateRetainingWall(
  ctx(
    ownerFacts([
      fact("retaining_wall.post_spacing_m", 1),
      fact("retaining_wall.pile_embedment_m", 1),
      fact("retaining_wall.disposal_included", true),
    ])
  ),
  wa()
);
const companyWins = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)]), [
    testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", 55),
  ]),
  wa()
);
const projectWins = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)]), [
    testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", 55),
    testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", 70, "project_material"),
  ]),
  wa()
);
const aliasOldKey = calculateRetainingWall(
  ctx(previewFacts([fact("retaining_wall.disposal_included", true)]), [
    testRate(RW_SPOIL_DISPOSAL_M3_KEY, "m3", 25),
  ]),
  wa()
);
const overMeasured = resolveSpoilRemoval({
  facts: previewFacts([
    fact("retaining_wall.disposal_included", true),
    fact("retaining_wall.spoil_removal_portion", "Some"),
    fact("retaining_wall.spoil_removal_volume_m3", 9),
  ]),
  workAreaId: "rw1",
  excavationVolumeM3: 6,
});
const overMeasuredPriced = calculateRetainingWall(
  ctx(
    previewFacts([
      fact("retaining_wall.disposal_included", true),
      fact("retaining_wall.spoil_removal_portion", "Some"),
      fact("retaining_wall.spoil_removal_volume_m3", 9),
    ]),
    [testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", REMOVAL_RATE)]
  ),
  wa()
);
const noExcavation = resolveSpoilRemoval({
  facts: ownerFacts([
    fact("retaining_wall.excavation_required", false),
    fact("retaining_wall.disposal_included", true),
  ]),
  workAreaId: "rw1",
  excavationVolumeM3: null,
});

const spoilAllLine = allRemoval.lineItems.find(
  (item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT
);
const spoilSomeLine = someRemoval.lineItems.find(
  (item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT
);
const spoilMissing = missingRate.lineItems.find(
  (item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT
);
const spoilOverLine = overMeasuredPriced.lineItems.find(
  (item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT
);
const spoilTipOnly = aliasOldKey.lineItems.find(
  (item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT
);
const noneReview = reviewOf(none);
const materials = noneReview.workAreas[0]?.categories.find((c) => c.id === "MATERIALS");
const pileGroup = materials?.lineGroups.find((g) => g.id === "h5-retaining-poles");
const labour = noneReview.workAreas[0]?.categories.find((c) => c.id === "LABOUR");
const plant = noneReview.workAreas[0]?.categories.find((c) => c.id === "PLANT");
const surfaceSrc = readFileSync(
  "components/assistant/builder-review/BuilderReviewSurface.tsx",
  "utf8"
);
const catalogueSrc = readFileSync("lib/rates/specific-material-catalogue.ts", "utf8");
const uiCopy = [
  ...(noneReview.workAreas[0]?.categories.flatMap((cat) => [
    ...cat.groupNotes.map((note) => `${note.title} ${note.detail}`),
    ...cat.lines.map(
      (line) =>
        `${line.label} ${line.supporting ?? ""} ${line.specification ?? ""} ${line.rateContext ?? ""}`
    ),
    ...cat.lineGroups.flatMap((group) => [
      `${group.label} ${group.supporting ?? ""}`,
      ...group.children.map((line) => `${line.label} ${line.supporting ?? ""}`),
    ]),
  ]) ?? []),
].join(" ");

console.log("\n--- SPOIL ---\n");
check(
  "1 question only applies when spoil-generating scope exists",
  hidden("retaining_wall.disposal_included", [
    { key: "retaining_wall.excavation_required", value: false },
  ]) &&
    !hidden("retaining_wall.disposal_included", [
      { key: "retaining_wall.excavation_required", value: true },
    ]) &&
    noExcavation.questionApplies === false
);
check(
  "2 No = no commercial line",
  none.lineItems.every((item) => item.componentKey !== RW_SPOIL_DISPOSAL_COMPONENT) &&
    !none.missingInfo.some((row) => /spoil removal/i.test(row))
);
check(
  "3 Yes + all uses known excavation quantity",
  near(spoilAllLine?.quantity ?? 0, 6) && spoilAllLine?.unit === "m3"
);
check(
  "4 Some uses entered quantity",
  near(spoilSomeLine?.quantity ?? 0, 2.5)
);
check(
  "5 quantity validation",
  overMeasured.removalVolumeM3 === 9 &&
    overMeasured.exceedsMeasured === true &&
    overMeasured.assumptions.includes(RW_SPOIL_REMOVAL_EXCEEDS_MEASURED)
);
check(
  "6 backfill volume not used",
  near(spoilAllLine?.quantity ?? 0, 6) &&
    (mat(allRemoval.requirements, RW_BACKFILL_COMPONENT)?.baseQuantity ?? 0) !== 6
);
check(
  "7 material carry not used as disposal",
  none.lineItems.every((item) => item.componentKey !== RW_SPOIL_DISPOSAL_COMPONENT)
);
check(
  "8 all-in removal identity explicit",
  spoilAllLine?.itemKey === RW_SPOIL_REMOVAL_ALL_IN_M3_KEY &&
    catalogueSrc.includes('item_key: "retaining_wall.spoil.removal.all_in.m3"') &&
    catalogueSrc.includes("Disposal / tip fee only")
);
check(
  "9 company $/m³ wins",
  near(companyWins.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
    ?.costRate ?? 0, 55)
);
check(
  "10 project rate wins company",
  near(projectWins.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
    ?.costRate ?? 0, 70)
);
check(
  "11 missing rate → Spoil removal Pricing Required only",
  spoilMissing?.rateSourceType === "missing" &&
    missingRate.missingInfo.some((row) => row === RW_SPOIL_REMOVAL_MISSING_RATE) &&
    !missingRate.missingInfo.some((row) => /bulk excavation/i.test(row))
);
check(
  "12 no Quotr benchmark invented",
  !/defaultCostRate:/.test(
    catalogueSrc.slice(
      catalogueSrc.indexOf("retaining_wall.spoil.removal.all_in.m3"),
      catalogueSrc.indexOf("retaining_wall.spoil.disposal.m3") + 80
    )
  ) &&
    spoilTipOnly?.rateSourceType === "missing" &&
    !near(spoilTipOnly?.costRate ?? 0, 25)
);
check(
  "13 excavation labour unchanged",
  near(
    lab(none.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.adjustedHours ?? 0,
    lab(allRemoval.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.adjustedHours ?? -1
  )
);
check(
  "14 plant unchanged",
  near(plantLine(none.lineItems)?.recommendedCost ?? 0, plantLine(allRemoval.lineItems)?.recommendedCost ?? -1)
);
check(
  "15 no duplicate excavation money",
  !allRemoval.lineItems.some((item) => item.label === "Bulk excavation") &&
    allRemoval.lineItems.filter((item) => item.componentKey === RW_EXCAVATION_LABOUR_COMPONENT).length === 1
);
check(
  "16 Update Estimate succeeds",
  calculateEstimate(ctx(previewFacts([fact("retaining_wall.disposal_included", false)])))
    .recommendedSell > 0 &&
    calculateEstimate(
      ctx(previewFacts([fact("retaining_wall.disposal_included", true)]), [
        testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", REMOVAL_RATE),
      ])
    ).recommendedSell > 0 &&
    calculateEstimate(ctx(previewFacts([fact("retaining_wall.disposal_included", true)])))
      .recommendedSell > 0 &&
    missingQty.missingInfo.includes(RW_SPOIL_REMOVAL_MISSING_QUANTITY) &&
    !missingQty.lineItems.some((item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
);

const noneCost = none.lineItems.reduce((s, i) => s + i.recommendedCost, 0);
const allCost = allRemoval.lineItems.reduce((s, i) => s + i.recommendedCost, 0);
const spoilCost = spoilAllLine?.recommendedCost ?? 0;
check(
  "16b commercial isolation 6 × rate",
  near(spoilCost, 6 * REMOVAL_RATE) && near(allCost - noneCost, 6 * REMOVAL_RATE)
);

console.log("\n--- UX ---\n");
const stock = (none.requirements ?? []).filter(
  (row): row is MaterialRequirement =>
    row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
);
const pileLm = (none.requirements ?? []).find(
  (row) => row.kind === "material" && row.componentKey === "retaining_wall.timber.piles.lm"
) as MaterialRequirement | undefined;
check("17 piles grouped", Boolean(pileGroup) && (materials?.lines.every((line) => !line.componentKey || !isRwTimberPileStockComponent(line.componentKey)) ?? false));
check(
  "18 pile theoretical qty preserved",
  (pileGroup?.supporting ?? "").includes("lm required") && (pileLm?.baseQuantity ?? 0) > 0
);
check(
  "19 pile purchase qty preserved",
  (pileGroup?.supporting ?? "").includes("lm purchased")
);
check("20 pile stock children preserved", (pileGroup?.children.length ?? 0) === stock.length && stock.length > 1);
check(
  "21 one Change material action",
  pileGroup?.showChangeMaterial === true &&
    surfaceSrc.includes("data-builder-review-line-group") &&
    surfaceSrc.includes("data-builder-review-change-material")
);
const board = materials?.lines.find((line) => line.componentKey === RW_TIMBER_BOARDS_COMPONENT);
check(
  "22 board net/purchase/waste visible",
  /lm required/.test(board?.supporting ?? "") &&
    /lm purchased/.test(board?.supporting ?? "") &&
    /waste/i.test(board?.supporting ?? "")
);
const aggregate = materials?.lines.find((line) => /drainage aggregate/i.test(line.label));
check(
  "23 aggregate in-place/purchase visible",
  /in-place/i.test(aggregate?.supporting ?? "") &&
    /purchased/i.test(aggregate?.supporting ?? "")
);
const takeoffCat = noneReview.workAreas[0]?.categories.find((c) => c.takeoff.length > 0);
check(
  "24 takeoff details collapsible/default collapsed",
  takeoffCat?.takeoffCollapsedByDefault === true &&
    takeoffCat.takeoffTitle === "Takeoff details" &&
    surfaceSrc.includes("data-takeoff-collapsed")
);
const labourKeys = new Set(labour?.lines.map((line) => line.componentKey));
check(
  "25 five labour intents visible",
  labourKeys.has(RW_TIMBER_PILE_LABOUR_COMPONENT) &&
    labourKeys.has(RW_TIMBER_FACE_LABOUR_COMPONENT) &&
    labourKeys.has(RW_EXCAVATION_LABOUR_COMPONENT) &&
    (labour?.lines.length ?? 0) >= 5
);
check(
  "26 internal tokens absent",
  !uiCopy.includes("QUOTR_STARTER") &&
    !uiCopy.includes("DETAILED_COMPONENT_AUTHORITY") &&
    !uiCopy.includes("LEGACY_FALLBACK_ONLY")
);
check(
  "27 rate variance hierarchy preserved",
  reviewOf(
    calculateRetainingWall(
      ctx(previewFacts(), [testRate(RW_FACE_BOARD_150_H4_KEY, "lm", 32)]),
      wa()
    )
  )
    .workAreas[0]?.categories.flatMap((c) => c.lines)
    .some((line) => (line.rateContext ?? "").includes("12.80")) === true
);
check(
  "28 assumptions collapsed",
  surfaceSrc.includes("data-builder-review-assumptions") &&
    noneReview.assumptions.length > 0
);
check(
  "29 Commercial Overview unchanged",
  noneReview.overview.categorySummary.some((row) => row.id === "MATERIALS") &&
    noneReview.overview.categorySummary.some((row) => row.id === "LABOUR") &&
    noneReview.overview.categorySummary.some((row) => row.id === "PLANT") &&
    typeof noneReview.overview.marginPercent === "number"
);
check(
  "30 mobile content contract",
  surfaceSrc.includes("overflow-x-hidden") &&
    surfaceSrc.includes("break-words") &&
    !/warning|text-destructive|text-red-/.test(surfaceSrc)
);

const question = getScopeQuestions("retaining_wall").find(
  (q) => q.factKey === "retaining_wall.disposal_included"
);
check(
  "30b question wording",
  question?.questionText === RW_SPOIL_REMOVAL_QUESTION &&
    RW_SPOIL_REMOVAL_OPTIONS.every((option) => question?.options?.includes(option))
);
check(
  "30c fixings row compact",
  (materials?.lines.find((line) => line.componentKey === RW_TIMBER_FIXINGS_COMPONENT)
    ?.supporting ?? "").includes("% of timber materials")
);
check(
  "30d plant hire-day primary",
  (plant?.lines[0]?.supporting ?? "").includes("/day") &&
    (plant?.lines[0]?.detail ?? "").includes("machine hours")
);
check(
  "30e excavation not called allowance when measured",
  labour?.lines.some(
    (line) =>
      line.componentKey === RW_EXCAVATION_LABOUR_COMPONENT &&
      line.label === "Excavation" &&
      !/allowance/i.test(line.label)
  ) === true
);

console.log("\n--- REGRESSION ---\n");
const skipNested = process.env.RW_SKIP_NESTED_SPAWN === "1";
const rw1eOk =
  skipNested || spawnVerifier("scripts/verify-retaining-wall-maturity-1e.ts");
check("31 RW-1E", rw1eOk);
check(
  "32 RW-1D",
  skipNested || spawnVerifier("scripts/verify-retaining-wall-maturity-1d.ts")
);
check(
  "33 RW-1C-R3",
  skipNested || spawnVerifier("scripts/verify-retaining-wall-maturity-1c-r3.ts")
);
check(
  "34 package/detail XOR",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(none.lineItems),
    hasDetailedMoneyLine: none.lineItems.some(
      (item) => item.componentKey === RW_TIMBER_BOARDS_COMPONENT
    ),
  })
);
const pricingParityOk = none.lineItems.every((item) => {
  const copied = buildPricingItemFieldsFromEstimateLineItem({
    category: item.category,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    notes: item.notes ?? null,
  });
  return near(copied.totalCost, item.recommendedCost);
});
check("35 Pricing parity", pricingParityOk);
const quoteParityOk =
  existsSync("lib/quotes/adoption-authority.ts") &&
  !readFileSync("lib/quotes/adoption-authority.ts", "utf8").includes(
    "calculateRetainingWall"
  );
check("36 Quote parity", quoteParityOk);
const deck2dOk =
  skipNested || spawnVerifier("scripts/verify-deck-maturity-2d.ts");
check("37 Deck 2D", deck2dOk);
check(
  "38 Rates UI Waste / disposal",
  catalogueSrc.includes('title: "Waste / disposal"') &&
    catalogueSrc.includes("Hardfill / excavated spoil removal") &&
    catalogueSrc.includes(RW_SPOIL_REMOVAL_RATE_HELPER) &&
    catalogueSrc.includes("Disposal / tip fee only")
);
check(
  "39 leftover tip-only identity preserved",
  catalogueSrc.includes('item_key: "retaining_wall.spoil.disposal.m3"') &&
    /calculatorSupport: "leftover"/.test(
      catalogueSrc.slice(catalogueSrc.indexOf("retaining_wall.spoil.disposal.m3"))
    )
);

console.log("\n--- 1F-R1 SEMANTIC LOCK ---\n");
check(
  "R1-1 all-in does not resolve tip-only",
  spoilAllLine?.itemKey === RW_SPOIL_REMOVAL_ALL_IN_M3_KEY &&
    mat(aliasOldKey.requirements, RW_SPOIL_DISPOSAL_COMPONENT)?.materialKey ===
      RW_SPOIL_REMOVAL_ALL_IN_M3_KEY &&
    spoilTipOnly?.rateSourceType === "missing" &&
    !near(spoilTipOnly?.costRate ?? 0, 25)
);
check(
  "R1-2 project all-in rate wins",
  near(
    projectWins.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
      ?.costRate ?? 0,
    70
  )
);
check(
  "R1-3 company all-in rate wins",
  near(
    companyWins.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
      ?.costRate ?? 0,
    55
  )
);
check(
  "R1-4 missing all-in → Spoil removal Pricing Required",
  spoilMissing?.rateSourceType === "missing" &&
    missingRate.missingInfo.includes(RW_SPOIL_REMOVAL_MISSING_RATE)
);
check(
  "R1-5 tip-only alone does not close the gap",
  spoilTipOnly?.rateSourceType === "missing" &&
    aliasOldKey.missingInfo.includes(RW_SPOIL_REMOVAL_MISSING_RATE)
);
check(
  "R1-6 all-removal uses measured excavation m³",
  near(spoilAllLine?.quantity ?? 0, 6) && spoilAllLine?.unit === "m3"
);
check(
  "R1-7 partial uses entered measured-equivalent m³",
  near(spoilSomeLine?.quantity ?? 0, 2.5)
);
check(
  "R1-8 > measured produces explicit override/disclosure",
  near(spoilOverLine?.quantity ?? 0, 9) &&
    overMeasured.exceedsMeasured === true &&
    overMeasured.assumptions.includes(RW_SPOIL_REMOVAL_EXCEEDS_MEASURED) &&
    overMeasuredPriced.assumptions.includes(RW_SPOIL_REMOVAL_EXCEEDS_MEASURED) &&
    (spoilOverLine?.notes ?? "").includes(RW_SPOIL_REMOVAL_EXCEEDS_MEASURED)
);
check(
  "R1-9 excavation labour unchanged",
  near(
    lab(none.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.adjustedHours ?? 0,
    lab(allRemoval.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.adjustedHours ?? -1
  )
);
check(
  "R1-10 plant unchanged",
  near(
    plantLine(none.lineItems)?.recommendedCost ?? 0,
    plantLine(allRemoval.lineItems)?.recommendedCost ?? -1
  )
);
check(
  "R1-11 Builder Review grouping unchanged",
  Boolean(pileGroup) &&
    (pileGroup?.children.length ?? 0) > 1 &&
    (labour?.lines.length ?? 0) >= 5 &&
    (plant?.lines.length ?? 0) >= 1
);
check("R1-12 Pricing parity", pricingParityOk);
check("R1-13 Quote parity", quoteParityOk);
check("R1-14 RW-1E unchanged", rw1eOk);
check("R1-15 Deck 2D unchanged", deck2dOk);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
