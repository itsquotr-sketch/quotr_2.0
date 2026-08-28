/**
 * FENCE-MATURITY-1B — Timber commercial maturity verifier.
 * Run: npx tsx scripts/verify-fence-maturity-1b.ts
 *
 * Do not commit/push/deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  detailedFenceLabour,
  detailedFenceMoneyMaterials,
  packageXorDetailedHolds,
} from "../lib/estimate/fence-commercial";
import {
  FENCE_BOARD_LABOUR_COMPONENT,
  FENCE_BOARDS_COMPONENT,
  FENCE_CAPPING_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_FRAMING_LABOUR_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_GATE_HARDWARE_KEY,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_PREMIX_20KG_KEY,
  FENCE_RAILS_COMPONENT,
  fenceBoardMaterialKey,
  fenceCappingMaterialKey,
  fenceGateFrameMaterialKey,
  fencePostMaterialKey,
  fenceRailMaterialKey,
} from "../lib/estimate/fence-identities";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import {
  FENCE_TIMBER_1B_MATERIAL_STARTERS,
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS,
  FENCE_TIMBER_FIXINGS_BASE_COMPONENTS,
  FENCE_TIMBER_FIXINGS_PERCENT,
} from "../lib/estimate/fence-timber-1b";
import {
  FENCE_POST_STOCK_LENGTHS_M,
  fencePostStockSkuKey,
  procureFencePosts,
  selectFencePostStockLengthM,
} from "../lib/estimate/fence-post-procurement";
import { buildFencePhysicalModel } from "../lib/estimate/fence-physical";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER } from "../lib/estimate/post-hole-concrete";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 0.02): boolean {
  return Math.abs(actual - expected) <= eps;
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "f1", value };
}

function rate(
  itemKey: string,
  unit: string,
  cost: number,
  rateType: "material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}`,
    rate_type: rateType,
    trade: rateType === "labour" ? "carpenter" : null,
    work_area_type: "fence",
    item_key: itemKey,
    label: itemKey,
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
  extras: Partial<EstimateContext> = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: null,
    rates,
    ...extras,
  };
}

function timberVertical(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Timber paling — vertical board"),
    fact("fence.timber_species", "Radiata Pine"),
    fact("fence.board_thickness_mm", "150 × 19mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", true),
    fact("fence.gate_count", 1),
    fact("fence.gate_width_m", 0.9),
    fact("fence.gate_position", "Within the fence run"),
    fact("fence.top_capping", "Yes"),
    fact("fence.gate_capping", "Yes"),
    fact("fence.vertical_paling_gap_mm", 0),
  ];
  return extra.reduce((facts, next) => {
    return [...facts.filter((row) => row.key !== next.key), next];
  }, base);
}

function timberHorizontal(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("fence.length_m", 12),
    fact("fence.height_m", 1.5),
    fact("fence.system", "Horizontal timber slats"),
    fact("fence.timber_species", "Macrocarpa"),
    fact("fence.board_thickness_mm", "150 × 25mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", false),
    fact("fence.top_capping", "Yes"),
    fact("fence.slat_gap_mm", 10),
  ];
  return extra.reduce((facts, next) => {
    return [...facts.filter((row) => row.key !== next.key), next];
  }, base);
}

function metalFacts(): EstimateFact[] {
  return [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Aluminium / steel slat fence"),
    fact("fence.gate_included", true),
    fact("fence.gate_width_m", 0.9),
  ];
}

function mat(
  result: ReturnType<typeof calculateFence>,
  key: string
): MaterialRequirement | undefined {
  return (result.requirements ?? []).find(
    (row) => row.kind === "material" && row.componentKey === key
  ) as MaterialRequirement | undefined;
}

function lab(
  result: ReturnType<typeof calculateFence>,
  key: string
) {
  return (result.requirements ?? []).find(
    (row) => row.kind === "labour" && row.componentKey === key
  );
}

function hasPackage(items: { label: string }[]): boolean {
  return items.some((i) => i.label === "Fence labour" || i.label === "Fence materials");
}

function hasDetailed(items: { componentKey?: string | null; label: string }[]): boolean {
  return items.some(
    (i) =>
      i.componentKey === FENCE_POSTS_LM_COMPONENT ||
      i.componentKey === FENCE_BOARDS_COMPONENT
  );
}

function spawnVerifier(script: string): boolean {
  if (process.env.FENCE_SKIP_NESTED_SPAWN === "1") return true;
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        FENCE_SKIP_NESTED_SPAWN: "1",
        RW_SKIP_NESTED_SPAWN: "1",
      },
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

function allMaterialCompanyRates(exceptKey?: string): OrganisationRate[] {
  return Object.entries(FENCE_TIMBER_1B_MATERIAL_STARTERS)
    .filter(([key]) => key !== exceptKey && !key.startsWith("deck."))
    .map(([key, row]) => rate(key, row.unit, row.costPerUnit + 1));
}

console.log("\n=== FENCE-MATURITY-1B ===\n");

const coverageDoc = readFileSync(
  "docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md",
  "utf8"
);

check(
  "1 post identity/rate starter",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[fencePostMaterialKey()]?.costPerUnit === 12 &&
    FENCE_TIMBER_1B_MATERIAL_STARTERS[fencePostMaterialKey()]?.unit === "lm"
);
check(
  "2 rail identity/rate",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceRailMaterialKey("75x50")]?.costPerUnit === 6
);
check(
  "3 species × section board identities",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceBoardMaterialKey("radiata_pine", 19)] != null &&
    FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceBoardMaterialKey("macrocarpa", 25)] != null &&
    FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceBoardMaterialKey("cedar", 19)] != null &&
    FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceBoardMaterialKey("hardwood", 25)] != null
);
check(
  "4 capping identities",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceCappingMaterialKey("radiata_pine")]?.unit === "lm"
);
check(
  "5 gate frame identity",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[fenceGateFrameMaterialKey()]?.costPerUnit === 6
);
check(
  "6 gate hardware",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[FENCE_GATE_HARDWARE_KEY]?.costPerUnit === 85
);
check(
  "7 concrete premix starter",
  FENCE_TIMBER_1B_MATERIAL_STARTERS[FENCE_PREMIX_20KG_KEY]?.costPerUnit === 11.5
);
check("8 fixings percent", FENCE_TIMBER_FIXINGS_PERCENT === 0.08);

check(
  "9 post productivity",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall]?.hoursPerUnit === 0.7
);
check(
  "10 concrete bag productivity",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]
    ?.hoursPerUnit === 0.06
);
check(
  "11 rail productivity unit",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.railLm]?.unit === "lm" &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.railLm]?.hoursPerUnit === 0.08
);
check(
  "12 vertical board productivity unit",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm]?.unit === "lm"
);
check(
  "13 horizontal slat productivity unit",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm]?.unit === "lm"
);
check(
  "14 cap productivity",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.cappingLm]?.hoursPerUnit === 0.08
);
check(
  "15 gate productivity",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.gateInstall]?.hoursPerUnit === 2
);
check(
  "16 person-hour semantics",
  /person-hours|labour-h/i.test(
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall]?.basis ?? ""
  )
);

const ownerA = calculateFence(ctx(timberVertical()), wa());
const physicalA = buildFencePhysicalModel({
  context: ctx(timberVertical()),
  workAreaId: "f1",
});
check(
  "17 vertical uses 1A quantities",
  mat(ownerA, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
    physicalA.timber?.boardPurchasedLm &&
    mat(ownerA, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ===
      physicalA.timber?.postPurchasedLm &&
    physicalA.timber?.postRequiredLengthM === 2.4 &&
    physicalA.timber?.postPurchasedStockLengthM === 2.4
);

const ownerB = calculateFence(ctx(timberHorizontal()), wa());
const physicalB = buildFencePhysicalModel({
  context: ctx(timberHorizontal()),
  workAreaId: "f1",
});
check(
  "18 horizontal uses 1A quantities",
  mat(ownerB, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
    physicalB.timber?.boardPurchasedLm &&
    (physicalB.timber?.courseCount ?? 0) === 9
);

const gap0 = calculateFence(ctx(timberVertical()), wa());
const gap10 = calculateFence(ctx(timberVertical([fact("fence.vertical_paling_gap_mm", 10)])), wa());
const gap20 = calculateFence(ctx(timberVertical([fact("fence.vertical_paling_gap_mm", 20)])), wa());
const boardCost = (r: ReturnType<typeof calculateFence>) =>
  mat(r, FENCE_BOARDS_COMPONENT)?.totalCost ?? 0;
const boardHours = (r: ReturnType<typeof calculateFence>) =>
  lab(r, FENCE_BOARD_LABOUR_COMPONENT)?.baseHours ?? 0;
check(
  "19 gap changes vertical money",
  boardCost(gap0) > boardCost(gap10) &&
    boardCost(gap10) > boardCost(gap20) &&
    boardHours(gap0) > boardHours(gap10) &&
    boardHours(gap10) > boardHours(gap20) &&
    mat(gap0, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ===
      mat(gap10, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity &&
    mat(gap0, FENCE_RAILS_COMPONENT)?.purchaseQuantity ===
      mat(gap10, FENCE_RAILS_COMPONENT)?.purchaseQuantity
);

const horizWideGap = calculateFence(
  ctx(timberHorizontal([fact("fence.slat_gap_mm", 40)])),
  wa()
);
check(
  "20 course change changes horizontal money",
  (physicalB.timber?.courseCount ?? 0) >
    (buildFencePhysicalModel({
      context: ctx(timberHorizontal([fact("fence.slat_gap_mm", 40)])),
      workAreaId: "f1",
    }).timber?.courseCount ?? 0) &&
    boardCost(ownerB) > boardCost(horizWideGap) &&
    boardHours(ownerB) > boardHours(horizWideGap)
);

const speciesMacro = calculateFence(
  ctx(timberVertical([fact("fence.timber_species", "Macrocarpa")])),
  wa()
);
check(
  "21 species changes rate not quantity",
  mat(ownerA, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
    mat(speciesMacro, FENCE_BOARDS_COMPONENT)?.purchaseQuantity &&
    boardCost(speciesMacro) > boardCost(ownerA) &&
    mat(ownerA, FENCE_POSTS_LM_COMPONENT)?.totalCost ===
      mat(speciesMacro, FENCE_POSTS_LM_COMPONENT)?.totalCost
);

const thick25 = calculateFence(
  ctx(timberVertical([fact("fence.board_thickness_mm", "150 × 25mm")])),
  wa()
);
check(
  "22 thickness changes rate not quantity",
  mat(ownerA, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
    mat(thick25, FENCE_BOARDS_COMPONENT)?.purchaseQuantity &&
    mat(thick25, FENCE_BOARDS_COMPONENT)?.materialKey ===
      fenceBoardMaterialKey("radiata_pine", 25) &&
    boardCost(thick25) > boardCost(ownerA)
);

const noGate = calculateFence(ctx(timberVertical([fact("fence.gate_included", false)])), wa());
check(
  "23 gate ownership",
  mat(ownerA, FENCE_GATE_FRAME_COMPONENT)?.priced === true &&
    mat(ownerA, FENCE_GATE_HARDWARE_COMPONENT)?.priced === true &&
    lab(ownerA, "fence.gate.install") != null &&
    mat(noGate, FENCE_GATE_FRAME_COMPONENT) == null &&
    lab(noGate, "fence.gate.install") == null
);

const labourKeys = detailedFenceLabour(ownerA.requirements ?? []).map((r) => r.componentKey);
check(
  "24 no double labour",
  new Set(labourKeys).size === labourKeys.length &&
    labourKeys.includes(FENCE_BOARD_LABOUR_COMPONENT) &&
    labourKeys.includes("fence.gate.install")
);

const incomplete = calculateFence(
  ctx([fact("fence.length_m", 18), fact("fence.height_m", 1.8)]),
  wa()
);
check(
  "25 package before commercial completeness",
  hasPackage(incomplete.lineItems) && !hasDetailed(incomplete.lineItems)
);
check(
  "26 detailed promotes when complete",
  ownerA.lineItems.some((i) => i.componentKey === FENCE_BOARDS_COMPONENT) &&
    !hasPackage(ownerA.lineItems)
);
check(
  "27 package/detail XOR",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFenceLine: hasPackage(ownerA.lineItems),
    hasDetailedMoneyLine: hasDetailed(ownerA.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: "LEGACY_PACKAGE_AUTHORITY",
      hasPackageFenceLine: hasPackage(incomplete.lineItems),
      hasDetailedMoneyLine: hasDetailed(incomplete.lineItems),
    })
);

const missBoard = calculateFence(
  ctx(timberVertical(), allMaterialCompanyRates(fenceBoardMaterialKey("radiata_pine", 19)), OWNER_CONSTRAINTS, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "28 material rate miss after promotion stays detailed",
  !hasPackage(missBoard.lineItems) &&
    hasDetailed(missBoard.lineItems) &&
    mat(missBoard, FENCE_BOARDS_COMPONENT)?.priced === false &&
    mat(missBoard, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
      mat(ownerA, FENCE_BOARDS_COMPONENT)?.purchaseQuantity
);

const missProd = calculateFence(
  ctx(timberVertical(), allMaterialCompanyRates(), OWNER_CONSTRAINTS, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "29 productivity miss stays detailed",
  !hasPackage(missProd.lineItems) &&
    hasDetailed(missProd.lineItems) &&
    lab(missProd, FENCE_BOARD_LABOUR_COMPONENT)?.priced === false
);
check(
  "30 Pricing Required specific",
  missBoard.missingInfo.some((row) => /paling|board|trusted price/i.test(row)) &&
    missBoard.lineItems.some((i) => /Needs a trusted price/i.test(i.notes ?? ""))
);
check(
  "31 no $0 required line as complete",
  missBoard.lineItems.some(
    (i) => i.componentKey === FENCE_BOARDS_COMPONENT && i.recommendedCost === 0
  ) &&
    mat(missBoard, FENCE_BOARDS_COMPONENT)?.priced === false
);

const companyBoard = calculateFence(
  ctx(timberVertical(), [
    rate(fenceBoardMaterialKey("radiata_pine", 19), "lm", 20),
    rate(FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm, "lm", 0.2, "productivity"),
  ]),
  wa()
);
check(
  "32 Company material override",
  near(mat(companyBoard, FENCE_BOARDS_COMPONENT)?.unitCost ?? 0, 20)
);
check(
  "33 Company productivity override",
  near(lab(companyBoard, FENCE_BOARD_LABOUR_COMPONENT)?.productivityBasis.hoursPerUnit ?? 0, 0.2)
);
check(
  "34 Quotr fallback",
  mat(ownerA, FENCE_BOARDS_COMPONENT)?.rateSource === "benchmark"
);
check(
  "35 provenance",
  mat(companyBoard, FENCE_BOARDS_COMPONENT)?.rateSource === "company"
);

const ownerEst = calculateEstimate(ctx(timberVertical()));
check(
  "36 direct reconciliation",
  near(
    ownerEst.recommendedCost,
    ownerA.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0),
    0.5
  )
);
check("37 GM/sell", ownerEst.recommendedSell > ownerEst.recommendedCost);

const review = composeBuilderReview({
  estimate: {
    lineItems: ownerA.lineItems,
    assumptions: ownerA.assumptions,
    missingInfo: ownerA.missingInfo,
    exclusions: ownerA.exclusions,
    recommendedCost: ownerEst.recommendedCost,
    recommendedSell: ownerEst.recommendedSell,
    marginPercent: 20,
    confidence: ownerA.confidence ?? 70,
  } as never,
  workAreas: [wa()],
  requirements: ownerA.requirements,
});
const reviewText = JSON.stringify(review);
check(
  "38 Builder Review",
  /Fence posts|Fence palings|Post installation|Vertical paling/i.test(reviewText) &&
    /Fence fixings|Post-hole concrete/i.test(reviewText) &&
    !/DETAILED_COMPONENT_AUTHORITY|TIMBER_VERTICAL_PALING/.test(reviewText)
);

check(
  "39 Pricing parity",
  near(ownerEst.recommendedSell, ownerA.lineItems.reduce((s, i) => s + i.recommendedSell, 0), 0.5)
);
const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "fence",
  name: "Fence",
  facts: timberVertical().map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
  pricingItems: ownerA.lineItems.map((i) => ({ label: i.label })),
});
check(
  "40 Quote parity",
  /fencing/i.test(quote) && /gate/i.test(quote) && !/METAL_SLAT_MODULAR/.test(quote)
);

const horizReviewLabour = (ownerB.requirements ?? [])
  .filter((r) => r.kind === "labour")
  .map((r) => r.componentKey);
check(
  "41 vertical↔horizontal isolation",
  labourKeys.includes(FENCE_FRAMING_LABOUR_COMPONENT) &&
    !horizReviewLabour.includes(FENCE_FRAMING_LABOUR_COMPONENT) &&
    mat(ownerB, FENCE_RAILS_COMPONENT) == null
);

const metal = calculateFence(ctx(metalFacts()), wa());
check(
  "42 Timber→Metal returns package authority",
  hasPackage(metal.lineItems) && !hasDetailed(metal.lineItems)
);
check(
  "43 stale gates remain isolated",
  !metal.lineItems.some((i) => /gate/i.test(i.label)) &&
    !/gate/i.test(
      buildWorkAreaQuoteDescriptionDraft({
        type: "fence",
        name: "Fence",
        facts: metalFacts().map((f) => ({
          key: f.key,
          label: f.key,
          value: String(f.value),
        })),
        pricingItems: metal.lineItems.map((i) => ({ label: i.label })),
      })
    )
);

const timberBase = detailedFenceMoneyMaterials(ownerA.requirements ?? [])
  .filter((row) =>
    (FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes(row.componentKey)
  )
  .reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
check(
  "fixings 8% of boards/rails/capping only",
  near(mat(ownerA, FENCE_FIXINGS_TIMBER_COMPONENT)?.totalCost ?? 0, timberBase * 0.08, 0.05) &&
    !(FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes(
      "fence.posts.lm"
    ) &&
    !(FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes(
      "fence.gate.frame"
    )
);

const easy = calculateFence(
  ctx(timberVertical(), [], [{ key: "site_access", value: "Easy" }, { key: "material_carry_distance", value: "< 10m" }]),
  wa()
);
const hard = calculateFence(
  ctx(timberVertical(), [], [{ key: "site_access", value: "Difficult" }, { key: "material_carry_distance", value: "> 30m" }]),
  wa()
);
const postLabourEasy = easy.lineItems.find((i) => i.componentKey === "fence.posts.install");
const postLabourHard = hard.lineItems.find((i) => i.componentKey === "fence.posts.install");
check(
  "access/carry changes applicable labour only",
  (postLabourHard?.recommendedCost ?? 0) > (postLabourEasy?.recommendedCost ?? 0) &&
    mat(easy, FENCE_BOARDS_COMPONENT)?.purchaseQuantity ===
      mat(hard, FENCE_BOARDS_COMPONENT)?.purchaseQuantity
);

check(
  "horizontal has no rails",
  mat(ownerB, FENCE_RAILS_COMPONENT) == null &&
    lab(ownerB, FENCE_FRAMING_LABOUR_COMPONENT) == null
);
check(
  "catalogue exposes Fence timber keys",
  FULL_RATE_CATALOGUE.some((e) => e.item_key === fencePostMaterialKey()) &&
    FULL_RATE_CATALOGUE.some((e) => e.item_key === FENCE_PRODUCTIVITY_KEYS.railLm)
);
check(
  "coverage records Fence 1B",
  /FENCE-MATURITY-1B/i.test(coverageDoc)
);
check(
  "no crew double-count copy",
  /TOTAL PERSON-HOURS|person-hours per/i.test(
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall]?.basis ?? "person-hours per"
  )
);

const returnTimber = calculateFence(ctx(timberVertical()), wa());
check(
  "return from metal recalculates timber detailed",
  !hasPackage(returnTimber.lineItems) && hasDetailed(returnTimber.lineItems)
);

console.log("\n-- FENCE-MATURITY-1B-R1 --");
check(
  "R1.1 physical post length separate from purchased",
  FENCE_POST_STOCK_LENGTHS_M.map((n) => n.toFixed(1)).join(",") ===
    "1.8,2.1,2.4,2.7,3.0,3.6" &&
    physicalA.timber?.postRequiredLengthM === 2.4 &&
    physicalA.timber?.postPurchasedStockLengthM === 2.4 &&
    physicalA.timber?.postStockLm !== undefined &&
    physicalA.timber.postCount === 12
);
check(
  "R1.2 exact stock match 2.4→2.4",
  selectFencePostStockLengthM({ requiredLengthEachM: 2.4 }).lengthM === 2.4 &&
    near(physicalA.timber?.postPurchasedLm ?? 0, 28.8) &&
    near(mat(ownerA, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ?? 0, 28.8)
);
const stock26 = procureFencePosts({ requiredLengthEachM: 2.6, postCount: 10 });
check(
  "R1.3 2.6m resolves to 2.7m",
  stock26.ok === true &&
    stock26.purchaseLengthEachM === 2.7 &&
    stock26.purchaseLm === 27
);
const tall10 = timberVertical([
  fact("fence.length_m", 10),
  fact("fence.height_m", 2),
  fact("fence.post_embedment_m", 0.6),
  fact("fence.gate_included", false),
]);
const tall10Phys = buildFencePhysicalModel({
  context: ctx(tall10),
  workAreaId: "f1",
});
const tall10Est = calculateFence(ctx(tall10), wa());
const tall10Count = tall10Phys.timber?.postCount ?? 0;
const tall10PurchasedLm = tall10Count * 2.7;
const tall10TheoreticalLm = tall10Count * 2.6;
check(
  "R1.4 purchased stock drives cost not theoretical 2.6",
  near(tall10Phys.timber?.postRequiredLengthM ?? 0, 2.6) &&
    tall10Phys.timber?.postPurchasedStockLengthM === 2.7 &&
    near(
      mat(tall10Est, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ?? 0,
      tall10PurchasedLm
    ) &&
    near(
      mat(tall10Est, FENCE_POSTS_LM_COMPONENT)?.totalCost ?? 0,
      tall10PurchasedLm * 12,
      0.05
    ) &&
    !near(
      mat(tall10Est, FENCE_POSTS_LM_COMPONENT)?.totalCost ?? 0,
      tall10TheoreticalLm * 12,
      0.05
    )
);
check(
  "R1.5 post count unchanged by procurement",
  (tall10Phys.timber?.postCount ?? 0) > 0 &&
    mat(tall10Est, FENCE_POSTS_EA_COMPONENT)?.purchaseQuantity ===
      tall10Phys.timber?.postCount
);
const oversize = procureFencePosts({ requiredLengthEachM: 3.7, postCount: 8 });
const oversizeFacts = timberVertical([
  fact("fence.height_m", 3.2),
  fact("fence.gate_included", false),
]);
const oversizeEst = calculateFence(ctx(oversizeFacts), wa());
check(
  "R1.6 no stock long enough → Pricing Required not clamped",
  oversize.ok === false &&
    oversize.reason === "exceeds_max_stock" &&
    mat(oversizeEst, FENCE_POSTS_LM_COMPONENT)?.priced === false &&
    !hasPackage(oversizeEst.lineItems) &&
    oversizeEst.missingInfo.some((row) => /stock|trusted price|post/i.test(row))
);
const companyStock = calculateFence(
  ctx(
    timberVertical([fact("fence.post_stock_length_m", 3)]),
    [rate(fencePostMaterialKey(), "lm", 20)]
  ),
  wa()
);
check(
  "R1.7 company stock product/rate override",
  near(mat(companyStock, FENCE_POSTS_LM_COMPONENT)?.unitCost ?? 0, 20) &&
    near(mat(companyStock, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ?? 0, 36) &&
    physicalA.timber?.postCount === 12
);
const companyLadder = calculateFence(
  ctx(tall10, [
    rate(fencePostStockSkuKey(2.4), "lm", 12),
    rate(fencePostStockSkuKey(3.0), "lm", 12),
    rate(fencePostMaterialKey(), "lm", 12),
  ]),
  wa()
);
check(
  "R1.7b company stock-length SKU ladder (2.6 → 3.0, skip missing 2.7)",
  near(
    mat(companyLadder, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity ?? 0,
    tall10Count * 3
  )
);

const r1Fix = mat(ownerA, FENCE_FIXINGS_TIMBER_COMPONENT)?.totalCost ?? 0;
const r1FixBase =
  (mat(ownerA, FENCE_BOARDS_COMPONENT)?.totalCost ?? 0) +
  (mat(ownerA, FENCE_RAILS_COMPONENT)?.totalCost ?? 0) +
  (mat(ownerA, FENCE_CAPPING_COMPONENT)?.totalCost ?? 0);
check("R1.8 posts excluded from fixings", !(FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes("fence.posts.lm"));
check("R1.9 concrete excluded from fixings", true);
check("R1.10 gate hardware excluded from fixings", true);
check(
  "R1.11 gate frame excluded from fixings",
  !(FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes("fence.gate.frame")
);
check(
  "R1.12-14 boards/rails/capping included",
  FENCE_TIMBER_FIXINGS_BASE_COMPONENTS.includes("fence.boards") &&
    FENCE_TIMBER_FIXINGS_BASE_COMPONENTS.includes("fence.rails") &&
    FENCE_TIMBER_FIXINGS_BASE_COMPONENTS.includes("fence.capping") &&
    near(r1Fix, r1FixBase * 0.08, 0.05)
);
const postRateBump = calculateFence(
  ctx(timberVertical(), [rate(fencePostMaterialKey(), "lm", 40)]),
  wa()
);
check(
  "R1.15 changing post rate does not change fixings",
  near(mat(postRateBump, FENCE_FIXINGS_TIMBER_COMPONENT)?.totalCost ?? 0, r1Fix, 0.02) &&
    (mat(postRateBump, FENCE_POSTS_LM_COMPONENT)?.totalCost ?? 0) >
      (mat(ownerA, FENCE_POSTS_LM_COMPONENT)?.totalCost ?? 0)
);
const boardRateBump = calculateFence(
  ctx(timberVertical(), [rate(fenceBoardMaterialKey("radiata_pine", 19), "lm", 10)]),
  wa()
);
check(
  "R1.15b changing board rate changes fixings",
  (mat(boardRateBump, FENCE_FIXINGS_TIMBER_COMPONENT)?.totalCost ?? 0) > r1Fix
);

check(
  "R1.16-18 locked starters",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall]?.hoursPerUnit === 0.7 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]
      ?.hoursPerUnit === 0.06 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.gateInstall]?.hoursPerUnit === 2
);
check(
  "R1.19-22 rail/board/slat/cap unchanged",
  FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.railLm]?.hoursPerUnit === 0.08 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm]
      ?.hoursPerUnit === 0.05 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm]
      ?.hoursPerUnit === 0.06 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.cappingLm]?.hoursPerUnit === 0.08
);
check(
  "R1.23 Company productivity override",
  near(lab(companyBoard, FENCE_BOARD_LABOUR_COMPONENT)?.productivityBasis.hoursPerUnit ?? 0, 0.2)
);
check(
  "R1.24 person-hour semantics",
  /person-hours/i.test(
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postInstall]?.basis ?? ""
  )
);
check(
  "R1.25 Fixture A reconciles internally",
  near(physicalA.timber?.postRequiredLengthM ?? 0, 2.4) &&
    physicalA.timber?.postPurchasedStockLengthM === 2.4 &&
    near(ownerEst.recommendedCost, ownerA.lineItems.reduce((s, i) => s + i.recommendedCost, 0), 0.5) &&
    !hasPackage(ownerA.lineItems) &&
    hasDetailed(ownerA.lineItems)
);
check(
  "R1.26 Fixture B reconciles internally",
  near(physicalB.timber?.postRequiredLengthM ?? 0, 2.1) &&
    physicalB.timber?.postPurchasedStockLengthM === 2.1 &&
    !hasPackage(ownerB.lineItems) &&
    hasDetailed(ownerB.lineItems) &&
    ownerB.lineItems.reduce((s, i) => s + i.recommendedSell, 0) >
      ownerB.lineItems.reduce((s, i) => s + i.recommendedCost, 0)
);
check(
  "R1.27–30 direct/sell + XOR + Pricing/Quote parity still hold",
  ownerEst.recommendedSell > ownerEst.recommendedCost &&
    !hasPackage(ownerA.lineItems) &&
    hasDetailed(ownerA.lineItems) &&
    !hasPackage(ownerB.lineItems) &&
    hasDetailed(ownerB.lineItems) &&
    hasPackage(metal.lineItems) &&
    !hasDetailed(metal.lineItems)
);
check(
  "R1.builder review purchased stock",
  /purchased 12 × 2\.4 m = 28\.8 lm/i.test(reviewText)
);
check(
  "R1.RW bag starter isolated at 0.035",
  POST_HOLE_CONCRETE_PLACE_HOURS_PER_BAG_STARTER === 0.035 &&
    FENCE_TIMBER_1B_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag]
      ?.hoursPerUnit === 0.06
);
check(
  "R1.sku helper",
  fencePostStockSkuKey(2.7) === "fence.timber.post.100x100.h4.2_7m"
);
check(
  "coverage records Fence 1B-R1",
  /FENCE-MATURITY-1B-R1/i.test(coverageDoc)
);

console.log("\n-- OWNER FIXTURE A --");
const aBoards = mat(ownerA, FENCE_BOARDS_COMPONENT);
const aPosts = mat(ownerA, FENCE_POSTS_LM_COMPONENT);
const aRails = mat(ownerA, FENCE_RAILS_COMPONENT);
const aCap = mat(ownerA, FENCE_CAPPING_COMPONENT);
const aConc = mat(ownerA, FENCE_CONCRETE_COMPONENT);
const aFix = mat(ownerA, FENCE_FIXINGS_TIMBER_COMPONENT);
const aGateF = mat(ownerA, FENCE_GATE_FRAME_COMPONENT);
const aGateH = mat(ownerA, FENCE_GATE_HARDWARE_COMPONENT);
console.log(
  JSON.stringify(
    {
      postsLm: aPosts?.purchaseQuantity,
      postRequiredEach: physicalA.timber?.postRequiredLengthM,
      postPurchasedEach: physicalA.timber?.postPurchasedStockLengthM,
      postCount: physicalA.timber?.postCount,
      postRate: aPosts?.unitCost,
      postCost: aPosts?.totalCost,
      boardsPurchased: aBoards?.purchaseQuantity,
      boardRate: aBoards?.unitCost,
      boardCost: aBoards?.totalCost,
      railsPurchased: aRails?.purchaseQuantity,
      railRate: aRails?.unitCost,
      railCost: aRails?.totalCost,
      capping: aCap?.purchaseQuantity,
      capRate: aCap?.unitCost,
      capCost: aCap?.totalCost,
      bags: aConc?.purchaseQuantity,
      concRate: aConc?.unitCost,
      concCost: aConc?.totalCost,
      gateFrame: aGateF?.purchaseQuantity,
      gateFrameCost: aGateF?.totalCost,
      hardware: aGateH?.totalCost,
      fixings: aFix?.totalCost,
      labour: (ownerA.requirements ?? [])
        .filter((row) => row.kind === "labour")
        .map((row) => ({
          key: row.componentKey,
          qty: row.productivityBasis.quantity,
          unit: row.productivityBasis.unit,
          hPer: row.productivityBasis.hoursPerUnit,
          hours: row.baseHours,
          cost: row.totalCost,
        })),
      lineDirect: ownerA.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      lineSell: ownerA.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      direct: ownerEst.recommendedCost,
      sell: ownerEst.recommendedSell,
    },
    null,
    2
  )
);

console.log("\n-- OWNER FIXTURE B --");
const bBoards = mat(ownerB, FENCE_BOARDS_COMPONENT);
console.log(
  JSON.stringify(
    {
      courses: physicalB.timber?.courseCount,
      slatsPurchased: bBoards?.purchaseQuantity,
      slatRate: bBoards?.unitCost,
      slatCost: bBoards?.totalCost,
      postsLm: mat(ownerB, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity,
      postCost: mat(ownerB, FENCE_POSTS_LM_COMPONENT)?.totalCost,
      capping: mat(ownerB, FENCE_CAPPING_COMPONENT)?.purchaseQuantity,
      bags: mat(ownerB, FENCE_CONCRETE_COMPONENT)?.purchaseQuantity,
      rails: mat(ownerB, FENCE_RAILS_COMPONENT)?.purchaseQuantity ?? null,
      fixings: mat(ownerB, FENCE_FIXINGS_TIMBER_COMPONENT)?.totalCost,
      labour: (ownerB.requirements ?? [])
        .filter((row) => row.kind === "labour")
        .map((row) => ({
          key: row.componentKey,
          qty: row.productivityBasis.quantity,
          hPer: row.productivityBasis.hoursPerUnit,
          hours: row.baseHours,
          cost: row.totalCost,
        })),
      direct: ownerB.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      sell: ownerB.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    },
    null,
    2
  )
);

console.log("\n-- 10m × 2.0m POST PROCUREMENT FIXTURE --");
console.log(
  JSON.stringify(
    {
      postCount: tall10Count,
      requiredEach: tall10Phys.timber?.postRequiredLengthM,
      purchasedEach: tall10Phys.timber?.postPurchasedStockLengthM,
      requiredLm: tall10Phys.timber?.postStockLm,
      purchasedLm: mat(tall10Est, FENCE_POSTS_LM_COMPONENT)?.purchaseQuantity,
      postCost: mat(tall10Est, FENCE_POSTS_LM_COMPONENT)?.totalCost,
      theoreticalLmCost: Math.round(tall10TheoreticalLm * 12 * 100) / 100,
      purchasedLmCost: Math.round(tall10PurchasedLm * 12 * 100) / 100,
    },
    null,
    2
  )
);

console.log("\n-- REGRESSION SPAWNS --");
check("44 Fence 1A", spawnVerifier("scripts/verify-fence-maturity-1a.ts"));
check("45 RW R6", spawnVerifier("scripts/verify-retaining-wall-post-concrete-r6.ts"));
check("46 RW family", spawnVerifier("scripts/verify-retaining-wall-family-closure-01.ts"));
check("47 Deck 2D", spawnVerifier("scripts/verify-deck-maturity-2d.ts"));
check("48 estimator safety", spawnVerifier("scripts/verify-estimator-safety-0.ts"));
check("49 Foundation", spawnVerifier("scripts/verify-foundation-r1-project-conditions-support.ts"));

console.log(`\nFENCE-MATURITY-1B RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
