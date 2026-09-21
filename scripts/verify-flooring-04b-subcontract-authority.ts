/**
 * FLOORING-04B — finish subcontract and add-on rate authority.
 *
 * Run: npx --yes tsx scripts/verify-flooring-04b-subcontract-authority.ts
 *
 * No paid AI. No Production. No hosted commercial line items.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import { KITCHEN_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { liveQuotrMaterialCost, workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import {
  calculateDoors,
  calculateFlooring,
} from "../lib/estimate/calculators/fitout";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import {
  DOORS_LEAF_HOLLOW_CORE_COST_EX_GST,
  DOORS_LEAF_HOLLOW_CORE_KEY,
} from "../lib/estimate/doors-identities";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_SUPPLY_INSTALL_DESCRIPTION,
  FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_DESCRIPTION,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_DESCRIPTION,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_DESCRIPTION,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_ORDINARY_ADDON_KEYS,
  FLOORING_ORDINARY_FINISH_PACKAGE_KEYS,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBCONTRACT_RATE_KEYS,
  FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_TILE_SUPPLY_INSTALL_DESCRIPTION,
  FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_DESCRIPTION,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import { calculateFlooringPortionPhysical } from "../lib/estimate/flooring-physical";
import {
  createEmptyFlooringPortion,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  flooringSubcontractAuthorityCost,
  isFlooringSubcontractRateKey,
  resolveFlooringSubcontractRate,
} from "../lib/estimate/flooring-subcontract-authority";
import {
  FLOORING_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { FULL_RATE_CATALOGUE, getCatalogueEntry, groupCatalogueByWorkArea } from "../lib/rates/catalogue";
import { listMaterialsPageCatalogueEntries } from "../lib/rates/material-registry";
import {
  FLOORING_SUBCONTRACT_RATE_CATALOGUE,
  listSubcontractRatesCatalogueEntries,
} from "../lib/rates/specific-material-catalogue";
import type { RatesPageRate } from "../lib/rates/types";

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

const SIX = [...FLOORING_SUBCONTRACT_RATE_KEYS];
const COSTS: Record<string, number> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]:
    FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST,
};
const LABELS: Record<string, string> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]: FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
};
const DESCS: Record<string, string> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_DESCRIPTION,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_DESCRIPTION,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_DESCRIPTION,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]:
    FLOORING_HARDWOOD_SUPPLY_INSTALL_DESCRIPTION,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_DESCRIPTION,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_DESCRIPTION,
};
const COMPANY: Record<string, number> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: 82,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]: 105,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: 165,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]: 210,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]: 18,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]: 42,
};

const FORBIDDEN_ALIASES = [
  "scope.flooring.m2",
  "flooring.material.m2",
  "flooring.vinyl.m2",
  "flooring.carpet.m2",
  "bathroom.tile.install.m2",
  "bathroom.floor_finish.vinyl_plank.install.m2",
  "bathroom.tile.material.m2",
];

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(facts: EstimateFact[], rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates,
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
    trade: null,
    work_area_type: extra.work_area_type ?? "flooring",
    source: "explicit_company",
  };
}

function statusLabel(entry: { defaultCostRate?: number }, rate?: RatesPageRate): string {
  const hasCompany = Boolean(rate?.active && rate.cost_rate != null);
  if (hasCompany) return "Your rate";
  if (entry.defaultCostRate != null) return "Quotr benchmark";
  return "Pricing required";
}

const catalogueHits = FULL_RATE_CATALOGUE.filter((row) =>
  SIX.includes(row.item_key as (typeof SIX)[number])
);

console.log("=== A. Catalogue ===\n");

check(
  "A1. Six exact identities exist",
  SIX.every((key) => getCatalogueEntry(key)?.item_key === key)
);
check(
  "A2. Each appears exactly once",
  catalogueHits.length === 6 &&
    FLOORING_SUBCONTRACT_RATE_CATALOGUE.length === 6 &&
    new Set(catalogueHits.map((row) => row.item_key)).size === 6
);
check(
  "A3. All are work area Flooring",
  SIX.every((key) => getCatalogueEntry(key)?.work_area_type === "flooring")
);
check(
  "A4. All use subcontract rate type/category",
  SIX.every((key) => {
    const entry = getCatalogueEntry(key);
    return (
      entry?.rate_type === "subcontractor" && entry.category === "subcontractor"
    );
  })
);
check(
  "A5. All use m²",
  SIX.every((key) => getCatalogueEntry(key)?.unit === "m2")
);
check(
  "A6. Exact labels",
  SIX.every((key) => getCatalogueEntry(key)?.label === LABELS[key])
);
check(
  "A7. Exact descriptions/inclusions",
  SIX.every((key) => getCatalogueEntry(key)?.description === DESCS[key]) &&
    /Excludes underlay/.test(FLOORING_CARPET_SUPPLY_INSTALL_DESCRIPTION) &&
    /Excludes sheet vinyl/.test(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_DESCRIPTION) &&
    /waterproofing/.test(FLOORING_TILE_SUPPLY_INSTALL_DESCRIPTION) &&
    /sanding or coating/.test(FLOORING_HARDWOOD_SUPPLY_INSTALL_DESCRIPTION) &&
    /base carpet package excludes underlay/.test(
      FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_DESCRIPTION
    ) &&
    /Does not cover all preparation risk/.test(
      FLOORING_FLOOR_PREPARATION_ALLOWANCE_DESCRIPTION
    )
);
check(
  "A8. Exact approved benchmark COST",
  SIX.every((key) => getCatalogueEntry(key)?.defaultCostRate === COSTS[key])
);
check(
  "A9. No sell values",
  SIX.every((key) => getCatalogueEntry(key)?.defaultSellRate == null)
);
check(
  "A10. Company override supported",
  SIX.every((key) => /Company exact subcontract rate wins/.test(getCatalogueEntry(key)?.description ?? ""))
);
check(
  "A11. FULL_RATE_CATALOGUE inclusion",
  SIX.every((key) => FULL_RATE_CATALOGUE.some((row) => row.item_key === key))
);
check(
  "A12. No legacy aliases",
  SIX.every((key) => {
    const ratesSrc = read("lib/estimate/rates.ts");
    return (
      !ratesSrc.includes(`"${key}"`) &&
      FORBIDDEN_ALIASES.every((alias) => getCatalogueEntry(key)?.item_key !== alias)
    );
  }) &&
    !SIX.some((key) => key === "flooring.material.m2" || key === "scope.flooring.m2")
);

console.log("\n=== B. Resolver ===\n");

check(
  "B13. Carpet resolves $75",
  resolveFlooringSubcontractRate({ itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2 })
    .costRate === 75
);
check(
  "B14. Vinyl resolves $95",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  }).costRate === 95
);
check(
  "B15. Tile resolves $150",
  resolveFlooringSubcontractRate({ itemKey: FLOORING_TILE_SUPPLY_INSTALL_M2 })
    .costRate === 150
);
check(
  "B16. Hardwood resolves $190",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  }).costRate === 190
);
check(
  "B17. Underlay resolves $15",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  }).costRate === 15
);
check(
  "B18. Preparation resolves $35",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  }).costRate === 35
);
check(
  "B19. Source is Quotr benchmark",
  SIX.every(
    (key) =>
      resolveFlooringSubcontractRate({ itemKey: key }).source === "quotr" &&
      resolveFlooringSubcontractRate({ itemKey: key }).sourceLabel ===
        "Quotr benchmark"
  )
);
check(
  "B20. Missing/invalid company rate does not become valid zero",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 0)],
  }).costRate === 75 &&
    resolveFlooringSubcontractRate({
      itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, null)],
    }).costRate === 75 &&
    resolveFlooringSubcontractRate({
      itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      organisationSettings: { allow_benchmark_rates: false } as never,
    }).costRate == null
);
check(
  "B21. No legacy fallback",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    rates: [
      orgRate("flooring.material.m2", 120, { rate_type: "material" }),
      orgRate("flooring.carpet.m2", 95, { rate_type: "material" }),
      orgRate("scope.flooring.m2", 120, { rate_type: "scope" }),
    ],
  }).costRate === 75
);
check(
  "B22. No Bathroom/Kitchen fallback",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_TILE_SUPPLY_INSTALL_M2,
    rates: [
      orgRate("bathroom.tile.install.m2", 95, {
        rate_type: "subcontractor",
        work_area_type: "bathroom",
      }),
      orgRate("kitchen.flooring", 180, { rate_type: "allowance" }),
    ],
  }).costRate === 150
);

console.log("\n=== C. Company overrides ===\n");

for (const key of SIX) {
  const short = LABELS[key];
  check(
    `C. ${short} override wins`,
    resolveFlooringSubcontractRate({
      itemKey: key,
      rates: [orgRate(key, COMPANY[key])],
    }).costRate === COMPANY[key] &&
      resolveFlooringSubcontractRate({
        itemKey: key,
        rates: [orgRate(key, COMPANY[key])],
      }).source === "company"
  );
}
for (const key of SIX) {
  const short = LABELS[key];
  check(
    `C. ${short} removal restores Quotr`,
    resolveFlooringSubcontractRate({
      itemKey: key,
      rates: [orgRate(key, COMPANY[key], { active: false })],
    }).costRate === COSTS[key]
  );
}

check(
  "C35. One-key isolation",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
    rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82)],
  }).costRate === 95 &&
    resolveFlooringSubcontractRate({
      itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82)],
    }).costRate === 82
);
check(
  "C36. Tenant isolation",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82, { id: "tenant-a" })],
  }).costRate === 82 &&
    resolveFlooringSubcontractRate({
      itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      rates: [],
    }).costRate === 75
);
check(
  "C37. No duplicate row requirement",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    rates: [orgRate(FLOORING_CARPET_SUPPLY_INSTALL_M2, 82)],
  }).costRate === 82 &&
    FULL_RATE_CATALOGUE.filter(
      (row) => row.item_key === FLOORING_CARPET_SUPPLY_INSTALL_M2
    ).length === 1
);

const tile500 = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_type: "tile",
    tile_width_mm: 500,
    tile_length_mm: 500,
    floor_preparation_required: false,
  }),
});
const tileCompany = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_type: "tile",
    tile_width_mm: 500,
    tile_length_mm: 500,
    floor_preparation_required: false,
  }),
});
check(
  "C38. Physical quantities unchanged",
  tile500.portion.tile?.wholeTileCount === tileCompany.portion.tile?.wholeTileCount &&
    tile500.portion.physicalNetAreaM2 === 10 &&
    tile500.requirements.some(
      (row) =>
        row.kind === "subcontract" &&
        row.componentKey === FLOORING_TILE_SUPPLY_INSTALL_M2 &&
        row.priced === false
    )
);

console.log("\n=== D. Authority arithmetic ===\n");

check(
  "D39. 10 m² carpet = $750",
  flooringSubcontractAuthorityCost(FLOORING_CARPET_SUPPLY_INSTALL_M2, 10) === 750
);
check(
  "D40. Carpet + underlay = $900",
  flooringSubcontractAuthorityCost(FLOORING_CARPET_SUPPLY_INSTALL_M2, 10)! +
    flooringSubcontractAuthorityCost(FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2, 10)! ===
    900
);
check(
  "D41. Vinyl + prep = $1,300",
  flooringSubcontractAuthorityCost(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2, 10)! +
    flooringSubcontractAuthorityCost(FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2, 10)! ===
    1300
);
check(
  "D42. Tile + prep = $1,850",
  flooringSubcontractAuthorityCost(FLOORING_TILE_SUPPLY_INSTALL_M2, 10)! +
    flooringSubcontractAuthorityCost(FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2, 10)! ===
    1850
);
check(
  "D43. Hardwood = $1,900",
  flooringSubcontractAuthorityCost(FLOORING_HARDWOOD_SUPPLY_INSTALL_M2, 10) ===
    1900
);

const nestedCalc = calculateFlooring(ctx(persist([ordinary()])), WA);
check(
  "D44. No commercial line items emitted",
  nestedCalc.lineItems.length === 0 &&
    (nestedCalc.requirements?.length ?? 0) > 0 &&
    (nestedCalc.requirements ?? []).every((row) => row.priced === false)
);

const physicalMap = [
  {
    finish: "carpet" as const,
    key: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    extra: { underlay_required: true as const },
    addOn: FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  },
  {
    finish: "vinyl_plank" as const,
    key: FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
    extra: { floor_preparation_required: true as const },
    addOn: FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  },
  {
    finish: "tile" as const,
    key: FLOORING_TILE_SUPPLY_INSTALL_M2,
    extra: {
      tile_width_mm: 600,
      tile_length_mm: 600,
      floor_preparation_required: true as const,
    },
    addOn: FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  },
  {
    finish: "hardwood" as const,
    key: FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
    extra: { hardwood_board_width_mm: 190 },
    addOn: null,
  },
];
check(
  "physical. Rate identities match flooring-physical.ts",
  physicalMap.every((row) => {
    const result = calculateFlooringPortionPhysical({
      workArea: WA,
      portion: ordinary({ finish_type: row.finish, ...row.extra }),
    });
    return (
      result.requirements.some((req) => req.componentKey === row.key) &&
      (row.addOn == null ||
        result.requirements.some((req) => req.componentKey === row.addOn))
    );
  })
);

console.log("\n=== E. Size independence ===\n");

const tileSizes = [
  [500, 500],
  [600, 600],
  [300, 600],
  [600, 1200],
  [450, 450],
] as const;
const tilePackageRates = tileSizes.map(([w, l]) => {
  const result = calculateFlooringPortionPhysical({
    workArea: WA,
    portion: ordinary({
      finish_type: "tile",
      tile_width_mm: w,
      tile_length_mm: l,
      floor_preparation_required: false,
    }),
  });
  const pack = result.requirements.find(
    (row) =>
      row.kind === "material" && row.componentKey === FLOORING_TILE_SUPPLY_INSTALL_M2
  );
  return {
    count: result.portion.tile?.wholeTileCount ?? 0,
    qty: pack && pack.kind === "material" ? pack.baseQuantity : null,
    rate: resolveFlooringSubcontractRate({
      itemKey: FLOORING_TILE_SUPPLY_INSTALL_M2,
    }).costRate,
  };
});
check(
  "E45. Tile size matrix same package rate",
  tilePackageRates.every((row) => row.rate === 150 && row.qty === 10)
);
check(
  "E46. Tile count not used for money",
  new Set(tilePackageRates.map((row) => row.count)).size > 1 &&
    tilePackageRates.every((row) => row.qty === 10)
);

const hardwoodWidths = [145, 165, 186, 190, 220, 200] as const;
const hardwoodRows = hardwoodWidths.map((width) => {
  const result = calculateFlooringPortionPhysical({
    workArea: WA,
    portion: ordinary({
      finish_type: "hardwood",
      hardwood_board_width_mm: width,
      underlay_required: null,
    }),
  });
  const pack = result.requirements.find(
    (row) =>
      row.kind === "material" &&
      row.componentKey === FLOORING_HARDWOOD_SUPPLY_INSTALL_M2
  );
  return {
    lm: result.portion.hardwood?.linealM ?? 0,
    qty: pack && pack.kind === "material" ? pack.baseQuantity : null,
    rate: resolveFlooringSubcontractRate({
      itemKey: FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
    }).costRate,
  };
});
check(
  "E47. Hardwood width matrix same package rate",
  hardwoodRows.every((row) => row.rate === 190 && row.qty === 10)
);
check(
  "E48. Hardwood lm not used for money",
  new Set(hardwoodRows.map((row) => row.lm)).size > 1 &&
    hardwoodRows.every((row) => row.qty === 10)
);

console.log("\n=== F. Rates UI ===\n");

const subcontractEntries = listSubcontractRatesCatalogueEntries();
const flooringSub = subcontractEntries.filter((row) =>
  SIX.includes(row.item_key as (typeof SIX)[number])
);
const groups = groupCatalogueByWorkArea(flooringSub);
const uiSrc = read("components/rates/RatesNonDefaultSections.tsx");
const tableSrc = read("components/rates/RatesTableSection.tsx");

check(
  "F49. Flooring group visible",
  groups.some((group) => group.workAreaLabel === "Flooring finish packages") &&
    groups.some((group) => group.workAreaLabel === "Flooring add-ons") &&
    uiSrc.includes("listSubcontractRatesCatalogueEntries")
);
check(
  "F50. Four finish rows",
  FLOORING_ORDINARY_FINISH_PACKAGE_KEYS.every((key) =>
    flooringSub.some((row) => row.item_key === key)
  ) &&
    groups.find((group) => group.workAreaLabel === "Flooring finish packages")
      ?.entries.length === 4
);
check(
  "F51. Two add-on rows",
  FLOORING_ORDINARY_ADDON_KEYS.every((key) =>
    flooringSub.some((row) => row.item_key === key)
  ) &&
    groups.find((group) => group.workAreaLabel === "Flooring add-ons")?.entries
      .length === 2
);
check(
  "F52. Add/Edit supported",
  uiSrc.includes("showAddButton") &&
    tableSrc.includes("RateEditDialog") &&
    tableSrc.includes("upsertRate")
);
const companyRates: RatesPageRate[] = [
  {
    id: "c1",
    item_key: FLOORING_CARPET_SUPPLY_INSTALL_M2,
    rate_type: "subcontractor",
    label: FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
    unit: "m2",
    cost_rate: 82,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "flooring",
    source: null,
    source_calibration_id: null,
    updated_at: null,
  },
];
check(
  "F53. Company/Quotr source shown",
  statusLabel(getCatalogueEntry(FLOORING_CARPET_SUPPLY_INSTALL_M2)!, companyRates[0]) ===
    "Your rate" &&
    statusLabel(getCatalogueEntry(FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2)!) ===
      "Quotr benchmark"
);
check(
  "F54. Search finds Flooring",
  flooringSub.every((row) =>
    `${row.workAreaLabel} ${row.label} ${row.item_key}`
      .toLowerCase()
      .includes("flooring") ||
    row.label.toLowerCase().includes("carpet") ||
    row.workAreaLabel?.toLowerCase().includes("flooring")
  ) && flooringSub.some((row) => /carpet/i.test(row.label))
);
check(
  "F55. Status filter works",
  statusLabel(getCatalogueEntry(FLOORING_CARPET_SUPPLY_INSTALL_M2)!, companyRates[0]) ===
    "Your rate" &&
    statusLabel(getCatalogueEntry(FLOORING_CARPET_SUPPLY_INSTALL_M2)!) ===
      "Quotr benchmark"
);
const materialsPage = listMaterialsPageCatalogueEntries();
check(
  "F56. No duplicate Materials rows",
  SIX.every((key) => !materialsPage.some((row) => row.item_key === key))
);

console.log("\n=== G. Safety ===\n");

const customPhysical = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_type: "other",
    other_description: "Cork-look vinyl",
    underlay_required: null,
  }),
});
check(
  "G57. Custom does not resolve ordinary package",
  customPhysical.requirements.length > 0 &&
    customPhysical.requirements.every(
      (row) =>
        !isFlooringSubcontractRateKey(row.componentKey) &&
        row.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT
    ) &&
    resolveFlooringSubcontractRate({ itemKey: FLOORING_CUSTOM_FINISH_COMPONENT })
      .costRate == null
);

const specialistPhysical = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: {
    ...createEmptyFlooringPortion({
      id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
      label: "Entry",
    }),
    finish_type: "other",
    specialist_kind: "laminate",
    other_description: "Laminate flooring",
    area_input_method: "direct_m2",
    area_m2: 10,
  },
});
check(
  "G58. Specialist does not resolve ordinary package",
  specialistPhysical.requirements.every(
    (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
  ) &&
    !specialistPhysical.requirements.some((row) =>
      isFlooringSubcontractRateKey(row.componentKey)
    )
);
check(
  "G59. No generic fallback",
  resolveFlooringSubcontractRate({ itemKey: "flooring.material.m2" }).costRate ==
    null &&
    resolveFlooringSubcontractRate({ itemKey: "scope.flooring.m2" }).costRate ==
      null &&
    getCatalogueEntry(FLOORING_CUSTOM_FINISH_COMPONENT) == null
);
check(
  "G60. Unresolved money is null, not $0",
  resolveFlooringSubcontractRate({
    itemKey: FLOORING_CUSTOM_FINISH_COMPONENT,
  }).costRate == null &&
    resolveFlooringSubcontractRate({
      itemKey: FLOORING_CARPET_SUPPLY_INSTALL_M2,
      organisationSettings: { allow_benchmark_rates: false } as never,
    }).costRate == null
);
check(
  "G61. Nested calculator still emits no line items",
  nestedCalc.lineItems.length === 0
);

const legacy = calculateFlooring(
  ctx([{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }]),
  WA
);
check(
  "G62. Flat legacy calculator unchanged",
  legacy.lineItems.length > 0 &&
    legacy.lineItems.some(
      (row) =>
        row.recommendedCost === 20 * FITOUT_BENCHMARKS.flooringPerM2.cost ||
        row.costRate === FITOUT_BENCHMARKS.flooringPerM2.cost
    )
);

const bathroomWa = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;
const bathroom = calculateBathroom(
  {
    ...ctx([{ key: "bathroom.area_m2", work_area_id: "b1", value: 6 }]),
    confirmedWorkAreas: [bathroomWa],
  } as EstimateContext,
  bathroomWa
);
check(
  "G63. Bathroom authority unchanged",
  liveQuotrMaterialCost("bathroom.tile.install.m2") === 95 &&
    liveQuotrMaterialCost("bathroom.floor_finish.vinyl_plank.install.m2") === 50 &&
    bathroom.lineItems.length > 0
);

const kitchenWa = {
  id: "k1",
  type: "kitchen",
  name: "Kitchen",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;
const kitchen = calculateKitchen(
  {
    ...ctx([
      { key: "kitchen.area_m2", work_area_id: "k1", value: 12 },
      { key: "kitchen.flooring_included", work_area_id: "k1", value: true },
    ]),
    confirmedWorkAreas: [kitchenWa],
  } as EstimateContext,
  kitchenWa
);
check(
  "G64. Kitchen authority unchanged",
  KITCHEN_BENCHMARKS.flooring.cost === 180 && kitchen.lineItems.length > 0
);

const doorsWa = {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
} as EstimateWorkArea;
const doorsLegacy = calculateDoors(
  {
    ...ctx([{ key: "doors.count", work_area_id: "d1", value: 1 }]),
    confirmedWorkAreas: [doorsWa],
  } as EstimateContext,
  doorsWa
);
check(
  "G65. Doors frozen authority unchanged",
  liveQuotrMaterialCost(DOORS_LEAF_HOLLOW_CORE_KEY) ===
    DOORS_LEAF_HOLLOW_CORE_COST_EX_GST && doorsLegacy.lineItems.length > 0
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("flooring");
check(
  "coverage. Six packages resolve with Quotr; Flooring cannot close at L5",
  coverage.ok &&
    coverage.resolves.filter((row) =>
      SIX.includes(row.materialIdentity as (typeof SIX)[number])
    ).length === 6 &&
    coverage.needsOwnerApproval.length > 0 &&
    workAreaMayCloseAtL5(coverage) === false &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Hosted commercial line items" &&
        row.outcome === "INTENTIONAL_PRICING_REQUIRED"
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
