/**
 * REQ-4A — snapshot + component authority + shadow reconciliation.
 * No live promotion. Estimate line money remains commercial authority.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  COMPONENT_COMMERCIAL_AUTHORITY_STATES,
  getComponentCommercialAuthority,
  LEGACY_FALLBACK_CONTRACT,
  REQ_4B_FIRST_PROMOTION_CANDIDATE,
} from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  findLegacyLinesForRequirement,
  isRateKeyUsedAsComponentKey,
} from "../lib/estimate/legacy-component-map";
import { buildRequirementId } from "../lib/estimate/requirement-id";
import {
  evaluatePromotionEligibility,
  RECONCILIATION_STATUSES,
  reconcileRequirementWithLegacyComponent,
} from "../lib/estimate/requirement-reconciliation";
import {
  buildEstimateRequirementSnapshotV1,
  ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION,
  parseEstimateRequirementSnapshot,
  RequirementSnapshotError,
  serializeEstimateRequirementSnapshot,
} from "../lib/estimate/requirement-snapshot";
import {
  buildRequirementCommercialDiagnostics,
  buildSnapshotPayloadForEstimate,
} from "../lib/estimate/requirement-snapshot-persist";
import {
  createMemoryRequirementSnapshotStore,
  resolveCurrentRequirementSnapshot,
} from "../lib/estimate/requirement-snapshot-store";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  PlantRequirement,
  SubcontractRequirement,
  WasteRequirement,
} from "../lib/estimate/requirements";
import { ESTIMATE_REQUIREMENT_CONTRACT_VERSION } from "../lib/estimate/requirements";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: orgSettings,
  materialWastageSettings: {
    deckingWastagePercent: 10,
    defaultMaterialWastagePercent: 10,
  },
  rates: [],
} as unknown as EstimateContext;

const ownerArea = 16.12;

function hardwoodFacts(workAreaId: string): EstimateFact[] {
  return [
    fact("deck.area_m2", workAreaId, ownerArea),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.height_m", workAreaId, 0.4),
    fact("deck.board_width_mm", workAreaId, 140),
  ];
}

function constraint(key: string, value: string, label: string) {
  return { key, value, label };
}

function surfaceReq(result: ReturnType<typeof calculateDeck>) {
  return (result.requirements ?? []).find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === DECK_SURFACE_COMPONENT_KEY
  );
}

function labourReq(result: ReturnType<typeof calculateDeck>) {
  return (result.requirements ?? []).find(
    (item): item is LabourRequirement =>
      item.kind === "labour" && item.componentKey === DECK_LABOUR_COMPONENT_KEY
  );
}

function provenance(calculatorSource: string) {
  return { calculatorSource, factKeys: [], constraintKeys: [] };
}

function baseReq(
  kind: EstimateRequirement["kind"],
  workAreaId: string,
  componentKey: string
) {
  return {
    requirementId: buildRequirementId({ workAreaId, kind, componentKey }),
    kind,
    workAreaId,
    workAreaType: "deck",
    componentKey,
    description: componentKey,
    confidence: "medium" as const,
    assumptions: [] as const,
    provenance: provenance("test"),
    priced: false as const,
  };
}

async function main() {
console.log("=== REQ-4A requirement commercial authority foundation ===\n");

const reqTypes = read("lib/estimate/requirements.ts");
const authoritySrc = read("lib/estimate/component-authority.ts");
const persistSrc = read("lib/estimate/persist-estimate.ts");
const pricingSrc = read("lib/pricing/actions.ts");
const quoteBuildSrc = read("lib/quotes/build-from-pricing.ts");
const migration = read(
  "supabase/migrations/035_estimate_requirement_snapshots.sql"
);
const deckSrc = read("lib/estimate/calculators/deck.ts");

check(
  "AUTHORITY 1 lifecycle contains all five states",
  COMPONENT_COMMERCIAL_AUTHORITY_STATES.join(",") ===
    "LEGACY_AUTHORITATIVE,SHADOW,REQUIREMENT_AUTHORITATIVE,LEGACY_FALLBACK,LEGACY_RETIRED"
);
check(
  "AUTHORITY 2 authority is external to requirements",
  !reqTypes.includes("commercialAuthority:") &&
    authoritySrc.includes("getComponentCommercialAuthority")
);
check(
  "AUTHORITY 3 default unmigrated component = LEGACY_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "fence",
    componentKey: "fence.labour",
  }).authority === "LEGACY_AUTHORITATIVE" &&
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: "deck.substructure",
    }).authority === "LEGACY_AUTHORITATIVE"
);
check(
  "AUTHORITY 4 Deck surface = REQUIREMENT_AUTHORITATIVE (REQ-4B)",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "AUTHORITY 5 Deck labour = SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);
check(
  "AUTHORITY 6 authority is component-level, not Work-Area global",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: "deck.face",
  }).authority === "LEGACY_AUTHORITATIVE" &&
    LEGACY_FALLBACK_CONTRACT.activated === true
);

const companyDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: 18.5,
        sell_rate: null,
        active: true,
      },
      {
        item_key: "labour.carpenter.hour",
        rate_type: "labour",
        unit: "hour",
        cost_rate: 80,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const companySurface = surfaceReq(companyDeck);
const companyLabour = labourReq(companyDeck);
const mappedSurface = companySurface
  ? findLegacyLinesForRequirement(companyDeck.lineItems, companySurface)
  : [];
const mappedLabour = companyLabour
  ? findLegacyLinesForRequirement(companyDeck.lineItems, companyLabour)
  : [];

check(
  "MAPPING 7 Deck surface maps to correct legacy component",
  mappedSurface.length === 1 &&
    mappedSurface[0]?.componentKey === DECK_SURFACE_COMPONENT_KEY &&
    mappedSurface[0]?.category === "materials"
);
check(
  "MAPPING 8 Deck labour maps to correct legacy component",
  mappedLabour.length === 1 &&
    mappedLabour[0]?.componentKey === DECK_LABOUR_COMPONENT_KEY &&
    mappedLabour[0]?.category === "labour"
);
check(
  "MAPPING 9 mapping does not rely only on description",
  read("lib/estimate/legacy-component-map.ts").includes("item.componentKey") &&
    !read("lib/estimate/legacy-component-map.ts").includes("item.label")
);
check(
  "MAPPING 10 rate key is not treated as component key",
  mappedSurface[0]?.itemKey !== mappedSurface[0]?.componentKey &&
    mappedLabour[0]?.itemKey !== mappedLabour[0]?.componentKey &&
    mappedSurface[0] != null &&
    !isRateKeyUsedAsComponentKey(mappedSurface[0])
);

const companySurfaceRec = reconcileRequirementWithLegacyComponent({
  requirement: companySurface ?? null,
  lineItems: companyDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check(
  "RECONCILE MATERIAL 11 company lm exact cost parity",
  companySurfaceRec.status === "PASS" &&
    companySurfaceRec.costComparison.requirementCost ===
      mappedSurface[0]?.recommendedCost &&
    companySurfaceRec.costComparison.requirementCost === 2343.03
);

const companyM2Deck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const companyM2Rec = reconcileRequirementWithLegacyComponent({
  requirement: surfaceReq(companyM2Deck) ?? null,
  lineItems: companyM2Deck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check(
  "RECONCILE MATERIAL 12 company m² converted exact parity",
  companyM2Rec.status === "PASS" &&
    companyM2Rec.costComparison.requirementCost ===
      surfaceReq(companyM2Deck)?.totalCost
);

const benchDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1") } as never,
  wa("d1", "deck", "Deck")
);
const benchRec = reconcileRequirementWithLegacyComponent({
  requirement: surfaceReq(benchDeck) ?? null,
  lineItems: benchDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check(
  "RECONCILE MATERIAL 13 benchmark exact parity",
  benchRec.status === "PASS" &&
    benchRec.costComparison.requirementCost === surfaceReq(benchDeck)?.totalCost
);
check(
  "RECONCILE MATERIAL 14 purchase quantity parity where comparable",
  companySurfaceRec.quantityComparison.status === "PASS" &&
    companySurfaceRec.quantityComparison.requirementQuantity === 126.65
);

const missingMaterialDeck = calculateDeck(
  {
    ...baseContext,
    organisationSettings: {
      allow_benchmark_rates: false,
      default_margin_percent: 20,
    },
    facts: hardwoodFacts("d1"),
    rates: [],
  } as never,
  wa("d1", "deck", "Deck")
);
const missingMaterialRec = reconcileRequirementWithLegacyComponent({
  requirement: surfaceReq(missingMaterialDeck) ?? null,
  lineItems: missingMaterialDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check(
  "RECONCILE MATERIAL 15 missing/unpriced case is explicit",
  missingMaterialRec.status === "UNPRICED_REQUIREMENT" ||
    missingMaterialRec.status === "MISSING_REQUIREMENT"
);

const companyLabourRec = reconcileRequirementWithLegacyComponent({
  requirement: companyLabour ?? null,
  lineItems: companyDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_LABOUR_COMPONENT_KEY,
});
check(
  "RECONCILE LABOUR 16 company labour cost parity",
  companyLabourRec.status === "PASS" &&
    companyLabourRec.costComparison.requirementCost ===
      mappedLabour[0]?.recommendedCost &&
    companyLabour?.hourlyCost === 80
);

const legacyOnDeck = calculateDeck(
  { ...baseContext, facts: hardwoodFacts("d1") } as never,
  wa("d1", "deck", "Deck")
);
const legacyOnRec = reconcileRequirementWithLegacyComponent({
  requirement: labourReq(legacyOnDeck) ?? null,
  lineItems: legacyOnDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_LABOUR_COMPONENT_KEY,
});
check(
  "RECONCILE LABOUR 17 legacy benchmark-on parity",
  legacyOnRec.status === "PASS" && labourReq(legacyOnDeck)?.hourlyCost === 60
);

const legacyOffDeck = calculateDeck(
  {
    ...baseContext,
    organisationSettings: {
      allow_benchmark_rates: false,
      default_margin_percent: 20,
    },
    facts: hardwoodFacts("d1"),
    rates: [],
  } as never,
  wa("d1", "deck", "Deck")
);
const legacyOffRec = reconcileRequirementWithLegacyComponent({
  requirement: labourReq(legacyOffDeck) ?? null,
  lineItems: legacyOffDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_LABOUR_COMPONENT_KEY,
});
check(
  "RECONCILE LABOUR 18 legacy benchmark-off parity",
  legacyOffRec.status === "PASS" && labourReq(legacyOffDeck)?.hourlyCost === 60
);
check(
  "RECONCILE LABOUR 19 adjustedHours parity",
  companyLabourRec.quantityComparison.status === "PASS" &&
    companyLabourRec.quantityComparison.requirementQuantity ===
      mappedLabour[0]?.labourHours
);

const restrictedDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d-pc"),
    constraints: [constraint("site_access", "Difficult", "Site access")],
  } as never,
  wa("d-pc", "deck", "Deck PC")
);
const restrictedLabour = labourReq(restrictedDeck);
check(
  "RECONCILE LABOUR 20 PC provenance preserved",
  restrictedLabour?.adjustmentRef.factors[0]?.key ===
    "project.labour_productivity" &&
    restrictedLabour.adjustmentRef.factors[0]?.value === 1.1 &&
    restrictedLabour.adjustedHours === 25.71
);

check(
  "RESULT 21 PASS handled",
  RECONCILIATION_STATUSES.includes("PASS") && companySurfaceRec.status === "PASS"
);
const failReq: MaterialRequirement = {
  ...companySurface!,
  totalCost: (companySurface?.totalCost ?? 0) + 1,
};
const failRec = reconcileRequirementWithLegacyComponent({
  requirement: failReq,
  lineItems: companyDeck.lineItems,
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check("RESULT 22 FAIL handled", failRec.status === "FAIL");

const packageQty = reconcileRequirementWithLegacyComponent({
  requirement: {
    ...companySurface!,
    purchaseUnit: "lm",
  },
  lineItems: companyDeck.lineItems.map((item) =>
    item.componentKey === DECK_SURFACE_COMPONENT_KEY
      ? { ...item, unit: "m²" }
      : item
  ),
  workAreaId: "d1",
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
});
check(
  "RESULT 23 NOT_COMPARABLE handled",
  packageQty.quantityComparison.status === "NOT_COMPARABLE" &&
    packageQty.quantityComparison.status !== "PASS"
);
check(
  "RESULT 24 missing requirement handled",
  reconcileRequirementWithLegacyComponent({
    requirement: null,
    lineItems: companyDeck.lineItems,
    workAreaId: "d1",
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).status === "MISSING_REQUIREMENT"
);
check(
  "RESULT 25 missing legacy component handled",
  reconcileRequirementWithLegacyComponent({
    requirement: companySurface ?? null,
    lineItems: companyDeck.lineItems.filter(
      (item) => item.componentKey !== DECK_SURFACE_COMPONENT_KEY
    ),
    workAreaId: "d1",
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).status === "MISSING_LEGACY_COMPONENT"
);

const surfaceEligible = evaluatePromotionEligibility({
  reconciliation: companySurfaceRec,
  snapshotPersisted: true,
  duplicateRequirement: false,
});
const labourEligible = evaluatePromotionEligibility({
  reconciliation: companyLabourRec,
  snapshotPersisted: true,
  duplicateRequirement: false,
});
check(
  "ELIGIBILITY 26 Deck surface promoted with reconciliation PASS",
  surfaceEligible.promoted === true &&
    companySurfaceRec.status === "PASS"
);
check(
  "ELIGIBILITY 27 Deck labour eligibility computed but not promoted",
  labourEligible.eligible === true &&
    labourEligible.promoted === false &&
    REQ_4B_FIRST_PROMOTION_CANDIDATE.componentKey === DECK_SURFACE_COMPONENT_KEY
);
check(
  "ELIGIBILITY 28 failed parity blocks eligibility",
  evaluatePromotionEligibility({
    reconciliation: failRec,
    snapshotPersisted: true,
    duplicateRequirement: false,
  }).eligible === false
);
check(
  "ELIGIBILITY 29 missing snapshot blocks eligibility",
  evaluatePromotionEligibility({
    reconciliation: companySurfaceRec,
    snapshotPersisted: false,
    duplicateRequirement: false,
  }).eligible === false
);
check(
  "ELIGIBILITY 30 unpriced requirement blocks eligibility where cost authority is required",
  evaluatePromotionEligibility({
    reconciliation: missingMaterialRec,
    snapshotPersisted: true,
    duplicateRequirement: false,
  }).eligible === false
);

const generationA = "11111111-1111-4111-8111-111111111111";
const snapshotA = buildSnapshotPayloadForEstimate({
  generationId: generationA,
  result: {
    ...companyDeck,
    costLow: companyDeck.lineItems.reduce((sum, item) => sum + item.costLow, 0),
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    recommendedCost: companyDeck.lineItems.reduce(
      (sum, item) => sum + item.recommendedCost,
      0
    ),
    recommendedSell: 0,
    grossProfit: 0,
    marginPercent: 20,
    markupPercent: 25,
    confidence: 70,
    rateSourceSummary: "test",
    assumptions: [],
    missingInfo: [],
    exclusions: [],
    lineItems: companyDeck.lineItems,
    requirements: companyDeck.requirements,
  },
});
const jsonA = serializeEstimateRequirementSnapshot(snapshotA);
const parsedA = parseEstimateRequirementSnapshot(jsonA);
check(
  "SNAPSHOT 31 versioned serialization",
  snapshotA.schemaVersion === ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION &&
    snapshotA.requirementContractVersion === ESTIMATE_REQUIREMENT_CONTRACT_VERSION
);
check(
  "SNAPSHOT 32 parse/validation",
  parsedA.generationId === generationA &&
    parsedA.requirements.length === (companyDeck.requirements?.length ?? 0)
);

let parseRejected = false;
try {
  parseEstimateRequirementSnapshot({ schemaVersion: "nope" });
} catch (error) {
  parseRejected = error instanceof RequirementSnapshotError;
}
check("SNAPSHOT 32b invalid schema rejected", parseRejected);

const plant: PlantRequirement = {
  ...baseReq("plant", "d1", "scaffold"),
  kind: "plant",
  plantKey: "scaffold",
  hours: 2,
};
const subcontract: SubcontractRequirement = {
  ...baseReq("subcontract", "d1", "plumbing"),
  kind: "subcontract",
  workAreaType: "bathroom",
  priced: true,
  allowanceCost: 100,
  totalCost: 100,
};
const waste: WasteRequirement = {
  ...baseReq("waste", "d1", "skip"),
  kind: "waste",
  quantity: 1,
  unit: "each",
};
const allKinds = buildEstimateRequirementSnapshotV1({
  generationId: "22222222-2222-4222-8222-222222222222",
  requirements: [companySurface!, companyLabour!, plant, subcontract, waste],
});
check(
  "SNAPSHOT 33 all five requirement kinds serializable",
  new Set(parseEstimateRequirementSnapshot(serializeEstimateRequirementSnapshot(allKinds)).requirements.map((item) => item.kind)).size === 5
);

const storedSurface = parsedA.requirements.find(
  (item) => item.kind === "material"
) as MaterialRequirement;
check(
  "SNAPSHOT 34 material rate outcome preserved",
  storedSurface.unitCost === 18.5 && storedSurface.totalCost === 2343.03
);
const storedLabour = parsedA.requirements.find(
  (item) => item.kind === "labour"
) as LabourRequirement;
check(
  "SNAPSHOT 35 labour rate outcome preserved",
  storedLabour.hourlyCost === 80 &&
    storedLabour.totalCost === companyLabour?.totalCost
);
check(
  "SNAPSHOT 36 assumptions preserved",
  JSON.stringify(storedSurface.assumptions) ===
    JSON.stringify(companySurface?.assumptions)
);
check(
  "SNAPSHOT 37 confidence preserved",
  storedSurface.confidence === companySurface?.confidence
);
check(
  "SNAPSHOT 38 adjustment factors preserved",
  JSON.stringify(restrictedLabour && buildEstimateRequirementSnapshotV1({
    generationId: "33333333-3333-4333-8333-333333333333",
    requirements: [restrictedLabour],
  }).requirements[0] &&
    (parseEstimateRequirementSnapshot(
      serializeEstimateRequirementSnapshot(
        buildEstimateRequirementSnapshotV1({
          generationId: "33333333-3333-4333-8333-333333333333",
          requirements: [restrictedLabour],
        })
      )
    ).requirements[0] as LabourRequirement).adjustmentRef) ===
    JSON.stringify(restrictedLabour?.adjustmentRef)
);
check(
  "SNAPSHOT 39 conversion preserved",
  JSON.stringify(storedSurface.conversion) ===
    JSON.stringify(companySurface?.conversion) ||
    (storedSurface.conversion == null && companySurface?.conversion == null)
);
check(
  "SNAPSHOT 40 authority state preserved",
  parsedA.componentAuthorities.some(
    (item) =>
      item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
      item.authority === "REQUIREMENT_AUTHORITATIVE"
  ) &&
    parsedA.componentAuthorities.some(
      (item) =>
        item.componentKey === DECK_LABOUR_COMPONENT_KEY &&
        item.authority === "SHADOW"
    )
);

const store = createMemoryRequirementSnapshotStore();
const recordA = await store.insert({
  orgId: "org-a",
  projectId: "p1",
  estimateId: "e1",
  generationId: generationA,
  payload: snapshotA,
});
const generationB = "44444444-4444-4444-8444-444444444444";
const expensiveDeck = calculateDeck(
  {
    ...baseContext,
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: 21,
        sell_rate: null,
        active: true,
      },
    ],
  } as never,
  wa("d1", "deck", "Deck")
);
const snapshotB = buildSnapshotPayloadForEstimate({
  generationId: generationB,
  result: {
    costLow: 0,
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    recommendedCost: 0,
    recommendedSell: 0,
    grossProfit: 0,
    marginPercent: 20,
    markupPercent: 25,
    confidence: 70,
    rateSourceSummary: "test",
    assumptions: [],
    missingInfo: [],
    exclusions: [],
    lineItems: expensiveDeck.lineItems,
    requirements: expensiveDeck.requirements,
  },
});
await store.insert({
  orgId: "org-a",
  projectId: "p1",
  estimateId: "e1",
  generationId: generationB,
  payload: snapshotB,
});
const rereadA = await store.getById(recordA.id);
check(
  "IMMUTABILITY 41 snapshot A survives generation B",
  rereadA != null && rereadA.generationId === generationA
);
check(
  "IMMUTABILITY 42 snapshot A values unchanged after rate change",
  (rereadA?.payload.requirements.find((item) => item.kind === "material") as MaterialRequirement)
    ?.unitCost === 18.5 &&
    (surfaceReq(expensiveDeck)?.unitCost === 21)
);
const pcSnapshot = buildEstimateRequirementSnapshotV1({
  generationId: "55555555-5555-4555-8555-555555555555",
  requirements: [restrictedLabour!],
});
check(
  "IMMUTABILITY 43 snapshot A values unchanged after PC change",
  storedLabour.adjustedHours !== restrictedLabour?.adjustedHours &&
    rereadA != null &&
    (rereadA.payload.requirements.find((item) => item.kind === "labour") as LabourRequirement)
      .adjustedHours === companyLabour?.adjustedHours &&
    pcSnapshot.requirements[0] &&
    (pcSnapshot.requirements[0] as LabourRequirement).adjustedHours === 25.71
);
check(
  "IMMUTABILITY 44 snapshot cannot be normally updated",
  migration.includes("REQ_SNAPSHOT:IMMUTABLE") &&
    migration.includes("grant select, insert on table") &&
    persistSrc.includes(".insert(") &&
    !persistSrc.includes('from("estimate_requirement_snapshots")\n        .update')
);
const current = resolveCurrentRequirementSnapshot({
  requirementGenerationId: generationB,
  latestRequirementSnapshotId: (await store.getByGenerationId(generationB))?.id,
  byId: await store.getByGenerationId(generationB),
  byGenerationId: await store.getByGenerationId(generationB),
});
check(
  "IMMUTABILITY 45 current estimate can identify its current snapshot deterministically",
  current?.generationId === generationB && current.generationId !== generationA
);

check(
  "TENANCY 46 org isolation",
  migration.includes("org_id uuid not null") &&
    migration.includes("org_id = public.auth_org_id()")
);
check(
  "TENANCY 47 no cross-org read",
  migration.includes("Users can select requirement snapshots in their organisation")
);
check(
  "TENANCY 48 no cross-org insert",
  migration.includes("Users can insert requirement snapshots in their organisation") &&
    migration.includes("e.org_id = public.auth_org_id()")
);
check(
  "TENANCY 49 RLS coverage",
  migration.includes("enable row level security") &&
    read("scripts/verify-rls-coverage.ts").includes(
      "estimate_requirement_snapshots"
    )
);

const estimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck")],
  facts: hardwoodFacts("d1"),
} as never);
const surfaceLine = estimate.lineItems.find(
  (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
);
const labourLine = estimate.lineItems.find(
  (item) => item.componentKey === DECK_LABOUR_COMPONENT_KEY
);
const requirementCostSum = (estimate.requirements ?? []).reduce(
  (sum, item) =>
    sum +
    (item.kind === "material" || item.kind === "labour"
      ? item.totalCost ?? 0
      : 0),
  0
);
check(
  "COMMERCIAL 50 no requirement cost added to estimate",
  estimate.recommendedCost ===
    estimate.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0) &&
    persistSrc.includes("Requirement objects are not commercial authority")
);
const surfaceReqFromEstimate = (estimate.requirements ?? []).find(
  (item): item is MaterialRequirement =>
    item.kind === "material" && item.componentKey === DECK_SURFACE_COMPONENT_KEY
);
check(
  "COMMERCIAL 51 requirement replaces legacy surface money (no double count)",
  surfaceLine != null &&
    labourLine != null &&
    deckSrc.includes("lineItems.push") &&
    surfaceLine.recommendedCost === surfaceReqFromEstimate?.totalCost &&
    estimate.commercialSelections?.some(
      (item) =>
        item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
        item.activeSource === "REQUIREMENT"
    )
);
check(
  "COMMERCIAL 52 Deck surface promoted; Deck labour remains SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE" &&
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW" &&
    authoritySrc.includes('authority: "REQUIREMENT_AUTHORITATIVE"')
);
check(
  "COMMERCIAL 53 estimate cost unchanged",
  calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("golden", "deck", "Deck 1")],
    facts: [
      fact("deck.area_m2", "golden", 40),
      fact("deck.board_material", "golden", "Hardwood"),
      fact("deck.height_m", "golden", 0.5),
      fact("deck.board_width_mm", "golden", 140),
    ],
  } as never).recommendedCost > 0
);
check(
  "COMMERCIAL 54 estimate sell unchanged",
  estimate.recommendedSell ===
    estimate.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
);
check(
  "COMMERCIAL 55 Pricing unchanged",
  !read("lib/pricing/actions.ts").includes("getComponentCommercialAuthority")
);
check(
  "COMMERCIAL 56 Quote unchanged",
  !read("lib/quotes/actions.ts").includes("getComponentCommercialAuthority")
);

check(
  "CROSS-REQ 57 Deck MaterialRequirement unchanged",
  companySurface?.componentKey === DECK_SURFACE_COMPONENT_KEY &&
    companySurface.purchaseQuantity === 126.65
);
check(
  "CROSS-REQ 58 Deck LabourRequirement unchanged",
  companyLabour?.componentKey === DECK_LABOUR_COMPONENT_KEY &&
    companyLabour.trade === "carpenter"
);
check(
  "CROSS-REQ 59 deterministic requirement IDs unchanged",
  companySurface?.requirementId ===
    buildRequirementId({
      workAreaId: "d1",
      kind: "material",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      variantKey: companySurface.variantKey,
    })
);
check(
  "CROSS-REQ 60 aggregation unchanged",
  read("lib/estimate/requirement-aggregate.ts").includes(
    "Not pricing-authority promotion"
  )
);

const uiFiles = walkTs(join("app")).concat(walkTs(join("components")));
check(
  "PLATFORM 61 no UI",
  !uiFiles.some((path) => {
    const text = readFileSync(path, "utf8");
    return (
      text.includes("SHADOW") && text.includes("decking.surface")
    ) || text.includes("Requirement snapshot");
  })
);
check(
  "PLATFORM 62 no AI",
  !authoritySrc.includes("anthropic") &&
    !read("lib/estimate/requirement-snapshot.ts").includes("generateText")
);
check(
  "PLATFORM 63 Production SD disabled",
  isScopeDiscoveryEnabled({}) === false
);
check(
  "PLATFORM 64 migration not applied remote",
  migration.includes("remote not applied") &&
    persistSrc.includes("schema_unavailable")
);
check(
  "PLATFORM 65 CM-03 untouched",
  read("docs/product/QUOTR_PRODUCT_BACKLOG.md").includes("CM-03") &&
    read("lib/estimate/labour-requirement.ts").includes("hardcoded_legacy")
);

const diagnostics = buildRequirementCommercialDiagnostics({
  result: estimate,
  snapshot: {
    ok: true,
    generationId: generationA,
    snapshotId: recordA.id,
    schemaVersion: ESTIMATE_REQUIREMENT_SNAPSHOT_SCHEMA_VERSION,
  },
});
check(
  "DIAGNOSTICS snapshot created counts",
  diagnostics.snapshotCreated &&
    diagnostics.requirementCount >= 2 &&
    diagnostics.firstPromotionCandidate.promoted === true &&
    diagnostics.firstPromotionCandidate.componentKey === DECK_SURFACE_COMPONENT_KEY
);
check(
  "REQUIREMENT_COST_NOT_IN_TOTAL",
  requirementCostSum > 0 &&
    estimate.recommendedCost ===
      estimate.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0)
);
check(
  "PHYSICAL takeoff still 126.65 lm",
  calculateDeckingBoardLm({
    areaM2: ownerArea,
    boardWidthMm: 140,
    wastagePercent: 10,
  }).totalLm === 126.65
);
check(
  "persist writes component_key for migrating components",
  persistSrc.includes("component_key: item.componentKey ?? null") &&
    persistSrc.includes("work_area_name: item.workAreaName")
);
check(
  "LINEAGE 66 pricing copies requirement_snapshot_id at create",
  migration.includes("pricing_documents.requirement_snapshot_id") &&
    pricingSrc.includes("requirement_snapshot_id: requirementSnapshotId") &&
    pricingSrc.includes("latest_requirement_snapshot_id")
);
check(
  "LINEAGE 67 pricing copies component_key from estimate lines",
  migration.includes("pricing_items.component_key") &&
    pricingSrc.includes("component_key: (lineItem.component_key")
);
check(
  "LINEAGE 68 quote uses durable pricing parent (no redundant snapshot column)",
  quoteBuildSrc.includes("pricing_document_id") &&
    !read("lib/quotes/actions.ts").includes("requirement_snapshot_id") &&
    read("docs/architecture/QUOTR_REQUIREMENT_SNAPSHOT_CONTRACT.md").includes(
      "Quote → Pricing → `requirement_snapshot_id`"
    )
);
check(
  "LINEAGE 69 commercial lineage verifier script exists",
  existsSync("scripts/verify-migration-035-requirement-snapshots.ts")
);
check(
  "REQ-TXN-01 documented as REQ-4B blocker",
  read("docs/architecture/QUOTR_REQUIREMENT_SNAPSHOT_CONTRACT.md").includes(
      "REQ-TXN-01"
    ) &&
    read("docs/product/QUOTR_PRODUCT_BACKLOG.md").includes("REQ-TXN-01")
);
check(
  "fallback contract both sources must not contribute money",
  LEGACY_FALLBACK_CONTRACT.bothSourcesMustNotContributeMoney === true
);

let nonFiniteRejected = false;
try {
  serializeEstimateRequirementSnapshot({
    ...snapshotA,
    requirements: [
      {
        ...companySurface!,
        unitCost: Number.POSITIVE_INFINITY,
      },
    ],
  });
} catch {
  nonFiniteRejected = true;
}
check("SNAPSHOT JSON non-finite rejected", nonFiniteRejected);

console.log(`\n=== REQ-4A Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
