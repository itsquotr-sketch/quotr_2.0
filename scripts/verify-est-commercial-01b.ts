/**
 * EST-COMMERCIAL-01B — mature Work Area Quotr fallbacks become cost-only.
 *
 * Fence / Retaining Wall / Bathroom / Fitout-Internal Walls legacy packages.
 * Run: npx --yes tsx scripts/verify-est-commercial-01b.ts
 *
 * No Production. No merge to main. Does not reopen 01A labour 60/90.
 */
import { readFileSync } from "node:fs";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import {
  BATHROOM_BENCHMARKS,
  FENCE_BENCHMARKS,
  FITOUT_BENCHMARKS,
  RETAINING_WALL_BENCHMARKS,
} from "../lib/estimate/benchmark-rates";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "../lib/estimate/bathroom-identities";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  calculateInternalWalls,
} from "../lib/estimate/calculators/fitout";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { FENCE_TIMBER_FIXINGS_PERCENT } from "../lib/estimate/fence-timber-1b";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import { resolveLabourRate, resolveRate } from "../lib/estimate/rates";
import { RW_TIMBER_FIXINGS_COMPONENT } from "../lib/estimate/retaining-wall-identities";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { OrganisationRate } from "../components/setup/types";
import type { PricingItem } from "../lib/pricing/types";

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
  return readFileSync(rel, "utf8");
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function materialRate(
  itemKey: string,
  cost: number,
  sell: number | null,
  workAreaType: string,
  unit = "lm"
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    trade: null,
    work_area_type: workAreaType,
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: sell,
    markup_percent: null,
    active: true,
  };
}

