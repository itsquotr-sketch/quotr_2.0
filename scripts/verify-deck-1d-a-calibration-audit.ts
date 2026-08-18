/**
 * DECK-1D-A — non-production calibration audit check.
 *
 * Confirms estimate behaviour is unchanged and prints DECK-RATE-REF-01
 * legacy vs partial detailed comparison. Does not change calculators.
 *
 * Run: npx tsx scripts/verify-deck-1d-a-calibration-audit.ts
 */
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
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

function materialReq(
  result: { requirements?: readonly { kind: string; componentKey: string }[] },
  componentKey: string
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
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

function ctx(
  workArea: EstimateWorkArea,
  facts: EstimateFact[]
): EstimateContext {
  return {
    ...baseContext,
    confirmedWorkAreas: [workArea],
    facts,
  } as EstimateContext;
}

console.log("=== DECK-1D-A calibration audit (no money change) ===\n");

check(
  "decking.surface REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "deck.labour SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);
check(
  "structural children unregistered / not REQUIREMENT_AUTHORITATIVE",
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
    (key) =>
      getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority !== "REQUIREMENT_AUTHORITATIVE"
  )
);
check("Production SD disabled", isScopeDiscoveryEnabled({}) === false);

const rateWa = wa("rate", "deck", "DECK-RATE-REF-01");
const rateFacts = [
  ...deckRateRef01Facts(rateWa.id),
  fact("deck.substructure_included", rateWa.id, true),
];
const estimate = calculateEstimate(ctx(rateWa, rateFacts));
const deckCalc = calculateDeck(ctx(rateWa, rateFacts), rateWa);

const framing = estimate.lineItems.find((item) => item.label === "Framing/substructure");
const fixings = estimate.lineItems.find((item) => item.label === "Fixings and consumables");
const labour = estimate.lineItems.find((item) => item.label === "Deck labour");
const joist = materialReq(estimate, DECK_JOISTS_COMPONENT_KEY);
const rim = materialReq(estimate, DECK_RIM_FRAMING_COMPONENT_KEY);
const bearer = materialReq(estimate, DECK_BEARERS_COMPONENT_KEY);
const supports = materialReq(estimate, DECK_SUPPORTS_COMPONENT_KEY);
const concrete = materialReq(estimate, DECK_CONCRETE_COMPONENT_KEY);
const pricedChildTotal = round2(
  (joist?.totalCost ?? 0) + (rim?.totalCost ?? 0) + (bearer?.totalCost ?? 0)
);

check("legacy substructure cost 1934.40", framing?.recommendedCost === 1934.4);
check("legacy fixings cost 403.00", fixings?.recommendedCost === 403);
check("PARTIAL PRICED STRUCTURAL CHILD COST 924.71", pricedChildTotal === 924.71);
check("supports unpriced 8 EA", supports?.priced === false && supports.purchaseQuantity === 8);
check("concrete unpriced 0.324", concrete?.priced === false && concrete.purchaseQuantity === 0.324);
check(
  "no structural child money lines",
  estimate.lineItems.every(
    (item) =>
      !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
        item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
      )
  )
);
check(
  "partial coverage note",
  deckCalc.deckSubstructureReconciliation?.commercialNote.includes(
    "PARTIAL PRICED STRUCTURAL CHILD COST"
  ) === true
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
check("Deck golden $48,340 unchanged", Math.round(deck1.recommendedSell) === 48340);

console.log("\n--- DECK-RATE-REF-01 comparison (diagnostic) ---");
console.log(`legacy substructure package cost  ${framing?.recommendedCost}`);
console.log(`legacy fixings cost               ${fixings?.recommendedCost}`);
console.log(`legacy deck labour cost           ${labour?.recommendedCost}`);
console.log(`PARTIAL PRICED STRUCTURAL CHILD   ${pricedChildTotal}`);
console.log(`unpriced supports                 ${supports?.purchaseQuantity} EA`);
console.log(`unpriced concrete                 ${concrete?.purchaseQuantity} m3`);
console.log("status                            PARTIAL_COVERAGE / incomplete variance");
console.log(`estimate sell                     ${Math.round(estimate.recommendedSell)}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
