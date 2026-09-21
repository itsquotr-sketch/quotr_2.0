/**
 * DOORS-05 — nested commercialisation and Builder Review.
 *
 * Run: npx --yes tsx scripts/verify-doors-05-commercial-builder-review.ts
 *
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import { PROJECT_CONDITION_PRODUCTIVITY_PATHS } from "../lib/estimate/condition-productivity-paths";
import {
  doorsLineScopeKey,
  formatDoorsReviewTitle,
} from "../lib/estimate/doors-commercial";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_HARDWARE_INSTALL_LABOUR,
  DOORS_HARDWARE_INSTALL_LABEL,
  DOORS_HARDWARE_STANDARD_COMPONENT,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_HARDWARE_STANDARD_LABEL,
  DOORS_LEAF_HOLLOW_CORE_LABEL,
  DOORS_ORDINARY_MATERIAL_KEYS,
  DOORS_ORDINARY_PRODUCTIVITY_KEYS,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_HOLLOW_CORE_SET_LABEL,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_PREHUNG_INSTALL_LABOUR,
  DOORS_PREHUNG_INSTALL_LABEL,
  DOORS_PREHUNG_SET_COMPONENT,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABEL,
  DOORS_SPECIALIST_COMPONENT,
} from "../lib/estimate/doors-identities";
import {
  calculateDoorsPhysical,
  requirementsForNestedItem,
} from "../lib/estimate/doors-physical";
import {
  createEmptyDoorPortion,
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTIONS_FACT_KEY,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateContext,
  EstimateConstraint,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";
import {
  DOORS_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";

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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const WA: EstimateWorkArea = {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
};
const IW: EstimateWorkArea = {
  id: "iw1",
  type: "internal_walls",
  name: "Internal Walls",
  sort_order: 2,
};

function persist(portions: readonly DoorPortion[], workAreaId = WA.id): EstimateFact[] {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
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
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-ordinary-1",
    label: patch.label ?? null,
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    height_authority: "extracted",
    specialist_kind: null,
    ...patch,
  };
}

function replacement(patch: Partial<DoorPortion> = {}): DoorPortion {
  return ordinary({
    id: "door-set-replacement-1",
    installation_type: "replacement_leaf",
    leaf_construction: "solid_core",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: false,
    ...patch,
  });
}

function specialist(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-specialist-1",
    label: patch.label ?? null,
    installation_type: "other_unsupported",
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: 1,
    hardware_included: null,
    other_description:
      patch.other_description ?? "fire-rated acoustic access-control door",
    specialist_kind: patch.specialist_kind ?? "fire_rated",
    ...patch,
  };
}

function materials(
  rows: readonly EstimateRequirement[]
): MaterialRequirement[] {
  return rows.filter((row): row is MaterialRequirement => row.kind === "material");
}

function labour(rows: readonly EstimateRequirement[]): LabourRequirement[] {
  return rows.filter((row): row is LabourRequirement => row.kind === "labour");
}

function companyMaterial(
  itemKey: string,
  cost: number,
  unit = getCatalogueEntry(itemKey)?.unit ?? "each"
): OrganisationRate {
  return {
    id: `org-mat-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function companyProductivity(
  itemKey: string,
  hours: number,
  unit: string
): OrganisationRate {
  return {
    id: `org-prod-${itemKey}`,
    rate_type: "productivity",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function companyLabour(cost: number): OrganisationRate {
  return {
    id: "org-labour-carpenter",
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: null,
    item_key: DOORS_CARPENTER_LABOUR_RATE_KEY,
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function hosted(portions: readonly DoorPortion[], extra: Parameters<typeof ctx>[1] = {}) {
  return calculateEstimate(ctx(persist(portions), extra));
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((row) => row.includedInTotal !== false)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function reqCost(rows: readonly EstimateRequirement[]): number {
  return round2(
    rows.reduce((sum, row) => {
      if (!row.priced || row.totalCost == null) return sum;
      return sum + row.totalCost;
    }, 0)
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
  facts: EstimateFact[],
  workAreas: { id: string; name: string; type: string }[] = [
    { id: WA.id, name: WA.name, type: WA.type },
  ]
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
    workAreas: workAreas.map((row) => ({ ...row, status: "confirmed" })),
    requirements: estimate.requirements,
    facts,
  });
}

function visibleReviewText(review: ReturnType<typeof composeBuilderReview>): string {
  const parts: string[] = [];
  for (const wa of review.workAreas) {
    parts.push(wa.workAreaName, wa.workAreaType ?? "");
    for (const group of wa.portionGroups ?? []) {
      parts.push(group.label, group.summary ?? "", ...group.assumptions);
      for (const lg of group.lineGroups) {
        parts.push(lg.label, lg.supporting ?? "", lg.rateContext ?? "");
        for (const child of lg.children) {
          parts.push(
            child.label,
            child.supporting ?? "",
            child.rateLabel,
            child.specification ?? ""
          );
        }
      }
    }
    for (const cat of wa.categories) {
      for (const line of cat.lines) {
        parts.push(line.label, line.supporting ?? "", line.rateLabel);
      }
    }
  }
  return parts.join(" · ");
}

function fixtureA(): DoorPortion {
  return ordinary({
    id: "fixture-a",
    label: "Bedroom doors",
    quantity: 1,
    hardware_included: true,
  });
}

function fixtureB(): DoorPortion {
  return ordinary({
    id: "fixture-b",
    leaf_construction: "solid_core",
    quantity: 1,
    hardware_included: true,
  });
}

function fixtureC(): DoorPortion {
  return replacement({
    id: "fixture-c",
    leaf_construction: "hollow_core",
    hardware_included: false,
  });
}

function fixtureD(): DoorPortion {
  return replacement({
    id: "fixture-d",
    leaf_construction: "solid_core",
    hardware_included: false,
  });
}

function fixtureE(): DoorPortion {
  return replacement({
    id: "fixture-e",
    leaf_construction: "hollow_core",
    hardware_included: true,
  });
}

function fixtureF(): DoorPortion {
  return ordinary({
    id: "fixture-f",
    label: "Bedroom doors",
    quantity: 2,
    hardware_included: true,
  });
}

console.log("=== DOORS-05 benchmark fixtures ===\n");

const a = hosted([fixtureA()]);
const b = hosted([fixtureB()]);
const c = hosted([fixtureC()]);
const d = hosted([fixtureD()]);
const e = hosted([fixtureE()]);
const f = hosted([fixtureF()]);
const combined = hosted([
  fixtureF(),
  replacement({
    id: "set-2-solid-replacement",
    label: "Ensuite",
    leaf_construction: "solid_core",
    hardware_included: false,
  }),
]);

check("1. Fixture A total = $445", near(a.recommendedCost, 445));
check("2. Fixture B total = $585", near(b.recommendedCost, 585));
check("3. Fixture C total = $170", near(c.recommendedCost, 170));
check("4. Fixture D total = $310", near(d.recommendedCost, 310));
check("5. Fixture E total = $255", near(e.recommendedCost, 255));
check("6. Fixture F total = $890", near(f.recommendedCost, 890));
check("7. Combined multi-set total = $1,200", near(combined.recommendedCost, 1200));

const aReqs = a.requirements ?? [];
check(
  "8. Materials and labour reconcile to totals",
  near(reqCost(aReqs), 445) &&
    near(includedCost(a.lineItems), 445) &&
    near(reqCost(materials(aReqs)), 295) &&
    near(reqCost(labour(aReqs)), 150)
);

check(
  "9. No sell/margin money is embedded in direct COST",
  materials(aReqs).every(
    (row) =>
      !row.priced ||
      (row.unitCost != null &&
        row.totalCost != null &&
        near(row.totalCost, round2(row.purchaseQuantity * row.unitCost)))
  ) &&
    labour(aReqs).every(
      (row) =>
        !row.priced ||
        (row.hourlyCost != null &&
          row.totalCost != null &&
          near(row.totalCost, round2(row.adjustedHours * row.hourlyCost)))
    ) &&
    a.recommendedSell > a.recommendedCost
);

check(
  "10. No legacy lump contributes",
  [a, b, c, d, e, f, combined].every(
    (est) =>
      !est.lineItems.some(
        (row) =>
          /supply\/install allowance/i.test(row.label) ||
          /Door installation allowance/i.test(row.label)
      )
  ) && !read("lib/estimate/doors-commercial.ts").includes("doorsEach")
);

console.log("\n=== DOORS-05 quantities and hours ===\n");

const aPhys = calculateDoorsPhysical({
  facts: persist([fixtureA()]),
  workArea: WA,
});
const aMat = materials(a.requirements ?? []);
const aLab = labour(a.requirements ?? []);
check(
  "11. Material quantities match physical requirements",
  aMat.every((row) => {
    const phys = materials(aPhys.requirements).find(
      (item) =>
        item.componentKey === row.componentKey &&
        item.variantKey === row.variantKey
    );
    return phys != null && phys.baseQuantity === row.baseQuantity;
  })
);
check(
  "12. Purchase quantities match physical requirements",
  aMat.every((row) => {
    const phys = materials(aPhys.requirements).find(
      (item) =>
        item.componentKey === row.componentKey &&
        item.variantKey === row.variantKey
    );
    return phys != null && phys.purchaseQuantity === row.purchaseQuantity;
  }) &&
    a.lineItems
      .filter((row) => row.category === "materials" && row.rateSourceType !== "missing")
      .every((row) => row.quantity === 1)
);

const prehungLab = aLab.find(
  (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
);
const hardwareLab = aLab.find(
  (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
);
const replC = labour(c.requirements ?? []).find(
  (row) => row.componentKey === DOORS_REPLACEMENT_LEAF_INSTALL_LABOUR
);
check(
  "13. Prehung hours use 2.00",
  near(prehungLab?.productivityBasis.hoursPerUnit, DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR) &&
    near(prehungLab?.adjustedHours, 2)
);
check(
  "14. Replacement hours use 1.50",
  near(
    replC?.productivityBasis.hoursPerUnit,
    DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR
  ) && near(replC?.adjustedHours, 1.5)
);
check(
  "15. Hardware hours use 0.50",
  near(
    hardwareLab?.productivityBasis.hoursPerUnit,
    DOORS_HARDWARE_INSTALL_HOURS_PER_SET
  ) && near(hardwareLab?.adjustedHours, 0.5)
);
check(
  "16. Hardware hours are additive",
  near((prehungLab?.adjustedHours ?? 0) + (hardwareLab?.adjustedHours ?? 0), 2.5) &&
    aLab.filter((row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR).length ===
      1 &&
    aLab.filter((row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR).length === 1
);
check(
  "17. Hardware excluded emits no hardware money/hours",
  materials(c.requirements ?? []).every(
    (row) => row.materialKey !== DOORS_HARDWARE_STANDARD_KEY
  ) &&
    labour(c.requirements ?? []).every(
      (row) => row.componentKey !== DOORS_HARDWARE_INSTALL_LABOUR
    )
);

const wide = hosted([
  ordinary({
    id: "wide",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: true,
  }),
]);
check(
  "18. Dimensions do not alter rate or hours",
  near(wide.recommendedCost, 445) &&
    near(
      labour(wide.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2
    )
);
check(
  "19. Hollow/solid changes material only",
  near(b.recommendedCost - a.recommendedCost, 140) &&
    near(
      labour(b.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2
    ) &&
    near(
      labour(b.requirements ?? []).find(
        (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
      )?.adjustedHours,
      0.5
    )
);
check(
  "20. No physical quantity is recomputed commercially",
  aMat.every((row) => row.wasteFactor === 0) &&
    !read("lib/estimate/doors-commercial.ts").includes("baseQuantity *") &&
    aPhys.requirements.every((row) =>
      row.kind === "material"
        ? row.purchaseQuantity ===
          aMat.find((item) => item.componentKey === row.componentKey)?.purchaseQuantity
        : true
    )
);

console.log("\n=== DOORS-05 company authority ===\n");

const matOverride = hosted([fixtureA()], {
  rates: [companyMaterial(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, 275)],
});
const aPrehungMat = materials(a.requirements ?? []).find(
  (row) => row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
);
const oPrehungMat = materials(matOverride.requirements ?? []).find(
  (row) => row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
);
check(
  "21. Material override changes material money only",
  near(oPrehungMat?.unitCost, 275) &&
    oPrehungMat?.purchaseQuantity === aPrehungMat?.purchaseQuantity &&
    near(
      labour(matOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2
    ) &&
    near(
      labour(matOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.hourlyCost,
      60
    ) &&
    near(matOverride.recommendedCost, 480)
);

const prodOverride = hosted([fixtureA()], {
  rates: [
    companyProductivity(
      DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
      2.5,
      "door"
    ),
  ],
});
check(
  "22. Productivity override changes hours only",
  near(
    materials(prodOverride.requirements ?? []).find(
      (row) => row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
    )?.totalCost,
    240
  ) &&
    near(
      labour(prodOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2.5
    ) &&
    near(
      labour(prodOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.hourlyCost,
      60
    )
);

const labourOverride = hosted([fixtureA()], { rates: [companyLabour(75)] });
check(
  "23. Hourly COST override changes labour money only",
  materials(labourOverride.requirements ?? []).every((row) =>
    near(row.totalCost, row.kind === "material" ? row.totalCost : 0)
  ) &&
    near(
      labour(labourOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2
    ) &&
    near(
      labour(labourOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.hourlyCost,
      75
    ) &&
    near(labourOverride.recommendedCost, 482.5)
);

const hwMatOverride = hosted([fixtureA()], {
  rates: [companyMaterial(DOORS_HARDWARE_STANDARD_KEY, 80, "set")],
});
check(
  "24. Hardware material override is independent",
  near(
    materials(hwMatOverride.requirements ?? []).find(
      (row) => row.materialKey === DOORS_HARDWARE_STANDARD_KEY
    )?.unitCost,
    80
  ) &&
    near(
      materials(hwMatOverride.requirements ?? []).find(
        (row) => row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
      )?.unitCost,
      240
    ) &&
    near(
      labour(hwMatOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
      )?.adjustedHours,
      0.5
    )
);

const hwProdOverride = hosted([fixtureA()], {
  rates: [
    companyProductivity(DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY, 0.75, "set"),
  ],
});
check(
  "25. Hardware productivity override is independent",
  near(
    labour(hwProdOverride.requirements ?? []).find(
      (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
    )?.adjustedHours,
    0.75
  ) &&
    near(
      labour(hwProdOverride.requirements ?? []).find(
        (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
      )?.adjustedHours,
      2
    ) &&
    near(
      materials(hwProdOverride.requirements ?? []).find(
        (row) => row.materialKey === DOORS_HARDWARE_STANDARD_KEY
      )?.totalCost,
      55
    )
);

const restored = hosted([fixtureA()], { rates: [] });
check(
  "26. Removing overrides restores Quotr authority",
  near(restored.recommendedCost, 445)
);

const tenantB = hosted([fixtureA()], {
  rates: [companyMaterial(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, 999)],
});
check(
  "27. Other tenants are unaffected",
  near(a.recommendedCost, 445) &&
    near(tenantB.recommendedCost, 445 - 240 + 999) &&
    a.recommendedCost !== tenantB.recommendedCost
);

console.log("\n=== DOORS-05 missing/custom/specialist safety ===\n");

const custom = hosted([
  ordinary({
    id: "custom-1",
    leaf_construction: "other",
    other_description: "custom cedar leaf",
    hardware_included: true,
  }),
]);
const customMat = materials(custom.requirements ?? []).find(
  (row) => row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
);
const customLab = labour(custom.requirements ?? []).find(
  (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
);
const customHw = materials(custom.requirements ?? []).find(
  (row) => row.materialKey === DOORS_HARDWARE_STANDARD_KEY
);
check(
  "28. Custom material is Pricing Required with null money",
  customMat != null &&
    customMat.priced === false &&
    customMat.unitCost == null &&
    customMat.totalCost == null &&
    customMat.rateSource === "missing"
);
check(
  "29. Custom material quantity remains visible",
  customMat?.purchaseQuantity === 1 &&
    custom.lineItems.some(
      (row) =>
        row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT &&
        row.quantity === 1 &&
        row.rateSourceType === "missing"
    )
);
check(
  "30. Custom ordinary labour still prices",
  customLab?.priced === true && near(customLab.totalCost, 120)
);
check(
  "31. Custom included hardware still prices",
  customHw?.priced === true &&
    near(customHw.totalCost, 55) &&
    near(
      labour(custom.requirements ?? []).find(
        (row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR
      )?.totalCost,
      30
    )
);

const specOnly = hosted([specialist({ quantity: 1 })]);
const specMat = materials(specOnly.requirements ?? []).find(
  (row) => row.componentKey === DOORS_SPECIALIST_COMPONENT
);
check(
  "32. Specialist is Pricing Required with null money",
  specMat != null &&
    specMat.priced === false &&
    specMat.unitCost == null &&
    specMat.totalCost == null &&
    specOnly.lineItems.some(
      (row) =>
        row.componentKey === DOORS_SPECIALIST_COMPONENT &&
        row.rateSourceType === "missing"
    )
);
check(
  "33. Specialist emits no ordinary money",
  materials(specOnly.requirements ?? []).every(
    (row) => !isOrdinaryMaterial(row.materialKey)
  ) &&
    labour(specOnly.requirements ?? []).every((row) => row.priced === false) &&
    !specOnly.lineItems.some((row) => (row.recommendedCost ?? 0) > 0)
);

function isOrdinaryMaterial(key: string | null | undefined): boolean {
  return Boolean(
    key && (DOORS_ORDINARY_MATERIAL_KEYS as readonly string[]).includes(key)
  );
}

const specSibling = hosted([
  specialist({ id: "spec-sib" }),
  fixtureA(),
]);
check(
  "34. Supported sibling continues pricing beside specialist",
  near(specSibling.recommendedCost, 445) &&
    specSibling.lineItems.some(
      (row) => row.nestedItemId === "fixture-a" && (row.recommendedCost ?? 0) > 0
    ) &&
    specSibling.lineItems.some(
      (row) =>
        row.nestedItemId === "spec-sib" && row.rateSourceType === "missing"
    )
);

const incompleteSibling = hosted([
  fixtureA(),
  createEmptyDoorPortion({ id: "incomplete-sib" }),
]);
check(
  "35. Incomplete sibling does not suppress complete sibling",
  near(incompleteSibling.recommendedCost, 445) &&
    incompleteSibling.missingInfo.some((row) => /not confirmed/i.test(row))
);
check(
  "36. Missing quantity is not zero",
  !incompleteSibling.lineItems.some(
    (row) =>
      row.nestedItemId === "incomplete-sib" && row.quantity === 0
  ) &&
    createEmptyDoorPortion().quantity !== 0 &&
    createEmptyDoorPortion().quantity == null
);
check(
  "37. Missing rate is not represented as legitimate $0",
  customMat?.totalCost !== 0 &&
    specMat?.totalCost !== 0 &&
    custom.lineItems
      .filter((row) => row.rateSourceType === "missing")
      .every((row) => row.rateSource.toLowerCase().includes("pricing required"))
);

const emptyNested = calculateDoors(
  ctx([
    {
      key: DOORS_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: [],
      source: "user",
    },
  ]),
  WA
);
const incompleteOnly = calculateDoors(
  ctx(persist([createEmptyDoorPortion({ id: "empty-1" })])),
  WA
);
const unsupportedOnly = calculateDoors(ctx(persist([specialist()])), WA);
check(
  "38. No nested failure falls through to legacy money",
  emptyNested.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    emptyNested.lineItems.length === 0 &&
    incompleteOnly.lineItems.length === 0 &&
    incompleteOnly.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    !unsupportedOnly.lineItems.some(
      (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
    )
);

console.log("\n=== DOORS-05 ownership ===\n");

const twins = hosted([
  ordinary({ id: "twin-a", quantity: 1, hardware_included: true }),
  ordinary({ id: "twin-b", quantity: 1, hardware_included: true }),
]);
check(
  "39. Multiple portions remain separate",
  twins.lineItems.some((row) => row.nestedItemId === "twin-a") &&
    twins.lineItems.some((row) => row.nestedItemId === "twin-b") &&
    near(twins.recommendedCost, 890)
);
check(
  "40. Identical portions do not dedupe",
  twins.lineItems.filter(
    (row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT
  ).length === 2 &&
    twins.lineItems.filter(
      (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
    ).length === 2
);
check(
  "41. Material and labour sibling lines remain separate",
  a.lineItems.some((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT) &&
    a.lineItems.some((row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR) &&
    new Set(a.lineItems.map((row) => row.scopeKey)).size === a.lineItems.length
);
check(
  "42. Hardware and primary-door lines remain separate",
  a.lineItems.some((row) => row.componentKey === DOORS_HARDWARE_STANDARD_COMPONENT) &&
    a.lineItems.some((row) => row.componentKey === DOORS_HARDWARE_INSTALL_LABOUR) &&
    a.lineItems.some((row) => row.componentKey === DOORS_PREHUNG_SET_COMPONENT)
);
check(
  "43. Every line retains correct nested item ownership",
  a.lineItems.every((row) => row.nestedItemId === "fixture-a") &&
    combined.lineItems.every(
      (row) =>
        row.nestedItemId === "fixture-f" ||
        row.nestedItemId === "set-2-solid-replacement"
    ) &&
    a.lineItems.every(
      (row) =>
        row.scopeKey ===
        doorsLineScopeKey({
          workAreaId: WA.id,
          nestedItemId: row.nestedItemId ?? "",
          componentKey: row.componentKey ?? "",
        })
    )
);

console.log("\n=== DOORS-05 Builder Review ===\n");

const reviewA = reviewOf(a, persist([fixtureA()]));
const doorsWa = reviewA.workAreas.find((row) => row.workAreaType === "doors");
check("44. Doors group exists", doorsWa != null && doorsWa.workAreaName === "Doors");

const reviewCombined = reviewOf(
  combined,
  persist([
    fixtureF(),
    replacement({
      id: "set-2-solid-replacement",
      label: "Ensuite",
      leaf_construction: "solid_core",
      hardware_included: false,
    }),
  ])
);
const combinedGroups = reviewCombined.workAreas[0]?.portionGroups ?? [];
check(
  "45. Door Sets are grouped independently",
  combinedGroups.length === 2 &&
    combinedGroups.some((row) => /Bedroom doors/.test(row.label)) &&
    combinedGroups.some((row) => /Ensuite/.test(row.label))
);

const fTitle = formatDoorsReviewTitle(
  calculateDoorsPhysical({ facts: persist([fixtureF()]), workArea: WA }).portions[0]!
);
check(
  "46. Generated specification title is correct",
  fTitle ===
    "Bedroom doors — 2 × 1980 × 810 mm hollow-core prehung internal door sets" &&
    (doorsWa?.portionGroups?.[0]?.label.includes("Bedroom doors") ?? false)
);

const aText = visibleReviewText(reviewA);
check(
  "47. Door supply line is readable",
  /hollow-core prehung internal door/i.test(aText)
);
check(
  "48. Hardware allowance line is readable",
  /hardware/i.test(aText) && /latch|lever|allowance/i.test(aText)
);
check(
  "49. Labour operations are readable",
  /prehung/i.test(aText) &&
    /install/i.test(aText) &&
    /hardware/i.test(aText)
);

const reviewRepl = reviewOf(
  hosted([
    replacement({
      id: "ensuite-repl",
      label: "Ensuite",
      leaf_construction: "solid_core",
      hardware_included: false,
    }),
  ]),
  persist([
    replacement({
      id: "ensuite-repl",
      label: "Ensuite",
      leaf_construction: "solid_core",
      hardware_included: false,
    }),
  ])
);
const replText = visibleReviewText(reviewRepl);
const replAssumptions = (reviewRepl.workAreas[0]?.portionGroups ?? []).flatMap(
  (row) => row.assumptions
);
check(
  "50. Replacement disclosures are visible",
  /Existing frame\/jamb retained/i.test(replAssumptions.join(" ")) &&
    /No opening alteration included/i.test(replAssumptions.join(" ")) &&
    /Existing hardware reused/i.test(replAssumptions.join(" "))
);

const reviewCustom = reviewOf(
  custom,
  persist([
    ordinary({
      id: "custom-1",
      leaf_construction: "other",
      other_description: "custom cedar leaf",
      hardware_included: true,
    }),
  ])
);
const customText = visibleReviewText(reviewCustom);
check(
  "51. Pricing Required is visible without $0",
  /pricing required|rate required/i.test(customText) &&
    !/\$0/.test(customText) &&
    (reviewCustom.workAreas[0]?.portionGroups ?? []).some((group) =>
      group.lineGroups.some((lg) => lg.pricingRequired || lg.costHidden)
    )
);
check(
  "52. No internal key leaks",
  !/door\.set\.internal|door\.leaf\.internal|doors\.prehung\.install\.hours|labour\.carpenter\.hour/.test(
    aText + customText + replText
  )
);
check(
  "53. No legacy package label appears",
  !/supply\/install allowance|Door installation allowance|doorsEach/.test(
    aText + visibleReviewText(reviewCombined)
  )
);
check(
  "54. Review totals reconcile to hosted estimator totals",
  near(reviewA.overview.recommendedCost, a.recommendedCost) &&
    near(reviewCombined.overview.recommendedCost, combined.recommendedCost)
);

console.log("\n=== DOORS-05 hosted integration ===\n");

check(
  "55. Hosted calculateEstimate prices complete nested Doors",
  a.lineItems.length > 0 &&
    !a.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    calculateDoors(ctx(persist([fixtureA()])), WA).lineItems.length > 0
);
check("56. Hosted path produces the accepted fixture total", near(a.recommendedCost, 445));
check(
  "57. Hosted path preserves company overrides",
  near(matOverride.recommendedCost, 480)
);
check(
  "58. Hosted path preserves custom-material partial pricing",
  near(custom.recommendedCost, 205) &&
    custom.lineItems.some(
      (row) =>
        row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT &&
        row.rateSourceType === "missing"
    )
);
check(
  "59. Hosted path preserves specialist sibling pricing",
  near(specSibling.recommendedCost, 445)
);

const legacy = calculateDoors(
  ctx([{ key: "doors.count", work_area_id: WA.id, value: 2, source: "user" }]),
  WA
);
check(
  "60. Legacy flat fixture remains unchanged",
  legacy.lineItems.some(
    (row) => row.recommendedCost === 2 * FITOUT_BENCHMARKS.doorsEach.cost
  ) && !legacy.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);
check(
  "61. Empty nested collection does not fall back",
  emptyNested.lineItems.length === 0 &&
    emptyNested.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);
check(
  "62. Incomplete nested collection does not fall back",
  incompleteOnly.lineItems.length === 0 &&
    incompleteOnly.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);
check(
  "63. Unsupported nested collection does not fall back",
  !unsupportedOnly.lineItems.some(
    (row) => (row.recommendedCost ?? 0) > 0
  ) &&
    (unsupportedOnly.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) ||
      unsupportedOnly.missingInfo.some((row) => /pricing required/i.test(row)))
);

console.log("\n=== DOORS-05 regression/coverage ===\n");

let iwFacts: EstimateFact[] = [];
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
});
const iwTypeId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
  value: "Yes",
  wallTypeId: iwTypeId,
});
const iwOpeningId = resolveInternalWallsWallTypes({
  facts: iwFacts,
  workAreaId: IW.id,
}).types[0]!.openings[0]!.id;
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.width_m",
  value: 0.81,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = applyInternalWallsFactWrite({
  facts: iwFacts,
  workAreaId: IW.id,
  key: "internal_walls.opening.height_m",
  value: 1.98,
  wallTypeId: iwTypeId,
  openingId: iwOpeningId,
});
iwFacts = [
  {
    key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
    work_area_id: IW.id,
    value: "new_partition",
    source: "user",
  },
  ...iwFacts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];
const iwOnly = calculateEstimate(ctx(iwFacts, { workAreas: [IW] }));
check(
  "64. IW opening-only produces no Door money",
  !iwOnly.lineItems.some((row) =>
    looksLikeDoorProductMoney({
      label: row.label,
      componentKey: row.componentKey,
      itemKey: row.itemKey,
    })
  ) &&
    !iwOnly.lineItems.some(
      (row) =>
        row.itemKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY ||
        row.componentKey === DOORS_PREHUNG_SET_COMPONENT
    )
);

const combinedIwDoors = calculateEstimate(
  ctx([...iwFacts, ...persist([fixtureA()])], { workAreas: [IW, WA] })
);
check(
  "65. Combined IW opening + Doors retains both work areas",
  combinedIwDoors.lineItems.some((row) => row.workAreaId === IW.id || row.workAreaName === IW.name) &&
    combinedIwDoors.lineItems.some((row) => row.workAreaId === WA.id || row.nestedItemId === "fixture-a") &&
    near(
      includedCost(
        combinedIwDoors.lineItems.filter(
          (row) => row.nestedItemId === "fixture-a" || row.workAreaId === WA.id
        )
      ),
      445
    )
);

check(
  "66. Ceiling/IW line ownership is unchanged",
  read("lib/estimate/internal-walls-physical.ts").includes("overlapGroup") &&
    read("lib/estimate/ceilings-commercial.ts").includes("withPricingOwnership") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("doors.set:") &&
    !read("lib/estimate/internal-walls-physical.ts").includes("doors.set:") &&
    read("lib/estimate/doors-commercial.ts").includes("doors.set:")
);

const doorsCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("doors");
check(
  "67. Coverage reports hosted commercial resolution honestly",
  doorsCoverage.ok &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        /hosted commercial/i.test(row.component) &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    ) &&
    DOORS_ORDINARY_MATERIAL_KEYS.every(
      (key) => liveQuotrMaterialCost(key) != null
    ) &&
    DOORS_ORDINARY_PRODUCTIVITY_KEYS.every(
      (key) => liveQuotrProductivity(key) != null
    )
);
check(
  "68. Quote wording is implemented without claiming human-QA frozen",
  workAreaMayCloseAtL5(doorsCoverage) &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        /pricing and quote/i.test(row.component) &&
        row.outcome === "RESOLVES_WITH_QUOTR" &&
        /DOORS-07/.test(row.notes) &&
        /not human-qa frozen/i.test(row.notes)
    )
);

const access = hosted([fixtureA()], {
  constraints: [{ key: "site_access", label: "Site access", value: "Difficult" }],
});
const accessLab = labour(access.requirements ?? []).find(
  (row) => row.componentKey === DOORS_PREHUNG_INSTALL_LABOUR
);
const accessPhys = calculateDoorsPhysical({
  facts: persist([fixtureA()]),
  workArea: WA,
});
check(
  "69. Project Conditions do not alter physical quantities",
  accessPhys.requirements.every((row) => {
    const priced = (access.requirements ?? []).find(
      (item) =>
        item.componentKey === row.componentKey &&
        item.variantKey === row.variantKey
    );
    if (row.kind !== "material" || priced?.kind !== "material") return true;
    return row.purchaseQuantity === priced.purchaseQuantity;
  }) &&
    near(
      materials(access.requirements ?? []).find(
        (row) => row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
      )?.totalCost,
      240
    ) &&
    (accessLab?.adjustedHours ?? 0) > 2
);
check(
  "70. No unapproved Doors-specific condition multiplier exists",
  !read("lib/estimate/doors-commercial.ts").includes("1.15") &&
    !read("lib/estimate/doors-commercial.ts").includes("* 1.") &&
    read("lib/estimate/doors-commercial.ts").includes("getCombinedLabourAccessFactor") &&
    PROJECT_CONDITION_PRODUCTIVITY_PATHS.some((row) =>
      "doors" in row
        ? /shared getCombinedLabourAccessFactor|applied via getCombinedLabourAccessFactor|Not consumed/.test(
            String((row as { doors?: string }).doors ?? "")
          )
        : false
    )
);

check(
  "human labels used on commercial lines",
  a.lineItems.some((row) => row.label === DOORS_PREHUNG_HOLLOW_CORE_SET_LABEL) &&
    a.lineItems.some((row) => row.label === DOORS_HARDWARE_STANDARD_LABEL) &&
    a.lineItems.some((row) => row.label === DOORS_PREHUNG_INSTALL_LABEL) &&
    a.lineItems.some((row) => row.label === DOORS_HARDWARE_INSTALL_LABEL) &&
    c.lineItems.some((row) => row.label === DOORS_LEAF_HOLLOW_CORE_LABEL) &&
    c.lineItems.some((row) => row.label === DOORS_REPLACEMENT_LEAF_INSTALL_LABEL)
);

check(
  "no $60 hardcoded in Doors commercial module",
  !read("lib/estimate/doors-commercial.ts").includes("60") &&
    !read("lib/assistant/builder-review/doors-review-groups.ts").includes("$60")
);

check(
  "requirements retain nested ownership",
  requirementsForNestedItem(a.requirements ?? [], "fixture-a").length ===
    (a.requirements ?? []).length
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