function ctx(params: {
  workArea: EstimateWorkArea;
  facts: EstimateFact[];
  rates?: OrganisationRate[];
  margin?: number;
  allowBenchmarks?: boolean;
}): EstimateContext {
  return {
    project: { id: "est-commercial-01b", qualityLevel: "standard" },
    confirmedWorkAreas: [params.workArea],
    facts: params.facts,
    constraints: [],
    materialWastageSettings: {
      sheetMaterialWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: params.rates ?? [],
    organisationSettings: {
      allow_benchmark_rates: params.allowBenchmarks ?? true,
      default_margin_percent: params.margin ?? 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function line(
  items: readonly EstimateLineItemInput[],
  label: string
): EstimateLineItemInput | undefined {
  return items.find((item) => item.label === label);
}

function near(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) < eps;
}

const gm20 = (cost: number) => deriveSellFromCost(cost, 20);
const gm15 = (cost: number) => deriveSellFromCost(cost, 15);
const gm10 = (cost: number) => deriveSellFromCost(cost, 10);

console.log("=== EST-COMMERCIAL-01B mature WA cost-first fallbacks ===\n");

const fenceSrc = read("lib/estimate/calculators/fence.ts");
const rwSrc = read("lib/estimate/calculators/retaining-wall.ts");
const bathroomSrc = read("lib/estimate/calculators/bathroom.ts");
const fitoutSrc = read("lib/estimate/calculators/fitout.ts");
const ratesSrc = read("lib/estimate/rates.ts");
const liningSrc = read("lib/estimate/internal-walls-lining-physical.ts");
const framingSrc = read("lib/estimate/internal-walls-physical.ts");
const catalogueSrc = read("lib/rates/catalogue.ts");
const specificSrc = read("lib/rates/specific-material-catalogue.ts");

check(
  "source Fence/RW/Bathroom/Fitout omit fallbackSellRate",
  !fenceSrc.includes("fallbackSellRate") &&
    !rwSrc.includes("fallbackSellRate") &&
    !bathroomSrc.includes("fallbackSellRate") &&
    !fitoutSrc.includes("fallbackSellRate:")
);

check(
  "source 01A labour remains cost-only (no 60/90 reintroduction)",
  ratesSrc.includes("const DEFAULT_LABOUR_COST_RATE = 60") &&
    !ratesSrc.includes("sellRate: 90") &&
    !fenceSrc.includes("60, sell: 90") &&
    !bathroomSrc.includes("60, sell: 90") &&
    !fitoutSrc.includes("60, sell: 90")
);

check(
  "Q formula identities 100@10/20/15",
  near(gm10(100), 111.11) && near(gm20(100), 125) && near(gm15(100), 117.65)
);

check(
  "catalogue Fence/RW/Bathroom package sells stripped",
  !catalogueSrc.includes("FENCE_BENCHMARKS.timberPerLm.sell") &&
    !catalogueSrc.includes("RETAINING_WALL_BENCHMARKS.timberFace.sell") &&
    !catalogueSrc.includes("BATHROOM_BENCHMARKS.tilingPerM2.sell")
);

check(
  "fence starters no longer bake cost/0.8 sell",
  !specificSrc.includes("const sell = cost != null ? Math.round((cost / 0.8)")
);

check(
  "mature IW physical paths only pass company sell_rate",
  liningSrc.includes("fallbackSellRate: company.sell_rate ?? undefined") &&
    framingSrc.includes("fallbackSellRate: company.sell_rate ?? undefined") &&
    !liningSrc.includes("FITOUT_BENCHMARKS")
);

const fenceWa = wa("f1", "fence", "Fence");
const fencePackageFacts = [
  fact("fence.length_m", "f1", 10),
  fact("fence.height_m", "f1", 1.8),
  fact("fence.material", "f1", "chainmesh"),
];
const fencePkg = calculateFence(
  ctx({ workArea: fenceWa, facts: fencePackageFacts }),
  fenceWa
);
const fenceMaterials = line(fencePkg.lineItems, "Fence materials");
check(
  "A fence package cost 90 preserved; 20% GM → 112.50 not 140",
  fenceMaterials != null &&
    fenceMaterials.quantity === 10 &&
    near(fenceMaterials.costRate ?? 0, FENCE_BENCHMARKS.timberPerLm.cost) &&
    near(fenceMaterials.recommendedCost ?? 0, 10 * FENCE_BENCHMARKS.timberPerLm.cost) &&
    near(fenceMaterials.sellRate ?? 0, gm20(FENCE_BENCHMARKS.timberPerLm.cost)) &&
    !near(fenceMaterials.sellRate ?? 0, FENCE_BENCHMARKS.timberPerLm.sell) &&
    fenceMaterials.sellAuthority === "derived_from_gross_margin"
);

const timberFenceFacts = [
  fact("fence.length_m", "f1", 18),
  fact("fence.height_m", "f1", 1.8),
  fact("fence.system", "f1", "Timber paling — vertical board"),
  fact("fence.timber_species", "f1", "Radiata Pine"),
  fact("fence.board_thickness_mm", "f1", "150 × 19mm"),
  fact("fence.post_spacing_m", "f1", 1.8),
  fact("fence.gate_included", "f1", false),
  fact("fence.top_capping", "f1", "Yes"),
  fact("fence.vertical_paling_gap_mm", "f1", 0),
];
const timberFence = calculateFence(
  ctx({ workArea: fenceWa, facts: timberFenceFacts }),
  fenceWa
);
const fenceFixings = line(timberFence.lineItems, "Fence fixings");
const namedTimberCost = timberFence.lineItems
  .filter((item) =>
    ["Fence palings", "Fence rails", "Top capping"].includes(item.label)
  )
  .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
check(
  "B fence 8% fixing residual cost unchanged; margin once",
  fenceFixings != null &&
    namedTimberCost > 0 &&
    near(fenceFixings.recommendedCost ?? 0, namedTimberCost * FENCE_TIMBER_FIXINGS_PERCENT) &&
    near(
      fenceFixings.recommendedSell ?? 0,
      gm20(fenceFixings.recommendedCost ?? 0)
    ) &&
    fenceFixings.sellAuthority === "derived_from_gross_margin" &&
    fenceFixings.quantity === (fenceFixings.quantity ?? 1)
);

const fencePaired = calculateFence(
  ctx({
    workArea: fenceWa,
    facts: fencePackageFacts,
    rates: [
      materialRate("fence.material.timber.lm", 90, 200, "fence", "lm"),
    ],
  }),
  fenceWa
);
const fencePairedLine = line(fencePaired.lineItems, "Fence materials");
check(
  "C company explicit paired Fence rate remains paired",
  fencePairedLine != null &&
    near(fencePairedLine.costRate ?? 0, 90) &&
    near(fencePairedLine.sellRate ?? 0, 200) &&
    (fencePairedLine.sellAuthority === "legacy_paired_rate")
);

const rwWa = wa("rw1", "retaining_wall", "Retaining wall");
const rwPackageFacts = [
  fact("retaining_wall.length_m", "rw1", 10),
  fact("retaining_wall.height_m", "rw1", 1.2),
  fact("retaining_wall.material", "rw1", "Concrete"),
];
const rwPkg = calculateRetainingWall(
  ctx({ workArea: rwWa, facts: rwPackageFacts }),
  rwWa
);
const rwMaterials = line(rwPkg.lineItems, "Retaining wall materials");
const rwFace = 10 * 1.2;
check(
  "D RW unspecified-concrete package cost 400; sell from 20% GM not 600",
  rwMaterials != null &&
    near(rwMaterials.quantity ?? 0, rwFace) &&
    near(rwMaterials.costRate ?? 0, RETAINING_WALL_BENCHMARKS.concreteFace.cost) &&
    near(
      rwMaterials.recommendedCost ?? 0,
      rwFace * RETAINING_WALL_BENCHMARKS.concreteFace.cost
    ) &&
    near(rwMaterials.sellRate ?? 0, gm20(RETAINING_WALL_BENCHMARKS.concreteFace.cost)) &&
    !near(rwMaterials.sellRate ?? 0, RETAINING_WALL_BENCHMARKS.concreteFace.sell) &&
    rwMaterials.sellAuthority === "derived_from_gross_margin"
);

const timberFaceResolved = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: "retaining_wall.material.timber.face_m2",
  workAreaType: "retaining_wall",
  unit: "m2",
  fallbackCostRate: RETAINING_WALL_BENCHMARKS.timberFace.cost,
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  } as EstimateContext["organisationSettings"],
});
check(
  "D timber face Quotr fallback cost 220 → 275 not 330",
  near(timberFaceResolved.costRate, 220) &&
    near(timberFaceResolved.sellRate, gm20(220)) &&
    !near(timberFaceResolved.sellRate, 330) &&
    timberFaceResolved.sellAuthority === "derived_from_gross_margin"
);

