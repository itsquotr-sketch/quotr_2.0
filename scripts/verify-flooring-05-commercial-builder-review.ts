/**
 * FLOORING-05 — hosted commercialisation and Builder Review.
 *
 * Run: npx --yes tsx scripts/verify-flooring-05-commercial-builder-review.ts
 *
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
} from "../lib/estimate/bathroom-identities";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateFlooring } from "../lib/estimate/calculators/fitout";
import { PROJECT_CONDITION_PRODUCTIVITY_PATHS } from "../lib/estimate/condition-productivity-paths";
import { round2 } from "../lib/estimate/facts";
import {
  formatFlooringReviewTitle,
  flooringLineScopeKey,
} from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import {
  calculateFlooringPhysical,
  calculateFlooringPortionPhysical,
} from "../lib/estimate/flooring-physical";
import {
  createEmptyFlooringPortion,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  FLOORING_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import type {
  EstimateConstraint,
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement, LabourRequirement } from "../lib/estimate/requirements";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 0.02
): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function persist(
  portions: readonly FlooringPortion[],
  workAreaId = WA.id
): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: workAreaId,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(
  facts: EstimateFact[],
  extra: {
    workAreas?: EstimateWorkArea[];
    rates?: OrganisationRate[];
    constraints?: EstimateConstraint[];
  } = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: extra.workAreas ?? [WA],
    facts,
    constraints: extra.constraints ?? [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 10,
    underlay_required: false,
    floor_preparation_required: false,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function orgRate(
  itemKey: string,
  cost: number | null,
  extra: Partial<OrganisationRate> = {}
): OrganisationRate {
  return {
    id: extra.id ?? `org-${itemKey}`,
    item_key: itemKey,
    rate_type: extra.rate_type ?? "subcontractor",
    label: itemKey,
    unit: extra.unit ?? "m2",
    cost_rate: cost,
    sell_rate: extra.sell_rate ?? null,
    markup_percent: null,
    active: extra.active ?? true,
    trade: extra.trade ?? null,
    work_area_type: extra.work_area_type ?? "flooring",
    source: extra.source ?? "explicit_company",
  };
}

function hosted(
  portions: readonly FlooringPortion[],
  extra: Parameters<typeof ctx>[1] = {}
) {
  return calculateEstimate(ctx(persist(portions), extra));
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((row) => row.includedInTotal !== false && row.rateSourceType !== "missing")
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function line(
  estimate: { lineItems: readonly EstimateLineItemInput[] },
  componentKey: string,
  nestedItemId?: string
): EstimateLineItemInput | undefined {
  return estimate.lineItems.find(
    (row) =>
      row.componentKey === componentKey &&
      (nestedItemId == null || row.nestedItemId === nestedItemId)
  );
}

function labourRows(
  requirements: readonly EstimateRequirement[] | undefined
): LabourRequirement[] {
  return (requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function mapReviewLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    productivityRate: item.productivityRate,
    costRate: item.costRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    nestedItemId: item.nestedItemId,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    scopeKey: item.scopeKey,
  }));
}

function reviewOf(
  estimate: ReturnType<typeof calculateEstimate>,
  facts: EstimateFact[]
) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: mapReviewLines(estimate.lineItems),
    },
    workAreas: [{ ...WA, status: "confirmed" }],
    requirements: estimate.requirements,
    facts,
  });
}

console.log("=== FLOORING-05 hosted commercialisation ===\n");

const phys = calculateFlooringPhysical({
  facts: persist([ordinary()]),
  workArea: WA,
});
const hostedCarpet = hosted([ordinary()]);
check(
  "1. Hosted path consumes physical requirements",
  phys.requirements.some((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2) &&
    hostedCarpet.lineItems.some(
      (row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )
);
check(
  "2. Commercial quantity is physical net m², not a reconstructed fact",
  line(hostedCarpet, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.quantity ===
    phys.portions[0]?.physicalNetAreaM2 &&
    line(hostedCarpet, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.quantity === 10
);
check(
  "3. Nested calculateFlooring and calculateEstimate agree on carpet COST",
  near(
    includedCost(calculateFlooring(ctx(persist([ordinary()])), WA).lineItems),
    750
  ) && near(includedCost(hostedCarpet.lineItems), 750)
);
check(
  "4. Golden 1. Carpet 10 m² underlay No = $750",
  near(includedCost(hostedCarpet.lineItems), 750) &&
    near(line(hostedCarpet, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 750)
);
const carpetUnderlay = hosted([ordinary({ underlay_required: true })]);
check(
  "5. Golden 2. Carpet 10 m² underlay Yes = $900",
  near(includedCost(carpetUnderlay.lineItems), 900) &&
    near(line(carpetUnderlay, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.recommendedCost, 150)
);
check(
  "6. Underlay is a separate line from the finish package",
  carpetUnderlay.lineItems.filter(
    (row) =>
      row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2 ||
      row.componentKey === FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2
  ).length === 2
);
const vinylPrep = hosted([
  ordinary({
    finish_type: "vinyl_plank",
    floor_preparation_required: true,
  }),
]);
check(
  "7. Golden 3. Vinyl 10 m² preparation Yes = $1,300",
  near(includedCost(vinylPrep.lineItems), 1300) &&
    near(line(vinylPrep, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2)?.recommendedCost, 950) &&
    near(line(vinylPrep, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2)?.recommendedCost, 350)
);
const tilePrep = hosted([
  ordinary({
    finish_type: "tile",
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: true,
  }),
]);
check(
  "8. Golden 4. Tile 10 m² preparation Yes = $1,850",
  near(includedCost(tilePrep.lineItems), 1850) &&
    near(line(tilePrep, FLOORING_TILE_SUPPLY_INSTALL_M2)?.recommendedCost, 1500)
);
check(
  "9. Tile count is informational and does not multiply COST",
  line(tilePrep, FLOORING_TILE_SUPPLY_INSTALL_M2)?.quantity === 10 &&
    /does not multiply/i.test(line(tilePrep, FLOORING_TILE_SUPPLY_INSTALL_M2)?.notes ?? "")
);
const hardwood = hosted([
  ordinary({
    finish_type: "hardwood",
    hardwood_board_width_mm: 186,
  }),
]);
check(
  "10. Golden 5. Hardwood 10 m² = $1,900",
  near(includedCost(hardwood.lineItems), 1900) &&
    line(hardwood, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)?.quantity === 10
);
check(
  "11. Hardwood lm does not multiply subcontract COST",
  /does not multiply/i.test(
    line(hardwood, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)?.notes ?? ""
  )
);
const ply = hosted([
  ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
]);
const plyMat = line(ply, FLOORING_SUBSTRATE_MATERIAL_COMPONENT);
const plyLab = line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR);
check(
  "12. Golden 6. 12 m² plywood = 5 sheets × $145 = $725",
  plyMat?.quantity === 5 && near(plyMat?.recommendedCost, 725)
);
check(
  "13. Golden 6. Substrate install 5 × 0.50 × carpenter = $150",
  near(plyLab?.labourHours, 2.5) && near(plyLab?.recommendedCost, 150)
);
check(
  "14. Substrate material and installation remain separate lines",
  plyMat != null && plyLab != null && plyMat.category === "materials" && plyLab.category === "labour"
);
const framing = hosted([
  ordinary({
    area_m2: 12,
    framing_required: true,
    framing_allowance_level: "standard",
  }),
]);
check(
  "15. Golden 7. Standard framing 12 m² = $1,080",
  near(
    line(framing, FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2)?.recommendedCost,
    1080
  ) && line(framing, FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2)?.quantity === 12
);
check(
  "16. Framing is one combined allowance, not timber plus labour",
  framing.lineItems.filter((row) =>
    (row.componentKey ?? "").includes("subfloor_framing")
  ).length === 1
);
const removal = hosted([
  ordinary({
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
]);
check(
  "17. Golden 8. Carpet removal 1.20 h = $72",
  near(line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.labourHours, 1.2) &&
    near(line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.recommendedCost, 72)
);
check(
  "18. Golden 8. Substrate removal 3.00 h = $180; combined $252",
  near(line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.labourHours, 3) &&
    near(line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.recommendedCost, 180) &&
    near(
      (line(removal, FLOORING_CARPET_REMOVE_LABOUR)?.recommendedCost ?? 0) +
        (line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.recommendedCost ?? 0),
      252
    )
);
check(
  "19. Finish and substrate removal stay separate operations",
  line(removal, FLOORING_CARPET_REMOVE_LABOUR) != null &&
    line(removal, FLOORING_SUBSTRATE_REMOVE_LABOUR) != null &&
    line(removal, FLOORING_CARPET_SUPPLY_INSTALL_M2) != null
);
const comprehensive = hosted([
  ordinary({
    label: "Lounge",
    area_m2: 12,
    underlay_required: true,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    framing_required: true,
    framing_allowance_level: "standard",
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
]);
check(
  "20. Golden 9. Comprehensive 12 m² carpet area = $3,337.40",
  near(includedCost(comprehensive.lineItems), 3337.4)
);
check(
  "21. Comprehensive breakdown matches 900+180+725+150+1080+86.40+216",
  near(line(comprehensive, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 900) &&
    near(line(comprehensive, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2)?.recommendedCost, 180) &&
    near(line(comprehensive, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725) &&
    near(line(comprehensive, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 150) &&
    near(
      line(comprehensive, FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2)?.recommendedCost,
      1080
    ) &&
    near(line(comprehensive, FLOORING_CARPET_REMOVE_LABOUR)?.recommendedCost, 86.4) &&
    near(line(comprehensive, FLOORING_SUBSTRATE_REMOVE_LABOUR)?.recommendedCost, 216)
);

const bedrooms = ordinary({
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
  label: "Bedrooms",
  area_m2: 24,
  underlay_required: true,
});
const living = ordinary({
  id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3",
  label: "Living room",
  finish_type: "vinyl_plank",
  area_m2: 20,
  floor_preparation_required: true,
});
const multi = hosted([bedrooms, living]);
check(
  "22. Golden 10. Bedrooms 24 m² carpet+underlay = $2,160",
  near(
    (line(multi, FLOORING_CARPET_SUPPLY_INSTALL_M2, bedrooms.id)?.recommendedCost ?? 0) +
      (line(multi, FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2, bedrooms.id)
        ?.recommendedCost ?? 0),
    2160
  )
);
check(
  "23. Golden 10. Living 20 m² vinyl+prep = $2,600; total $4,760",
  near(
    (line(multi, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2, living.id)?.recommendedCost ?? 0) +
      (line(multi, FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2, living.id)?.recommendedCost ?? 0),
    2600
  ) && near(includedCost(multi.lineItems), 4760)
);
check(
  "24. Identical-looking areas do not deduplicate",
  hosted([
    ordinary({ id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4", label: "A", area_m2: 10 }),
    ordinary({ id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5", label: "B", area_m2: 10 }),
  ]).lineItems.filter((row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2)
    .length === 2
);
check(
  "25. Ownership uses Work Area + Flooring Area ID + component",
  flooringLineScopeKey({
    workAreaId: WA.id,
    nestedItemId: bedrooms.id,
    componentKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
  }) === `flooring:${WA.id}:${bedrooms.id}:${FLOORING_CARPET_SUPPLY_INSTALL_M2}` &&
    line(multi, FLOORING_CARPET_SUPPLY_INSTALL_M2, bedrooms.id)?.scopeKey ===
      `flooring:${WA.id}:${bedrooms.id}:${FLOORING_CARPET_SUPPLY_INSTALL_M2}` &&
    line(multi, FLOORING_CARPET_SUPPLY_INSTALL_M2, bedrooms.id)?.overlapGroup ===
      `flooring.area:${bedrooms.id}`
);

const incompleteSibling = hosted([
  ordinary({ id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6", label: "Complete" }),
  createEmptyFlooringPortion({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa7",
    label: "Incomplete",
  }),
]);
check(
  "26. Incomplete sibling does not kill the complete area",
  near(
    line(incompleteSibling, FLOORING_CARPET_SUPPLY_INSTALL_M2, "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6")
      ?.recommendedCost,
    750
  ) &&
    !incompleteSibling.lineItems.some(
      (row) => row.nestedItemId === "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa7" && (row.recommendedCost ?? 0) > 0
    )
);

const custom = hosted([
  ordinary({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa8",
    finish_type: "other",
    other_description: "Cork",
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    area_m2: 12,
  }),
]);
check(
  "27. Custom finish package is Pricing Required",
  custom.lineItems.some(
    (row) =>
      row.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT &&
      row.rateSourceType === "missing"
  )
);
check(
  "28. Custom finish still prices confirmed plywood independently",
  near(line(custom, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725) &&
    near(line(custom, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 150)
);

const specialist = hosted([
  {
    ...createEmptyFlooringPortion({
      id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa9",
      label: "Entry",
    }),
    finish_type: "other",
    specialist_kind: "structural",
    other_description: "Engineered structural flooring",
    area_input_method: "direct_m2",
    area_m2: 10,
    finish_removal_required: true,
    existing_finish_type: "tile",
    framing_required: true,
    framing_allowance_level: "major",
  },
  ordinary({ id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa10", label: "Hall" }),
]);
check(
  "29. Specialist does not inherit ordinary removal or framing money",
  !specialist.lineItems.some(
    (row) =>
      row.nestedItemId === "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa9" &&
      row.rateSourceType !== "missing" &&
      (row.recommendedCost ?? 0) > 0
  )
);
check(
  "30. Supported sibling still prices next to specialist",
  near(
    line(specialist, FLOORING_CARPET_SUPPLY_INSTALL_M2, "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa10")
      ?.recommendedCost,
    750
  )
);

const fc = hosted([
  ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "fibre_cement",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  }),
]);
check(
  "31. FC material stays Pricing Required with sheet quantity 8",
  line(fc, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.rateSourceType === "missing" &&
    line(fc, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.quantity === 8 &&
    line(fc, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.costRate == null
);
check(
  "32. FC installation labour still prices independently",
  near(line(fc, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.labourHours, 4) &&
    near(line(fc, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 240)
);
check(
  "33. Secura does not inherit plywood COST",
  hosted([
    ordinary({
      area_m2: 12,
      substrate_required: true,
      substrate_family: "fibre_cement",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
    }),
  ]).lineItems.some(
    (row) =>
      row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT &&
      row.rateSourceType === "missing" &&
      row.costRate == null
  )
);
check(
  "34. Unresolved money is null, never a legitimate $0",
  (line(fc, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost ?? 0) === 0 &&
    line(fc, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.rateSourceType === "missing" &&
    !fc.lineItems.some(
      (row) =>
        row.rateSourceType !== "missing" && (row.recommendedCost ?? 0) === 0
    )
);

const access = hosted(
  [
    ordinary({
      area_m2: 12,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ],
  { constraints: [{ key: "site_access", label: "Site access", value: "Difficult" }] }
);
const accessLab = labourRows(access.requirements).find(
  (row) => row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
);
check(
  "35. Project Conditions adjust labour hours only",
  (accessLab?.adjustedHours ?? 0) > 2.5 &&
    line(access, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.quantity === 5 &&
    near(line(access, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725) &&
    near(line(access, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 900)
);
check(
  "36. No Flooring-specific multiplier",
  read("lib/estimate/flooring-commercial.ts").includes("getCombinedLabourAccessFactor") &&
    !read("lib/estimate/flooring-commercial.ts").includes("* 1.") &&
    PROJECT_CONDITION_PRODUCTIVITY_PATHS.some((row) =>
      /Flooring-specific multiplier|commercializeFlooring labour hours/.test(
        String((row as { flooring?: string }).flooring ?? "")
      )
    )
);

const carpetCompany = hosted([ordinary()], {
  rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82)],
});
check(
  "37. Company carpet subcontract beats Quotr",
  near(line(carpetCompany, FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 820)
);
check(
  "38. Removing carpet override restores Quotr",
  near(line(hosted([ordinary()]), FLOORING_CARPET_SUPPLY_INSTALL_M2)?.recommendedCost, 750)
);
const vinylCompany = hosted(
  [ordinary({ finish_type: "vinyl_plank", floor_preparation_required: false })],
  { rates: [orgRate(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2, 105)] }
);
check(
  "39. Company vinyl package beats Quotr",
  near(line(vinylCompany, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2)?.recommendedCost, 1050)
);
const tileCompany = hosted(
  [
    ordinary({
      finish_type: "tile",
      tile_width_mm: 600,
      tile_length_mm: 600,
      floor_preparation_required: false,
    }),
  ],
  { rates: [orgRate(FLOORING_TILE_SUPPLY_INSTALL_M2, 165)] }
);
check(
  "40. Company tile package beats Quotr",
  near(line(tileCompany, FLOORING_TILE_SUPPLY_INSTALL_M2)?.recommendedCost, 1650)
);
const hardwoodCompany = hosted(
  [ordinary({ finish_type: "hardwood", hardwood_board_width_mm: 186 })],
  { rates: [orgRate(FLOORING_HARDWOOD_SUPPLY_INSTALL_M2, 210)] }
);
check(
  "41. Company hardwood package beats Quotr",
  near(line(hardwoodCompany, FLOORING_HARDWOOD_SUPPLY_INSTALL_M2)?.recommendedCost, 2100)
);
check(
  "42. Company underlay beats Quotr and does not change carpet",
  near(
    line(
      hosted([ordinary({ underlay_required: true })], {
        rates: [orgRate(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2, 18)],
      }),
      FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2
    )?.recommendedCost,
    180
  ) &&
    near(
      line(
        hosted([ordinary({ underlay_required: true })], {
          rates: [orgRate(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2, 18)],
        }),
        FLOORING_CARPET_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      750
    )
);
check(
  "43. Company preparation beats Quotr",
  near(
    line(
      hosted(
        [ordinary({ finish_type: "vinyl_plank", floor_preparation_required: true })],
        { rates: [orgRate(FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2, 42)] }
      ),
      FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
    )?.recommendedCost,
    420
  )
);
const plyCompany = hosted(
  [
    ordinary({
      area_m2: 12,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ],
  {
    rates: [
      orgRate(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY, 160, {
        rate_type: "material",
        unit: "each",
      }),
    ],
  }
);
check(
  "44. Company plywood changes material money only",
  near(line(plyCompany, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 800) &&
    near(line(plyCompany, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 150) &&
    line(plyCompany, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.quantity === 5
);
const prodCompany = hosted(
  [
    ordinary({
      area_m2: 12,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ],
  {
    rates: [
      orgRate(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET, 0.65, {
        rate_type: "productivity",
        unit: "sheet",
      }),
    ],
  }
);
check(
  "45. Productivity override changes hours only",
  near(line(prodCompany, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.labourHours, 3.25) &&
    near(line(prodCompany, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725)
);
const carpenterCompany = hosted(
  [
    ordinary({
      area_m2: 12,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    }),
  ],
  {
    rates: [
      orgRate(FLOORING_CARPENTER_LABOUR_RATE_KEY, 70, {
        rate_type: "labour",
        unit: "hour",
        trade: "carpenter",
        work_area_type: null,
      }),
    ],
  }
);
check(
  "46. Carpenter override changes labour money only",
  near(line(carpenterCompany, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.recommendedCost, 175) &&
    near(line(carpenterCompany, FLOORING_SUBSTRATE_MATERIAL_COMPONENT)?.recommendedCost, 725)
);
check(
  "47. Company framing minor beats Quotr",
  near(
    line(
      hosted(
        [ordinary({ framing_required: true, framing_allowance_level: "minor" })],
        {
          rates: [
            orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 55, {
              rate_type: "allowance",
            }),
          ],
        }
      ),
      FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2
    )?.recommendedCost,
    550
  )
);
check(
  "48. Company framing standard/major beat Quotr independently",
  near(
    line(
      hosted(
        [
          ordinary({
            framing_required: true,
            framing_allowance_level: "standard",
            area_m2: 12,
          }),
        ],
        {
          rates: [
            orgRate(FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2, 105, {
              rate_type: "allowance",
            }),
          ],
        }
      ),
      FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2
    )?.recommendedCost,
    1260
  ) &&
    near(
      line(
        hosted(
          [
            ordinary({
              framing_required: true,
              framing_allowance_level: "major",
              area_m2: 12,
            }),
          ],
          {
            rates: [
              orgRate(FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2, 185, {
                rate_type: "allowance",
              }),
            ],
          }
        ),
        FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2
      )?.recommendedCost,
      2220
    )
);
check(
  "49. Company carpet removal productivity changes hours only",
  near(
    line(
      hosted(
        [
          ordinary({
            finish_removal_required: true,
            existing_finish_type: "carpet",
            substrate_removal_required: false,
          }),
        ],
        {
          rates: [
            orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0.15, {
              rate_type: "productivity",
            }),
          ],
        }
      ),
      FLOORING_CARPET_REMOVE_LABOUR
    )?.labourHours,
    1.5
  ) &&
    near(
      line(
        hosted(
          [
            ordinary({
              finish_removal_required: true,
              existing_finish_type: "carpet",
              substrate_removal_required: false,
            }),
          ],
          {
            rates: [
              orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0.15, {
                rate_type: "productivity",
              }),
            ],
          }
        ),
        FLOORING_CARPET_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      750
    )
);
const removalProd = hosted(
  [
    ordinary({
      finish_removal_required: true,
      existing_finish_type: "vinyl",
      substrate_removal_required: true,
    }),
  ],
  {
    rates: [
      orgRate(FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2, 0.25, {
        rate_type: "productivity",
      }),
      orgRate(FLOORING_TILE_REMOVE_HOURS_PER_M2, 0.7, { rate_type: "productivity" }),
      orgRate(FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2, 0.45, {
        rate_type: "productivity",
      }),
      orgRate(FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2, 0.4, {
        rate_type: "productivity",
      }),
    ],
  }
);
check(
  "50. Vinyl and substrate removal company hours win independently",
  near(
    labourRows(removalProd.requirements).find(
      (row) => row.productivityBasis.key === FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2
    )?.baseHours,
    2.5
  ) &&
    near(
      labourRows(removalProd.requirements).find(
        (row) => row.productivityBasis.key === FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2
      )?.baseHours,
      4
    )
);
check(
  "51. Other tenant remains on Quotr",
  near(includedCost(hosted([ordinary()]).lineItems), 750)
);
check(
  "52. Zero, invalid, inactive, or wrong-type overrides do not win",
  near(
    line(
      hosted([ordinary()], {
        rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 0)],
      }),
      FLOORING_CARPET_SUPPLY_INSTALL_M2
    )?.recommendedCost,
    750
  ) &&
    near(
      line(
        hosted([ordinary()], {
          rates: [
            orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82, { rate_type: "material" }),
          ],
        }),
        FLOORING_CARPET_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      750
    ) &&
    near(
      line(
        hosted([ordinary()], {
          rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82, { active: false })],
        }),
        FLOORING_CARPET_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      750
    )
);
check(
  "53. Company sell is not treated as direct COST",
  near(
    line(
      hosted([ordinary()], {
        rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82, { sell_rate: 200 })],
      }),
      FLOORING_CARPET_SUPPLY_INSTALL_M2
    )?.recommendedCost,
    820
  )
);

const reviewFacts = persist([
  ordinary({
    label: "Bedrooms",
    area_m2: 24,
    underlay_required: true,
  }),
  ordinary({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa11",
    label: "Bathroom floor",
    finish_type: "tile",
    area_m2: 12,
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: false,
  }),
  ordinary({
    id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa12",
    label: "Dining room",
    finish_type: "hardwood",
    area_m2: 15,
    hardwood_board_width_mm: 186,
  }),
]);
const reviewEst = calculateEstimate(ctx(reviewFacts));
const review = reviewOf(reviewEst, reviewFacts);
const titles = (review.workAreas[0]?.portionGroups ?? []).map((row) => row.label);
check(
  "54. Builder Review titles use human Flooring Area wording",
  titles.some((row) => row === "Bedrooms — 24 m² carpet") &&
    titles.some((row) => row === "Bathroom floor — 12 m² tile, 600 × 600 mm") &&
    titles.some((row) => row === "Dining room — 15 m² hardwood, 186 mm boards")
);
check(
  "55. Builder Review groups Finish / Add-ons independently",
  (review.workAreas[0]?.portionGroups ?? []).some((group) =>
    group.lineGroups.some((lg) => lg.label === "Finish")
  ) &&
    (review.workAreas[0]?.portionGroups ?? []).some((group) =>
      group.lineGroups.some((lg) => lg.label === "Add-ons")
    )
);
const tileGroup = (review.workAreas[0]?.portionGroups ?? []).find((row) =>
  row.label.includes("Bathroom floor")
);
check(
  "56. Tile takeoff wording is informational only",
  /does not multiply the subcontract COST/i.test(
    tileGroup?.lineGroups.find((lg) => lg.label === "Finish")?.supporting ?? ""
  )
);
const hardwoodGroup = (review.workAreas[0]?.portionGroups ?? []).find((row) =>
  row.label.includes("Dining room")
);
check(
  "57. Hardwood lm wording is informational only",
  /does not multiply the subcontract COST/i.test(
    hardwoodGroup?.lineGroups.find((lg) => lg.label === "Finish")?.supporting ?? ""
  )
);
const reviewComp = reviewOf(
  comprehensive,
  persist([
    ordinary({
      label: "Lounge",
      area_m2: 12,
      underlay_required: true,
      substrate_required: true,
      substrate_family: "structural_plywood",
      substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
      framing_required: true,
      framing_allowance_level: "standard",
      finish_removal_required: true,
      existing_finish_type: "carpet",
      substrate_removal_required: true,
    }),
  ])
);
const lounge = reviewComp.workAreas[0]?.portionGroups?.[0];
check(
  "58. Builder Review includes Substrate, Framing allowance, and Removal",
  (lounge?.lineGroups ?? []).some((lg) => lg.label === "Substrate") &&
    (lounge?.lineGroups ?? []).some((lg) => lg.label === "Framing allowance") &&
    (lounge?.lineGroups ?? []).some((lg) => lg.label === "Removal")
);
check(
  "59. Framing review does not fabricate a materials/labour split",
  /Combined allowance/i.test(
    lounge?.lineGroups.find((lg) => lg.label === "Framing allowance")?.supporting ?? ""
  )
);
check(
  "60. Removal review does not claim disposal",
  /No disposal/i.test(
    lounge?.lineGroups.find((lg) => lg.label === "Removal")?.supporting ?? ""
  )
);
check(
  "61. Review titles do not expose enum keys",
  !titles.some((row) => /vinyl_plank|finish_type/.test(row))
);
check(
  "62. formatFlooringReviewTitle matches the Bedrooms fixture",
  formatFlooringReviewTitle(
    calculateFlooringPortionPhysical({
      workArea: WA,
      portion: ordinary({ label: "Bedrooms", area_m2: 24, underlay_required: true }),
    }).portion
  ) === "Bedrooms — 24 m² carpet"
);

check(
  "63. Nested Flooring never uses FITOUT $120/m²",
  comprehensive.lineItems.every(
    (row) => row.costRate !== FITOUT_BENCHMARKS.flooringPerM2.cost
  ) && FITOUT_BENCHMARKS.flooringPerM2.cost === 120
);
check(
  "64. Nested Flooring never uses $22/m² removal",
  comprehensive.lineItems.every(
    (row) => row.costRate !== FITOUT_BENCHMARKS.removalPerM2.cost
  )
);
check(
  "65. Nested Flooring never uses $8 underlay or $18/$45 prep",
  comprehensive.lineItems.every(
    (row) =>
      row.costRate !== FITOUT_BENCHMARKS.underlayPerM2.cost &&
      row.costRate !== FITOUT_BENCHMARKS.floorPrepMinor.cost &&
      row.costRate !== FITOUT_BENCHMARKS.floorPrepMajor.cost
  )
);
const legacy = calculateFlooring(
  ctx([{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }]),
  WA
);
check(
  "66. Flat legacy Flooring remains unchanged",
  legacy.lineItems.length > 0 &&
    legacy.lineItems.some(
      (row) => row.costRate === FITOUT_BENCHMARKS.flooringPerM2.cost
    )
);
check(
  "67. Nested and legacy do not coexist on the nested path",
  !comprehensive.lineItems.some((row) => row.itemKey === "flooring.material.m2") &&
    !comprehensive.lineItems.some((row) => row.itemKey === "scope.flooring.m2")
);
check(
  "68. Finish package is not split into invented material and labour",
  comprehensive.lineItems.filter(
    (row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
  ).length === 1 &&
    comprehensive.lineItems.find(
      (row) => row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )?.category === "subcontractor"
);
check(
  "69. Labour COST uses carpenter identity, with no hardcoded hourly figure in Flooring commercial modules",
  line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.itemKey ===
    FLOORING_CARPENTER_LABOUR_RATE_KEY &&
    !read("lib/estimate/flooring-commercial.ts").includes("$60") &&
    !/\b60\b/.test(
      read("lib/estimate/flooring-commercial.ts").split("labour.carpenter")[0] ?? ""
    )
);
check(
  "70. Physical kernel still does not recompute commercial money",
  calculateFlooringPortionPhysical({
    workArea: WA,
    portion: ordinary({ area_m2: 12 }),
  }).requirements.every((row) => row.priced === false)
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("flooring");
check(
  "71. Ordinary packages, plywood, productivity, framing and removal resolve",
  coverage.ok &&
    coverage.resolves.length >= 6 + 1 + 1 + 3 + 5 &&
    liveQuotrProductivity(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET) === 0.5
);
check(
  "72. Hosted commercialisation and Builder Review are wired",
  FLOORING_BENCHMARK_REQUIREMENTS.some(
    (row) =>
      row.component === "Hosted commercial line items" &&
      row.outcome === "RESOLVES_WITH_QUOTR"
  ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Builder Review grouping" &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    )
);
check(
  "73. Pricing, Quote and human QA remain unwired; L5 blocked",
  coverage.needsOwnerApproval.length > 0 &&
    workAreaMayCloseAtL5(coverage) === false &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Pricing page integration" &&
        row.outcome === "NEEDS_NEW_QUOTR_BENCHMARK"
    ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Client Quote wording" &&
        row.outcome === "NEEDS_NEW_QUOTR_BENCHMARK"
    )
);
check(
  "74. FC/Secura and custom/specialist remain intentional PR",
  FLOORING_BENCHMARK_REQUIREMENTS.some(
    (row) =>
      row.materialIdentity === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY &&
      row.outcome === "INTENTIONAL_PRICING_REQUIRED"
  ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.materialIdentity === FLOORING_CUSTOM_FINISH_COMPONENT &&
        row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    )
);
check(
  "75. Traceability: every commercial line has nested ID, component, quantity, source",
  comprehensive.lineItems.every(
    (row) =>
      Boolean(row.nestedItemId) &&
      Boolean(row.componentKey) &&
      (row.quantity ?? 0) > 0 &&
      Boolean(row.rateSource)
  )
);
check(
  "76. Preparation is not applied to carpet or hardwood",
  hosted([ordinary({ underlay_required: false })]).lineItems.every(
    (row) => row.componentKey !== FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
  ) &&
    hosted([
      ordinary({ finish_type: "hardwood", hardwood_board_width_mm: 186 }),
    ]).lineItems.every(
      (row) => row.componentKey !== FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
    )
);
check(
  "77. No framing line when framing is No",
  hosted([ordinary()]).lineItems.every(
    (row) => !String(row.componentKey).includes("subfloor_framing")
  )
);
check(
  "78. Unknown removal type stays PR while finish still prices",
  hosted([
    ordinary({
      finish_removal_required: true,
      existing_finish_type: "other",
      substrate_removal_required: false,
    }),
  ]).lineItems.some(
    (row) =>
      row.rateSourceType === "missing" && /custom existing-finish removal/i.test(row.label)
  ) &&
    near(
      line(
        hosted([
          ordinary({
            finish_removal_required: true,
            existing_finish_type: "other",
            substrate_removal_required: false,
          }),
        ]),
        FLOORING_CARPET_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      750
    )
);
check(
  "79. Specialist component identity is retained",
  specialist.lineItems.some(
    (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
  )
);
check(
  "80. Multi-area review keeps independent groups",
  (reviewOf(multi, persist([bedrooms, living])).workAreas[0]?.portionGroups ?? [])
    .length === 2
);
check(
  "81. Substrate install quantity is purchased sheets from FLOORING-03, not net m²",
  line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.quantity === 5 &&
    line(ply, FLOORING_SUBSTRATE_INSTALL_LABOUR)?.unit === "sheet"
);
check(
  "82. No Bathroom tile/vinyl package keys on nested Flooring lines",
  comprehensive.lineItems.every(
    (row) =>
      row.itemKey !== "bathroom.tile.install.m2" &&
      row.itemKey !== "bathroom.floor_finish.vinyl_plank.install.m2"
  )
);
check(
  "83. Commercial module does not rebuild area from raw facts",
  !read("lib/estimate/flooring-commercial.ts").includes("getNumberFact") &&
    !read("lib/estimate/flooring-commercial.ts").includes("flooring.area_m2")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
