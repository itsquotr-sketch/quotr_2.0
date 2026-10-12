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
import {
  deckStatedCountConflict,
  deckStatedCountConflictFromPersisted,
  quoteCreationDecision,
} from "../lib/estimate/deck-stated-count-guard";
import { projectEstimateOverview } from "../lib/assistant/presentation/estimate-overview";
import { deriveProjectWorkflow } from "../lib/projects/workflow-orientation";
import {
  estimateStatusText,
  pricingLockReason,
} from "../lib/projects/project-section-nav";
import {
  formatProfitabilityDisplay,
  PROFITABILITY_UNAVAILABLE_LABEL,
} from "../lib/financial-presentation/format";
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
  ctx(
    [
      ...base,
      fact("deck.pile_or_post_count", 16),
      fact("deck.hole_shape", "circular"),
      fact("deck.hole_diameter_mm", 350),
      fact("deck.hole_depth_mm", 600),
      fact("deck.hole_ground", "ordinary"),
      fact("deck.hole_method", "hand"),
    ],
    [companyConcrete(0.7)]
  ),
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
check(
  "excavation, post installation, and concrete placement are three lines",
  install?.componentKey === "deck.posts.install" &&
    holes?.componentKey === "deck.hole.excavate" &&
    place?.componentKey === "deck.concrete.place"
);
check(
  "stated 16 holes are 8.8 person-hours at the $60 fallback",
  holes?.includedInTotal !== false &&
    holes?.labourHours === 8.8 &&
    holes?.costRate === 60 &&
    holes?.recommendedCost === 528 &&
    holes?.recommendedSell === 660,
  `hours=${holes?.labourHours} cost=${holes?.recommendedCost} sell=${holes?.recommendedSell} rate=${holes?.costRate}`
);
const spoil = line(stated, "Post-hole spoil destination");
check(
  "unknown spoil stays Pricing Required and out of the total",
  spoil?.includedInTotal === false &&
    spoil?.rateSourceType === "missing" &&
    spoil?.quantity === 0.924 &&
    (spoil?.recommendedCost ?? 0) === 0
);
const holeNotes = spoil ? buildLineItemNotes(spoil) : null;
const priced = calculateAuthoritativeFieldsFromEstimateLine({
  category: "materials",
  recommended_cost: 0,
  recommended_sell: 0,
  notes: holeNotes,
});
check("spoil pricing cost is unknown", priced.ok && priced.fields.costKnown === false);
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
check(
  "observed desktop settle leaves the heading 8px inside the workspace",
  nextWorkspaceScrollTop({
    containerScrollTop: 120,
    containerTop: 288,
    containerHeight: 700,
    targetTop: 296,
    viewportHeight: 900,
    bottomOverlay: 0,
  }) === null
);
check(
  "short phone viewport keeps the heading above the bottom navigation",
  nextWorkspaceScrollTop({
    containerScrollTop: 0,
    containerTop: 140,
    containerHeight: 520,
    targetTop: 640,
    viewportHeight: 700,
    bottomOverlay: 72,
  }) === 492
);