const rwDetailedFacts = [
  fact("retaining_wall.material", "rw1", "Timber"),
  fact("retaining_wall.length_m", "rw1", 15),
  fact("retaining_wall.height_m", "rw1", 1.2),
  fact("retaining_wall.excavation_required", "rw1", true),
  fact("retaining_wall.face_board_section", "rw1", "150×50 H4"),
];
const rwDetailed = calculateRetainingWall(
  ctx({ workArea: rwWa, facts: rwDetailedFacts }),
  rwWa
);
const rwPackageOnDetailed = line(rwDetailed.lineItems, "Retaining wall materials");
check(
  "E detailed timber path stays cost-first (no package face-m² money)",
  rwPackageOnDetailed == null &&
    rwDetailed.lineItems.some(
      (item) =>
        item.sellAuthority === "derived_from_gross_margin" &&
        (item.recommendedCost ?? 0) > 0
    )
);

const rwFixings = rwDetailed.lineItems.find(
  (item) => item.componentKey === RW_TIMBER_FIXINGS_COMPONENT
);
check(
  "F RW 8% residual is physical/cost allowance, then GM once",
  rwFixings != null &&
    (rwFixings.recommendedCost ?? 0) > 0 &&
    near(
      rwFixings.recommendedSell ?? 0,
      gm20(rwFixings.recommendedCost ?? 0)
    ) &&
    rwFixings.sellAuthority === "derived_from_gross_margin" &&
    /8%/.test(rwFixings.notes ?? rwFixings.identitySummary ?? "") &&
    rwFixings.notes?.toLowerCase().includes("margin") !== true
);

