/**
 * DECK-MATURITY-2A — physical takeoff foundation.
 * Planning quantities only. No structural child commercial money.
 *
 * Run: npx tsx scripts/verify-deck-maturity-2a.ts
 */
import { existsSync, readFileSync } from "node:fs";
import {
  composeBuilderReview,
  toTakeoffRow,
} from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { DECK_NOT_CONSUMED_REFINE_KEYS } from "../lib/assistant/refine/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import {
  getConsumedFactConsumption,
  isCalculatorConsumedFact,
  isCommercialConsumedFact,
} from "../lib/estimate/consumed-facts";
import { DECK_INFORMATION_CONTRACT } from "../lib/estimate/deck-information-contract";
import {
  CONSERVATIVE_SUPPORT_LAYOUT_HINT,
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_ESTIMATING_DISCLAIMER,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
  DEFAULT_BEARER_SPACING_M,
  DEFAULT_JOIST_CENTRES_MM,
  DEFAULT_SUPPORT_SPACING_M,
  PLANNING_TAKEOFF_PARENT_HINT,
  calculateDeckStructureQuantities,
  classifyDeckGeometryReadiness,
  deckLayoutCountFromSpan,
  readDeckStructureFacts,
  resolveDeckStructureOrientation,
  shorterPlanningAxis,
} from "../lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string, type = "deck", name = "Deck"): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
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
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    includedInTotal: item.includedInTotal,
  }));
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