const staleLines = [
  { componentKey: "deck.posts.install", label: "Pile/post installation", quantity: 15, unit: "ea" },
  { componentKey: "deck.hole.excavate", label: "Hole excavation", quantity: 15, unit: "hole" },
  { componentKey: "deck.concrete.bags", label: "Post-hole concrete", quantity: 38, unit: "bag" },
  { componentKey: "deck.supports", label: "Piles / posts", quantity: 18, unit: "lm" },
  { componentKey: "deck.concrete.place", label: "Concrete placement", quantity: 38, unit: "bag", labourHours: 29.26 },
];
const conflict = deckStatedCountConflict({
  facts: [
    fact("deck.pile_or_post_count", 16),
    fact("deck.substructure_included", true),
    fact("deck.concrete_to_supports", true),
  ],
  lines: staleLines,
});
check(
  "saved 15-post draft conflicts with the stated 16",
  conflict?.changes.some((change) => change.label === "Pile/post installation" && change.to === 16) === true &&
    conflict?.changes.some((change) => change.label === "Hole excavation" && change.to === 16) === true &&
    conflict?.changes.some((change) => change.label === "Post-hole concrete" && change.to === 40) === true &&
    conflict?.changes.some((change) => change.label === "Piles / posts" && change.to === 19.2) === true &&
    conflict?.changes.some((change) => change.label === "Concrete placement" && change.to === 30.8) === true,
  conflict?.summary
);
check(
  "a matching draft does not ask to recalculate",
  deckStatedCountConflict({
    facts: [fact("deck.pile_or_post_count", 16)],
    lines: [{ componentKey: "deck.posts.install", quantity: 16, unit: "ea" }],
  }) == null
);
const overview = projectEstimateOverview({
  hasEstimate: true,
  isStale: false,
  detailsOutstanding: false,
  estimate: {
    recommendedSell: 1000,
    recommendedCost: 800,
    grossProfit: 200,
    marginPercent: 20,
  },
  gstRate: 15,
  breakdown: null,
  review: null,
  readinessBlockers: [],
  rateSourceSummary: null,
  pricingDocumentExists: true,
  specialistPricingNotice: null,
  workAreaNames: ["Deck"],
  statedCountConflictDetail: conflict?.summary ?? null,
});
check(
  "the conflict blocks Pricing and Quote continuation",
  overview.primary === "regenerate" &&
    overview.pricingCreationBlocked &&
    overview.pricingEntry === "blocked" &&
    overview.required.some((item) => item.id === "deck-stated-count") &&
    overview.sell.presentation === "previous" &&
    overview.sell.label === "Old working estimate" &&
    overview.sell.exGst != null
);
const header = deriveProjectWorkflow({
  projectId: "dunkirk",
  activeTab: "assistant",
  hasEstimate: true,
  estimateIsStale: false,
  quantityConflictDetail: conflict?.summary ?? null,
  pricingSummary: null,
  quoteSummary: null,
});
const estimateStage = header.stages.find((stage) => stage.id === "estimate");
const pricingStage = header.stages.find((stage) => stage.id === "pricing");
check(
  "the header says the estimate needs updating",
  estimateStage != null &&
    pricingStage != null &&
    estimateStatusText(estimateStage, false, true) === "Needs updating · Current" &&
    pricingStage.status !== "Ready" &&
    pricingStage.locked &&
    (pricingLockReason(pricingStage) ?? "").startsWith("Recalculate this draft")
);
const persistedRefusal = deckStatedCountConflictFromPersisted({
  facts: [
    fact("deck.pile_or_post_count", 16),
    fact("deck.substructure_included", true),
    fact("deck.concrete_to_supports", true),
  ],
  lines: staleLines.map((row) => ({
    label: row.label,
    component_key: row.componentKey,
    notes: buildLineItemNotes({
      workAreaId: "deck",
      workAreaName: "Deck",
      label: row.label,
      category: row.componentKey === "deck.concrete.place" ? "labour" : "materials",
      quantity: row.quantity,
      unit: row.unit,
      labourHours: row.labourHours,
      componentKey: row.componentKey,
      costLow: 0,
      costHigh: 0,
      sellLow: 0,
      sellHigh: 0,
      recommendedCost: 0,
      recommendedSell: 0,
      grossProfit: 0,
      marginPercent: 0,
      markupPercent: 0,
      rateSource: "saved",
      sortOrder: 1,
    }),
  })),
});
check(
  "the server reads the saved draft and refuses it",
  persistedRefusal?.summary === conflict?.summary &&
    (persistedRefusal?.summary ?? "").includes("15 → 16")
);
const issuedQuote = quoteCreationDecision({
  existingQuoteId: "issued-quote",
  statedCountConflict: conflict?.summary ?? "blocked",
});
const newQuote = quoteCreationDecision({
  existingQuoteId: null,
  statedCountConflict: conflict?.summary ?? null,
});
check(
  "an issued quote stays open and a new quote is refused",
  issuedQuote.action === "open_existing" &&
    issuedQuote.quoteId === "issued-quote" &&
    newQuote.action === "refuse"
);
function included(
  result: ReturnType<typeof calculateDeck>,
  category: "materials" | "labour",
  field: "recommendedCost" | "recommendedSell"
) {
  return result.lineItems
    .filter((item) => item.category === category && item.includedInTotal !== false)
    .reduce((sum, item) => sum + item[field], 0);
}
function clientSell(result: ReturnType<typeof calculateDeck>) {
  return result.lineItems
    .filter((item) => item.includedInTotal !== false)
    .reduce((sum, item) => sum + item.recommendedSell, 0);
}
const beforeMaterials = included(spacing, "materials", "recommendedCost");
const afterMaterials = included(stated, "materials", "recommendedCost");
const beforeLabour = included(spacing, "labour", "recommendedCost");
const afterLabour = included(stated, "labour", "recommendedCost");
const beforeSell = clientSell(spacing);
const afterSell = clientSell(stated);
const afterGst = Math.round(afterSell * 0.15 * 100) / 100;
check(
  "updating the draft changes material, labour, sell, and GST",
  afterMaterials > beforeMaterials &&
    afterLabour > beforeLabour &&
    afterSell > beforeSell &&
    afterGst > 0,
  `materials ${beforeMaterials.toFixed(2)} → ${afterMaterials.toFixed(2)}; labour ${beforeLabour.toFixed(2)} → ${afterLabour.toFixed(2)}; sell ${beforeSell.toFixed(2)} → ${afterSell.toFixed(2)}; GST ${afterGst.toFixed(2)}`
);
console.log(
  `disposable update materials $${beforeMaterials.toFixed(2)} → $${afterMaterials.toFixed(2)}; labour $${beforeLabour.toFixed(2)} → $${afterLabour.toFixed(2)}; sell $${beforeSell.toFixed(2)} → $${afterSell.toFixed(2)}; GST $${afterGst.toFixed(2)}`
);
const clearedConflict = deckStatedCountConflict({
  facts: [
    ...base,
    fact("deck.pile_or_post_count", 16),
    fact("deck.hole_shape", "circular"),
    fact("deck.hole_diameter_mm", 350),
    fact("deck.hole_depth_mm", 600),
    fact("deck.hole_ground", "ordinary"),
    fact("deck.hole_method", "hand"),
  ],
  lines: stated.lineItems,
});
const clearedOverview = projectEstimateOverview({
  hasEstimate: true,
  isStale: false,
  detailsOutstanding: false,
  estimate: {
    recommendedSell: afterSell,
    recommendedCost: afterMaterials + afterLabour,
    grossProfit: afterSell - (afterMaterials + afterLabour),
    marginPercent: 20,
  },
  gstRate: 15,
  breakdown: null,
  review: null,
  readinessBlockers: [],
  rateSourceSummary: null,
  pricingDocumentExists: false,
  specialistPricingNotice: null,
  workAreaNames: ["Deck"],
  statedCountConflictDetail: clearedConflict?.summary ?? null,
});
check(
  "the warning clears and Pricing can be created",
  clearedConflict == null &&
    clearedOverview.pricingCreationBlocked === false &&
    clearedOverview.pricingEntry === "create" &&
    clearedOverview.sell.label === "Recommended client sell"
);
const pricedHole = formatProfitabilityDisplay({
  costKnown: priced.ok ? priced.fields.costKnown : true,
  grossProfit: 120,
  marginPercent: 100,
});
check(
  "an explicit excavation sell keeps profit unknown",
  priced.ok &&
    priced.fields.costKnown === false &&
    pricedHole.profitLabel === PROFITABILITY_UNAVAILABLE_LABEL
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