const bathWa = wa("b1", "bathroom", "Bathroom");
const legacyBathFacts = [
  fact("bathroom.area_m2", "b1", 4),
  fact("bathroom.waterproofing_included", "b1", true),
  fact("bathroom.tiling_included", "b1", true),
  fact("bathroom.floor_tiling_area_m2", "b1", 4),
  fact("bathroom.plumbing_changes", "b1", "Minor"),
  fact("bathroom.electrical_changes", "b1", "Minor"),
  fact("bathroom.ventilation_included", "b1", true),
  fact("bathroom.fixtures_client_supplied", "b1", true),
  fact("bathroom.tile_extent", "b1", "Floor only"),
];
const legacyBath = calculateBathroom(
  ctx({ workArea: bathWa, facts: legacyBathFacts }),
  bathWa
);
const wp = line(legacyBath.lineItems, "Waterproofing allowance");
const tiling = line(legacyBath.lineItems, "Tiling allowance");
const plumbing = line(legacyBath.lineItems, "Plumbing allowance");
const electrical = line(legacyBath.lineItems, "Electrical allowance");
const vent = line(legacyBath.lineItems, "Extractor fan/ventilation allowance");
check(
  "G waterproofing cost allowance; sell F-SFM not 1800",
  wp != null &&
    (wp.recommendedCost ?? 0) >= BATHROOM_BENCHMARKS.waterproofingMinimum.cost &&
    near(wp.recommendedSell ?? 0, gm20(wp.recommendedCost ?? 0)) &&
    !near(wp.recommendedSell ?? 0, BATHROOM_BENCHMARKS.waterproofingMinimum.sell) &&
    wp.sellAuthority === "derived_from_gross_margin"
);
check(
  "G tiling cost-first; minimum is cost 2200 then GM, not sell 3400",
  tiling != null &&
    (tiling.recommendedCost ?? 0) >= BATHROOM_BENCHMARKS.tilingMinimum.cost &&
    near(tiling.recommendedSell ?? 0, gm20(tiling.recommendedCost ?? 0)) &&
    (tiling.recommendedSell ?? 0) < BATHROOM_BENCHMARKS.tilingMinimum.sell
);
check(
  "H plumbing subcontract cost 1200; GM once → 1500 not 1800",
  plumbing != null &&
    near(plumbing.recommendedCost ?? 0, BATHROOM_BENCHMARKS.plumbingMinor.cost) &&
    near(plumbing.recommendedSell ?? 0, gm20(BATHROOM_BENCHMARKS.plumbingMinor.cost)) &&
    !near(plumbing.recommendedSell ?? 0, BATHROOM_BENCHMARKS.plumbingMinor.sell) &&
    plumbing.sellAuthority === "derived_from_gross_margin"
);
check(
  "G electrical + extractor migrate to cost-only",
  electrical != null &&
    near(electrical.recommendedCost ?? 0, BATHROOM_BENCHMARKS.electricalMinor.cost) &&
    near(
      electrical.recommendedSell ?? 0,
      gm20(BATHROOM_BENCHMARKS.electricalMinor.cost)
    ) &&
    vent != null &&
    near(vent.recommendedCost ?? 0, BATHROOM_BENCHMARKS.extractorFan.cost) &&
    near(vent.recommendedSell ?? 0, gm20(BATHROOM_BENCHMARKS.extractorFan.cost))
);

