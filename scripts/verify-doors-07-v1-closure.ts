/**
 * DOORS-07 — ordinary nested Doors V1 closure and regression freeze.
 *
 * Run: npx --yes tsx scripts/verify-doors-07-v1-closure.ts
 *
 * Golden fixtures, ownership, nested persistence, Rates, Review, Pricing,
 * Quote, legacy isolation, and human-QA freeze. No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import {
  extractDoorPortionsFromBrief,
  mergeDoorPortionsPreferringDeterministic,
} from "../lib/estimate/doors-brief";
import {
  doorPortionIsInformationComplete,
  listDoorsClarifyCandidates,
  summariseDoorPortion,
} from "../lib/estimate/doors-clarify";
import { calculateDoorsPhysical } from "../lib/estimate/doors-physical";
import {
  DOORS_ADD_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  DOORS_HEIGHT_MM_VALUES,
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTIONS_FACT_KEY,
  DOORS_WIDTH_MM_VALUES,
  applyDoorsFactWrite,
  createEmptyDoorPortion,
  mergePersistedDoorsPortionsOnReanalyse,
  parseDoorsPortions,
  storedDoorsPortions,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { DOORS_INFORMATION_CONTRACT } from "../lib/estimate/doors-information-contract";
import {
  doorsIncludedQuoteScopeCount,
  DOORS_QUOTE_SHARED_EXCLUSIONS,
} from "../lib/estimate/doors-quote";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_HARDWARE_STANDARD_COST_EX_GST,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_LEAF_HOLLOW_CORE_COST_EX_GST,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_COST_EX_GST,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_ORDINARY_MATERIAL_KEYS,
  DOORS_ORDINARY_PRODUCTIVITY_KEYS,
  DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_PREHUNG_SOLID_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_SPECIALIST_COMPONENT,
  DOORS_V1_COVERAGE_QUOTE_NOTES,
  DOORS_V1_HUMAN_QA_FROZEN,
  DOORS_V1_SUPPORT_NOTES,
} from "../lib/estimate/doors-identities";
import { applyTargetMarginToLineItems } from "../lib/estimate/margin-override";
import { round2 } from "../lib/estimate/facts";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
} from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateRequirement } from "../lib/estimate/requirements";
import {
  DOORS_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import {
  buildMaterialRegistry,
  filterMaterialCategories,
} from "../lib/rates/material-registry";
import {
  buildProductivityRegistry,
  filterProductivityGroups,
} from "../lib/rates/productivity-registry";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { briefHasIndependentBathroom } from "../lib/work-areas/ownership";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";

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

const QA_BRIEF =
  "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware. Also replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.";

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

function ctx(
  facts: EstimateFact[],
  extra: { workAreas?: EstimateWorkArea[]; rates?: OrganisationRate[] } = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: extra.workAreas ?? [WA],
    facts,
    constraints: [],
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

function categoryCost(
  items: readonly EstimateLineItemInput[],
  category: string
): number {
  return includedCost(items.filter((row) => row.category === category));
}

function labourHours(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((row) => row.category === "labour")
      .reduce((sum, row) => sum + (row.labourHours ?? 0), 0)
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

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: getAnalysisCapableWorkAreaTypes(),
  }).extraction;
}

function persistExtracted(extraction: AIExtractionOutput): EstimateFact[] {
  const fact = extraction.facts.find((row) => row.key === DOORS_PORTIONS_FACT_KEY);
  return applyDoorsFactWrite({
    facts: [],
    workAreaId: WA.id,
    key: DOORS_PORTIONS_FACT_KEY,
    value: parseDoorsPortions(fact?.value),
    factSource: "ai_extracted",
  });
}

console.log("=== DOORS-07 V1 closure ===\n");

const GOLDEN = [
  {
    id: "A",
    portions: [ordinary({ id: "fixture-a", quantity: 1, hardware_included: true })],
    materials: 295,
    labour: 150,
    hours: 2.5,
    total: 445,
    rate: 60,
  },
  {
    id: "B",
    portions: [
      ordinary({
        id: "fixture-b",
        leaf_construction: "solid_core" as const,
        hardware_included: true,
      }),
    ],
    materials: 435,
    labour: 150,
    hours: 2.5,
    total: 585,
    rate: 60,
  },
  {
    id: "C",
    portions: [
      replacement({
        id: "fixture-c",
        leaf_construction: "hollow_core" as const,
        hardware_included: false,
      }),
    ],
    materials: 80,
    labour: 90,
    hours: 1.5,
    total: 170,
    rate: 60,
  },
  {
    id: "D",
    portions: [
      replacement({
        id: "fixture-d",
        leaf_construction: "solid_core" as const,
        hardware_included: false,
      }),
    ],
    materials: 220,
    labour: 90,
    hours: 1.5,
    total: 310,
    rate: 60,
  },
  {
    id: "E",
    portions: [
      replacement({
        id: "fixture-e",
        leaf_construction: "hollow_core" as const,
        hardware_included: true,
      }),
    ],
    materials: 135,
    labour: 120,
    hours: 2,
    total: 255,
    rate: 60,
  },
  {
    id: "F",
    portions: [ordinary({ id: "fixture-f", quantity: 2, hardware_included: true })],
    materials: 590,
    labour: 300,
    hours: 5,
    total: 890,
    rate: 60,
  },
] as const;

for (const row of GOLDEN) {
  const estimate = hosted(row.portions);
  check(
    `golden ${row.id} direct COST $${row.total}`,
    includedCost(estimate.lineItems) === row.total &&
      categoryCost(estimate.lineItems, "materials") === row.materials &&
      categoryCost(estimate.lineItems, "labour") === row.labour &&
      labourHours(estimate.lineItems) === row.hours,
    `total=${includedCost(estimate.lineItems)} mat=${categoryCost(estimate.lineItems, "materials")} lab=${categoryCost(estimate.lineItems, "labour")} h=${labourHours(estimate.lineItems)}`
  );
}

const qaExtraction = extract(QA_BRIEF);
const qaFacts = persistExtracted(qaExtraction);
const qaPortions = storedDoorsPortions(qaFacts, WA.id);
const qaEstimate = calculateEstimate(
  ctx(qaFacts, { rates: [companyLabour(65)] })
);
const bedroom = qaPortions.find(
  (row) =>
    /bedroom/i.test(row.label ?? "") &&
    row.installation_type === "prehung_internal" &&
    row.leaf_construction === "hollow_core" &&
    row.height_mm === 1980 &&
    row.width_mm === 810 &&
    row.quantity === 2 &&
    row.hardware_included === true
);
const ensuite = qaPortions.find(
  (row) =>
    /ensuite/i.test(row.label ?? "") &&
    row.installation_type === "replacement_leaf" &&
    row.leaf_construction === "solid_core" &&
    row.height_mm === 2200 &&
    row.width_mm === 910 &&
    row.quantity === 1 &&
    row.hardware_included === false
);
check(
  "G hosted two-set identities remain separate",
  qaPortions.length === 2 && Boolean(bedroom) && Boolean(ensuite)
);
check(
  "G combined $1,232.50 at company $65",
  includedCost(qaEstimate.lineItems) === 1232.5 &&
    categoryCost(qaEstimate.lineItems, "materials") === 810 &&
    categoryCost(qaEstimate.lineItems, "labour") === 422.5,
  `total=${includedCost(qaEstimate.lineItems)}`
);
check(
  "G is Doors only",
  qaExtraction.workAreas.length === 1 && qaExtraction.workAreas[0]?.type === "doors"
);

const bedroomLines = qaEstimate.lineItems.filter(
  (row) => row.nestedItemId === bedroom?.id
);
const ensuiteLines = qaEstimate.lineItems.filter(
  (row) => row.nestedItemId === ensuite?.id
);
check(
  "G Bedroom $915 / Ensuite $317.50",
  includedCost(bedroomLines) === 915 && includedCost(ensuiteLines) === 317.5,
  `bed=${includedCost(bedroomLines)} ens=${includedCost(ensuiteLines)}`
);

console.log("\n=== Ownership / routing ===\n");

const opening = extract("Construct an internal wall with one 810 × 1980 opening. Opening only.");
check(
  "opening-only is Internal Walls, not Doors",
  opening.workAreas.some((row) => row.type === "internal_walls") &&
    !opening.workAreas.some((row) => row.type === "doors")
);
const supply = extract("Supply and install one 1980 × 810 mm hollow-core prehung internal door.");
check(
  "explicit door supply creates Doors",
  supply.workAreas.some((row) => row.type === "doors")
);
const combined = extract(
  "Construct an internal wall with one 810 × 1980 opening and supply and install a matching hollow-core prehung internal door."
);
check(
  "combined opening + door supply creates both",
  combined.workAreas.some((row) => row.type === "internal_walls") &&
    combined.workAreas.some((row) => row.type === "doors")
);
check(
  "ensuite as door location does not create Bathroom",
  !extract("Replace one internal door leaf to the ensuite.").workAreas.some(
    (row) => row.type === "bathroom"
  ) && !briefHasIndependentBathroom("Replace one internal door leaf to the ensuite.")
);
check(
  "kitchen door does not create Kitchen",
  !extract("Supply and install a kitchen door.").workAreas.some((row) => row.type === "kitchen")
);
check(
  "genuine ensuite renovation still creates Bathroom",
  extract("Renovate the ensuite.").workAreas.some((row) => row.type === "bathroom")
);
check(
  "by-others suppresses Doors",
  !extract("Form an 810 opening. Door by others.").workAreas.some((row) => row.type === "doors")
);

const iwFacts = applyInternalWallsFactWrite({
  facts: [
    {
      key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
      work_area_id: IW.id,
      value: "new_walls",
      source: "user",
    },
    {
      key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
      work_area_id: IW.id,
      value: true,
      source: "user",
    },
  ],
  workAreaId: IW.id,
  key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  value: true,
  factSource: "user",
});
const doorsBesideIw = calculateEstimate(
  ctx([...iwFacts, ...persist([ordinary()])], { workAreas: [IW, WA] })
);
check(
  "Doors facts do not mutate Internal Walls money identities",
  !doorsBesideIw.lineItems.some((row) => looksLikeDoorProductMoney(row.itemKey ?? "")) ||
    doorsBesideIw.lineItems.some((row) => row.workAreaName === "Doors")
);
check(
  "IW opening still does not emit door product keys",
  !calculateEstimate(ctx(iwFacts, { workAreas: [IW] })).lineItems.some((row) =>
    looksLikeDoorProductMoney(row.itemKey ?? "")
  )
);

console.log("\n=== Nested persistence / Details ===\n");

check(
  "supported sizes are frozen metadata",
  DOORS_HEIGHT_MM_VALUES.join(",") === "1980,2200,2400" &&
    DOORS_WIDTH_MM_VALUES.join(",") === "410,610,760,810,860,910"
);

const hybridAi: DoorPortion[] = [
  ordinary({
    id: "hybrid",
    label: "Bedrooms / Ensuite",
    quantity: 3,
    leaf_construction: "solid_core",
  }),
];
const merged = mergeDoorPortionsPreferringDeterministic(
  hybridAi,
  extractDoorPortionsFromBrief(QA_BRIEF)
);
check(
  "hybrid AI row cannot collapse two deterministic Door Sets",
  merged.length === 2 &&
    merged.some((row) => row.quantity === 2 && row.leaf_construction === "hollow_core") &&
    merged.some((row) => row.quantity === 1 && row.leaf_construction === "solid_core")
);

const userOwned = qaPortions.map((row, index) =>
  index === 0
    ? { ...row, width_mm: 860 as const, width_authority: "user" as const }
    : row
);
const reanalysed = mergePersistedDoorsPortionsOnReanalyse({
  extracted: extractDoorPortionsFromBrief(QA_BRIEF),
  persisted: userOwned,
});
check(
  "user-owned width survives re-analysis",
  reanalysed.length === 2 &&
    reanalysed.some((row) => row.width_mm === 860 && row.width_authority === "user")
);

const afterDelete = mergePersistedDoorsPortionsOnReanalyse({
  extracted: extractDoorPortionsFromBrief(QA_BRIEF),
  persisted: [userOwned[0]!],
});
check(
  "intentional user deletion is not recreated",
  afterDelete.length === 1 && afterDelete[0]?.id === userOwned[0]?.id
);

const healed = mergePersistedDoorsPortionsOnReanalyse({
  extracted: extractDoorPortionsFromBrief(QA_BRIEF),
  persisted: [
    ordinary({
      id: "stale-hybrid",
      label: "Bedrooms / Ensuite",
      quantity: 3,
      leaf_construction: "solid_core",
    }),
  ],
});
check(
  "machine-owned stale hybrid may heal to two Door Sets",
  healed.length === 2 && healed[0]?.id === "stale-hybrid"
);

let nestedFacts = persist([ordinary({ id: "keep-me" })]);
nestedFacts = applyDoorsFactWrite({
  facts: nestedFacts,
  workAreaId: WA.id,
  key: DOORS_ADD_PORTION_KEY,
  value: true,
  factSource: "user",
});
const afterAdd = storedDoorsPortions(nestedFacts, WA.id);
nestedFacts = applyDoorsFactWrite({
  facts: nestedFacts,
  workAreaId: WA.id,
  key: DOORS_DUPLICATE_PORTION_KEY,
  value: afterAdd[0]!.id,
  factSource: "user",
});
const afterDup = storedDoorsPortions(nestedFacts, WA.id);
nestedFacts = applyDoorsFactWrite({
  facts: nestedFacts,
  workAreaId: WA.id,
  key: DOORS_DELETE_PORTION_KEY,
  value: afterDup[1]!.id,
  factSource: "user",
});
const afterNestedDelete = storedDoorsPortions(nestedFacts, WA.id);
check(
  "Add, Duplicate and Delete preserve unique nested IDs",
  new Set(afterDup.map((row) => row.id)).size === 3 &&
    afterNestedDelete.some((row) => row.id === "keep-me") &&
    !afterNestedDelete.some((row) => row.id === afterDup[1]!.id)
);

const contractKeys = DOORS_INFORMATION_CONTRACT.map((row) => row.factKey);
check(
  "ordinary required questions remain in accepted order",
  contractKeys.slice(0, 8).join(",") ===
    [
      "doors.portion.installation_type",
      "doors.portion.leaf_construction",
      "doors.portion.other_description",
      "doors.portion.height_mm",
      "doors.portion.width_mm",
      "doors.portion.quantity",
      "doors.portion.hardware_included",
      "doors.portion.label",
    ].join(",")
);

const incomplete = ordinary({
  id: "incomplete",
  width_mm: null,
  quantity: null,
  hardware_included: null,
  height_mm: DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  height_authority: "assumed_disclosed",
});
check(
  "1980 height is disclosed; width/quantity/hardware are never invented",
  incomplete.height_mm === 1980 &&
    incomplete.width_mm == null &&
    incomplete.quantity == null &&
    incomplete.hardware_included == null &&
    doorPortionIsInformationComplete(incomplete) === false
);
check(
  "location remains optional",
  DOORS_INFORMATION_CONTRACT.find((row) => row.factKey === "doors.portion.label")
    ?.askClass === "ASSUME_IF_SKIPPED"
);

const mixedComplete = hosted([
  ordinary({ id: "complete-sibling" }),
  ordinary({ id: "incomplete-sibling", width_mm: null, quantity: null }),
]);
check(
  "incomplete sibling does not block complete sibling pricing",
  mixedComplete.lineItems.some(
    (row) => row.nestedItemId === "complete-sibling" && (row.recommendedCost ?? 0) > 0
  ) &&
    !mixedComplete.lineItems.some(
      (row) =>
        row.nestedItemId === "incomplete-sibling" &&
        row.includedInTotal !== false &&
        (row.recommendedCost ?? 0) > 0
    )
);

const plan = composeJobPlan({
  workAreas: [WA],
  facts: qaFacts,
  qualityLevel: "standard",
  briefText: QA_BRIEF,
});
check(
  "Work card uses nested Door Set summaries, not KNOWN · 1",
  Boolean(plan.cards[0]?.summary?.toLowerCase().includes("2 door sets")) &&
    !/KNOWN · 1/.test(plan.cards[0]?.summary ?? "") &&
    !summariseDoorPortion(bedroom!, 0).summary.includes("KNOWN · 1")
);

const clarify = composeClarifyView({
  stage: "quality",
  briefText: QA_BRIEF,
  qualityLevel: "standard",
  workAreas: [WA],
  facts: qaFacts,
  constraints: [],
  jobPlan: plan,
});
const ready = composeEstimateReadiness({
  clarify,
  jobPlan: plan,
  qualityLevel: "standard",
  constraints: [],
});
check(
  "QA brief Details/Ready complete without Bathroom questions",
  ready.enoughToEstimate === true &&
    !listDoorsClarifyCandidates({
      facts: qaFacts,
      workAreaId: WA.id,
      workAreaName: WA.name,
    }).some((row) => /demolition|waterproof/i.test(row.label)) &&
    !clarify.candidates.some((row) => /demolition|waterproof/i.test(row.label))
);

console.log("\n=== Physical / Rates / commercial ===\n");

const physicalF = calculateDoorsPhysical({
  workArea: WA,
  facts: persist(GOLDEN[5].portions),
});
check(
  "quantity drives materials and operations once; hardware only when included",
  physicalF.requirements.some(
    (row) =>
      row.kind === "material" &&
      row.materialKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY &&
      row.baseQuantity === 2
  ) &&
    physicalF.requirements.some(
      (row) =>
        row.kind === "material" &&
        row.materialKey === DOORS_HARDWARE_STANDARD_KEY &&
        row.baseQuantity === 2
    ) &&
    !calculateDoorsPhysical({
      workArea: WA,
      facts: persist(GOLDEN[2].portions),
    }).requirements.some((row) => row.materialKey === DOORS_HARDWARE_STANDARD_KEY)
);
check(
  "replacement does not emit a frame/jamb identity",
  !calculateDoorsPhysical({
    workArea: WA,
    facts: persist(GOLDEN[3].portions),
  }).requirements.some((row) => /jamb|frame|prehung/i.test(row.materialKey ?? row.componentKey ?? ""))
);

const sizeShift = hosted([
  ordinary({ id: "size-a", height_mm: 1980, width_mm: 810 }),
  ordinary({ id: "size-b", height_mm: 2400, width_mm: 910 }),
]);
check(
  "supported dimensions do not alter rates or hours",
  includedCost(sizeShift.lineItems.filter((row) => row.nestedItemId === "size-a")) ===
    includedCost(sizeShift.lineItems.filter((row) => row.nestedItemId === "size-b")) &&
    labourHours(sizeShift.lineItems.filter((row) => row.nestedItemId === "size-a")) ===
      labourHours(sizeShift.lineItems.filter((row) => row.nestedItemId === "size-b"))
);

const identical = hosted([
  ordinary({ id: "twin-a" }),
  ordinary({ id: "twin-b" }),
]);
check(
  "identical Door Sets do not deduplicate",
  includedCost(identical.lineItems) === 890 &&
    identical.lineItems.filter((row) => row.nestedItemId === "twin-a").length > 0 &&
    identical.lineItems.filter((row) => row.nestedItemId === "twin-b").length > 0
);

const specialist = hosted([
    {
      ...createEmptyDoorPortion({ id: "specialist-1" }),
    installation_type: "other_unsupported",
    specialist_kind: "fire_rated",
    quantity: 1,
    other_description: "fire-rated acoustic door",
  },
]);
check(
  "unsupported specialist systems receive no ordinary money",
  !specialist.lineItems.some(
    (row) =>
      row.includedInTotal !== false &&
      (row.recommendedCost ?? 0) > 0 &&
      DOORS_ORDINARY_MATERIAL_KEYS.includes(
        (row.itemKey ?? "") as (typeof DOORS_ORDINARY_MATERIAL_KEYS)[number]
      )
  ) &&
    specialist.requirements?.some((row) => row.componentKey === DOORS_SPECIALIST_COMPONENT)
);

check(
  "five ordinary material identities resolve at frozen COST",
  liveQuotrMaterialCost(DOORS_LEAF_HOLLOW_CORE_KEY) === DOORS_LEAF_HOLLOW_CORE_COST_EX_GST &&
    liveQuotrMaterialCost(DOORS_LEAF_SOLID_CORE_KEY) === DOORS_LEAF_SOLID_CORE_COST_EX_GST &&
    liveQuotrMaterialCost(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY) ===
      DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST &&
    liveQuotrMaterialCost(DOORS_PREHUNG_SOLID_CORE_SET_KEY) ===
      DOORS_PREHUNG_SOLID_CORE_SET_COST_EX_GST &&
    liveQuotrMaterialCost(DOORS_HARDWARE_STANDARD_KEY) === DOORS_HARDWARE_STANDARD_COST_EX_GST
);
check(
  "three productivity identities resolve at frozen hours",
  liveQuotrProductivity(DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY) ===
    DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR &&
    liveQuotrProductivity(DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY) ===
      DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR &&
    liveQuotrProductivity(DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY) ===
      DOORS_HARDWARE_INSTALL_HOURS_PER_SET
);

const materialRegistry = buildMaterialRegistry({ rates: [], editable: true });
const doorsMaterials = filterMaterialCategories({
  categories: materialRegistry.categories,
  query: "",
  status: "all",
  categoryId: "all",
  workArea: "doors",
}).flatMap((category) =>
  category.families.flatMap((family) => family.ordinaryItems.map((item) => item.canonicalKey))
);
check(
  "Rates Materials shows all five ordinary Door identities",
  DOORS_ORDINARY_MATERIAL_KEYS.every((key) => doorsMaterials.includes(key)) &&
    materialRegistry.categories.some((row) => row.categoryId === "doors")
);

const productivityRegistry = buildProductivityRegistry({ rates: [], editable: true });
const doorsProductivity = filterProductivityGroups({
  groups: productivityRegistry.groups,
  query: "doors",
  status: "all",
}).flatMap((group) =>
  group.workAreaType === "doors"
    ? group.ordinaryItems.map((item) => item.productivityKey)
    : []
);
check(
  "Rates Productivity shows all three ordinary Door operations",
  DOORS_ORDINARY_PRODUCTIVITY_KEYS.every((key) => doorsProductivity.includes(key))
);

const overrideEstimate = hosted([ordinary()], {
  rates: [
    {
      id: "org-mat",
      rate_type: "material",
      trade: null,
      work_area_type: "doors",
      item_key: DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
      label: "override",
      unit: getCatalogueEntry(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY)?.unit ?? "each",
      cost_rate: 275,
      sell_rate: null,
      markup_percent: null,
      active: true,
      source: "explicit_company",
    } as OrganisationRate,
    {
      id: "org-prod",
      rate_type: "productivity",
      trade: null,
      work_area_type: "doors",
      item_key: DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
      label: "override",
      unit: "door",
      cost_rate: 2.5,
      sell_rate: null,
      markup_percent: null,
      active: true,
      source: "explicit_company",
    } as OrganisationRate,
    companyLabour(70),
  ],
});
const restored = hosted([ordinary()]);
check(
  "company overrides are independent and restoring Quotr returns $445",
  categoryCost(overrideEstimate.lineItems, "materials") === 275 + 55 &&
    labourHours(overrideEstimate.lineItems) === 3 &&
    categoryCost(overrideEstimate.lineItems, "labour") === 210 &&
    includedCost(restored.lineItems) === 445
);

const customReq = calculateDoorsPhysical({
  workArea: WA,
  facts: persist([
    ordinary({
      id: "custom-leaf",
      installation_type: "replacement_leaf",
      leaf_construction: "other",
      other_description: "custom veneer leaf",
      hardware_included: false,
    }),
  ]),
}).requirements as EstimateRequirement[];
check(
  "custom/specialist missing authority stays null, never legitimate $0",
  customReq.some(
    (row) =>
      row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT &&
      (row.priced !== true || row.totalCost == null)
  ) && !customReq.some((row) => row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT && row.totalCost === 0)
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: qaEstimate.recommendedCost,
    recommendedSell: qaEstimate.recommendedSell,
    marginPercent: qaEstimate.marginPercent,
    confidence: qaEstimate.confidence,
    assumptions: qaEstimate.assumptions,
    missingInfo: qaEstimate.missingInfo,
    lineItems: mapReviewLines(qaEstimate.lineItems),
  },
  workAreas: [{ id: WA.id, name: WA.name, type: WA.type, status: "confirmed" }],
  requirements: qaEstimate.requirements,
  facts: qaFacts,
});
check(
  "Builder Review keeps two Door Set groups and no Bathroom",
  (review.workAreas[0]?.portionGroups ?? []).length === 2 &&
    !review.workAreas.some((row) => /bathroom/i.test(row.workAreaName)) &&
    categoryCost(qaEstimate.lineItems, "materials") > 0 &&
    categoryCost(qaEstimate.lineItems, "labour") > 0
);
check(
  "no legacy Doors lump in nested commercial path",
  !qaEstimate.lineItems.some(
    (row) =>
      row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost ||
      /supply\/install allowance/i.test(row.label)
  )
);

console.log("\n=== Pricing / Quote / legacy / freeze ===\n");

const priced = applyTargetMarginToLineItems(
  qaEstimate.lineItems.map((row) => ({
    recommendedCost: row.recommendedCost ?? 0,
    recommendedSell: row.recommendedSell,
    quantity: row.quantity,
  })),
  30,
  { default_margin_percent: 30 } as never
);
check(
  "margin changes sell only, not direct COST or quantities",
  priced.every(
    (row, index) =>
      row.recommendedCost === (qaEstimate.lineItems[index]?.recommendedCost ?? 0) &&
      row.quantity === qaEstimate.lineItems[index]?.quantity
  ) &&
    priced.some(
      (row, index) =>
        (row.recommendedSell ?? 0) !== (qaEstimate.lineItems[index]?.recommendedSell ?? 0)
    )
);

const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "doors",
  name: "Doors",
  facts: [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify(qaPortions),
    },
  ],
});
check(
  "Quote has two labelled Door Set entries with correct wording",
  /Bedrooms:/.test(quote) &&
    /Ensuite:/.test(quote) &&
    /prehung internal door sets/.test(quote) &&
    /existing retained frame\/jamb/.test(quote) &&
    /Existing door hardware will be reused/.test(quote) &&
    quote.includes(DOORS_QUOTE_SHARED_EXCLUSIONS) &&
    doorsIncludedQuoteScopeCount([
      {
        key: DOORS_PORTIONS_FACT_KEY,
        label: "Door sets",
        value: JSON.stringify(qaPortions),
      },
    ]) === 2
);
check(
  "labelled locations are not repeated awkwardly",
  !/to the ensuite to the existing/i.test(quote) &&
    (quote.match(/Ensuite/g) ?? []).length === 1
);
check(
  "Quote does not leak COST, hours, productivity, benchmarks, margins or PR",
  !/\$\d/.test(quote) &&
    !/\bCOST\b/.test(quote) &&
    !/person-hours?|\$\/hour|benchmark|margin|Pricing Required|doors\./i.test(quote)
);

const customQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "doors",
  name: "Doors",
  facts: [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify([
        ordinary({
          id: "custom-q",
          installation_type: "replacement_leaf",
          leaf_construction: "other",
          other_description: "custom veneer leaf",
          hardware_included: false,
        }),
      ]),
    },
  ],
});
check(
  "unresolved custom supply is not falsely claimed as included",
  /excluded pending/i.test(customQuote) && !/Supply and fit 1 × custom veneer leaf replacement internal door leaf to the existing retained frame\/jamb\. Includes/i.test(customQuote)
);

const specialistQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "doors",
  name: "Doors",
  facts: [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify([
        {
          ...createEmptyDoorPortion({ id: "specialist-q" }),
          installation_type: "other_unsupported",
          specialist_kind: "cavity_slider",
          quantity: 1,
          other_description: "cavity slider",
        },
      ]),
    },
  ],
});
check(
  "specialist/incomplete work is safely excluded pending confirmation",
  /excluded pending/i.test(specialistQuote)
);

const legacy = calculateDoors(
  ctx([{ key: "doors.count", work_area_id: WA.id, value: 2, source: "user" }]),
  WA
);
const nestedNoFallback = calculateDoors(ctx(persist([ordinary({ quantity: 1 })])), WA);
check(
  "flat doors.count retains legacy behaviour",
  legacy.lineItems.some((row) => row.recommendedCost === 2 * FITOUT_BENCHMARKS.doorsEach.cost) &&
    !legacy.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);
check(
  "nested Door Sets never fall through to FITOUT_BENCHMARKS.doorsEach",
  !nestedNoFallback.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
  ) &&
    nestedNoFallback.lineItems.some((row) => (row.recommendedCost ?? 0) > 0) &&
    !nestedNoFallback.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE)
);
check(
  "legacy and nested money do not coexist for the same scope",
  !nestedNoFallback.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
  ) &&
    !legacy.lineItems.some(
      (row) => row.itemKey === DOORS_PREHUNG_HOLLOW_CORE_SET_KEY
    )
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("doors");
const support = getWorkAreaSupportEntry("doors");
check(
  "ordinary nested V1 may close at L5 and is human-QA frozen",
  DOORS_V1_HUMAN_QA_FROZEN === true &&
    workAreaMayCloseAtL5(coverage) &&
    coverage.intentionalPr.length >= 2 &&
    support?.band === "component" &&
    support.notes === DOORS_V1_SUPPORT_NOTES &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        /pricing and quote/i.test(row.component) &&
        row.notes === DOORS_V1_COVERAGE_QUOTE_NOTES
    )
);
check(
  "freeze does not claim unsupported door systems",
  !/exterior|aluminium|fire-rated|cavity slider|automatic|access-control|bifold|barn|architrave/i.test(
    support?.notes ?? ""
  ) &&
    /custom\/specialist stay pricing required/i.test(support?.notes ?? "") &&
    read("lib/estimate/doors-identities.ts").includes("DOORS_V1_HUMAN_QA_FROZEN")
);
check(
  "no hardcoded Doors hourly COST and no Production bypass",
  !read("lib/estimate/doors-commercial.ts").includes("process.env") &&
    !read("lib/estimate/doors-commercial.ts").includes("60") &&
    !read("lib/work-areas/support-contract.ts").includes("process.env")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
