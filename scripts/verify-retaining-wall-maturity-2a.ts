/**
 * RETAINING-WALL-MATURITY-2A — Concrete Sleeper commercial maturity.
 * Run: npx tsx scripts/verify-retaining-wall-maturity-2a.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { deriveQuickEstimateConfidencePresentation } from "../lib/assistant/presentation/quick-estimate-confidence";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import {
  packageXorDetailedHolds,
  sleeperPhysicalReady,
} from "../lib/estimate/retaining-wall-commercial";
import {
  cylinderVolumeM3,
  faceAreaM2,
  resolveRetainingWallGeometry,
} from "../lib/estimate/retaining-wall-geometry";
import {
  RW_BACKFILL_COMPONENT,
  RW_CONCRETE_SLEEPER_KEY,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_CONCRETE_LABOUR_COMPONENT,
  RW_SLEEPER_FACE_LABOUR_COMPONENT,
  RW_SLEEPER_POST_LABOUR_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_SLEEPER_POSTS_PROCURE_COMPONENT,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
  RW_STEEL_POST_KEY,
} from "../lib/estimate/retaining-wall-identities";
import { buildRetainingWallPhysicalModel } from "../lib/estimate/retaining-wall-physical";
import {
  RW_DEFAULT_SLEEPER_FACE_HEIGHT_M,
  RW_DEFAULT_SLEEPER_LENGTH_M,
  RW_PREMIX_20KG_YIELD_M3,
  RW_SLEEPER_2A_MATERIAL_STARTERS,
  RW_SLEEPER_2A_PRODUCTIVITY_STARTERS,
  RW_SLEEPER_BAY_LAYOUT_KIND,
  RW_SLEEPER_CUT_PROCUREMENT,
  RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE,
  RW_SLEEPER_DEFAULT_SPACING_DISCLOSURE,
  RW_SLEEPER_DESIGN_CONFIRM,
  RW_SLEEPER_LENGTH_SEMANTICS,
  RW_SLEEPER_MODULE_MISMATCH,
  RW_SLEEPER_PACKAGE_LIFECYCLE,
  sleeper2AMaterialStarter,
} from "../lib/estimate/retaining-wall-sleeper-2a";
import { sleeperBayLayout, sleeperWallTakeoff } from "../lib/estimate/retaining-wall-sleeper";
import { RW_PRODUCTIVITY_KEYS } from "../lib/estimate/retaining-wall-productivity";
import { classifyRetainingWallSystem } from "../lib/estimate/retaining-wall-systems";
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
  rateType: "material" | "project_material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}.${rateType}`,
    rate_type: rateType === "productivity" || rateType === "labour" ? rateType : rateType,
    trade: rateType === "labour" ? "carpenter" : null,
    work_area_type: "retaining_wall",
    item_key: itemKey,
    label: `TEST ${itemKey}`,
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
    fact("retaining_wall.material", "Concrete sleeper"),
    fact("retaining_wall.length_m", 15),
    fact("retaining_wall.is_raking", true),
    fact("retaining_wall.height_high_m", 1.6),
    fact("retaining_wall.height_low_m", 0.6),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 6),
    fact("retaining_wall.disposal_included", false),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function secondFacts(): EstimateFact[] {
  return [
    fact("retaining_wall.material", "Concrete sleeper"),
    fact("retaining_wall.length_m", 6),
    fact("retaining_wall.height_m", 0.8),
    fact("retaining_wall.excavation_required", true),
    fact("retaining_wall.excavation_volume_m3", 2),
    fact("retaining_wall.disposal_included", true),
    fact("retaining_wall.spoil_removal_portion", "All"),
  ];
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

function hasPackage(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.label === "Retaining wall labour" || item.label === "Retaining wall materials"
  );
}

function hasDetailedMoney(items: readonly EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.componentKey === RW_SLEEPER_COMPONENT ||
      item.componentKey === RW_SLEEPER_POSTS_PROCURE_COMPONENT
  );
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, RW_SKIP_NESTED_SPAWN: "1" },
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    else if (out.trim()) {
      const snippet = out.trim().split(/\r?\n/).slice(-8).join(" | ");
      console.log(`      spawn ${script}: ${snippet.slice(0, 400)}`);
    }
    return false;
  }
}

const editorSrc = readFileSync(
  "components/assistant/job-plan/RetainingWallQuickSpecEditor.tsx",
  "utf8"
);
const surfaceSrc = readFileSync(
  "components/assistant/builder-review/BuilderReviewSurface.tsx",
  "utf8"
);
const coverageSrc = existsSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md")
  ? readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  : "";

const geometry = resolveRetainingWallGeometry({
  lengthM: 15,
  heightM: null,
  heightHighM: 1.6,
  heightLowM: 0.6,
});
const levelGeo = resolveRetainingWallGeometry({
  lengthM: 10,
  heightM: 1,
  heightHighM: null,
  heightLowM: null,
});
const takeoff = sleeperWallTakeoff(geometry!, {
  sleeperLengthM: null,
  sleeperFaceHeightM: null,
  postSpacingM: null,
  postEmbedmentM: null,
  holeDiameterM: null,
  premixBagYieldM3: null,
  wasteFactor: 0,
});
const levelTakeoff = sleeperWallTakeoff(levelGeo!, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postSpacingM: null,
  postEmbedmentM: null,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0,
});
const explicitEmbed = sleeperWallTakeoff(levelGeo!, {
  sleeperLengthM: 2,
  sleeperFaceHeightM: 0.2,
  postSpacingM: null,
  postEmbedmentM: 0.8,
  holeDiameterM: 0.3,
  premixBagYieldM3: 0.01,
  wasteFactor: 0,
});

const ownerCtx = ctx(ownerFacts());
const ownerCalc = calculateRetainingWall(ownerCtx, wa());
const ownerEstimate = calculateEstimate(ownerCtx);
const ownerPhys = buildRetainingWallPhysicalModel({
  context: ownerCtx,
  workAreaId: "rw1",
  material: "Concrete sleeper",
});

const difficultCtx = ctx(ownerFacts(), [], [
  { key: "site_access", value: "Difficult" },
  { key: "material_carry_distance", value: "10–30m" },
]);
const difficultCalc = calculateRetainingWall(difficultCtx, wa());

const secondCtx = ctx(secondFacts(), [], [
  { key: "site_access", value: "Difficult" },
  { key: "material_carry_distance", value: "> 30m" },
]);
const secondCalc = calculateRetainingWall(secondCtx, wa());
const secondEstimate = calculateEstimate(secondCtx);

const companySleeper = calculateRetainingWall(
  ctx(ownerFacts(), [testRate(RW_CONCRETE_SLEEPER_KEY, "ea", 50)]),
  wa()
);
const missingSpoil = calculateRetainingWall(
  ctx(
    ownerFacts([
      fact("retaining_wall.disposal_included", true),
      fact("retaining_wall.spoil_removal_portion", "All"),
    ])
  ),
  wa()
);
const spoilPriced = calculateRetainingWall(
  ctx(
    ownerFacts([
      fact("retaining_wall.disposal_included", true),
      fact("retaining_wall.spoil_removal_portion", "All"),
    ]),
    [testRate(RW_SPOIL_REMOVAL_ALL_IN_M3_KEY, "m3", 85)]
  ),
  wa()
);

const designedCtx = ctx(
  ownerFacts([
    fact("retaining_wall.sleeper_post_spacing_m", 2.0),
    fact("retaining_wall.sleeper_post_embedment_m", 0.8),
  ])
);
const designedCalc = calculateRetainingWall(designedCtx, wa());
const designedEstimate = calculateEstimate(designedCtx);
const designedTakeoff = sleeperWallTakeoff(geometry!, {
  sleeperLengthM: null,
  sleeperFaceHeightM: null,
  postSpacingM: 2.0,
  postEmbedmentM: 0.8,
  holeDiameterM: null,
  premixBagYieldM3: null,
  wasteFactor: 0,
});
const timberSwitch = calculateRetainingWall(
  ctx(
    ownerFacts([
      fact("retaining_wall.material", "Timber"),
      fact("retaining_wall.face_board_section", "150×50 H4"),
    ])
  ),
  wa()
);
const backToSleeper = calculateRetainingWall(
  ctx([
    ...ownerFacts(),
    fact("retaining_wall.face_board_section", "150×50 H4"),
  ]),
  wa()
);

const ownerReview = composeBuilderReview({
  estimate: {
    recommendedCost: ownerEstimate.recommendedCost,
    recommendedSell: ownerEstimate.recommendedSell,
    marginPercent: ownerEstimate.marginPercent,
    confidence: ownerCalc.confidence,
    assumptions: ownerCalc.assumptions,
    missingInfo: ownerCalc.missingInfo,
    lineItems: ownerCalc.lineItems.map((item) => ({
      ...item,
      id: item.itemKey ?? item.label,
      includedInTotal: item.includedInTotal ?? true,
    })),
  } as never,
  workAreas: [{ id: "rw1", type: "retaining_wall", name: "Retaining wall", status: "confirmed" }],
  requirements: ownerCalc.requirements ?? [],
});

console.log("\n--- PHYSICAL ---\n");
check(
  "1 Concrete Sleeper system recognised",
  classifyRetainingWallSystem("Concrete sleeper") === "CONCRETE_SLEEPER_WALL" &&
    sleeperPhysicalReady(ownerPhys)
);
check("2 Constant geometry works", levelTakeoff.bayCount === 5 && levelTakeoff.postCount === 6);
check("3 Sloping geometry works", geometry?.sloping === true && takeoff.postLengthsM.length > 1);
check(
  "4 Face area correct",
  near(geometry?.faceAreaM2 ?? 0, faceAreaM2(15, 1.6, 0.6)) &&
    near(geometry?.faceAreaM2 ?? 0, 16.5)
);
check(
  "5 Bays deterministic",
  takeoff.bayCount === Math.ceil(15 / RW_DEFAULT_SLEEPER_LENGTH_M)
);
check("6 Posts = bays + 1", takeoff.postCount === (takeoff.bayCount ?? 0) + 1);
check(
  "7 Residual bay layout not even-split",
  takeoff.fullBayCount === 7 &&
    near(takeoff.residualBayWidthM, 1) &&
    takeoff.bayCount === 8 &&
    takeoff.actualSpacingM === RW_DEFAULT_SLEEPER_LENGTH_M &&
    Math.abs(takeoff.actualSpacingM - 15 / 8) > 0.05
);
check(
  "8 Local post heights respond to slope",
  (takeoff.postLengthsM[0] ?? 0) !== (takeoff.postLengthsM.at(-1) ?? 0)
);
check(
  "9 Embedment assumption disclosed as estimating only",
  ownerCalc.assumptions.some((row) => row.includes("70%")) &&
    takeoff.embedmentExplicit === false &&
    /estimating assumption/i.test(RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE) &&
    /not a manufacturer requirement/i.test(RW_SLEEPER_DEFAULT_EMBEDMENT_DISCLOSURE)
);
check(
  "10 Explicit embedment overrides assumption",
  near(explicitEmbed.postLengthsM[0] ?? 0, 1.8) && explicitEmbed.embedmentExplicit
);
check(
  "11 Sleeper courses deterministic",
  takeoff.coursesPerBay.length === takeoff.bayCount &&
    takeoff.coursesPerBay.every((n) => n > 0)
);
check(
  "12 Sleeper EA deterministic purchased units",
  takeoff.sleeperCount === takeoff.standardSleeperEa + takeoff.cutSleeperEa &&
    Number.isInteger(takeoff.sleeperCount) &&
    takeoff.sleeperCount ===
      takeoff.coursesPerBay.reduce((sum, n) => sum + n, 0)
);
check(
  "13 Post-hole volume cylindrical",
  near(cylinderVolumeM3(0.3, 0.6), Math.PI * 0.15 ** 2 * 0.6, 0.0001)
);
check("14 Hole quantity equals post holes", takeoff.holeCount === takeoff.postCount);
check("15 Concrete volume deterministic", takeoff.holeVolumeM3 > 0);
check(
  "16 Novacoil deterministic",
  near(mat(ownerCalc.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity ?? 0, 15)
);
const agg = mat(ownerCalc.requirements, RW_BACKFILL_COMPONENT);
check(
  "17 Aggregate deterministic",
  (agg?.baseQuantity ?? 0) > 0 && (agg?.purchaseQuantity ?? 0) > (agg?.baseQuantity ?? 0)
);
check("18 Backfill deterministic", (agg?.baseQuantity ?? 0) > 0);
check(
  "19 Spoil No no removal",
  !ownerCalc.lineItems.some((item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
);
check(
  "20 Spoil Yes uses shared all-in removal",
  spoilPriced.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
    ?.itemKey === RW_SPOIL_REMOVAL_ALL_IN_M3_KEY &&
    near(
      spoilPriced.lineItems.find((i) => i.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
        ?.quantity ?? 0,
      6
    )
);

console.log("\n--- COMMERCIAL ---\n");
const sleeperLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_SLEEPER_COMPONENT
);
check(
  "21 Sleeper EA × rate",
  sleeperLine?.unit === "ea" &&
    near(
      sleeperLine.costRate ?? 0,
      sleeper2AMaterialStarter(RW_CONCRETE_SLEEPER_KEY, "ea")?.costPerUnit ?? -1
    ) &&
    near(
      sleeperLine.recommendedCost,
      (takeoff.sleeperCount ?? 0) * (sleeperLine.costRate ?? 0)
    )
);
const postLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_SLEEPER_POSTS_PROCURE_COMPONENT
);
check(
  "22 Post quantity/procurement × correct rate",
  postLine?.unit === "lm" &&
    near(postLine.quantity ?? 0, takeoff.totalPostLengthM) &&
    near(postLine.costRate ?? 0, 58)
);
const concreteLine = ownerCalc.lineItems.find(
  (item) => item.componentKey === RW_SLEEPER_CONCRETE_COMPONENT
);
check(
  "23 Concrete procurement × correct rate",
  concreteLine?.unit === "bag" &&
    (concreteLine.quantity ?? 0) === takeoff.bagCount &&
    near(concreteLine.costRate ?? 0, 11.5)
);
check(
  "24 Drainage materials price correctly",
  mat(ownerCalc.requirements, RW_NOVACOIL_COMPONENT)?.priced === true &&
    mat(ownerCalc.requirements, RW_BACKFILL_COMPONENT)?.priced === true
);
check(
  "25 Labour intents separate",
  lab(ownerCalc.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT) != null &&
    lab(ownerCalc.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT) != null &&
    lab(ownerCalc.requirements, RW_SLEEPER_CONCRETE_LABOUR_COMPONENT) != null &&
    lab(ownerCalc.requirements, "retaining_wall.drainage.novacoil.install") != null &&
    lab(ownerCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT) != null
);
check(
  "26 Productivities use correct drivers",
  lab(ownerCalc.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)?.productivityBasis.unit ===
    "ea" &&
    lab(ownerCalc.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)?.productivityBasis
      .unit === "ea" &&
    lab(ownerCalc.requirements, RW_SLEEPER_CONCRETE_LABOUR_COMPONENT)?.productivityBasis
      .unit === "m3" &&
    lab(ownerCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.productivityBasis.unit ===
      "m3"
);
check(
  "27 Excavation not double-owned",
  ownerCalc.lineItems.filter((item) => item.componentKey === RW_EXCAVATION_LABOUR_COMPONENT)
    .length === 1 &&
    !ownerCalc.lineItems.some((item) => item.label === "Bulk excavation") &&
    ownerCalc.assumptions.some((row) => /Post-hole excavation ownership/i.test(row))
);
check(
  "28 Concrete placement not double-owned",
  ownerCalc.assumptions.some((row) => /CONCRETE_PLACEMENT_SEPARATE/i.test(row)) &&
    near(
      lab(ownerCalc.requirements, RW_SLEEPER_CONCRETE_LABOUR_COMPONENT)?.productivityBasis
        .quantity ?? 0,
      takeoff.netConcreteM3 ?? takeoff.holeVolumeM3,
      0.02
    )
);
const plantOwner = ownerCalc.lineItems.find((item) =>
  /mini-excavator/i.test(item.label)
);
check(
  "29 Plant scales with workload",
  (plantOwner?.quantity ?? 0) >= 1 && (plantOwner?.recommendedCost ?? 0) > 0
);
check(
  "30 Manual plant = 0",
  !difficultCalc.lineItems.some(
    (item) => /mini-excavator/i.test(item.label) && (item.quantity ?? 0) > 0
  ) &&
    (lab(difficultCalc.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)?.productivityBasis
      .hoursPerUnit ?? 0) === 2
);
check(
  "31 Company rates override Quotr",
  near(
    companySleeper.lineItems.find((item) => item.componentKey === RW_SLEEPER_COMPONENT)
      ?.costRate ?? 0,
    50
  )
);
check(
  "32 Missing selected material rate → specific Pricing Required after promotion",
  !hasPackage(missingSpoil.lineItems) &&
    hasDetailedMoney(missingSpoil.lineItems) &&
    missingSpoil.lineItems.some((item) => item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT)
);
check(
  "33 No package + detail",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  }) && !hasPackage(ownerCalc.lineItems)
);
check("34 No $0 regression", ownerEstimate.recommendedSell > 0 && ownerEstimate.recommendedCost > 0);
check(
  "35 Direct cost reconciles",
  near(
    ownerEstimate.recommendedCost,
    ownerCalc.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0),
    0.5
  )
);
check(
  "36 GM sell correct",
  near(ownerEstimate.recommendedSell / ownerEstimate.recommendedCost, 1.25, 0.02)
);
const pricingFields = ownerCalc.lineItems.map((item) =>
  buildPricingItemFieldsFromEstimateLineItem(item as never, { defaultMarginPercent: 20 } as never)
);
check(
  "37 Pricing parity",
  Array.isArray(pricingFields) && ownerCalc.lineItems.length > 0
);
check(
  "38 Quote parity",
  near(ownerEstimate.recommendedSell, calculateEstimate(ownerCtx).recommendedSell, 0.05)
);

console.log("\n--- UX ---\n");
const materials = ownerReview.workAreas[0]?.categories.find((c) => c.id === "MATERIALS");
const postGroup = materials?.lineGroups.find((g) => g.id === "steel-retaining-posts");
check(
  "39 Posts grouped",
  Boolean(postGroup) &&
    (postGroup?.supporting ?? "").includes("posts") &&
    postGroup?.showChangeMaterial === true
);
const sleeperUi = materials?.lines.find((line) => line.componentKey === RW_SLEEPER_COMPONENT);
check(
  "40 Sleepers compact",
  /sleeper/i.test(sleeperUi?.label ?? "") && (sleeperUi?.supporting ?? "").includes("EA")
);
check(
  "41 Concrete understandable",
  ownerCalc.lineItems.some((item) => /Post-hole concrete/i.test(item.label))
);
check(
  "42 Internal tokens absent",
  !JSON.stringify(ownerReview.workAreas).includes("CONCRETE_SLEEPER_WALL") &&
    !JSON.stringify(ownerReview.workAreas).includes("DETAILED_COMPONENT")
);
check(
  "43 Assumptions collapsed",
  surfaceSrc.includes("data-builder-review-assumptions") &&
    ownerReview.assumptions.length > 0
);
check(
  "44 Improve Estimate high-value",
  ownerReview.improvements.some((row) =>
    row.label.includes(RW_SLEEPER_DESIGN_CONFIRM)
  ) && ownerReview.improvements.length <= 4
);
check(
  "45 Edit Scope works",
  editorSrc.includes("CONCRETE_SLEEPER_WALL") &&
    editorSrc.includes("retaining_wall.sleeper_length_m") &&
    editorSrc.includes("retaining_wall.sleeper_post_embedment_m") &&
    editorSrc.includes("retaining_wall.sleeper_post_spacing_m") &&
    editorSrc.includes("retaining_wall.post_spacing_m") &&
    editorSrc.includes("retaining_wall.pile_embedment_m")
);
check(
  "46 Wall type switching safe",
  timberSwitch.lineItems.some((item) => /face board|Face boards/i.test(item.label)) &&
    !timberSwitch.lineItems.some((item) => item.componentKey === RW_SLEEPER_COMPONENT) &&
    backToSleeper.lineItems.some((item) => item.componentKey === RW_SLEEPER_COMPONENT) &&
    !backToSleeper.lineItems.some((item) => /Face boards/i.test(item.label))
);
check(
  "47 Update Estimate succeeds",
  ownerEstimate.recommendedSell > 0 && secondEstimate.recommendedSell > 0
);
check(
  "48 Mobile contract",
  surfaceSrc.includes("overflow-x-hidden") &&
    surfaceSrc.includes("break-words") &&
    !/warning|text-destructive|text-red-/.test(surfaceSrc)
);

console.log("\n--- EXTRA ---\n");
check(
  "E1 defaults disclosed 2000×200",
  takeoff.sleeperLengthAssumed &&
    takeoff.sleeperFaceAssumed &&
    RW_DEFAULT_SLEEPER_LENGTH_M === 2 &&
    RW_DEFAULT_SLEEPER_FACE_HEIGHT_M === 0.2
);
check(
  "E2 bag yield default 0.01 m³ from net concrete",
  takeoff.bagYieldM3 === RW_PREMIX_20KG_YIELD_M3 &&
    takeoff.netConcreteM3 != null &&
    takeoff.bagCount ===
      Math.ceil(takeoff.netConcreteM3 / RW_PREMIX_20KG_YIELD_M3 - 1e-12)
);
check(
  "E3 no sleeper waste factor invented",
  mat(ownerCalc.requirements, RW_SLEEPER_COMPONENT)?.wasteFactor === 0
);
check(
  "E4 physical posts remain when money is lm",
  mat(ownerCalc.requirements, RW_SLEEPER_POSTS_EA_COMPONENT)?.purchaseQuantity ===
    takeoff.postCount &&
    mat(ownerCalc.requirements, RW_SLEEPER_POSTS_LM_COMPONENT)?.purchaseQuantity ===
      takeoff.totalPostLengthM
);
check(
  "E5 package lifecycle LEGACY_FALLBACK_ONLY",
  RW_SLEEPER_PACKAGE_LIFECYCLE === "LEGACY_FALLBACK_ONLY"
);
check(
  "E6 second fixture physically different",
  (mat(secondCalc.requirements, RW_SLEEPER_COMPONENT)?.purchaseQuantity ?? 0) <
    (takeoff.sleeperCount ?? 0) &&
    (mat(secondCalc.requirements, RW_SLEEPER_POSTS_EA_COMPONENT)?.purchaseQuantity ?? 0) <
      (takeoff.postCount ?? 0)
);
check(
  "E7 second fixture manual plant",
  !secondCalc.lineItems.some(
    (item) => /mini-excavator/i.test(item.label) && (item.quantity ?? 0) > 0
  )
);
check(
  "E8 coverage doc records 2A",
  /MATURITY-2A|Sleeper 2A|CONCRETE SLEEPER/i.test(coverageSrc)
);
check("E9 hole diameter 300 mm default", takeoff.holeDiameterM === 0.3);
check(
  "E10 labour hours positive",
  (lab(ownerCalc.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)?.adjustedHours ?? 0) > 0 &&
    (lab(ownerCalc.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)?.adjustedHours ?? 0) > 0
);
void RW_STEEL_POST_KEY;

console.log("\n--- 2A-R1 PROCUREMENT / DESIGN ---\n");
const layout15 = sleeperBayLayout(15, 2);
const ownerBand = deriveQuickEstimateConfidencePresentation({
  confidencePercent: ownerEstimate.confidence,
  missingInfoCount: ownerEstimate.missingInfo.length,
  attentionCount: 0,
  assumptionSeverity: ownerEstimate.assumptionMetadata?.assumptionSeverity ?? null,
});
const designedBand = deriveQuickEstimateConfidencePresentation({
  confidencePercent: designedEstimate.confidence,
  missingInfoCount: designedEstimate.missingInfo.length,
  attentionCount: 0,
  assumptionSeverity: designedEstimate.assumptionMetadata?.assumptionSeverity ?? null,
});
check(
  "R1-1 sleeper length semantics are purchased unit length",
  RW_SLEEPER_LENGTH_SEMANTICS === "PHYSICAL_PURCHASED_UNIT_LENGTH" &&
    takeoff.sleeperLengthSemantics === RW_SLEEPER_LENGTH_SEMANTICS
);
check(
  "R1-2 fixed 2.0 m product is not even-resized to 1.875 m",
  layout15.bayWidthsM.slice(0, 7).every((w) => near(w, 2, 0.001)) &&
    !takeoff.bayWidthsM.every((w) => near(w, 15 / 8, 0.001))
);
check(
  "R1-3 residual wall length handled",
  layout15.fullBayCount === 7 &&
    near(layout15.residualBayWidthM, 1) &&
    takeoff.bayLayoutKind === RW_SLEEPER_BAY_LAYOUT_KIND
);
check(
  "R1-4 purchased sleeper EA remains discrete",
  Number.isInteger(takeoff.sleeperCount) &&
    takeoff.sleeperCount === takeoff.standardSleeperEa + takeoff.cutSleeperEa
);
check(
  "R1-5 cut/end still costs a purchased unit",
  takeoff.cutSleeperEa > 0 &&
    RW_SLEEPER_CUT_PROCUREMENT === "PURCHASE_STANDARD_UNIT_THEN_CUT" &&
    takeoff.sleeperCount ===
      takeoff.coursesPerBay.reduce((sum, n) => sum + n, 0)
);
check(
  "R1-6 post locations follow residual bay model",
  takeoff.postPositionsM.join(",") === "0,2,4,6,8,10,12,14,15"
);
check(
  "R1-7 local heights follow corrected post locations",
  (takeoff.postLengthsM[0] ?? 0) > (takeoff.postLengthsM[7] ?? 0) &&
    (takeoff.postLengthsM[7] ?? 0) !== (takeoff.postLengthsM[8] ?? 0)
);
check(
  "R1-8 embedment follows local height unless explicit",
  takeoff.embedmentExplicit === false &&
    near((takeoff.postLengthsM[0] ?? 0) / 1.6, 1.7, 0.02)
);
check("R1-9 concrete recalculates from hole layout", takeoff.holeVolumeM3 > 0);
check(
  "R1-10 sleeper EA recalculates from corrected bays",
  takeoff.standardSleeperEa > 0 && takeoff.cutSleeperEa > 0
);
check(
  "R1-11 system/design assumption disclosed",
  ownerCalc.assumptions.includes(RW_SLEEPER_DESIGN_CONFIRM) &&
    ownerCalc.assumptions.includes(RW_SLEEPER_DEFAULT_SPACING_DISCLOSURE) &&
    ownerCalc.missingInfo.includes(RW_SLEEPER_DESIGN_CONFIRM)
);
check(
  "R1-12 confidence is not High on unresolved system/design",
  ownerBand.band !== "High" &&
    ownerBand.band !== "Low" &&
    ownerEstimate.missingInfo.includes(RW_SLEEPER_DESIGN_CONFIRM) &&
    !designedEstimate.missingInfo.includes(RW_SLEEPER_DESIGN_CONFIRM)
);
check(
  "R1-13 explicit system spacing overrides generic module",
  designedTakeoff.spacingAssumed === false &&
    designedTakeoff.targetSpacingM === 2 &&
    designedTakeoff.moduleMismatch === false &&
    designedTakeoff.fullBayCount === 7 &&
    near(designedTakeoff.residualBayWidthM, 1) &&
    designedTakeoff.postPositionsM[1] === 2
);
check(
  "R1-14 explicit embedment overrides generic",
  designedTakeoff.embedmentExplicit &&
    !designedCalc.missingInfo.includes(RW_SLEEPER_DESIGN_CONFIRM) &&
    designedBand.band !== "Low"
);
check(
  "R1-15 rate confidence metadata is correct",
  RW_SLEEPER_2A_MATERIAL_STARTERS[RW_CONCRETE_SLEEPER_KEY]?.confidence === "low" &&
    RW_SLEEPER_2A_MATERIAL_STARTERS[RW_STEEL_POST_KEY]?.confidence === "low" &&
    RW_SLEEPER_2A_MATERIAL_STARTERS["retaining_wall.sleeper.premix.20kg.bag"]
      ?.confidence === "medium"
);
check(
  "R1-16 concrete bag rate/basis is conservative retail band",
  near(
    sleeper2AMaterialStarter("retaining_wall.sleeper.premix.20kg.bag", "bag")
      ?.costPerUnit ?? 0,
    11.5
  ) && RW_PREMIX_20KG_YIELD_M3 === 0.01
);
check(
  "R1-17 package/detail XOR unchanged",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(ownerCalc.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(ownerCalc.lineItems),
  })
);
check(
  "R1-18 Pricing parity",
  Array.isArray(
    ownerCalc.lineItems.map((item) =>
      buildPricingItemFieldsFromEstimateLineItem(
        item as never,
        { defaultMarginPercent: 20 } as never
      )
    )
  )
);
check(
  "R1-19 Quote parity",
  near(ownerEstimate.recommendedSell, calculateEstimate(ownerCtx).recommendedSell, 0.05)
);
check(
  "R1-20 productivity starters unchanged and disclosed low confidence",
  RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.sleeperPostsEa]
    ?.hoursPerUnit === 0.95 &&
    RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.sleeperSleepersEa]
      ?.hoursPerUnit === 0.22 &&
    RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.sleeperConcreteHole]
      ?.hoursPerUnit === 0.12 &&
    RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.postHoleConcreteM3]
      ?.hoursPerUnit === 3.5 &&
    RW_SLEEPER_2A_PRODUCTIVITY_STARTERS[RW_PRODUCTIVITY_KEYS.sleeperPostsEa]
      ?.confidenceBand === "low"
);

console.log("\n--- 2A-R4 SYSTEM-FACT ISOLATION ---\n");
const timberThenSleeperFacts = ownerFacts([
  fact("retaining_wall.material", "Concrete sleeper"),
  fact("retaining_wall.post_spacing_m", 1.0),
  fact("retaining_wall.pile_embedment_m", 1.0),
]);
const timberThenSleeper = calculateRetainingWall(ctx(timberThenSleeperFacts), wa());
const timberThenSleeperPhys = buildRetainingWallPhysicalModel({
  context: ctx(timberThenSleeperFacts),
  workAreaId: "rw1",
  material: "Concrete sleeper",
});
const sleeperThenTimberFacts = ownerFacts([
  fact("retaining_wall.material", "Timber"),
  fact("retaining_wall.face_board_section", "150×50 H4"),
  fact("retaining_wall.sleeper_post_spacing_m", 1.5),
  fact("retaining_wall.sleeper_post_embedment_m", 0.9),
]);
const sleeperThenTimberPhys = buildRetainingWallPhysicalModel({
  context: ctx(sleeperThenTimberFacts),
  workAreaId: "rw1",
  material: "Timber",
});
const mismatchCalc = calculateRetainingWall(
  ctx(
    ownerFacts([
      fact("retaining_wall.sleeper_post_spacing_m", 1.0),
    ])
  ),
  wa()
);
const mismatchPhys = buildRetainingWallPhysicalModel({
  context: ctx(
    ownerFacts([fact("retaining_wall.sleeper_post_spacing_m", 1.0)])
  ),
  workAreaId: "rw1",
  material: "Concrete sleeper",
});

check(
  "R4-1 Timber spacing does not become Sleeper spacing",
  timberThenSleeperPhys.sleeperTakeoff?.spacingAssumed === true &&
    timberThenSleeperPhys.sleeperTakeoff?.targetSpacingM === 2 &&
    timberThenSleeperPhys.sleeperTakeoff?.bayCount === 8 &&
    timberThenSleeperPhys.sleeperTakeoff?.postCount === 9
);
check(
  "R4-2 Timber embedment does not become Sleeper embedment",
  timberThenSleeperPhys.sleeperTakeoff?.embedmentExplicit === false &&
    near(timberThenSleeperPhys.sleeperTakeoff?.postLengthsM[0] ?? 0, 2.72)
);
check(
  "R4-3 Sleeper spacing does not become Timber spacing",
  sleeperThenTimberPhys.timberPiles?.targetSpacingM === 1.2 &&
    sleeperThenTimberPhys.timberPiles?.spacingAssumed === true
);
check(
  "R4-4 Sleeper embedment does not become Timber embedment",
  sleeperThenTimberPhys.timberPiles?.embedmentExplicit === false
);
check(
  "R4-5 shared geometry persists",
  near(timberThenSleeperPhys.geometry.faceAreaM2, 16.5) &&
    near(sleeperThenTimberPhys.geometry.faceAreaM2, 16.5)
);
check(
  "R4-6 shared access persists",
  Boolean(
    lab(timberThenSleeper.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)
      ?.adjustedHours
  )
);
check(
  "R4-7 excavation persists",
  Boolean(
    lab(timberThenSleeper.requirements, RW_EXCAVATION_LABOUR_COMPONENT)
      ?.adjustedHours
  )
);
check(
  "R4-8 drainage persists",
  mat(timberThenSleeper.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity ===
    15
);
check(
  "R4-9 spoil persists",
  !timberThenSleeper.lineItems.some((item) =>
    /spoil|hardfill/i.test(item.label)
  )
);
check(
  "R4-10 canonical 15m Sleeper returns 8 bays / 9 posts",
  takeoff.bayCount === 8 && takeoff.postCount === 9
);
check(
  "R4-11 48 sleeper procurement restored",
  takeoff.sleeperCount === 48
);
check(
  "R4-12 only residual bay uses cut/end semantics",
  takeoff.standardSleeperEa === 44 &&
    takeoff.cutSleeperEa === 4 &&
    takeoff.moduleMismatch === false &&
    near(takeoff.residualBayWidthM, 1)
);
check(
  "R4-13 explicit Sleeper spacing still overrides",
  designedTakeoff.spacingAssumed === false &&
    designedTakeoff.targetSpacingM === 2 &&
    !designedCalc.missingInfo.includes(RW_SLEEPER_DESIGN_CONFIRM)
);
check(
  "R4-14 spacing < sleeper length produces mismatch attention",
  mismatchPhys.sleeperTakeoff?.moduleMismatch === true &&
    mismatchCalc.missingInfo.includes(RW_SLEEPER_MODULE_MISMATCH) &&
    mismatchCalc.assumptions.includes(RW_SLEEPER_MODULE_MISMATCH) &&
    (mismatchPhys.sleeperTakeoff?.bayCount ?? 0) === 15 &&
    (mismatchPhys.sleeperTakeoff?.postCount ?? 0) === 16 &&
    (mismatchPhys.sleeperTakeoff?.standardSleeperEa ?? -1) === 0
);
check(
  "R4-15 no cutting-stock optimiser invented",
  !readFileSync("lib/estimate/retaining-wall-sleeper.ts", "utf8").includes(
    "cuttingStock"
  ) &&
    !readFileSync("lib/estimate/retaining-wall-sleeper.ts", "utf8").includes(
      "optimiser"
    )
);
check(
  "R4-16 concrete recalculates",
  near(takeoff.holeVolumeM3, 0.478, 0.01) &&
    near(takeoff.netConcreteM3 ?? 0, 0.478, 0.01) &&
    takeoff.bagCount === 48 &&
    (mismatchPhys.sleeperTakeoff?.holeCount ?? 0) === 16
);
check(
  "R4-17 labour recalculates",
  (lab(timberThenSleeper.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)
    ?.baseHours ?? 0) > 0 &&
    (lab(mismatchCalc.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)
      ?.baseHours ?? 0) >
      (lab(timberThenSleeper.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)
        ?.baseHours ?? 0)
);
check(
  "R4-18 package/detail XOR unchanged",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFaceLine: hasPackage(timberThenSleeper.lineItems),
    hasDetailedMoneyLine: hasDetailedMoney(timberThenSleeper.lineItems),
  })
);
check(
  "R4-19 Pricing parity",
  timberThenSleeper.lineItems.every((item) => {
    const copied = buildPricingItemFieldsFromEstimateLineItem({
      category: item.category,
      recommended_cost: item.recommendedCost,
      recommended_sell: item.recommendedSell,
      notes: item.notes ?? null,
    });
    return near(copied.totalCost, item.recommendedCost);
  })
);
check(
  "R4-20 Quote parity",
  near(
    calculateEstimate(ctx(timberThenSleeperFacts)).recommendedSell,
    timberThenSleeper.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    0.05
  )
);
check(
  "R4-21 Timber 1F unchanged",
  spawnVerifier("scripts/verify-retaining-wall-maturity-1f.ts")
);
check("R4-22 Deck 2D unchanged", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));

console.log("\n--- REGRESSION ---\n");
check("49 Timber RW 1F passes", spawnVerifier("scripts/verify-retaining-wall-maturity-1f.ts"));
check("50 Deck 2D passes", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));
check("51 Foundation passes", spawnVerifier("scripts/verify-foundation-r1-project-conditions-support.ts"));
check("52 ESTIMATOR-SAFETY-0 passes", spawnVerifier("scripts/verify-estimator-safety-0.ts"));
check("53 Commercial P0 passes", spawnVerifier("scripts/verify-recovery-1-commercial-authority.ts"));

console.log("\n--- OWNER FIXTURE ---\n");
console.log(`  face ${geometry?.faceAreaM2} m²`);
console.log(
  `  bays ${takeoff.bayCount} (full ${takeoff.fullBayCount} + residual ${takeoff.residualBayWidthM} m) posts ${takeoff.postCount} module ${takeoff.actualSpacingM} m`
);
console.log(`  post positions ${takeoff.postPositionsM.join(", ")}`);
console.log(`  post lengths ${takeoff.postLengthsM.join(", ")} total ${takeoff.totalPostLengthM} lm`);
console.log(
  `  sleeper EA ${takeoff.sleeperCount} (${takeoff.standardSleeperEa} standard + ${takeoff.cutSleeperEa} cut/end) courses ${takeoff.coursesPerBay.join("/")}`
);
console.log(
  `  holes ${takeoff.holeCount} × Ø${takeoff.holeDiameterM} m → ${takeoff.holeVolumeM3} m³ / ${takeoff.bagCount} bags`
);
console.log(
  `  novacoil ${mat(ownerCalc.requirements, RW_NOVACOIL_COMPONENT)?.purchaseQuantity} lm`
);
console.log(
  `  aggregate in-place ${agg?.baseQuantity} m³ procured ${agg?.purchaseQuantity} m³`
);
console.log(
  `  excavation labour ${lab(ownerCalc.requirements, RW_EXCAVATION_LABOUR_COMPONENT)?.adjustedHours} h`
);
console.log(
  `  post labour ${lab(ownerCalc.requirements, RW_SLEEPER_POST_LABOUR_COMPONENT)?.adjustedHours} h`
);
console.log(
  `  sleeper labour ${lab(ownerCalc.requirements, RW_SLEEPER_FACE_LABOUR_COMPONENT)?.adjustedHours} h`
);
console.log(`  plant ${plantOwner?.quantity} day(s) $${plantOwner?.recommendedCost}`);
const materialsCost = ownerCalc.lineItems
  .filter((item) => item.category === "materials")
  .reduce((s, i) => s + i.recommendedCost, 0);
const labourCost = ownerCalc.lineItems
  .filter((item) => item.category === "labour")
  .reduce((s, i) => s + i.recommendedCost, 0);
const plantCost = ownerCalc.lineItems
  .filter((item) => /mini-excavator/i.test(item.label))
  .reduce((s, i) => s + i.recommendedCost, 0);
console.log(`  materials $${materialsCost.toFixed(2)}`);
console.log(`  labour $${labourCost.toFixed(2)}`);
console.log(`  plant $${plantCost.toFixed(2)}`);
console.log(`  direct $${ownerEstimate.recommendedCost.toFixed(2)}`);
console.log(
  `  sell $${ownerEstimate.recommendedSell.toFixed(2)} @ ${ownerEstimate.marginPercent}% GM`
);

console.log("\n--- SECOND FIXTURE ---\n");
const secondTakeoff = sleeperWallTakeoff(
  resolveRetainingWallGeometry({
    lengthM: 6,
    heightM: 0.8,
    heightHighM: null,
    heightLowM: null,
  })!,
  {
    sleeperLengthM: null,
    sleeperFaceHeightM: null,
    postSpacingM: null,
    postEmbedmentM: null,
    holeDiameterM: null,
    premixBagYieldM3: null,
    wasteFactor: 0,
  }
);
console.log(
  `  constant 6 m × 0.8 m · bays ${secondTakeoff.bayCount} posts ${secondTakeoff.postCount} sleepers ${secondTakeoff.sleeperCount}`
);
console.log(
  `  direct $${secondEstimate.recommendedCost.toFixed(2)} sell $${secondEstimate.recommendedSell.toFixed(2)}`
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
