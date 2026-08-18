/**
 * CAT-IDENTITY-01 — material identity foundation verifier.
 *
 * Run: npx tsx scripts/verify-cat-identity-01.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../lib/estimate/deck-structure";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { round2 } from "../lib/estimate/facts";
import {
  buildConcreteMaterialIdentity,
  buildStructuralTimberIdentity,
  commercialRateEligibilityFromIdentityMatch,
  compareMaterialIdentities,
  identityContainsForbiddenComponentToken,
  identityContainsRateUnit,
  materialIdentitiesShareStock,
  normalizeMaterialGrade,
  normalizeMaterialSection,
  normalizeMaterialTreatment,
  parseMaterialDescription,
  serializeMaterialIdentityKey,
  STRUCTURAL_FRAMING_PRODUCT_FAMILY,
  STRUCTURAL_LVL_PRODUCT_FAMILY,
} from "../lib/materials/identity";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
import {
  buildEstimateRequirementSnapshotV1,
  parseEstimateRequirementSnapshot,
  serializeEstimateRequirementSnapshot,
} from "../lib/estimate/requirement-snapshot";

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

function deckRefFacts(workAreaId: string, extras: EstimateFact[] = []): EstimateFact[] {
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
    ...extras,
  ];
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

console.log("=== CAT-IDENTITY-01 material identity foundation ===\n");

check("1 140x45 → 140x45", normalizeMaterialSection("140x45") === "140x45");
check("2 140 x 45 → 140x45", normalizeMaterialSection("140 x 45") === "140x45");
check("3 140×45 → 140x45", normalizeMaterialSection("140×45") === "140x45");
check("4 45x140 → 140x45", normalizeMaterialSection("45x140") === "140x45");
check("5 140 x 45 mm → 140x45", normalizeMaterialSection("140 x 45 mm") === "140x45");
check("6 200x50 accepted", normalizeMaterialSection("200x50") === "200x50");
check("7 malformed custom safe", normalizeMaterialSection("Big deck timber") == null);

const h32 = normalizeMaterialTreatment("H3.2");
const h32l = normalizeMaterialTreatment("h3.2");
const h32u = normalizeMaterialTreatment("H3_2");
const h4 = normalizeMaterialTreatment("H4");
const unknownT = normalizeMaterialTreatment(null);
const customT = normalizeMaterialTreatment("CCA special");
check("8 H3.2 known", h32.kind === "known" && h32.value === "h3.2");
check("9 h3.2 same", h32l.value === "h3.2");
check("10 H3_2 same", h32u.value === "h3.2");
check("11 H4 distinct", h4.value === "h4" && h4.value !== h32.value);
check("12 unknown stays unknown", unknownT.kind === "unknown" && unknownT.value == null);
check("13 custom does not map", customT.kind === "custom" && customT.custom === "CCA special");

check("14 SG8", normalizeMaterialGrade("SG8") === "sg8");
check("15 sg8 same", normalizeMaterialGrade("sg8") === "sg8");
check("16 unknown grade", normalizeMaterialGrade(null) == null);
check("17 no default grade", normalizeMaterialGrade("") == null);

const joistId = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
});
check(
  "18 no component name in identity",
  joistId != null && !identityContainsForbiddenComponentToken(joistId)
);
check(
  "19 no rate unit in identity",
  joistId != null && !identityContainsRateUnit(joistId)
);
check(
  "20 exact compares exact",
  joistId != null &&
    compareMaterialIdentities(joistId, joistId) === "exact"
);

const unknownTreatmentId = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
});
check(
  "21 unknown treatment vs H3.2 not exact",
  unknownTreatmentId != null &&
    joistId != null &&
    compareMaterialIdentities(unknownTreatmentId, joistId) === "partial"
);
check(
  "22 H3.2 vs H4 incompatible",
  joistId != null &&
    compareMaterialIdentities(
      joistId,
      buildStructuralTimberIdentity({
        sectionRaw: "140x45",
        treatmentRaw: "H4",
      })!
    ) === "incompatible"
);
check(
  "23 140x45 vs 190x45 incompatible",
  joistId != null &&
    compareMaterialIdentities(
      joistId,
      buildStructuralTimberIdentity({
        sectionRaw: "190x45",
        treatmentRaw: "H3.2",
      })!
    ) === "incompatible"
);
const customDesc = parseMaterialDescription("200x50 rough sawn H3.2 custom pine");
check(
  "24 original description retained",
  customDesc.originalDescription === "200x50 rough sawn H3.2 custom pine" &&
    customDesc.section === "200x50" &&
    customDesc.treatment.value === "h3.2"
);

const noTreatmentDeck = calculateDeck(
  {
    ...baseContext,
    facts: deckRefFacts("t1").filter((row) => row.key !== "deck.framing_treatment"),
  } as EstimateContext,
  wa("t1", "deck", "No treatment")
);
const joistNoT = materialReq(noTreatmentDeck, DECK_JOISTS_COMPONENT_KEY);
const rimNoT = materialReq(noTreatmentDeck, DECK_RIM_FRAMING_COMPONENT_KEY);
const bearerNoT = materialReq(noTreatmentDeck, DECK_BEARERS_COMPONENT_KEY);
check("25 joists emit without treatment", joistNoT != null);
check("26 joists purchase 42.32", joistNoT?.purchaseQuantity === 42.32);
check(
  "27 priced=false",
  joistNoT?.priced === false && joistNoT.rateSource === "missing"
);
check("28 rim emits without treatment", rimNoT != null && rimNoT.purchaseQuantity === 10.92);
check(
  "29 bearers emit without treatment",
  bearerNoT != null && bearerNoT.purchaseQuantity === 10.92
);

const noSectionDeck = calculateDeck(
  {
    ...baseContext,
    facts: deckRefFacts("t2").filter((row) => row.key !== "deck.joist_section"),
  } as EstimateContext,
  wa("t2", "deck", "No joist section")
);
check(
  "30 no fabricated joist identity without section",
  materialReq(noSectionDeck, DECK_JOISTS_COMPONENT_KEY) == null &&
    materialReq(noSectionDeck, DECK_RIM_FRAMING_COMPONENT_KEY) == null
);

const concrete = materialReq(noTreatmentDeck, DECK_CONCRETE_COMPONENT_KEY);
check(
  "31 concrete unknown mix still emits",
  concrete != null &&
    concrete.purchaseQuantity === 0.324 &&
    concrete.materialIdentity?.family === "concrete" &&
    concrete.priced === false
);
check(
  "32 supports 8 EA",
  materialReq(noTreatmentDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity === 8 &&
    materialReq(noTreatmentDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseUnit === "ea"
);

const refDeck = calculateDeck(
  { ...baseContext, facts: deckRefFacts("ref") } as EstimateContext,
  wa("ref", "deck", "DECK-REF-01")
);
const refJoist = materialReq(refDeck, DECK_JOISTS_COMPONENT_KEY);
const refRim = materialReq(refDeck, DECK_RIM_FRAMING_COMPONENT_KEY);
const refBearer = materialReq(refDeck, DECK_BEARERS_COMPONENT_KEY);
check(
  "33 joist/rim same stock",
  refJoist?.materialIdentity != null &&
    refRim?.materialIdentity != null &&
    materialIdentitiesShareStock(refJoist.materialIdentity, refRim.materialIdentity)
);
check(
  "34 aggregate 53.24 lm",
  refJoist != null &&
    refRim != null &&
    round2(refJoist.purchaseQuantity + refRim.purchaseQuantity) === 53.24
);
check(
  "35 bearer not aggregate with joist",
  refJoist?.materialIdentity != null &&
    refBearer?.materialIdentity != null &&
    !materialIdentitiesShareStock(refJoist.materialIdentity, refBearer.materialIdentity)
);

const custom200 = buildStructuralTimberIdentity({
  sectionRaw: "200x50",
  treatmentRaw: "H3.2",
  originalDescription: "200x50 rough sawn H3.2 custom pine",
});
check("36 200x50 custom valid", custom200?.section === "200x50");
check(
  "37 not in common list still valid",
  custom200 != null && serializeMaterialIdentityKey(custom200).includes("200x50")
);
check(
  "38 custom description retained",
  custom200?.originalDescription === "200x50 rough sawn H3.2 custom pine"
);

const customDeck = calculateDeck(
  {
    ...baseContext,
    facts: deckRefFacts("c1").map((row) =>
      row.key === "deck.joist_section"
        ? fact("deck.joist_section", "c1", "200x50")
        : row
    ),
  } as EstimateContext,
  wa("c1", "deck", "Custom 200x50")
);
check(
  "39 custom 200x50 unpriced",
  materialReq(customDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(customDeck, DECK_JOISTS_COMPONENT_KEY)?.unitCost == null
);

const lvl = buildStructuralTimberIdentity({
  sectionRaw: "240x45 LVL",
  originalDescription: "240x45 LVL",
});
check(
  "39b LVL custom valid",
  lvl?.section === "240x45" &&
    lvl.productFamily === "structural_lvl" &&
    lvl.species == null &&
    lvl.originalDescription === "240x45 LVL" &&
    lvl.grade == null
);

check(
  "40 structural children SHADOW/LEGACY",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority === "LEGACY_AUTHORITATIVE"
  )
);
check(
  "41 substructure money remains",
  refDeck.lineItems.some((item) => item.label === "Framing/substructure")
);
check(
  "42 surface REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "43 labour SHADOW",
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
check("44 Deck 1 golden $48,340", Math.round(deck1.recommendedSell) === 48340);

check("45 no migration 037", !existsSync("supabase/migrations/037"));
check(
  "46 no prices in identity module",
  !read("lib/materials/identity.ts").includes("cost_rate") &&
    !read("lib/materials/identity.ts").includes("18.75")
);
check(
  "47 no DECK-1C-B research",
  !existsSync("docs/audits/DECK_1C_B_BENCHMARK_RESEARCH.md")
);
check("48 Production SD disabled", isScopeDiscoveryEnabled({}) === false);

check(
  "49 identity key has no sg8 default",
  unknownTreatmentId != null &&
    !serializeMaterialIdentityKey(unknownTreatmentId).includes("sg8")
);
check(
  "50 identity key has no lm",
  joistId != null && !serializeMaterialIdentityKey(joistId).endsWith(".lm")
);
check(
  "51 snapshot-serializable identity on joists",
  refJoist?.materialIdentity != null &&
    JSON.parse(JSON.stringify(refJoist.materialIdentity)).section === "140x45"
);
check(
  "52 concrete family not footing-frozen",
  concrete?.materialKey === "concrete"
);
check(
  "53 DECK-REF-01 quantities frozen",
  refJoist?.purchaseQuantity === 42.32 &&
    refRim?.purchaseQuantity === 10.92 &&
    refBearer?.purchaseQuantity === 10.92 &&
    materialReq(refDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity === 8 &&
    materialReq(refDeck, DECK_CONCRETE_COMPONENT_KEY)?.purchaseQuantity === 0.324
);
check(
  "54 no structural money lines",
  refDeck.lineItems.every(
    (item) =>
      !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
        item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
      )
  )
);

const concreteId = buildConcreteMaterialIdentity({});
check("55 concrete mix unknown identity", concreteId.grade == null);

const withSg8 = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
  gradeRaw: "SG8",
});
const h32UnknownGrade = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
});
const sg6 = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
  gradeRaw: "SG6",
});
const unknownAll = buildStructuralTimberIdentity({ sectionRaw: "140x45" });
check(
  "56 known SG8 participates in identity key",
  withSg8 != null &&
    serializeMaterialIdentityKey(withSg8) ===
      "timber.structural_framing.140x45.sg8.h3.2"
);
check(
  "57 unknown grade does not become SG8",
  h32UnknownGrade != null &&
    h32UnknownGrade.grade == null &&
    !serializeMaterialIdentityKey(h32UnknownGrade).includes("sg8")
);
check(
  "58 known grade vs unknown grade not exact",
  withSg8 != null &&
    h32UnknownGrade != null &&
    compareMaterialIdentities(withSg8, h32UnknownGrade) === "partial"
);
check(
  "59 different known grades do not collide",
  withSg8 != null &&
    sg6 != null &&
    compareMaterialIdentities(withSg8, sg6) === "incompatible"
);
check(
  "60 known treatment vs unknown not exact",
  unknownAll != null &&
    h32UnknownGrade != null &&
    compareMaterialIdentities(unknownAll, h32UnknownGrade) === "partial"
);
const ccaSameSection = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "CCA special",
});
const cca = buildStructuralTimberIdentity({
  sectionRaw: "200x50",
  treatmentRaw: "CCA special",
});
check(
  "61 custom treatment distinct from known",
  ccaSameSection != null &&
    ccaSameSection.treatmentKind === "custom" &&
    joistId != null &&
    compareMaterialIdentities(ccaSameSection, joistId) === "incompatible"
);
const otherCustom = buildStructuralTimberIdentity({
  sectionRaw: "200x50",
  treatmentRaw: "proprietary dip",
});
check(
  "62 different custom treatments do not merge",
  cca != null &&
    otherCustom != null &&
    compareMaterialIdentities(cca, otherCustom) === "incompatible"
);
const generic240 = buildStructuralTimberIdentity({ sectionRaw: "240x45" });
check(
  "63 240x45 LVL distinct from generic structural timber",
  lvl != null &&
    generic240 != null &&
    lvl.productFamily === STRUCTURAL_LVL_PRODUCT_FAMILY &&
    generic240.productFamily === STRUCTURAL_FRAMING_PRODUCT_FAMILY &&
    compareMaterialIdentities(lvl, generic240) === "incompatible"
);
const wordingA = buildStructuralTimberIdentity({
  sectionRaw: "140x45",
  treatmentRaw: "H3.2",
  originalDescription: "140x45 H3.2",
});
const wordingB = buildStructuralTimberIdentity({
  sectionRaw: "140 x 45",
  treatmentRaw: "h3.2",
  originalDescription: "140 x 45 treated framing",
});
check(
  "64 originalDescription preserved",
  wordingB?.originalDescription === "140 x 45 treated framing"
);
check(
  "65 harmless wording does not define mismatch",
  wordingA != null &&
    wordingB != null &&
    wordingA.originalDescription !== wordingB.originalDescription &&
    compareMaterialIdentities(wordingA, wordingB) === "exact"
);
check(
  "66 identity exact is not rate eligibility",
  commercialRateEligibilityFromIdentityMatch("exact") ===
    "deferred_to_rate_resolver" &&
    refJoist?.priced === false
);
check(
  "67 no fuzzy rate selection in identity module",
  !read("lib/materials/identity.ts").includes("fuzzy") &&
    !read("lib/materials/identity.ts").includes("close enough")
);
check(
  "68 unknown vs SG8 H3.2 is partial not exact",
  unknownAll != null &&
    withSg8 != null &&
    compareMaterialIdentities(unknownAll, withSg8) === "partial"
);
check(
  "69 same custom treatment is exact identity",
  cca != null &&
    compareMaterialIdentities(
      cca,
      buildStructuralTimberIdentity({
        sectionRaw: "200x50",
        treatmentRaw: "CCA special",
      })!
    ) === "exact"
);

const snapshot = buildEstimateRequirementSnapshotV1({
  generationId: "cat-identity-01-snap",
  requirements: refDeck.requirements ?? [],
});
const parsedSnap = parseEstimateRequirementSnapshot(
  serializeEstimateRequirementSnapshot(snapshot)
);
const snapJoist = parsedSnap.requirements.find(
  (item) => item.kind === "material" && item.componentKey === DECK_JOISTS_COMPONENT_KEY
) as MaterialRequirement | undefined;
check(
  "70 snapshot preserves known/unknown identity fields",
  snapJoist?.materialIdentity?.section === "140x45" &&
    snapJoist.materialIdentity.treatment === "h3.2" &&
    snapJoist.materialIdentity.treatmentKind === "known" &&
    snapJoist.materialIdentity.grade == null
);
check(
  "71 custom treatment snapshot key includes custom slug",
  cca != null &&
    serializeMaterialIdentityKey(cca).includes("custom.cca_special")
);
const customRoundTrip = JSON.parse(JSON.stringify(cca)) as typeof cca;
check(
  "72 custom identity JSON round-trip",
  customRoundTrip?.treatmentKind === "custom" &&
    customRoundTrip.treatmentCustom === "CCA special" &&
    customRoundTrip.treatment == null &&
    customRoundTrip.grade == null
);
const sg8KeyedDeck = calculateDeck(
  {
    ...baseContext,
    facts: deckRefFacts("sg8k"),
    rates: [
      {
        id: "r-sg8",
        rate_type: "material",
        trade: null,
        work_area_type: "deck",
        item_key: "timber.structural_framing.140x45.sg8.h3.2.lm",
        label: "SG8 framing",
        unit: "lm",
        cost_rate: 18.75,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ],
  } as EstimateContext,
  wa("sg8k", "deck", "SG8 keyed rate")
);
check(
  "73 SG8 company rate does not price unknown-grade joists",
  materialReq(sg8KeyedDeck, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
    materialReq(sg8KeyedDeck, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity ===
      42.32
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

console.log(`\n=== CAT-IDENTITY-01 Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