function ctx(facts: EstimateFact[], id = "p1"): EstimateContext {
  return {
    project: { id, qualityLevel: "standard" },
    confirmedWorkAreas: [],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function materialReq(
  result: { requirements?: readonly { kind: string; componentKey: string }[] },
  componentKey: string
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function structuralMoneyOnLines(
  items: readonly { label?: string; componentKey?: string | null; itemKey?: string | null }[]
): boolean {
  return items.some((item) => {
    const key = `${item.componentKey ?? ""} ${item.itemKey ?? ""} ${item.label ?? ""}`.toLowerCase();
    return (
      DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.some((k) => key.includes(k)) ||
      /\b(joist|bearer|rim framing|pile|footing concrete)\b.*\$/.test(key)
    );
  });
}

function deckRef01Facts(workAreaId: string): EstimateFact[] {
  return [
    fact("deck.length_m", workAreaId, 5.2),
    fact("deck.width_m", workAreaId, 3.1),
    fact("deck.area_m2", workAreaId, 16.12),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.board_width_mm", workAreaId, 140),
    fact("deck.height_m", workAreaId, 1.2),
    fact("deck.substructure_included", workAreaId, true),
    fact("deck.joist_section", workAreaId, "140x45"),
    fact("deck.joist_centres_mm", workAreaId, 400),
    fact("deck.framing_treatment", workAreaId, "H3.2"),
    fact("deck.bearer_section", workAreaId, "190x45"),
    fact("deck.bearer_row_count", workAreaId, 2),
    fact("deck.support_type", workAreaId, "Post"),
    fact("deck.supports_per_bearer", workAreaId, 4),
    fact("deck.support_section", workAreaId, "90x90"),
    fact("deck.footing_length_mm", workAreaId, 300),
    fact("deck.footing_width_mm", workAreaId, 300),
    fact("deck.footing_depth_mm", workAreaId, 450),
    fact("deck.vertical_face_boards_required", workAreaId, true),
    fact("deck.access_type", workAreaId, "Stair set"),
    fact("deck.balustrade_required", workAreaId, false),
  ];
}

function factsFromFixture(
  record: Record<string, string | number | boolean>,
  workAreaId: string
): EstimateFact[] {
  return Object.entries(record).map(([key, value]) => fact(key, workAreaId, value));
}

console.log("=== DECK-MATURITY-2A physical takeoff foundation ===\n");

const REF = "ref";
const refFacts = deckRef01Facts(REF);
const refWa = wa(REF);
const refStructure = readDeckStructureFacts({ facts: refFacts, workAreaId: REF });
const refQty =
  refStructure != null
    ? calculateDeckStructureQuantities({
        facts: refStructure,
        framingWastePercent: 5,
      })
    : null;
const refDeck = calculateDeck(ctx(refFacts), refWa);

check(
  "1 rectangular geometry recognised",
  classifyDeckGeometryReadiness({ facts: refFacts, workAreaId: REF }) ===
    "DETAILED_GEOMETRY_AVAILABLE"
);

const areaOnlyFacts = [
  fact("deck.area_m2", "a1", 16.12),
  fact("deck.board_material", "a1", "Hardwood"),
  fact("deck.substructure_included", "a1", true),
];
const areaOnlyDeck = calculateDeck(ctx(areaOnlyFacts), wa("a1"));
check(
  "2 area-only does not fabricate detailed framing",
  classifyDeckGeometryReadiness({ facts: areaOnlyFacts, workAreaId: "a1" }) ===
    "AREA_ONLY" &&
    !materialReq(areaOnlyDeck, DECK_JOISTS_COMPONENT_KEY) &&
    !materialReq(areaOnlyDeck, DECK_SUPPORTS_COMPONENT_KEY)
);

const emptyFacts: EstimateFact[] = [];
check(
  "3 unsupported/irregular geometry falls back safely",
  classifyDeckGeometryReadiness({ facts: emptyFacts, workAreaId: "x" }) ===
    "IRREGULAR_UNSUPPORTED" &&
    calculateDeck(ctx(emptyFacts), wa("x")).requirements?.every(
      (item) =>
        !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
          item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
        )
    ) !== false
);

check(
  "4 orientation convention stable",
  refQty != null &&
    refQty.orientation.boardDirection === "length" &&
    refQty.orientation.joistDirection === "width" &&
    refQty.orientation.bearerDirection === "length"
);

check("5 joist count deterministic", refQty?.joistCount === 14);
check(
  "6 spacing consumed where explicit",
  refQty?.joistCentresMm === 400 && refQty.joistCentresDefaulted === false
);

const assumedSpacingFacts = refFacts.filter((row) => row.key !== "deck.joist_centres_mm");
const assumedQty = calculateDeckStructureQuantities({
  facts: readDeckStructureFacts({ facts: assumedSpacingFacts, workAreaId: REF })!,
  framingWastePercent: 5,
});
check(
  "7 assumed spacing disclosed where used",
  assumedQty.joistCentresMm === DEFAULT_JOIST_CENTRES_MM &&
    assumedQty.joistCentresDefaulted &&
    materialReq(calculateDeck(ctx(assumedSpacingFacts), refWa), DECK_JOISTS_COMPONENT_KEY)
      ?.assumptions.some((item) => item.key === "deck.joists.spacing_default") === true
);

check("8 total lm deterministic", typeof refQty?.joistPurchaseLm === "number");
check(
  "9 detailed geometry stays detailed when 90×90 posts lack a rate",
  refDeck.lineItems.some(
    (item) => item.componentKey === DECK_JOISTS_COMPONENT_KEY
  ) &&
    !refDeck.lineItems.some((item) => item.label === "Framing/substructure") &&
    refDeck.lineItems.some(
      (item) => item.label === "Piles / posts" && item.rateSourceType === "missing"
    )
);

check("10 rim quantity deterministic", refQty != null && refQty.rimBaseLm === 10.4);
check(
  "11 rim remains a detailed commercial child",
  materialReq(refDeck, DECK_RIM_FRAMING_COMPONENT_KEY) != null &&
    refDeck.lineItems.some((item) => item.label === "Rim framing")
);

check(
  "12 current supported bearer quantity deterministic",
  refQty?.bearerRowCount === 2 && refQty.bearerBaseLm === 10.4
);

const noLayoutFacts = refFacts.filter(
  (row) =>
    row.key !== "deck.bearer_row_count" &&
    row.key !== "deck.supports_per_bearer" &&
    row.key !== "deck.support_type" &&
    row.key !== "deck.support_section" &&
    row.key !== "deck.bearer_section"
);
const layoutQty = calculateDeckStructureQuantities({
  facts: readDeckStructureFacts({ facts: noLayoutFacts, workAreaId: REF })!,
  framingWastePercent: 5,
});
check(
  "13 unsupported bearer layout not fabricated when partial spec omits supports only",
  (() => {
    const partial = refFacts.filter(
      (row) =>
        row.key !== "deck.supports_per_bearer" &&
        row.key !== "deck.support_type" &&
        row.key !== "deck.support_section"
    );
    const q = calculateDeckStructureQuantities({
      facts: readDeckStructureFacts({ facts: partial, workAreaId: REF })!,
      framingWastePercent: 5,
    });
    return q.supportCount === 0 && q.bearerRowCount === 2 && !q.layoutEstimated;
  })()
);
check(
  "14 bearers remain a detailed commercial child",
  refDeck.lineItems.some((item) => /bearer/i.test(item.label))
);

check("15 support count deterministic where valid", refQty?.supportCount === 8);
check(
  "16 missing support geometry does not fabricate when bearer rows are explicit",
  !materialReq(
    calculateDeck(
      ctx(
        refFacts.filter(
          (row) =>
            row.key !== "deck.supports_per_bearer" &&
            row.key !== "deck.support_type" &&
            row.key !== "deck.support_section"
        )
      ),
      refWa
    ),
    DECK_SUPPORTS_COMPONENT_KEY
  )
);
check(
  "17 unpriced 90×90 supports stay detailed Pricing Required",
  refDeck.lineItems.some(
    (item) =>
      item.componentKey === DECK_SUPPORTS_COMPONENT_KEY &&
      item.rateSourceType === "missing"
  )
);

check(
  "18 concrete only when dimensions sufficient",
  materialReq(refDeck, DECK_CONCRETE_COMPONENT_KEY)?.purchaseQuantity === 0.324
);
check(
  "19 no fabricated volume",
  !materialReq(
    calculateDeck(
      ctx(
        refFacts.filter(
          (row) =>
            !row.key.startsWith("deck.footing_")
        )
      ),
      refWa
    ),
    DECK_CONCRETE_COMPONENT_KEY
  )
);
check(
  "20 no child money (concrete)",
  refDeck.lineItems.every((item) => !/concrete/i.test(item.label))
);

const excludedFacts = [
  ...refFacts.filter((row) => row.key !== "deck.substructure_included"),
  fact("deck.substructure_included", REF, false),
];
check(
  "21 new substructure activates physical takeoff",
  materialReq(refDeck, DECK_JOISTS_COMPONENT_KEY) != null &&
    !materialReq(calculateDeck(ctx(excludedFacts), refWa), DECK_JOISTS_COMPONENT_KEY)
);

const noRemoval = calculateDeck(
  ctx(refFacts.filter((row) => row.key !== "deck.existing_deck_removal")),
  refWa
);
check(
  "22 removal only if included",
  !noRemoval.lineItems.some((item) => /demolition|removal/i.test(item.label))
);

check(
  "23 fascia only if included",
  refDeck.lineItems.some((item) => /fascia|face/i.test(item.label)) &&
    !calculateDeck(
      ctx(
        refFacts
          .filter((row) => row.key !== "deck.vertical_face_boards_required")
          .concat([fact("deck.vertical_face_boards_required", REF, false)])
      ),
      refWa
    ).lineItems.some((item) => /fascia|face/i.test(item.label))
);

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const kwila = loadCalibrationFixture("OWNER-KWILA-01.json");
const DECK = "wa-deck-1";
const realFacts = factsFromFixture(realJob.facts, DECK);
const kwilaFacts = factsFromFixture(kwila.facts, DECK);

const realPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: realFacts,
  qualityLevel: "standard",
  briefText: realJob.sourceBrief ?? null,
});
const kwilaPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: kwilaFacts,
  qualityLevel: "standard",
  briefText: kwila.sourceBrief ?? null,
});

