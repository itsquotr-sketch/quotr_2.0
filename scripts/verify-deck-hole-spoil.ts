/**
 * Deck hole excavation hours, bank spoil, and the $60 labour fallback.
 * Run: npx tsx scripts/verify-deck-hole-spoil.ts
 */
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_HOLE_PROVISIONAL_HOURS,
  circularBankVolumeM3,
  planDeckHoleExcavation,
} from "../lib/estimate/deck-hole-excavation";
import { resolveLabourRate } from "../lib/estimate/rates";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { editableProductivityCatalogueKeys } from "../lib/rates/productivity-registry";
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

function wa(): EstimateWorkArea {
  return { id: "deck", type: "deck", name: "Deck", sort_order: 1 };
}

function rate(partial: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "cost_rate">): OrganisationRate {
  return {
    id: partial.item_key,
    rate_type: partial.rate_type ?? "labour",
    label: partial.label ?? partial.item_key,
    unit: partial.unit ?? "hour",
    sell_rate: partial.sell_rate ?? null,
    source: partial.source ?? "user",
    active: partial.active ?? true,
    ...partial,
  } as OrganisationRate;
}

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  access: "good" | "restricted" = "good"
): EstimateContext {
  return {
    project: { id: "draft", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [{ key: "site_access", value: access }],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
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
];

const sixteen = calculateDeck(ctx([...base, fact("deck.pile_or_post_count", 16)]), wa());
const hole = sixteen.lineItems.find((item) => item.label === "Hole excavation");
const install = sixteen.lineItems.find((item) => item.label === "Pile/post installation");
const place = sixteen.lineItems.find((item) => item.label === "Concrete placement");
const bags = sixteen.lineItems.find((item) => item.unit === "bag" && item.category === "materials");
const spoil = sixteen.lineItems.find((item) => item.label === "Post-hole spoil destination");
const removal = sixteen.lineItems.find((item) => item.label === "Existing deck removal");

check("16 holes stay the stated count", hole?.quantity === 16 && install?.quantity === 16);
check(
  "excavation, installation, and concrete are distinct",
  hole?.componentKey === "deck.hole.excavate" &&
    install?.componentKey === "deck.posts.install" &&
    place?.componentKey === "deck.concrete.place" &&
    hole?.label !== install?.label &&
    hole?.label !== place?.label,
  [hole?.componentKey, install?.componentKey, place?.componentKey].join(" | ")
);
check(
  "provisional hours are 0.5, not post or bag time",
  hole?.productivityRate === DECK_HOLE_PROVISIONAL_HOURS &&
    hole.productivityRate !== 1 &&
    install?.productivityRate === 1 &&
    place?.productivityRate === 0.06666666666666667,
  `hole=${hole?.productivityRate} install=${install?.productivityRate} place=${place?.productivityRate}`
);
check(
  "16 ordinary holes cost 8 h × $60",
  hole?.labourHours === 8 &&
    hole.costRate === 60 &&
    hole.recommendedCost === 480 &&
    hole.recommendedSell === 600 &&
    hole.includedInTotal !== false
);
check(
  "assumed 350 × 600 is labelled and bank volume is 0.92 m³",
  sixteen.assumptions.some((text) => text.includes("Assumed circular hole 350 mm diameter × 600 mm deep")) &&
    sixteen.assumptions.some((text) => text.includes("not measured")) &&
    spoil?.quantity === 0.92 &&
    (spoil?.notes ?? "").includes("m³ bank") &&
    !(spoil?.notes ?? "").includes("3×") &&
    !sixteen.assumptions.some((text) => /×\s*3/.test(text) && /swell/i.test(text) && /applied/.test(text) === false)
);
check(
  "unknown spoil is Pricing Required and demolition is absent",
  spoil?.rateSourceType === "missing" &&
    spoil.includedInTotal === false &&
    (spoil.recommendedCost ?? 0) === 0 &&
    removal == null &&
    bags?.quantity === 40
);

const restricted = calculateDeck(
  ctx([...base, fact("deck.pile_or_post_count", 16)], [], "restricted"),
  wa()
);
const restrictedHole = restricted.lineItems.find((item) => item.label === "Hole excavation");
check(
  "restricted access applies once: 8.8 h and $528",
  restrictedHole?.labourHours === 8.8 && restrictedHole.recommendedCost === 528,
  String(restrictedHole?.labourHours)
);

const companyLabour = calculateDeck(
  ctx(
    [...base, fact("deck.pile_or_post_count", 16)],
    [rate({ item_key: "labour.carpenter.hour", cost_rate: 80, rate_type: "labour", unit: "hour" })]
  ),
  wa()
);
const companyHole = companyLabour.lineItems.find((item) => item.label === "Hole excavation");
check(
  "company $80/h replaces the $60 fallback",
  companyHole?.costRate === 80 && companyHole.labourHours === 8 && companyHole.recommendedCost === 640
);

const companyHours = calculateDeck(
  ctx(
    [
      ...base,
      fact("deck.pile_or_post_count", 16),
      fact("deck.hole_diameter_mm", 600),
      fact("deck.hole_depth_mm", 1200),
      fact("deck.hole_ground", "rock"),
    ],
    [
      rate({
        item_key: "deck.hole.excavate.hours_per_hole",
        cost_rate: 0.8,
        rate_type: "productivity",
        unit: "hole",
        source: "calibrated_productivity",
      }),
    ]
  ),
  wa()
);
const overrideHole = companyHours.lineItems.find((item) => item.label === "Hole excavation");
check(
  "calibrated hours apply outside ordinary scope",
  overrideHole?.productivityRate === 0.8 &&
    overrideHole.labourHours === 12.8 &&
    overrideHole.includedInTotal !== false &&
    companyHours.assumptions.some((text) => text.includes("Confirmed circular hole 600 mm")),
  `rate=${overrideHole?.productivityRate} hours=${overrideHole?.labourHours} included=${overrideHole?.includedInTotal}`
);

const outOfScope = planDeckHoleExcavation({
  facts: [fact("deck.hole_diameter_mm", 600), fact("deck.hole_depth_mm", 1200)],
  workAreaId: "deck",
  holeCount: 16,
  rates: [],
});
check(
  "unsupported size without company hours stays unpriced",
  outOfScope.productivity?.applies === false && outOfScope.spoilLines.length === 1
);

const none = planDeckHoleExcavation({ facts: [], workAreaId: "deck", holeCount: 0 });
check("zero holes add no money", none.spoilLines.length === 0 && none.productivity == null);

const one = planDeckHoleExcavation({ facts: [], workAreaId: "deck", holeCount: 1 });
const oneVolume = circularBankVolumeM3(350, 600, 1);
check(
  "one assumed hole is 0.5 h and its own bank volume",
  one.productivity?.hoursPerHole === 0.5 &&
    one.geometry?.bankVolumeM3 === oneVolume.totalM3 &&
    oneVolume.totalM3 === 0.06
);

const sized = circularBankVolumeM3(300, 800, 16);
const other = planDeckHoleExcavation({
  facts: [fact("deck.hole_diameter_mm", 300), fact("deck.hole_depth_mm", 800)],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "300 × 800 mm changes the bank volume",
  other.geometry?.bankVolumeM3 === sized.totalM3 && sized.totalM3 !== 0.92
);

const footings = planDeckHoleExcavation({
  facts: [
    fact("deck.footing_length_mm", 400),
    fact("deck.footing_width_mm", 400),
    fact("deck.footing_depth_mm", 450),
  ],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "footing dimensions are not the dug hole",
  footings.geometry?.diameterMm === 350 && footings.geometry.depthMm === 600
);

const onSite = planDeckHoleExcavation({
  facts: [fact("deck.spoil_leaves_site", false)],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "on-site spoil has no disposal money",
  onSite.spoilDestination === "on_site" && onSite.spoilLines.length === 0
);

const offSite = planDeckHoleExcavation({
  facts: [fact("deck.spoil_leaves_site", true)],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "off-site spoil splits haulage and tip when neither is priced",
  offSite.spoilLines.length === 2 &&
    offSite.spoilLines.every((line) => line.kind === "pricing_required") &&
    offSite.spoilLines.every((line) => line.quantityM3 === 0.92)
);

const allIn = planDeckHoleExcavation({
  facts: [fact("deck.spoil_leaves_site", true)],
  workAreaId: "deck",
  holeCount: 16,
  rates: [rate({ item_key: "deck.spoil.removal.all_in.m3", cost_rate: 90, rate_type: "material", unit: "m3" })],
});
check(
  "an all-in spoil rate is one line and does not add a tip",
  allIn.spoilLines.length === 1 &&
    allIn.spoilLines[0]?.kind === "priced" &&
    allIn.spoilLines[0].unitCost === 90
);

const excluded = calculateDeck(
  ctx([
    ...base.filter((row) => row.key !== "deck.substructure_included"),
    fact("deck.substructure_included", false),
    fact("deck.existing_deck_removal", true),
  ]),
  wa()
);
const demo = excluded.lineItems.find((item) => /existing deck removal/i.test(item.label));
check(
  "deck demolition is not a post hole",
  !excluded.lineItems.some((item) => item.componentKey === "deck.hole.excavate") &&
    demo != null &&
    (demo.notes ?? "").includes("not post-hole soil"),
  demo?.notes ?? "no demolition line"
);

const carpenter = resolveLabourRate({
  rates: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
});
const labourer = resolveLabourRate({
  rates: [],
  trade: "labourer",
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
});
const general = resolveLabourRate({
  rates: [],
  trade: "general",
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
});
const savedLabourer = resolveLabourRate({
  rates: [rate({ item_key: "labour.labourer.hour", cost_rate: 42, sell_rate: 70, rate_type: "labour", unit: "hour" })],
  trade: "labourer",
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
});
check(
  "carpenter, labourer, and general fall back to $60 benchmark",
  carpenter.costRate === 60 &&
    carpenter.sourceType === "benchmark" &&
    labourer.costRate === 60 &&
    labourer.sourceType === "benchmark" &&
    general.costRate === 60 &&
    general.sourceType === "benchmark" &&
    savedLabourer.costRate === 42 &&
    savedLabourer.sellRate === 70 &&
    savedLabourer.sourceType === "user_rate"
);
check(
  "Rates can edit hole excavation hours",
  editableProductivityCatalogueKeys().includes("deck.hole.excavate.hours_per_hole") &&
    getCatalogueEntry("deck.hole.excavate.hours_per_hole")?.defaultCostRate === 0.5
);
check(
  "catalogue labour defaults are $60 cost only",
  getCatalogueEntry("labour.carpenter.hour")?.defaultCostRate === 60 &&
    getCatalogueEntry("labour.labourer.hour")?.defaultCostRate === 60 &&
    getCatalogueEntry("labour.labourer.hour")?.defaultSellRate == null &&
    getCatalogueEntry("labour.general.hour")?.defaultCostRate === 60 &&
    getCatalogueEntry("labour.general.hour")?.defaultSellRate == null &&
    getCatalogueEntry("labour.apprentice.hour")?.defaultCostRate === 40
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
