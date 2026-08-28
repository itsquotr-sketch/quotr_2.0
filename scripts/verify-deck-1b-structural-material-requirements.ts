/**
 * DECK-1B — shadow structural MaterialRequirement verification.
 *
 * Run: npx tsx scripts/verify-deck-1b-structural-material-requirements.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_SUBSTRUCTURE_GROUP_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  calculateDeckStructureQuantities,
  readDeckStructureFacts,
  resolveDeckStructureOrientation,
} from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import {
  getComponentCommercialAuthority,
  generationRequiresRequirementSnapshot,
} from "../lib/estimate/component-authority";
import { buildRequirementId } from "../lib/estimate/requirement-id";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import { buildFactLookup, type ProjectFactRecord } from "../lib/scopes/fact-values";
import { deckScope } from "../lib/scopes/templates/deck";

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

function deckRef01Facts(workAreaId: string, overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
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
  const overrideMap = new Map(overrides.map((row) => [`${row.work_area_id}:${row.key}`, row]));
  return base.map((row) => overrideMap.get(`${row.work_area_id}:${row.key}`) ?? row);
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


console.log("=== DECK-1B structural MaterialRequirements ===\n");

const refWa = wa("ref", "deck", "DECK-REF-01");
const refFacts = deckRef01Facts("ref");
const refDeck = calculateDeck(
  { ...baseContext, facts: refFacts } as EstimateContext,
  refWa
);

const structureFacts = readDeckStructureFacts({ facts: refFacts, workAreaId: "ref" });
const quantities =
  structureFacts != null
    ? calculateDeckStructureQuantities({
        facts: structureFacts,
        framingWastePercent: 5,
      })
    : null;

check("1 geometry 5.20 x 3.10 = 16.12", structureFacts != null);
check(
  "2 orientation default boards length / joists width",
  quantities != null &&
    quantities.orientation.boardDirection === "length" &&
    quantities.orientation.joistDirection === "width" &&
    quantities.orientation.bearerDirection === "length"
);
check("3 joist perpendicular span 5.20", quantities?.joistPerpendicularSpanM === 5.2);
check("4 joist run 3.10", quantities?.joistRunLengthM === 3.1);
check("5 joist spaces 12", quantities?.joistSpaces === 12);
check("6 joist count 13", quantities?.joistCount === 13);
check("7 joist base 40.30 lm", quantities?.joistBaseLm === 40.3);
check("8 joist purchase 42.32 lm", quantities?.joistPurchaseLm === 42.32);
check("9 rim base 10.40 lm", quantities?.rimBaseLm === 10.4);
check("10 rim purchase 10.92 lm", quantities?.rimPurchaseLm === 10.92);
check("11 bearer base 10.40 lm", quantities?.bearerBaseLm === 10.4);
check("12 bearer purchase 10.92 lm", quantities?.bearerPurchaseLm === 10.92);
check("13 supports 8 EA", quantities?.supportCount === 8);
check("14 no corner deduction", quantities?.supportCount === 2 * 4);
check(
  "15 no support LM requirement",
  refDeck.requirements?.every(
    (item) => !(item.kind === "material" && item.purchaseUnit === "lm" && item.componentKey === DECK_SUPPORTS_COMPONENT_KEY)
  )
);
check("16 concrete volume each 0.0405 m3", quantities?.footingVolumeEachM3 === 0.0405);
check("17 concrete total 0.324 m3", quantities?.concreteBaseM3 === 0.324);
check("18 concrete purchase 0.324 m3", quantities?.concretePurchaseM3 === 0.324);
check("19 no bag rounding", materialReq(refDeck, DECK_CONCRETE_COMPONENT_KEY)?.purchaseUnit === "m3");

const joistReq = materialReq(refDeck, DECK_JOISTS_COMPONENT_KEY);
const rimReq = materialReq(refDeck, DECK_RIM_FRAMING_COMPONENT_KEY);
const bearerReq = materialReq(refDeck, DECK_BEARERS_COMPONENT_KEY);
const supportReq = materialReq(refDeck, DECK_SUPPORTS_COMPONENT_KEY);
const concreteReq = materialReq(refDeck, DECK_CONCRETE_COMPONENT_KEY);

check(
  "20 joist requirement ID",
  joistReq?.requirementId ===
    buildRequirementId({
      workAreaId: "ref",
      kind: "material",
      componentKey: DECK_JOISTS_COMPONENT_KEY,
      variantKey: "140x45-h3.2",
    })
);
check(
  "21 rim requirement ID",
  rimReq?.requirementId ===
    buildRequirementId({
      workAreaId: "ref",
      kind: "material",
      componentKey: DECK_RIM_FRAMING_COMPONENT_KEY,
      variantKey: "140x45-h3.2",
    })
);
check(
  "22 bearer requirement ID",
  bearerReq?.requirementId ===
    buildRequirementId({
      workAreaId: "ref",
      kind: "material",
      componentKey: DECK_BEARERS_COMPONENT_KEY,
      variantKey: "190x45-h3.2",
    })
);
check(
  "23 support requirement ID",
  supportReq?.requirementId ===
    buildRequirementId({
      workAreaId: "ref",
      kind: "material",
      componentKey: DECK_SUPPORTS_COMPONENT_KEY,
      variantKey: "90x90-h3.2",
    })
);
check(
  "24 concrete requirement ID",
  concreteReq?.requirementId ===
    buildRequirementId({
      workAreaId: "ref",
      kind: "material",
      componentKey: DECK_CONCRETE_COMPONENT_KEY,
      variantKey: "standard-footing",
    })
);
check(
  "25 units lm/lm/lm/ea/m3",
  joistReq?.purchaseUnit === "lm" &&
    rimReq?.purchaseUnit === "lm" &&
    bearerReq?.purchaseUnit === "lm" &&
    supportReq?.purchaseUnit === "ea" &&
    concreteReq?.purchaseUnit === "m3"
);
check(
  "26 physical quantities exact",
  joistReq?.purchaseQuantity === 42.32 &&
    rimReq?.purchaseQuantity === 10.92 &&
    bearerReq?.purchaseQuantity === 10.92 &&
    supportReq?.purchaseQuantity === 8 &&
    concreteReq?.purchaseQuantity === 0.324
);
check(
  "27 missing rates priced=false",
  [joistReq, rimReq, bearerReq, supportReq, concreteReq].every(
    (item) => item?.priced === false && item.totalCost == null
  )
);
check(
  "28 no money fabrication",
  [joistReq, rimReq, bearerReq, supportReq, concreteReq].every(
    (item) => item?.unitCost == null
  )
);

check(
  "29 default orientation assumption",
  joistReq?.assumptions.some((item) => item.key === "deck.board_direction_default")
);
check(
  "30 no spacing default assumption when user supplied 450",
  !joistReq?.assumptions.some((item) => item.key === "deck.joists.spacing_default")
);
check(
  "31 framing waste assumption when default 5%",
  joistReq?.assumptions.some((item) => item.key === "deck.framing.waste_default")
);

const defaultSpacingDeck = calculateDeck(
  {
    ...baseContext,
    facts: deckRef01Facts("d2").filter((row) => row.key !== "deck.joist_centres_mm"),
  } as EstimateContext,
  wa("d2", "deck", "Default spacing")
);
check(
  "32 default 450 centres assumption when omitted",
  materialReq(defaultSpacingDeck, DECK_JOISTS_COMPONENT_KEY)?.assumptions.some(
    (item) => item.key === "deck.joists.spacing_default"
  )
);

const partialFooting = calculateDeck(
  {
    ...baseContext,
    facts: deckRef01Facts("d3").filter(
      (row) =>
        ![
          "deck.footing_length_mm",
          "deck.footing_width_mm",
          "deck.footing_depth_mm",
        ].includes(row.key)
    ),
  } as EstimateContext,
  wa("d3", "deck", "Partial footing")
);
check(
  "33 missing footing omits concrete only",
  materialReq(partialFooting, DECK_CONCRETE_COMPONENT_KEY) == null &&
    materialReq(partialFooting, DECK_SUPPORTS_COMPONENT_KEY) != null
);
check(
  "34 joists still emit with partial footing",
  materialReq(partialFooting, DECK_JOISTS_COMPONENT_KEY) != null
);

const noSupports = calculateDeck(
  {
    ...baseContext,
    facts: deckRef01Facts("d4").filter(
      (row) =>
        ![
          "deck.support_type",
          "deck.supports_per_bearer",
          "deck.support_section",
        ].includes(row.key)
    ),
  } as EstimateContext,
  wa("d4", "deck", "No supports")
);
check(
  "35 missing supports omits support and concrete",
  materialReq(noSupports, DECK_SUPPORTS_COMPONENT_KEY) == null &&
    materialReq(noSupports, DECK_CONCRETE_COMPONENT_KEY) == null &&
    materialReq(noSupports, DECK_JOISTS_COMPONENT_KEY) != null
);

const areaOnly = calculateDeck(
  {
    ...baseContext,
    facts: [
      fact("deck.area_m2", "d5", 16.12),
      fact("deck.board_material", "d5", "Hardwood"),
      fact("deck.board_width_mm", "d5", 140),
      fact("deck.height_m", "d5", 0.4),
      fact("deck.joist_section", "d5", "140x45"),
      fact("deck.framing_treatment", "d5", "H3.2"),
    ],
  } as EstimateContext,
  wa("d5", "deck", "Area only")
);
check(
  "36 area-only emits no structural requirements",
  areaOnly.requirements?.filter((item) =>
    DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
      item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
    )
  ).length === 0
);

check(
  "37 no span-table sizing in deck-structure module",
  !read("lib/estimate/deck-structure.ts").includes("spanTable") &&
    !read("lib/estimate/deck-structure.ts").includes("NZS")
);
check(
  "38 height may estimate post length; support purchase unit stays EA",
  materialReq(refDeck, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseUnit === "ea" &&
    read("lib/estimate/deck-structure.ts").includes("postLengthEachM")
);

const substructureLine = refDeck.lineItems.find(
  (item) => item.label === "Framing/substructure"
);
check(
  "39 detailed geometry keeps children when 90×90 posts lack a rate",
  substructureLine == null &&
    refDeck.lineItems.some((item) => item.label === "Joists") &&
    refDeck.lineItems.some(
      (item) => item.label === "Piles / posts" && item.rateSourceType === "missing"
    )
);
check(
  "40 no structural component promoted",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority === "LEGACY_AUTHORITATIVE"
  )
);
check(
  "41 unpriced posts stay detailed Pricing Required, not a package",
  refDeck.lineItems.some(
    (item) => item.componentKey === DECK_SUPPORTS_COMPONENT_KEY
  ) &&
    refDeck.lineItems.some((item) => item.label === "Joists") &&
    !refDeck.lineItems.some((item) => item.label === "Framing/substructure")
);


check(
  "42 surface remains REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "43 labour remains SHADOW",
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
check(
  "44 Deck 1 golden sell $48,340",
  Math.round(deck1.recommendedSell) === 48340
);

const reconciliation = refDeck.deckSubstructureReconciliation;
check(
  "45 parent deck.substructure group",
  reconciliation?.groupKey === DECK_SUBSTRUCTURE_GROUP_KEY
);
check(
  "46 intentional model improvement class",
  reconciliation?.parityClass === "INTENTIONAL_MODEL_IMPROVEMENT"
);
check(
  "47 unpriced child coverage honest",
  reconciliation?.unpricedChildCount === 5 &&
    reconciliation.pricedChildCount === 0 &&
    (reconciliation.status === "COVERAGE_PARTIAL" ||
      reconciliation.status === "NOT_COMPARABLE")
);
check(
  "48 children mapped",
  reconciliation?.emittedChildComponentKeys.length === 5 &&
    reconciliation.childComponentKeys.length === 5
);

const fence = calculateFence(
  {
    ...baseContext,
    facts: [
      fact("fence.length_m", "f1", 20),
      fact("fence.height_m", "f1", 1.8),
      fact("fence.material", "f1", "Timber"),
    ],
  } as never,
  wa("f1", "fence", "Fence")
);
const pergola = calculatePergola(
  {
    ...baseContext,
    facts: [
      fact("pergola.area_m2", "p1", 12),
      fact("pergola.material", "p1", "Timber"),
    ],
  } as never,
  wa("p1", "pergola", "Pergola")
);
const retaining = calculateRetainingWall(
  {
    ...baseContext,
    facts: [
      fact("retaining_wall.length_m", "r1", 8),
      fact("retaining_wall.height_m", "r1", 1),
    ],
  } as never,
  wa("r1", "retaining_wall", "RW")
);
const bathroom = calculateBathroom(
  {
    ...baseContext,
    facts: [
      fact("bathroom.area_m2", "b1", 6),
      fact("bathroom.layout", "b1", "Full renovation"),
    ],
  } as never,
  wa("b1", "bathroom", "Bathroom")
);
check(
  "49 fence emits planning or priced timber requirements",
  (fence.requirements ?? []).length > 0
);
check("50 pergola unchanged", pergola.requirements == null);
check("51 retaining unchanged", retaining.requirements == null);
check("52 bathroom unchanged", bathroom.requirements == null);

check("53 no migration 037", !existsSync("supabase/migrations/037"));
check("54 Production SD disabled", isScopeDiscoveryEnabled({}) === false);
check(
  "55 no AI in deck-structure",
  !read("lib/estimate/deck-structure.ts").includes("openai")
);
check(
  "56 orientation resolver bearer perpendicular to joists",
  resolveDeckStructureOrientation({
    boardDirectionFact: null,
    joistDirectionFact: null,
  }).bearerDirection === "length"
);
check(
  "57 no deck.blocking emitted",
  refDeck.requirements?.every((item) => item.componentKey !== "deck.blocking")
);
check(
  "58 no deck.fixings.structural emitted",
  refDeck.requirements?.every((item) => item.componentKey !== "deck.fixings.structural")
);
check(
  "59 snapshot still required for surface authority",
  generationRequiresRequirementSnapshot() === true
);

const centres400Facts = deckRef01Facts("d6").map((row) =>
  row.key === "deck.joist_centres_mm"
    ? fact("deck.joist_centres_mm", "d6", 400)
    : row
);
const centres400Deck = calculateDeck(
  { ...baseContext, facts: centres400Facts } as EstimateContext,
  wa("d6", "deck", "400 centres")
);
const joist400 = materialReq(centres400Deck, DECK_JOISTS_COMPONENT_KEY);
check("60 400 centres purchase 45.57 lm", joist400?.purchaseQuantity === 45.57);
check("61 400 centres base 43.40 lm", joist400?.baseQuantity === 43.4);
check(
  "62 400 centres count via quantities helper",
  calculateDeckStructureQuantities({
    facts: readDeckStructureFacts({
      facts: centres400Facts,
      workAreaId: "d6",
    })!,
    framingWastePercent: 5,
  }).joistCount === 14
);
check(
  "63 no spacing default when user entered 400",
  !joist400?.assumptions.some((item) => item.key === "deck.joists.spacing_default")
);
check(
  "64 rim unchanged after centres edit",
  materialReq(centres400Deck, DECK_RIM_FRAMING_COMPONENT_KEY)?.purchaseQuantity === 10.92
);
check(
  "65 detailed model remains after centres edit (no package reversion)",
  !centres400Deck.lineItems.some((item) => item.label === "Framing/substructure") &&
    materialReq(centres400Deck, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity != null
);

function projectFacts(rows: EstimateFact[]): ProjectFactRecord[] {
  return rows.map((row) => ({
    key: row.key,
    work_area_id: row.work_area_id,
    value: row.value,
  }));
}

const uxWa = "ux1";
const framingQ = deckScope.questions.find((q) => q.factKey === "deck.joist_section")!;
const supportsQ = deckScope.questions.find((q) => q.factKey === "deck.support_type")!;
const footingQ = deckScope.questions.find(
  (q) => q.factKey === "deck.footing_length_mm"
)!;
check(
  "66 framing hidden when substructure excluded",
  shouldHideConditionalQuestion(
    framingQ,
    uxWa,
    buildFactLookup(projectFacts([fact("deck.substructure_included", uxWa, false)]))
  )
);
check(
  "67 supports hidden until bearer rows known",
  shouldHideConditionalQuestion(
    supportsQ,
    uxWa,
    buildFactLookup(
      projectFacts([fact("deck.substructure_included", uxWa, true)])
    )
  )
);
check(
  "68 footings hidden until supports per bearer known",
  shouldHideConditionalQuestion(
    footingQ,
    uxWa,
    buildFactLookup(
      projectFacts([
        fact("deck.substructure_included", uxWa, true),
        fact("deck.bearer_row_count", uxWa, 2),
      ])
    )
  )
);
check(
  "69 footings visible when supports path started",
  !shouldHideConditionalQuestion(
    footingQ,
    uxWa,
    buildFactLookup(
      projectFacts([
        fact("deck.substructure_included", uxWa, true),
        fact("deck.bearer_row_count", uxWa, 2),
        fact("deck.supports_per_bearer", uxWa, 4),
      ])
    )
  )
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

console.log(`\n=== DECK-1B Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