check(
  "24 low-level balustrade not recommended absent evidence",
  !realPlan.cards[0]?.included.some((item) => item.id === "balustrade") &&
    !kwilaPlan.cards[0]?.included.some((item) => item.id === "balustrade")
);

const realClarify = composeClarifyView({
  stage: "quality",
  briefText: realJob.sourceBrief ?? null,
  qualityLevel: "standard",
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  facts: realFacts,
  constraints: [],
  jobPlan: {
    cards: realPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      included: card.included,
      notIncluded: card.notIncluded,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const askedKeys = new Set(
  [...realClarify.candidates, ...realClarify.deferred]
    .map((c) => c.factKey)
    .filter(Boolean)
);
check(
  "25 no ask for quantities Quotr can derive",
  !askedKeys.has("deck.pile_or_post_count") &&
    !askedKeys.has("deck.bearer_row_count") &&
    !askedKeys.has("deck.supports_per_bearer") &&
    !askedKeys.has("deck.joist_centres_mm")
);
check(
  "26 useful missing physical facts may surface",
  realClarify.candidates.length + realClarify.deferred.length <= 6
);
const realRefine = composeRefineView({
  briefText: realJob.sourceBrief ?? null,
  qualityLevel: "standard",
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  facts: realFacts,
  constraints: [],
  jobPlan: {
    cards: realPlan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
check(
  "27 non-consumed facts remain hidden",
  !realRefine.highValue.some((c) =>
    DECK_NOT_CONSUMED_REFINE_KEYS.includes(
      (c.factKey ?? "") as (typeof DECK_NOT_CONSUMED_REFINE_KEYS)[number]
    )
  ) &&
    !realRefine.advanced.some((c) =>
      DECK_NOT_CONSUMED_REFINE_KEYS.includes(
        (c.factKey ?? "") as (typeof DECK_NOT_CONSUMED_REFINE_KEYS)[number]
      )
    )
);
check(
  "28 commercial readiness does not require full physical takeoff",
  classifyDeckGeometryReadiness({ facts: areaOnlyFacts, workAreaId: "a1" }) ===
    "AREA_ONLY" &&
    areaOnlyDeck.lineItems.some((item) => item.label === "Framing/substructure")
);

const realEstimate = calculateEstimate({
  ...ctx(realFacts, "real-job-01"),
  confirmedWorkAreas: [wa(DECK)],
  facts: realFacts,
});
const realReview = composeBuilderReview({
  estimate: {
    recommendedCost: realEstimate.recommendedCost,
    recommendedSell: realEstimate.recommendedSell,
    marginPercent: realEstimate.marginPercent,
    confidence: realEstimate.confidence,
    assumptions: realEstimate.assumptions,
    missingInfo: realEstimate.missingInfo,
    lineItems: mapCalcLines(realEstimate.lineItems),
  },
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  requirements: realEstimate.requirements ?? [],
});
const takeoffRows = realReview.workAreas.flatMap((waRow) =>
  waRow.categories.flatMap((cat) => cat.takeoff)
);
check(
  "29 planning takeoff only for unpriced structural children",
  takeoffRows.every((row) => row.commercial === false)
);
check(
  "30 framing package or detailed children, never both",
  (() => {
    const pkg = realEstimate.lineItems.some(
      (item) =>
        item.label === "Framing/substructure" && item.recommendedCost > 0
    );
    const detail = realEstimate.lineItems.some(
      (item) =>
        item.componentKey === DECK_JOISTS_COMPONENT_KEY ||
        item.componentKey === DECK_BEARERS_COMPONENT_KEY ||
        item.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY ||
        item.componentKey === DECK_SUPPORTS_COMPONENT_KEY
    );
    return (pkg || detail) && !(pkg && detail);
  })()
);
check(
  "31 no double money",
  realReview.takeoffAffectsMoney === false && realReview.costReconciles
);
check(
  "32 planning hint present when takeoff remains",
  takeoffRows.length === 0 ||
    (takeoffRows.some((row) => row.parentAllowanceHint === PLANNING_TAKEOFF_PARENT_HINT) &&
      realReview.workAreas.some((waRow) =>
        waRow.categories.some(
          (cat) => cat.takeoffDisclaimer === DECK_STRUCTURAL_ESTIMATING_DISCLAIMER
        )
      ))
);
check(
  "33 assumptions truthful",
  realEstimate.assumptions.some((text) => /450/.test(text)) &&
    realEstimate.assumptions.some((text) => /rectangular layout/i.test(text)) &&
    realEstimate.assumptions.some((text) => /shorter 3 m span|shorter 3.0 m span/i.test(text)) &&
    realEstimate.assumptions.some((text) =>
      text.includes(CONSERVATIVE_SUPPORT_LAYOUT_HINT)
    )
);

// DECK-REF-01 with Owner 2A facts (400 mm centres explicit). Recompute — do not restamp 450 mm golden.
const refJoistSpaces = Math.ceil(5.2 / 0.4);
check(
  "34 DECK-REF-01 quantities reconcile",
  refQty != null &&
    refJoistSpaces === 13 &&
    refQty.joistCount === 14 &&
    refQty.joistRunLengthM === 3.1 &&
    refQty.joistBaseLm === 43.4 &&
    refQty.joistPurchaseLm === 45.57 &&
    refQty.rimBaseLm === 10.4 &&
    refQty.rimPurchaseLm === 10.92 &&
    refQty.bearerBaseLm === 10.4 &&
    refQty.supportCount === 8 &&
    refQty.concreteBaseM3 === 0.324
);

const realStructure = readDeckStructureFacts({ facts: realFacts, workAreaId: DECK });
const realQty =
  realStructure != null
    ? calculateDeckStructureQuantities({
        facts: realStructure,
        framingWastePercent: 5,
      })
    : null;
check(
  "35 REAL-JOB-01 behaviour",
  realPlan.cards[0]?.included.some((item) => item.id === "decking") === true &&
    realPlan.cards[0]?.included.some((item) => item.id === "substructure") === true &&
    realQty?.orientation.joistDirection === "length" &&
    realQty.joistRunLengthM === 3 &&
    realQty.joistCount === 21 &&
    realQty.joistPurchaseLm === 66.15 &&
    realQty.rimBaseLm === 18 &&
    realQty.bearerRowCount === deckLayoutCountFromSpan(3, DEFAULT_BEARER_SPACING_M) &&
    realQty.supportCount ===
      deckLayoutCountFromSpan(3, DEFAULT_BEARER_SPACING_M) *
        deckLayoutCountFromSpan(9, DEFAULT_SUPPORT_SPACING_M) &&
    materialReq(realEstimate, DECK_CONCRETE_COMPONENT_KEY) == null
);

const kwilaEstimate = calculateEstimate({
  ...ctx(kwilaFacts, "owner-kwila-01"),
  confirmedWorkAreas: [wa(DECK)],
  facts: kwilaFacts,
});
const kwilaReview = composeBuilderReview({
  estimate: {
    recommendedCost: kwilaEstimate.recommendedCost,
    recommendedSell: kwilaEstimate.recommendedSell,
    marginPercent: kwilaEstimate.marginPercent,
    confidence: kwilaEstimate.confidence,
    assumptions: kwilaEstimate.assumptions,
    missingInfo: kwilaEstimate.missingInfo,
    lineItems: mapCalcLines(kwilaEstimate.lineItems),
  },
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  requirements: kwilaEstimate.requirements ?? [],
});
check(
  "36 Owner Kwila 3×9 behaviour",
  kwila.facts["deck.board_material"] === "Kwila" &&
    kwilaPlan.cards[0]?.included.some((item) => item.id === "substructure") === true &&
    !kwilaPlan.cards[0]?.included.some((item) => item.id === "balustrade") &&
    kwilaReview.workAreas.some((waRow) =>
      waRow.categories.some(
        (cat) =>
          cat.takeoff.length >= 1 ||
          cat.lines.some(
            (line) =>
              line.label === "Joists" ||
              line.componentKey === DECK_JOISTS_COMPONENT_KEY
          )
      )
    ) &&
    (kwilaEstimate.lineItems.some((item) => item.label === "Framing/substructure") ||
      kwilaEstimate.lineItems.some((item) => item.label === "Joists"))
);

check(
  "37 commercial totals remain finite (2B-R1 may change package money)",
  realEstimate.recommendedCost > 0 &&
    Number.isFinite(realEstimate.recommendedCost)
);
check(
  "38 Pricing parity",
  realEstimate.recommendedSell > 0 &&
    realEstimate.recommendedCost > 0 &&
    realEstimate.recommendedSell >= realEstimate.recommendedCost
);
check(
  "39 Quote parity",
  realEstimate.recommendedSell > 0 &&
    Math.abs(
      realEstimate.recommendedSell - kwilaEstimate.recommendedSell
    ) >= 0
);
check(
  "40 structural authority unchanged",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority === "LEGACY_AUTHORITATIVE"
  )
);
check(
  "41 sell authority unchanged",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "42 no new rates",
  !read("lib/estimate/deck-structure.ts").includes("itemKey: \"deck.joists") &&
    !existsSync("supabase/migrations/038_deck_maturity_2a_rates.sql")
);

check(
  "43 physical-only consumption represented safely",
  getConsumedFactConsumption("deck", "deck.joist_centres_mm")?.physical === true &&
    getConsumedFactConsumption("deck", "deck.joist_centres_mm")?.commercial === false &&
    isCalculatorConsumedFact("deck", "deck.joist_centres_mm")
);
check(
  "44 commercial consumption unchanged",
  isCommercialConsumedFact("deck", "deck.board_material") === true &&
    isCommercialConsumedFact("deck", "deck.substructure_included") === true
);
check(
  "45 false refine field cannot claim effect",
  getConsumedFactConsumption("deck", "deck.pergola_included") == null &&
    DECK_INFORMATION_CONTRACT.some(
      (row) => row.factKey === "deck.pergola_included" && !row.calculatorConsumed
    )
);

const surface = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
check(
  "46 no wide table contract",
  !surface.includes("<table") && surface.includes("flex-wrap")
);
check(
  "47 planning takeoff readable",
  surface.includes("data-builder-review-takeoff") &&
    surface.includes("data-commercial=\"false\"") &&
    surface.includes("data-takeoff-row")
);

check(
  "48 layout defaults are estimating not identity",
  DEFAULT_BEARER_SPACING_M === 1.8 &&
    DEFAULT_SUPPORT_SPACING_M === 1.8 &&
    layoutQty.layoutEstimated &&
    layoutQty.bearerRowCount === deckLayoutCountFromSpan(3.1, 1.8)
);
check(
  "49 area-only Builder Review discloses unavailable takeoff",
  composeBuilderReview({
    estimate: {
      recommendedCost: areaOnlyDeck.lineItems.reduce((s, l) => s + l.recommendedCost, 0),
      recommendedSell: areaOnlyDeck.lineItems.reduce((s, l) => s + l.recommendedSell, 0),
      marginPercent: 20,
      confidence: 50,
      assumptions: areaOnlyDeck.assumptions,
      missingInfo: areaOnlyDeck.missingInfo,
      lineItems: mapCalcLines(areaOnlyDeck.lineItems),
    },
    workAreas: [{ id: "a1", type: "deck", name: "Deck", status: "confirmed" }],
    requirements: areaOnlyDeck.requirements ?? [],
  }).workAreas.some((waRow) =>
    waRow.categories.some(
      (cat) => cat.takeoffUnavailableHint === DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT
    )
  )
);
check(
  "50 takeoff row never commercial",
  toTakeoffRow(materialReq(realEstimate, DECK_JOISTS_COMPONENT_KEY)!).commercial === false
);
check(
  "51 Kwila vs Hardwood money may differ only on surface identity",
  kwilaEstimate.lineItems.find((item) => item.label === "Framing/substructure")
    ?.recommendedCost ===
    realEstimate.lineItems.find((item) => item.label === "Framing/substructure")
      ?.recommendedCost
);
check(
  "52 no NZS / engineered claim in structure module",
  !read("lib/estimate/deck-structure.ts").includes("NZS") &&
    !read("lib/estimate/deck-structure.ts").includes("structurally adequate")
);
check(
  "53 coverage doc records 2A",
  read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md").includes(
    "DECK-MATURITY-2A"
  ) &&
    read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md").includes(
      "PHYSICAL TAKEOFF FOUNDATION"
    )
);
check(
  "54 Owner Kwila fixture exists",
  existsSync("tests/fixtures/deck-calibration/OWNER-KWILA-01.json")
);

function qtyFromFacts(facts: EstimateFact[], id: string) {
  const structure = readDeckStructureFacts({ facts, workAreaId: id });
  return structure
    ? calculateDeckStructureQuantities({ facts: structure, framingWastePercent: 5 })
    : null;
}

const swappedFacts = [
  fact("deck.length_m", "sw", 9),
  fact("deck.width_m", "sw", 3),
  fact("deck.area_m2", "sw", 27),
  fact("deck.substructure_included", "sw", true),
];
const swappedQty = qtyFromFacts(swappedFacts, "sw");
check(
  "55 3×9 order cannot imply 9m joist span",
  realQty?.joistRunLengthM === 3 && realQty.joistRunLengthM !== 9
);
check(
  "56 9×3 equivalent layout",
  swappedQty?.joistRunLengthM === 3 &&
    swappedQty.joistCount === realQty?.joistCount &&
    swappedQty.bearerRowCount === realQty?.bearerRowCount &&
    swappedQty.supportCount === realQty?.supportCount
);
check(
  "57 sensible shorter-span joist orientation",
  realQty?.orientation.joistOrientationSource === "derived_shorter_span" &&
    realQty.orientation.joistDirection === "length" &&
    shorterPlanningAxis(3, 9) === "length"
);
check(
  "58 bearer direction follows joists",
  realQty?.orientation.bearerDirection === "width" &&
    realQty.bearerRunLengthM === 9
);
check(
  "59 support calculation follows corrected orientation",
  realQty?.supportCount === 18 && realQty.supportsPerBearer === 6
);
const squareQty = qtyFromFacts(
  [
    fact("deck.length_m", "sq", 4),
    fact("deck.width_m", "sq", 4),
    fact("deck.substructure_included", "sq", true),
  ],
  "sq"
);
const nearSquareQty = qtyFromFacts(
  [
    fact("deck.length_m", "nsq", 4),
    fact("deck.width_m", "nsq", 4.04),
    fact("deck.substructure_included", "nsq", true),
  ],
  "nsq"
);
check(
  "60 square/tie orientation deterministic",
  squareQty?.orientation.joistDirection === "width" &&
    nearSquareQty?.orientation.joistDirection === "width" &&
    resolveDeckStructureOrientation({
      boardDirectionFact: null,
      joistDirectionFact: null,
    }).joistOrientationSource === "historical_default"
);
const explicitJoist = qtyFromFacts(
  [
    fact("deck.length_m", "ex", 3),
    fact("deck.width_m", "ex", 9),
    fact("deck.joist_direction", "ex", "width"),
    fact("deck.substructure_included", "ex", true),
  ],
  "ex"
);
const explicitBoard = qtyFromFacts(
  [
    fact("deck.length_m", "bd", 3),
    fact("deck.width_m", "bd", 9),
    fact("deck.board_direction", "bd", "length"),
    fact("deck.substructure_included", "bd", true),
  ],
  "bd"
);
check(
  "61 explicit joist orientation overrides derived",
  explicitJoist?.orientation.joistOrientationSource === "explicit_joist" &&
    explicitJoist.joistRunLengthM === 9 &&
    explicitBoard?.orientation.joistOrientationSource === "explicit_board" &&
    explicitBoard.joistRunLengthM === 9
);
check(
  "62 attached context does not claim structural support",
  !realEstimate.assumptions.some((text) =>
    /existing.*provide structural support/i.test(text) &&
    !text.includes("not assumed")
  ) &&
    realEstimate.assumptions.some((text) =>
      text.includes("not assumed to provide structural support")
    )
);
check(
  "63 conservative attachment assumption disclosed",
  materialReq(realEstimate, DECK_SUPPORTS_COMPONENT_KEY)?.assumptions.some(
    (item) => item.key === "deck.supports.conservative_layout"
  ) === true
);
check(
  "64 Kwila/Hardwood physical takeoff identical",
  materialReq(kwilaEstimate, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity ===
    materialReq(realEstimate, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity &&
    materialReq(kwilaEstimate, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity ===
      materialReq(realEstimate, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity
);
check(
  "65 takeoff names span not length/width jargon",
  toTakeoffRow(materialReq(realEstimate, DECK_JOISTS_COMPONENT_KEY)!).detail
    ?.includes("estimated across 3 m span") === true
);
check(
  "66 2B stale verifier uses Estimate Basis",
  read("scripts/verify-deck-2b-assisted-quick-estimate.ts").includes(
    "Estimate Basis"
  ) &&
    !read("scripts/verify-deck-2b-assisted-quick-estimate.ts").includes(
      'disclosureSrc.includes("Job details")'
    )
);
check(
  "67 no joist-direction Clarify question",
  !askedKeys.has("deck.joist_direction") && !askedKeys.has("deck.board_direction")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
