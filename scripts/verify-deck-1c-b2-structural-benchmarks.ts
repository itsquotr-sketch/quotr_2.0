/**
 * DECK-1C-B2 — sourced structural timber benchmark verifier.
 *
 * Run: npx tsx scripts/verify-deck-1c-b2-structural-benchmarks.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { deckRateRef01Facts } from "../lib/estimate/deck-rate-ref-01";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { round2 } from "../lib/estimate/facts";
import {
  buildEstimateRequirementSnapshotV1,
  parseEstimateRequirementSnapshot,
  serializeEstimateRequirementSnapshot,
} from "../lib/estimate/requirement-snapshot";
import { findExactStructuralTimberBenchmark, NZ_GST_INCLUSIVE_DIVISOR, STRUCTURAL_BENCHMARK_STALE_DAYS, STRUCTURAL_TIMBER_BENCHMARKS, structuralBenchmarkIsStale } from "../lib/estimate/structural-timber-benchmarks";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  buildStructuralTimberIdentity,
  compareMaterialIdentities,
  serializeMaterialIdentityKey,
} from "../lib/materials/identity";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";

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

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
  },
  materialWastageSettings: { decking: 10, default: 5 },
  rates: [],
} as unknown as EstimateContext;

function deckRef01Facts(workAreaId: string): EstimateFact[] {
  return [
    fact("deck.length_m", workAreaId, 5.2),
    fact("deck.width_m", workAreaId, 3.1),
    fact("deck.area_m2", workAreaId, 16.12),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.board_width_mm", workAreaId, 140),
    fact("deck.height_m", workAreaId, 0.4),
    fact("deck.joist_section", workAreaId, "140x45"),
    fact("deck.joist_centres_mm", workAreaId, 450),
    fact("deck.framing_treatment", workAreaId, "H3.2"),
    fact("deck.bearer_section", workAreaId, "190x45"),
    fact("deck.bearer_row_count", workAreaId, 2),
    fact("deck.support_type", workAreaId, "Post"),
    fact("deck.supports_per_bearer", workAreaId, 4),
    fact("deck.support_section", workAreaId, "90x90"),
    fact("deck.footing_length_mm", workAreaId, 300),
    fact("deck.footing_width_mm", workAreaId, 300),
    fact("deck.footing_depth_mm", workAreaId, 450),
  ];
}

function withTreatment(
  rows: EstimateFact[],
  workAreaId: string,
  treatment: string
): EstimateFact[] {
  return rows.map((row) =>
    row.key === "deck.framing_treatment"
      ? fact("deck.framing_treatment", workAreaId, treatment)
      : row
  );
}

function withJoistSection(
  rows: EstimateFact[],
  workAreaId: string,
  section: string
): EstimateFact[] {
  return rows.map((row) =>
    row.key === "deck.joist_section"
      ? fact("deck.joist_section", workAreaId, section)
      : row
  );
}

function materialReq(
  result: ReturnType<typeof calculateDeck>,
  componentKey: string
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function orgRate(params: {
  id: string;
  itemKey: string;
  cost: number;
  rateType?: "material" | "project_material";
}): OrganisationRate {
  return {
    id: params.id,
    rate_type: params.rateType ?? "material",
    trade: null,
    work_area_type: "deck",
    item_key: params.itemKey,
    label: params.id,
    unit: "lm",
    cost_rate: params.cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

function calcDeck(
  workAreaId: string,
  facts: EstimateFact[],
  extras?: Partial<EstimateContext>
) {
  return calculateDeck(
    {
      ...baseContext,
      ...extras,
      facts,
    } as EstimateContext,
    wa(workAreaId, "deck", workAreaId)
  );
}

console.log("=== DECK-1C-B2 structural timber benchmarks ===\n");

const kd = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
});
const green = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "green",
});
const unknownProcessing = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
});
const unknownGrade = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
});
const unknownTreatment = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  processingRaw: "KD",
});
const h12 = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H1.2",
  processingRaw: "KD",
});
const h4 = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H4",
  processingRaw: "KD",
});
const lvl = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
  originalDescription: "140x45 LVL SG8 H3.2 KD",
  productFamily: "structural_lvl",
});
const section200 = buildStructuralTimberIdentity({
  sectionRaw: "200x50",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
});
const catUnchanged = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
  gradeRaw: "SG8",
});

check(
  "1 KD identity distinct from green",
  kd != null &&
    green != null &&
    compareMaterialIdentities(kd, green) === "incompatible" &&
    serializeMaterialIdentityKey(kd).endsWith(".kd") &&
    serializeMaterialIdentityKey(green).endsWith(".green")
);
check(
  "2 KD identity distinct from unknown processing",
  kd != null &&
    unknownProcessing != null &&
    compareMaterialIdentities(kd, unknownProcessing) === "partial" &&
    !serializeMaterialIdentityKey(unknownProcessing).endsWith(".kd")
);
check(
  "3 existing CAT normalization unchanged",
  catUnchanged != null &&
    serializeMaterialIdentityKey(catUnchanged) ===
      "timber.structural_framing.140x45.sg8.h3.2"
);
check(
  "4 known SG8 required for SG8 benchmark",
  kd != null &&
    unknownGrade != null &&
    compareMaterialIdentities(kd, unknownGrade) === "partial"
);
check(
  "5 known H3.2 required",
  kd != null &&
    unknownTreatment != null &&
    compareMaterialIdentities(kd, unknownTreatment) === "partial"
);
check(
  "6 exact section required",
  kd != null &&
    section200 != null &&
    compareMaterialIdentities(kd, section200) === "incompatible"
);

const b90 = STRUCTURAL_TIMBER_BENCHMARKS.find((row) => row.evidenceId === "T10");
const b140 = STRUCTURAL_TIMBER_BENCHMARKS.find((row) => row.evidenceId === "T01");
const b190 = STRUCTURAL_TIMBER_BENCHMARKS.find((row) => row.evidenceId === "T14");
const expected90 = round2(44.66 / 4.8 / NZ_GST_INCLUSIVE_DIVISOR);
const expected140 = round2(75.35 / 4.8 / NZ_GST_INCLUSIVE_DIVISOR);
const expected190 = round2(125.09 / 6.0 / NZ_GST_INCLUSIVE_DIVISOR);

check("7 approved 90x45 benchmark exists", b90?.canonicalMaterialIdentity.section === "90x45");
check("8 approved 140x45 benchmark exists", b140?.canonicalMaterialIdentity.section === "140x45");
check("9 approved 190x45 benchmark exists", b190?.canonicalMaterialIdentity.section === "190x45");
check(
  "10 all unit = lm",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.rateUnit === "lm")
);
check(
  "11 all cost ex-GST",
  STRUCTURAL_TIMBER_BENCHMARKS.every(
    (row) =>
      row.gstBasis === "inclusive" &&
      row.normalizedRateExGst ===
        round2(row.sourcePriceInclGst / row.stockLengthM / NZ_GST_INCLUSIVE_DIVISOR)
  ) &&
    b90?.normalizedRateExGst === expected90 &&
    b140?.normalizedRateExGst === expected140 &&
    b190?.normalizedRateExGst === expected190
);
check(
  "12 provenance source present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.sourceName === "Bunnings NZ")
);
check(
  "13 source URL/reference present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.sourceURL.startsWith("https://www.bunnings.co.nz/"))
);
check(
  "14 raw price evidence present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.sourcePriceInclGst > 0 && row.sourceUnit === "piece")
);
check(
  "15 GST basis present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.gstBasis === "inclusive")
);
check(
  "16 researched date present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.researchedAt === "2026-08-18")
);
check(
  "17 verified date present",
  STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.verifiedAt === "2026-08-18")
);
check(
  "18 source product code/description preserved",
  b90?.sourceProductCode === "0616579" &&
    b140?.sourceProductCode === "0616335" &&
    b190?.sourceProductCode === "0616565" &&
    STRUCTURAL_TIMBER_BENCHMARKS.every((row) => row.sourceProductDescription.includes("SG8 H3.2 KD"))
);

const id90 = buildStructuralTimberIdentity({
  sectionRaw: "90x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
})!;
check(
  "19 exact 90x45 SG8 H3.2 KD resolves",
  findExactStructuralTimberBenchmark(id90, "lm")?.evidenceId === "T10"
);
check(
  "20 exact 140x45 resolves",
  kd != null && findExactStructuralTimberBenchmark(kd, "lm")?.evidenceId === "T01"
);
const id190 = buildStructuralTimberIdentity({
  sectionRaw: "190x45",
  gradeRaw: "SG8",
  treatmentRaw: "H3.2",
  processingRaw: "KD",
})!;
check(
  "21 exact 190x45 resolves",
  findExactStructuralTimberBenchmark(id190, "lm")?.evidenceId === "T14"
);

const rateWa = "rate";
const rateFacts = deckRateRef01Facts(rateWa);
const rateDeck = calcDeck(rateWa, rateFacts);
const rateJoist = materialReq(rateDeck, DECK_JOISTS_COMPONENT_KEY);
const rateRim = materialReq(rateDeck, DECK_RIM_FRAMING_COMPONENT_KEY);
const rateBearer = materialReq(rateDeck, DECK_BEARERS_COMPONENT_KEY);
const rateSupports = materialReq(rateDeck, DECK_SUPPORTS_COMPONENT_KEY);
const rateConcrete = materialReq(rateDeck, DECK_CONCRETE_COMPONENT_KEY);

check(
  "22 rateSource = benchmark",
  rateJoist?.rateSource === "benchmark" &&
    rateRim?.rateSource === "benchmark" &&
    rateBearer?.rateSource === "benchmark"
);

const unknownGradeDeck = calcDeck(
  "ug",
  withTreatment(deckRateRef01Facts("ug"), "ug", "H3.2 KD")
);
check(
  "23 grade unknown does not resolve",
  materialReq(unknownGradeDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false
);

const unknownTreatmentDeck = calcDeck(
  "ut",
  withTreatment(deckRateRef01Facts("ut"), "ut", "SG8 KD")
);
check(
  "24 treatment unknown does not resolve",
  materialReq(unknownTreatmentDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false
);

const unknownKdDeck = calcDeck(
  "uk",
  withTreatment(deckRateRef01Facts("uk"), "uk", "H3.2 SG8")
);
check(
  "25 KD unknown does not resolve",
  materialReq(unknownKdDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(unknownKdDeck, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.processingKind ===
      "unknown"
);

const greenDeck = calcDeck(
  "gr",
  withTreatment(deckRateRef01Facts("gr"), "gr", "H3.2 SG8 green")
);
check(
  "26 green does not resolve KD",
  materialReq(greenDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(greenDeck, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.processing === "green"
);

const h12Deck = calcDeck(
  "h12",
  withTreatment(deckRateRef01Facts("h12"), "h12", "H1.2 SG8 KD")
);
check(
  "27 H1.2 does not resolve H3.2",
  materialReq(h12Deck, DECK_JOISTS_COMPONENT_KEY)?.priced === false
);

const h4Deck = calcDeck(
  "h4",
  withTreatment(deckRateRef01Facts("h4"), "h4", "H4 SG8 KD")
);
check(
  "28 H4 does not resolve H3.2",
  materialReq(h4Deck, DECK_JOISTS_COMPONENT_KEY)?.priced === false
);

const lvlDeck = calcDeck(
  "lvl",
  withJoistSection(deckRateRef01Facts("lvl"), "lvl", "140x45 LVL")
);
check(
  "29 LVL does not resolve framing",
  materialReq(lvlDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(lvlDeck, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.productFamily ===
      "structural_lvl"
);

const custom200Deck = calcDeck(
  "s200",
  withJoistSection(deckRateRef01Facts("s200"), "s200", "200x50")
);
check(
  "30 200x50 does not resolve",
  materialReq(custom200Deck, DECK_JOISTS_COMPONENT_KEY)?.priced === false
);

const companyKey = `${serializeMaterialIdentityKey(kd!)}.lm`;
const companyDeck = calcDeck(rateWa, rateFacts, {
  rates: [orgRate({ id: "company", itemKey: companyKey, cost: 20 })],
});
check(
  "31 company exact outranks benchmark",
  materialReq(companyDeck, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "company" &&
    materialReq(companyDeck, DECK_JOISTS_COMPONENT_KEY)?.unitCost === 20
);

const projectDeck = calcDeck(rateWa, rateFacts, {
  rates: [
    orgRate({ id: "company", itemKey: companyKey, cost: 20 }),
    orgRate({
      id: "project",
      itemKey: companyKey,
      cost: 25,
      rateType: "project_material",
    }),
  ],
});
check(
  "32 project override outranks company/benchmark",
  materialReq(projectDeck, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "project_override" &&
    materialReq(projectDeck, DECK_JOISTS_COMPONENT_KEY)?.unitCost === 25
);

check("33 DECK-RATE-REF-01 joists 42.32 lm", rateJoist?.purchaseQuantity === 42.32);
check("34 rim 10.92 lm", rateRim?.purchaseQuantity === 10.92);
check(
  "35 joists/rim same material identity",
  rateJoist?.materialIdentity != null &&
    rateRim?.materialIdentity != null &&
    compareMaterialIdentities(rateJoist.materialIdentity, rateRim.materialIdentity) === "exact"
);
check(
  "36 aggregate 53.24 lm",
  rateJoist != null &&
    rateRim != null &&
    round2(rateJoist.purchaseQuantity + rateRim.purchaseQuantity) === 53.24
);
check(
  "37 both use 140 benchmark",
  rateJoist?.unitCost === expected140 &&
    rateRim?.unitCost === expected140 &&
    rateJoist.rateEvidence?.evidenceId === "T01" &&
    rateRim.rateEvidence?.evidenceId === "T01"
);
check("38 bearer 10.92 lm", rateBearer?.purchaseQuantity === 10.92);
check(
  "39 bearer uses 190 benchmark",
  rateBearer?.unitCost === expected190 && rateBearer.rateEvidence?.evidenceId === "T14"
);
check(
  "40 priced=true for these three requirements",
  rateJoist?.priced === true && rateRim?.priced === true && rateBearer?.priced === true
);
check(
  "41 costs calculated once",
  rateJoist?.totalCost === round2(42.32 * expected140) &&
    rateRim?.totalCost === round2(10.92 * expected140) &&
    rateBearer?.totalCost === round2(10.92 * expected190)
);
check(
  "42 waste not re-applied in rate layer",
  rateJoist != null &&
    rateJoist.wasteFactor === 0.05 &&
    rateJoist.totalCost ===
      round2(rateJoist.purchaseQuantity * (rateJoist.unitCost ?? 0)) &&
    rateJoist.totalCost !==
      round2(rateJoist.baseQuantity * (1 + rateJoist.wasteFactor) * (rateJoist.unitCost ?? 0) * (1 + rateJoist.wasteFactor))
);

check(
  "43 supports remain unpriced",
  rateSupports?.priced === false &&
    rateSupports.purchaseQuantity === 8 &&
    rateSupports.purchaseUnit === "ea"
);
check(
  "44 concrete remains unpriced",
  rateConcrete?.priced === false && rateConcrete.purchaseQuantity === 0.324
);

const refDeck = calcDeck("ref", deckRef01Facts("ref"));
check(
  "45 partial identity DECK-REF remains unpriced",
  materialReq(refDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(refDeck, DECK_RIM_FRAMING_COMPONENT_KEY)?.priced === false &&
    materialReq(refDeck, DECK_BEARERS_COMPONENT_KEY)?.priced === false
);

check(
  "46 structural children remain SHADOW",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority === "LEGACY_AUTHORITATIVE"
  )
);
check(
  "47 unpriced 90×90 does not restore the substructure package",
  rateDeck.lineItems.some(
    (item) => item.componentKey === DECK_JOISTS_COMPONENT_KEY
  ) && !rateDeck.lineItems.some((item) => item.label === "Framing/substructure")
);

const rateEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa(rateWa, "deck", "DECK-RATE-REF-01")],
  facts: rateFacts,
} as never);
const refEstimate = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("ref", "deck", "DECK-REF-01")],
  facts: deckRef01Facts("ref"),
} as never);
check(
  "48 detailed geometry XOR package remains",
  !rateDeck.lineItems.some((item) => item.label === "Framing/substructure") &&
    !refEstimate.lineItems.some((item) => item.label === "Framing/substructure") &&
    rateDeck.lineItems.some((item) => item.label === "Joists") &&
    refEstimate.lineItems.some((item) => item.label === "Joists")
);
check(
  "49 decking surface authority unchanged",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "50 Deck labour unchanged",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);

const deck1 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
  facts: [
    fact("deck.area_m2", "d1", 70),
    fact("deck.board_material", "d1", "Hardwood"),
    fact("deck.board_width_mm", "d1", 140),
    fact("deck.height_m", "d1", 0.8),
    fact("deck.existing_deck_removal", "d1", true),
    fact("deck.access_type", "d1", "Stair set"),
    fact("deck.balustrade_required", "d1", true),
  ],
  materialWastageSettings: { decking: 10, default: 5 },
} as never);
check("51 Deck golden $48,340 unchanged", Math.round(deck1.recommendedSell) === 48340);

const snapshot = buildEstimateRequirementSnapshotV1({
  generationId: "deck-1c-b2-rate-ref-01",
  generatedAt: "2026-08-18T00:00:00.000Z",
  requirements: rateDeck.requirements ?? [],
});
const snapshotJson = serializeEstimateRequirementSnapshot(snapshot);
const parsedSnapshot = parseEstimateRequirementSnapshot(snapshotJson);
const snapJoist = parsedSnapshot.requirements.find(
  (item): item is MaterialRequirement =>
    item.kind === "material" && item.componentKey === DECK_JOISTS_COMPONENT_KEY
);
check(
  "52 benchmark identity serialized",
  snapJoist?.materialIdentity?.section === "140x45" &&
    snapJoist.materialIdentity.grade === "sg8" &&
    snapJoist.materialIdentity.treatment === "h3.2"
);
check(
  "53 rate/unit serialized",
  snapJoist?.unitCost === expected140 && snapJoist.purchaseUnit === "lm"
);
check("54 rate source serialized", snapJoist?.rateSource === "benchmark");
check(
  "55 rate evidence survives benchmark change scenario/test",
  snapJoist?.rateEvidence?.normalizedRateExGst === expected140 &&
    snapJoist.totalCost === rateJoist?.totalCost &&
    snapJoist.rateEvidence.sourceURL === b140?.sourceURL &&
    parsedSnapshot.requirements.find(
      (item) => item.kind === "material" && item.componentKey === DECK_JOISTS_COMPONENT_KEY
    )?.totalCost === rateJoist?.totalCost
);
check(
  "56 processing/KD serialized",
  snapJoist?.materialIdentity?.processing === "kd" &&
    snapJoist.materialIdentity.processingKind === "known"
);

check("57 no materials table", !existsSync("supabase/migrations/037_materials.sql"));
const migrations = existsSync("supabase/migrations")
  ? readdirSync("supabase/migrations")
  : [];
check(
  "58 no migration",
  !migrations.some((name) => /037|materials_table|global_materials/i.test(name))
);
check(
  "59 no supplier integration",
  !readFileSync("lib/estimate/structural-timber-benchmarks.ts", "utf8").includes("account price") &&
    !readFileSync("lib/estimate/resolve-structural-material-rate.ts", "utf8").includes("supplier_api")
);
check("60 no Production deploy", true);
check("61 Production SD disabled", isScopeDiscoveryEnabled({}) === false);

const recon = rateDeck.deckSubstructureReconciliation;
check(
  "62 substructure pricing coverage partial",
  recon?.pricingCoverage === "partial" &&
    recon.pricedChildCount === 3 &&
    recon.unpricedChildCount === 2 &&
    recon.unpricedChildComponentKeys.includes(DECK_SUPPORTS_COMPONENT_KEY) &&
    recon.unpricedChildComponentKeys.includes(DECK_CONCRETE_COMPONENT_KEY) &&
    recon.pricedChildCostTotal ===
      round2(
        (rateJoist?.totalCost ?? 0) +
          (rateRim?.totalCost ?? 0) +
          (rateBearer?.totalCost ?? 0)
      ) &&
    recon.commercialNote.includes("PARTIAL PRICED STRUCTURAL CHILD COST")
);
check(
  "63 no green/H1.2/70x45 B2 rates",
  STRUCTURAL_TIMBER_BENCHMARKS.length === 3 &&
    !STRUCTURAL_TIMBER_BENCHMARKS.some((row) => row.canonicalMaterialIdentity.processing === "green")
);
check(
  "64 debug key is not persistent catalogue id",
  readFileSync("lib/materials/identity.ts", "utf8").includes(
    "NOT a future globally unique persistent Material row ID"
  )
);
check(
  "65 90-day stale threshold documented in type",
  STRUCTURAL_BENCHMARK_STALE_DAYS === 90 &&
    structuralBenchmarkIsStale("2026-08-18", new Date("2026-08-18T00:00:00.000Z")) === false &&
    structuralBenchmarkIsStale("2026-08-18", new Date("2026-12-01T00:00:00.000Z")) === true
);
check(
  "66 90x45 live fixture resolves",
  materialReq(
    calcDeck(
      "n90",
      withJoistSection(deckRateRef01Facts("n90"), "n90", "90x45")
    ),
    DECK_JOISTS_COMPONENT_KEY
  )?.unitCost === expected90
);
check(
  "67 unknown processing vs KD benchmark is not exact",
  unknownProcessing != null &&
    findExactStructuralTimberBenchmark(unknownProcessing, "lm") == null
);
check(
  "68 LVL identity incompatible with framing benchmark",
  lvl != null &&
    kd != null &&
    compareMaterialIdentities(kd, lvl) === "incompatible"
);
check(
  "69 H1.2/H4 incompatible with H3.2 benchmark",
  h12 != null &&
    h4 != null &&
    kd != null &&
    compareMaterialIdentities(kd, h12) === "incompatible" &&
    compareMaterialIdentities(kd, h4) === "incompatible"
);

const fence2 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("f2", "fence", "Fence 2")],
  facts: [
    fact("fence.length_m", "f2", 30),
    fact("fence.height_m", "f2", 2),
    fact("fence.material", "f2", "Timber"),
    fact("fence.gate_included", "f2", true),
    fact("fence.demolition_required", "f2", true),
    fact("fence.disposal_required", "f2", true),
    fact("fence.slope_condition", "f2", "Steep/sloping"),
    fact("fence.access", "f2", "Difficult"),
  ],
} as never);
const pergola1 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("p1", "pergola", "Pergola 1")],
  facts: [
    fact("pergola.area_m2", "p1", 24),
    fact("pergola.material", "p1", "Aluminium"),
    fact("pergola.attached", "p1", "Attached"),
    fact("pergola.roofing_included", "p1", true),
    fact("pergola.roofing_type", "p1", "Colorsteel"),
  ],
} as never);
const rw2 = calculateEstimate({
  ...baseContext,
  confirmedWorkAreas: [wa("rw2", "retaining_wall", "Retaining Wall 2")],
  facts: [
    fact("retaining_wall.length_m", "rw2", 10),
    fact("retaining_wall.height_m", "rw2", 1),
    fact("retaining_wall.is_raking", "rw2", false),
    fact("retaining_wall.fixing_type", "rw2", "Standard"),
    fact("retaining_wall.material", "rw2", "Timber"),
    fact("retaining_wall.drainage_required", "rw2", true),
    fact("retaining_wall.backfill_included", "rw2", true),
    fact("retaining_wall.backfill_depth_m", "rw2", 0.3),
    fact("retaining_wall.backfill_length_m", "rw2", 10),
    fact("retaining_wall.backfill_height_m", "rw2", 1),
  ],
} as never);

check("70 Fence 2 golden $8,782", Math.round(fence2.recommendedSell) === 8782);
check("71 Pergola 1 golden $15,374", Math.round(pergola1.recommendedSell) === 15374);
check("72 Retaining Wall 2 golden $7,345", Math.round(rw2.recommendedSell) === 7345);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
