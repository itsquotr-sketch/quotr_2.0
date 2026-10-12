/**
 * Dunkirk 6.0 × 3.5 m deck: a stated pile count is the support count
 * unless bearer rows and supports per bearer are both confirmed.
 * Run: npx tsx scripts/verify-dunkirk-deck-quantity.ts
 */
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import { concreteCompanyComparison } from "../lib/estimate/deck-productivity";
import { DECK_CONCRETE_PRODUCTIVITY_KEY } from "../lib/estimate/deck-scope-2c";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { unknownCostWithoutClientSell } from "../lib/work-areas/manual-pricing-route";
import { nextWorkspaceScrollTop } from "../lib/ui/scroll-workspace";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { OrganisationRate } from "../components/setup/types";

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

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "deck", value };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return {
    id: "deck",
    type: "deck",
    name: "Deck",
    sort_order: 1,
    status: "confirmed",
  };
}

function ctx(
  facts: EstimateFact[],
  rates: readonly OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "draft", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [{ key: "site_access", value: "restricted" }],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [...rates],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function companyConcrete(hours: number): OrganisationRate {
  return {
    id: "concrete",
    rate_type: "productivity",
    item_key: DECK_CONCRETE_PRODUCTIVITY_KEY,
    label: "concrete",
    unit: "bag",
    cost_rate: hours,
    sell_rate: null,
    source: "calibrated_productivity",
    active: true,
  } as OrganisationRate;
}

const base = [
  fact("deck.length_m", 6),
  fact("deck.width_m", 3.5),
  fact("deck.height_m", 0.7),
  fact("deck.area_m2", 21),
  fact("deck.board_material", "Kwila"),
  fact("deck.board_width_mm", 140),
  fact("deck.substructure_included", true),
  fact("deck.concrete_to_supports", true),
  fact("deck.access_type", "Stair set"),
];

const stated = calculateDeck(
  ctx([...base, fact("deck.pile_or_post_count", 16)], [companyConcrete(0.7)]),
  wa()
);
const spacing = calculateDeck(ctx(base, [companyConcrete(0.7)]), wa());
const confirmed = calculateDeck(
  ctx(
    [
      ...base,
      fact("deck.pile_or_post_count", 16),
      fact("deck.bearer_row_count", 2),
      fact("deck.supports_per_bearer", 2),
    ],
    [companyConcrete(0.7)]
  ),
  wa()
);

function line(result: ReturnType<typeof calculateDeck>, label: string) {
  return result.lineItems.find((item) => item.label === label);
}

const piles = line(stated, "Piles / posts");
const install = line(stated, "Pile/post installation");
const holes = line(stated, "Hole excavation");
const bags = stated.lineItems.find((item) => item.unit === "bag" && item.category === "materials");
const place = line(stated, "Concrete placement");

check(
  "pile material is purchased from the stated 16",
  piles?.quantity === 19.2 && (piles?.notes ?? "").includes("16"),
  `${piles?.quantity} ${piles?.notes ?? ""}`
);
check("stated 16 install", install?.quantity === 16, String(install?.quantity));
check("stated 16 holes", holes?.quantity === 16 && holes.unit === "hole");
check("stated 40 bags", bags?.quantity === 40, String(bags?.quantity));
check("stated place quantity 40", place?.quantity === 40, String(place?.quantity));
check(
  "stated place hours 40 × 0.7 × 1.10",
  place?.labourHours === 30.8,
  String(place?.labourHours)
);
check(
  "company rate is named and benchmark is not applied",
  (place?.notes ?? "").includes("company rate of 0.7 h/bag") &&
    (place?.notes ?? "").includes("not the rate applied")
);
check(
  "spacing without a stated count stays 15",
  line(spacing, "Pile/post installation")?.quantity === 15 &&
    spacing.lineItems.find((item) => item.unit === "bag" && item.category === "materials")
      ?.quantity === 38
);
check(
  "confirmed layout overrides the stated count",
  line(confirmed, "Pile/post installation")?.quantity === 4 &&
    confirmed.assumptions.some((text) => text.includes("stated count of 16"))
);
check("holes stay out of the known total", holes?.includedInTotal === false);
check("holes have no assessed cost", holes?.recommendedCost === 0 && holes?.recommendedSell === 0);

const holeNotes = holes ? buildLineItemNotes(holes) : null;
const priced = calculateAuthoritativeFieldsFromEstimateLine({
  category: "labour",
  recommended_cost: 0,
  recommended_sell: 0,
  notes: holeNotes,
});
check("pricing cost is unknown", priced.ok && priced.fields.costKnown === false);
check(
  "quote stays blocked without a client sell",
  priced.ok &&
    unknownCostWithoutClientSell({
      visible_on_quote: true,
      cost_known: priced.fields.costKnown,
      total_sell: 0,
    })
);
check(
  "a positive client sell clears the block",
  priced.ok &&
    !unknownCostWithoutClientSell({
      visible_on_quote: true,
      cost_known: priced.fields.costKnown,
      total_sell: 120,
    })
);
check(
  "benchmark concrete has no company comparison",
  concreteCompanyComparison({
    hoursPerUnit: 0.06666666666666667,
    sourceType: "benchmark",
    sourceLabel: "Quotr benchmark",
  } as never) === ""
);

check(
  "heading already in the workspace does not scroll",
  nextWorkspaceScrollTop({
    containerScrollTop: 40,
    containerTop: 80,
    containerHeight: 600,
    targetTop: 120,
    viewportHeight: 800,
    bottomOverlay: 72,
  }) === null
);
check(
  "heading below the workspace scrolls only that container",
  nextWorkspaceScrollTop({
    containerScrollTop: 0,
    containerTop: 80,
    containerHeight: 600,
    targetTop: 900,
    viewportHeight: 800,
    bottomOverlay: 72,
  }) === 812
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