const packageBath = calculateBathroom(
  ctx({
    workArea: bathWa,
    facts: [
      fact("bathroom.area_m2", "b1", 8),
      fact("bathroom.renovation_type", "b1", "Full renovation"),
      fact("bathroom.waterproofing_included", "b1", false),
      fact("bathroom.tiling_included", "b1", false),
      fact("bathroom.fixtures_client_supplied", "b1", false),
    ],
  }),
  bathWa
);
const bathPackage = line(
  packageBath.lineItems,
  "Bathroom materials/finishes allowance"
);
check(
  "G $18k package cost preserved; sell 22500 not 25000",
  bathPackage != null &&
    near(bathPackage.recommendedCost ?? 0, BATHROOM_BENCHMARKS.minimumPackage.cost) &&
    near(bathPackage.recommendedSell ?? 0, gm20(BATHROOM_BENCHMARKS.minimumPackage.cost)) &&
    !near(bathPackage.recommendedSell ?? 0, BATHROOM_BENCHMARKS.minimumPackage.sell)
);

const matureBathFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
];
const prBath = calculateBathroom(
  ctx({
    workArea: bathWa,
    facts: matureBathFacts,
    allowBenchmarks: false,
    rates: [
      {
        id: "labour.carpenter.hour",
        rate_type: "labour",
        trade: "carpenter",
        work_area_type: "bathroom",
        item_key: "labour.carpenter.hour",
        label: "Carpenter",
        unit: "hour",
        cost_rate: 60,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ],
  }),
  bathWa
);
check(
  "I Pricing Required remains Pricing Required (no fake benchmark)",
  prBath.lineItems.some(
    (item) =>
      item.itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
      (/pricing required|rate required/i.test(item.rateSource ?? "") ||
        item.rateSourceType === "missing")
  ) &&
    !prBath.lineItems.some((item) =>
      /materials\/finishes allowance/i.test(item.label)
    )
);

const iwWa = wa("w1", "internal_walls", "Internal walls");
const legacyIw = calculateInternalWalls(
  ctx({
    workArea: iwWa,
    facts: [
      fact("internal_walls.length_lm", "w1", 10),
      fact("internal_walls.height_m", "w1", 2.4),
    ],
  }),
  iwWa
);
const iwAllowance = line(legacyIw.lineItems, "Internal wall materials allowance");
check(
  "J FITOUT legacy pair migrates: cost 95 → 118.75 not 145",
  iwAllowance != null &&
    near(iwAllowance.costRate ?? 0, FITOUT_BENCHMARKS.internalWallsPerM2.cost) &&
    near(iwAllowance.sellRate ?? 0, gm20(FITOUT_BENCHMARKS.internalWallsPerM2.cost)) &&
    !near(iwAllowance.sellRate ?? 0, FITOUT_BENCHMARKS.internalWallsPerM2.sell) &&
    iwAllowance.sellAuthority === "derived_from_gross_margin"
);

function writeWall(
  workAreaId: string,
  writes: Array<{ key: string; value: unknown }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

const matureIwFacts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...writeWall("w1", [
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type A" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
    { key: "internal_walls.wall_type.length_lm", value: 12 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]),
];
const matureIw = calculateInternalWalls(
  ctx({ workArea: iwWa, facts: matureIwFacts }),
  iwWa
);
const maturePackage = line(matureIw.lineItems, "Internal wall materials allowance");
const liningLabourMature = matureIw.lineItems.find((item) =>
  /lining labour/i.test(item.label)
);
const gibLine = matureIw.lineItems.find(
  (item) =>
    /gib|plasterboard|sheet/i.test(item.label) ||
    item.itemKey?.includes("plasterboard")
);
check(
  "K mature Internal Walls does not use FITOUT m² package",
  maturePackage == null &&
    matureIw.lineItems.some((item) => (item.recommendedCost ?? 0) > 0 || item.rateSourceType === "missing")
);
check(
  "L GIB / lining labour / fixing quantities present and not package-derived",
  (liningLabourMature?.quantity ?? 0) > 0 &&
    (gibLine?.quantity ?? 0) > 0
);

const companyPair = resolveRate({
  rates: [materialRate("fence.material.timber.lm", 88, 160, "fence")],
  rateType: "material",
  itemKey: "fence.material.timber.lm",
  workAreaType: "fence",
  unit: "lm",
  fallbackCostRate: 90,
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  } as EstimateContext["organisationSettings"],
});
check(
  "M company explicit cost+sell remains authoritative",
  near(companyPair.costRate, 88) &&
    near(companyPair.sellRate, 160) &&
    companyPair.sellAuthority === "legacy_paired_rate"
);

const afterTarget = applyTargetMarginToLineItems(
  fencePkg.lineItems,
  15,
  ctx({ workArea: fenceWa, facts: fencePackageFacts }).organisationSettings
);
const fenceAfterTarget = line(afterTarget, "Fence materials");
check(
  "N project target GM 15% rewrites from cost, no stack",
  fenceAfterTarget != null &&
    near(fenceAfterTarget.recommendedCost ?? 0, fenceMaterials?.recommendedCost ?? -1) &&
    near(
      fenceAfterTarget.recommendedSell ?? 0,
      gm15(fenceMaterials?.recommendedCost ?? 0)
    ) &&
    fenceAfterTarget.sellAuthority === "derived_from_gross_margin"
);

const labour = resolveLabourRate({
  rates: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  } as EstimateContext["organisationSettings"],
});
check(
  "O default labour remains 60 cost-only from 01A",
  labour.costRate === 60 &&
    near(labour.sellRate, gm20(60)) &&
    labour.sellAuthority === "derived_from_gross_margin" &&
    !near(labour.sellRate, 90)
);

const pricingFromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
  id: "line-fence",
  category: "materials",
  recommended_cost: fenceMaterials?.recommendedCost ?? 0,
  recommended_sell: fenceMaterials?.recommendedSell ?? 0,
  notes: null,
});
check(
  "P Pricing copies estimate sell (no second margin)",
  pricingFromEstimate.ok &&
    near(pricingFromEstimate.fields.totalCost, fenceMaterials?.recommendedCost ?? -1) &&
    near(pricingFromEstimate.fields.totalSell, fenceMaterials?.recommendedSell ?? -1)
);

const pricingItem = {
  id: "p1",
  work_area_id: "f1",
  internal_label: "Fence materials",
  client_label: "Fence materials",
  client_description: null,
  item_type: "material",
  quantity: fenceMaterials?.quantity ?? 1,
  unit: "lm",
  unit_cost: fenceMaterials?.costRate ?? 0,
  unit_sell: fenceMaterials?.sellRate ?? 0,
  total_cost: fenceMaterials?.recommendedCost ?? 0,
  total_sell: fenceMaterials?.recommendedSell ?? 0,
  optional: false,
  visible_on_quote: true,
  sort_order: 1,
} as PricingItem;
const quoteItems = mapPricingItemsToQuoteItems(
  [pricingItem],
  new Map([["f1", "Fence"]])
);
check(
  "P Quote copies Pricing sell; GST not applied on the line",
  near(quoteItems[0]?.total ?? 0, fenceMaterials?.recommendedSell ?? -1)
);

const estimateCopy = calculateEstimate(
  ctx({ workArea: fenceWa, facts: fencePackageFacts })
);
check(
  "estimate engine Fence package sell matches calculator",
  near(estimateCopy.recommendedSell, fencePkg.lineItems.reduce(
    (sum, item) => sum + (item.includedInTotal === false ? 0 : item.recommendedSell ?? 0),
    0
  ))
);

const costInvariant =
  near(fenceMaterials?.costRate ?? 0, 90) &&
    near(rwMaterials?.costRate ?? 0, RETAINING_WALL_BENCHMARKS.concreteFace.cost) &&
  near(plumbing?.recommendedCost ?? 0, 1200) &&
  near(iwAllowance?.costRate ?? 0, 95);
check(
  "cost/quantity invariance on migrated package lines",
  costInvariant &&
    fenceMaterials?.quantity === 10 &&
    near(rwMaterials?.quantity ?? 0, 12)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
