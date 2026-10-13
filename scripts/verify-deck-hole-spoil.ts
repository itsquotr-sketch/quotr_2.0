/**
 * Deck hole excavation hours, bank spoil, and the $60 labour fallback.
 * Run: npx tsx scripts/verify-deck-hole-spoil.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_HOLE_PROVISIONAL_HOURS,
  circularBankVolumeM3,
  planDeckHoleExcavation,
  rectangularBankVolumeM3,
} from "../lib/estimate/deck-hole-excavation";
import {
  deckDetailGaps,
  deckPostHoleControlId,
  firstDeckDetailTarget,
  quantityConflictStageStatus,
} from "../lib/estimate/deck-detail-completeness";
import {
  DECK_POST_HOLE_FINISH,
  deckConcreteCalculationLines,
  deckConcreteResultLabel,
  deckConcreteYieldCard,
  deckExcavationResultLabel,
  deckPostHoleFinishItems,
  deckPostSizeStatus,
} from "../lib/estimate/deck-post-hole-result";
import { deckStatedCountConflict } from "../lib/estimate/deck-stated-count-guard";
import { round2 } from "../lib/estimate/facts";
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

const confirmedHoles = [
  fact("deck.hole_shape", "circular"),
  fact("deck.hole_diameter_mm", 350),
  fact("deck.hole_depth_mm", 600),
  fact("deck.hole_ground", "ordinary"),
  fact("deck.hole_method", "hand"),
];

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

const sixteen = calculateDeck(
  ctx([...base, fact("deck.pile_or_post_count", 16), ...confirmedHoles]),
  wa()
);
const assumed = calculateDeck(ctx([...base, fact("deck.pile_or_post_count", 16)]), wa());
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
    install?.includedInTotal === false &&
    install?.rateSourceType === "missing" &&
    (install?.recommendedCost ?? 0) === 0 &&
    (install?.notes ?? "").includes("no approved installation-only hour") &&
    place?.productivityRate === 0.06666666666666667,
  `hole=${hole?.productivityRate} install=${install?.rateSourceType} place=${place?.productivityRate}`
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
  "confirmed 350 × 600 bank volume is about 0.924 m³",
  sixteen.assumptions.some((text) => text.includes("Confirmed circular hole 350 mm diameter × 600 mm deep")) &&
    spoil?.quantity === 0.924 &&
    (spoil?.notes ?? "").includes("m³ bank") &&
    !(spoil?.notes ?? "").includes("3×") &&
    sixteen.assumptions.some((text) => text.includes("3× swell note is not applied"))
);
const assumedHole = assumed.lineItems.find((item) => item.label === "Hole excavation");
const assumedSpoil = assumed.lineItems.find((item) => item.label === "Post-hole spoil destination");
check(
  "an assumed hole is labelled and does not take the 0.50 h starter",
  assumed.assumptions.some((text) => text.includes("Assumed circular hole 350 mm diameter × 600 mm deep")) &&
    assumed.assumptions.some((text) => text.includes("not measured")) &&
    assumedHole?.includedInTotal === false &&
    assumedHole?.productivityRate == null &&
    assumedSpoil?.quantity === 0.924 &&
    assumedHole?.holeDraft?.needsConfirmation === true
);
check(
  "unknown spoil is Pricing Required and demolition is absent",
  spoil?.rateSourceType === "missing" &&
    spoil.includedInTotal === false &&
    (spoil.recommendedCost ?? 0) === 0 &&
    removal == null &&
    bags?.quantity === 93 &&
    (bags?.notes ?? "").includes("Provisional concrete quantity") &&
    !(bags?.notes ?? "").includes("2.5")
);

const restricted = calculateDeck(
  ctx([...base, fact("deck.pile_or_post_count", 16), ...confirmedHoles], [], "restricted"),
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
    [...base, fact("deck.pile_or_post_count", 16), ...confirmedHoles],
    [rate({ item_key: "labour.carpenter.hour", cost_rate: 80, rate_type: "labour", unit: "hour" })]
  ),
  wa()
);
const companyHole = companyLabour.lineItems.find((item) => item.label === "Hole excavation");
check(
  "company $80/h replaces the $60 fallback",
  companyHole?.costRate === 80 && companyHole.labourHours === 8 && companyHole.recommendedCost === 640
);
const companyPostInstall = calculateDeck(
  ctx(
    [...base, fact("deck.pile_or_post_count", 16), ...confirmedHoles],
    [
      rate({
        item_key: "deck.posts.install.hours_per_ea",
        cost_rate: 0.4,
        rate_type: "productivity",
        unit: "ea",
      }),
    ]
  ),
  wa()
);
const companyPost = companyPostInstall.lineItems.find((item) => item.label === "Pile/post installation");
check(
  "a company installation rate prices posts without using the overlapping Quotr hour",
  companyPost?.includedInTotal !== false &&
    companyPost.productivityRate === 0.4 &&
    companyPost.labourHours === 6.4 &&
    companyPost.costRate === 60 &&
    companyPost.recommendedCost === 384 &&
    companyPost.recommendedSell === 480 &&
    (companyPost.notes ?? "").includes("Your company rate") &&
    !(companyPost.notes ?? "").includes("1 person-hour"),
  `rate=${companyPost?.productivityRate} hours=${companyPost?.labourHours} cost=${companyPost?.recommendedCost} sell=${companyPost?.recommendedSell} included=${companyPost?.includedInTotal} notes=${companyPost?.notes}`
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
  "one assumed hole does not take the starter and keeps its bank volume",
  one.productivity?.applies === false &&
    one.geometry?.bankVolumeM3 === oneVolume.totalM3 &&
    oneVolume.totalM3 === 0.058
);

const sized = circularBankVolumeM3(300, 800, 16);
const other = planDeckHoleExcavation({
  facts: [fact("deck.hole_diameter_mm", 300), fact("deck.hole_depth_mm", 800)],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "300 × 800 mm changes the bank volume",
  other.geometry?.bankVolumeM3 === sized.totalM3 && sized.totalM3 !== 0.924
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
    offSite.spoilLines.every((line) => line.quantityM3 === 0.924)
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

const machine = planDeckHoleExcavation({
  facts: [...confirmedHoles.filter((row) => row.key !== "deck.hole_method"), fact("deck.hole_method", "machine")],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "a machine dig does not take the 0.50 h starter",
  machine.productivity?.applies === false && machine.productivity.sourceType === "missing"
);
const rock = planDeckHoleExcavation({
  facts: [...confirmedHoles.filter((row) => row.key !== "deck.hole_ground"), fact("deck.hole_ground", "rock")],
  workAreaId: "deck",
  holeCount: 16,
});
check("rock does not take the 0.50 h starter", rock.productivity?.applies === false);
const water = planDeckHoleExcavation({
  facts: [
    ...confirmedHoles.filter((row) => row.key !== "deck.hole_ground"),
    fact("deck.hole_ground", "groundwater"),
  ],
  workAreaId: "deck",
  holeCount: 16,
});
check("groundwater does not take the 0.50 h starter", water.productivity?.applies === false);
const jobHours = planDeckHoleExcavation({
  facts: [...rock.assumptions.length ? confirmedHoles.filter((row) => row.key !== "deck.hole_ground") : [], fact("deck.hole_ground", "rock"), fact("deck.hole_shape", "circular"), fact("deck.hole_diameter_mm", 350), fact("deck.hole_depth_mm", 600), fact("deck.hole_method", "hand"), fact("deck.hole_job_hours_per_hole", 1.25)],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "an explicit job hours figure is used outside ordinary ground",
  jobHours.productivity?.applies === true && jobHours.productivity.hoursPerHole === 1.25
);
const rect = rectangularBankVolumeM3(400, 400, 600, 16);
const rectangular = planDeckHoleExcavation({
  facts: [
    fact("deck.hole_shape", "rectangular"),
    fact("deck.hole_length_mm", 400),
    fact("deck.hole_width_mm", 400),
    fact("deck.hole_depth_mm", 600),
    fact("deck.hole_ground", "ordinary"),
    fact("deck.hole_method", "hand"),
    fact("deck.spoil_destination", "on_site"),
  ],
  workAreaId: "deck",
  holeCount: 16,
});
check(
  "rectangular bank volume is length × width × depth and has no removal charge",
  rectangular.geometry?.bankVolumeM3 === rect.totalM3 &&
    rect.totalM3 === 1.536 &&
    rectangular.spoilLines.length === 0 &&
    rectangular.productivity?.applies === false
);
const override = calculateDeck(
  ctx([
    ...base,
    fact("deck.pile_or_post_count", 16),
    ...confirmedHoles,
    fact("deck.hole_count", 12),
    fact("deck.hole_count_reason", "Two posts share a pad"),
    fact("deck.spoil_destination", "on_site"),
  ]),
  wa()
);
const overrideExcavation = override.lineItems.find((item) => item.label === "Hole excavation");
const overrideInstall = override.lineItems.find((item) => item.label === "Pile/post installation");
const overrideBags = override.lineItems.find((item) => item.unit === "bag" && item.category === "materials");
check(
  "a reasoned hole count is the only count used for holes, spoil, and concrete",
  overrideExcavation?.quantity === 12 &&
    overrideExcavation.labourHours === 6 &&
    overrideInstall?.quantity === 16 &&
    overrideBags?.quantity === 70 &&
    !override.lineItems.some((item) => item.componentKey === "deck.spoil.haulage") &&
    !override.lineItems.some((item) => item.componentKey === "deck.spoil.destination")
);
const savedStamp = sixteen.lineItems.find((item) => item.componentKey === "deck.hole.excavate")?.holeDraft;
const stale = savedStamp
  ? deckStatedCountConflict({
      facts: [
        fact("deck.pile_or_post_count", 16),
        fact("deck.substructure_included", true),
        ...confirmedHoles.filter((row) => row.key !== "deck.hole_depth_mm"),
        fact("deck.hole_depth_mm", 800),
      ],
      lines: [
        { componentKey: "deck.posts.install", label: "Pile/post installation", quantity: 16, unit: "ea" },
        {
          componentKey: "deck.hole.excavate",
          label: "Hole excavation",
          quantity: 16,
          unit: "hole",
          holeDraft: savedStamp,
        },
      ],
    })
  : null;
check(
  "a changed depth makes the saved draft stale",
  stale != null &&
    (stale?.summary ?? "").includes("Update this estimate") &&
    (stale?.changes.some((change) => change.label === "Post-hole spoil") ?? false),
  stale?.summary
);
const unchanged = savedStamp
  ? deckStatedCountConflict({
      facts: [
        fact("deck.pile_or_post_count", 16),
        fact("deck.substructure_included", true),
        fact("deck.concrete_to_supports", true),
        ...confirmedHoles,
      ],
      lines: [
        { componentKey: "deck.posts.install", quantity: 16, unit: "ea" },
        { componentKey: "deck.hole.excavate", quantity: 16, unit: "hole", holeDraft: savedStamp },
      ],
    })
  : { summary: "missing" };
check(
  "unconfirmed concrete stays provisional on an unchanged hole draft",
  unchanged != null && (unchanged.summary ?? "").includes("provisional")
);

const measuredBase = [
  ...base,
  fact("deck.pile_or_post_count", 16),
  ...confirmedHoles,
  fact("deck.concrete_fill", "full"),
  fact("deck.support_section", "125x125"),
  fact("deck.post_embedment_mm", 600),
];

function concreteReport(label: string, result: ReturnType<typeof calculateDeck>) {
  const material = result.lineItems.find((item) => item.componentKey === "deck.concrete.bags");
  const placement = result.lineItems.find((item) => item.componentKey === "deck.concrete.place");
  const spoilLine = result.lineItems.find((item) => item.label === "Post-hole spoil destination");
  console.log(
    [
      label,
      `bags=${material?.quantity}`,
      `hours=${placement?.labourHours}`,
      `cost=${material?.recommendedCost}`,
      `sell=${material?.recommendedSell}`,
      `spoil=${spoilLine?.quantity}`,
      material?.notes ?? "",
    ].join(" | ")
  );
  return { material, placement, spoilLine };
}

const measured = calculateDeck(ctx(measuredBase), wa());
const measuredReport = concreteReport("16 × 350 × 600 full, 125×125 embedded 600", measured);
const measuredInstall = measured.lineItems.find((item) => item.label === "Pile/post installation");
const measuredHole = measured.lineItems.find((item) => item.label === "Hole excavation");
const measuredSpoil = measured.lineItems.find((item) => item.label === "Post-hole spoil destination");
check(
  "16-post rows keep excavation, placement, and bags, and leave installation Pricing Required",
  measuredHole?.labourHours === 8 &&
    measuredHole.recommendedCost === 480 &&
    measuredHole.recommendedSell === 600 &&
    measuredInstall?.includedInTotal === false &&
    (measuredInstall?.recommendedCost ?? 0) === 0 &&
    (measuredInstall?.recommendedSell ?? 0) === 0 &&
    (measuredInstall?.rateSource ?? "").toLowerCase().includes("pricing required") &&
    (measuredInstall?.notes ?? "").includes("no approved installation-only hour") &&
    (measuredHole?.notes ?? "").includes("h/hole") &&
    (measuredReport.placement?.notes ?? "").includes("h/bag") &&
    measuredReport.placement?.labourHours === 5.2 &&
    measuredReport.placement.recommendedCost === 312 &&
    measuredReport.placement.recommendedSell === 390 &&
    measuredReport.material?.quantity === 78 &&
    measuredReport.material.recommendedCost === 762.06 &&
    measuredReport.material.recommendedSell === 952.38 &&
    measuredSpoil?.includedInTotal === false &&
    measured.lineItems.filter((item) => item.label === "Hole excavation").length === 1 &&
    measured.lineItems.filter((item) => /mix/i.test(item.label)).length === 0
);
const deeper = calculateDeck(
  ctx(measuredBase.map((row) => (row.key === "deck.hole_depth_mm" ? fact("deck.hole_depth_mm", 800) : row))),
  wa()
);
const deeperReport = concreteReport("depth 800, embedment still 600", deeper);
const throughPost = calculateDeck(
  ctx([
    ...measuredBase.filter((row) => row.key !== "deck.hole_depth_mm" && row.key !== "deck.post_embedment_mm"),
    fact("deck.hole_depth_mm", 800),
    fact("deck.post_embedment_mm", 800),
  ]),
  wa()
);
concreteReport("depth 800, post through the concrete", throughPost);
const rectangularDeck = calculateDeck(
  ctx([
    ...base,
    fact("deck.pile_or_post_count", 16),
    fact("deck.hole_shape", "rectangular"),
    fact("deck.hole_length_mm", 400),
    fact("deck.hole_width_mm", 400),
    fact("deck.hole_depth_mm", 600),
    fact("deck.hole_ground", "ordinary"),
    fact("deck.hole_method", "hand"),
    fact("deck.concrete_fill", "full"),
    fact("deck.support_section", "125x125"),
    fact("deck.post_embedment_mm", 600),
  ]),
  wa()
);
const rectangularReport = concreteReport("16 × 400 × 400 × 600", rectangularDeck);
const partial = calculateDeck(
  ctx([
    ...measuredBase.map((row) =>
      row.key === "deck.concrete_fill" ? fact("deck.concrete_fill", "partial") : row
    ),
    fact("deck.concrete_fill_depth_mm", 300),
  ]),
  wa()
);
const partialReport = concreteReport("partial fill 300 mm", partial);
const companyQty = calculateDeck(
  ctx([...measuredBase, fact("deck.concrete_bags_per_hole", 3)]),
  wa()
);
const companyReport = concreteReport("company 3 bags per hole", companyQty);

function once(result: ReturnType<typeof calculateDeck>, key: string) {
  return result.lineItems.filter((item) => item.componentKey === key).length === 1;
}

check(
  "measured 350 × 600 is 78 bags from the net fill",
  measuredReport.material?.quantity === 78 &&
    measuredReport.placement?.labourHours === 5.2 &&
    measuredReport.material.recommendedCost === 762.06 &&
    measuredReport.material.recommendedSell === 952.38 &&
    measuredReport.spoilLine?.quantity === 0.924 &&
    (measuredReport.material.notes ?? "").includes("0.150 m³") &&
    (measuredReport.material.notes ?? "").includes("0.01 m³") &&
    (measuredReport.material.notes ?? "").includes("fully concreted") &&
    once(measured, "deck.hole.excavate") &&
    once(measured, "deck.posts.install") &&
    once(measured, "deck.concrete.place")
);
check(
  "a deeper hole changes bags, placement hours, and bank spoil",
  deeperReport.material?.quantity === 109 &&
    deeperReport.placement?.labourHours === round2(109 * (4 / 60)) &&
    deeperReport.spoilLine?.quantity === 1.232 &&
    deeperReport.material.quantity !== measuredReport.material?.quantity
);
check(
  "rectangular holes use length × width × depth",
  rectangularReport.material?.quantity === 139 &&
    rectangularReport.spoilLine?.quantity === 1.536 &&
    (rectangularReport.material.notes ?? "").includes("Rectangular")
);
check(
  "partial fill prices only the concreted depth and leaves spoil on the bank volume",
  partialReport.material?.quantity === 39 &&
    partialReport.spoilLine?.quantity === 0.924 &&
    (partialReport.material.notes ?? "").includes("remaining 300 mm")
);
const partial400 = calculateDeck(
  ctx([
    ...measuredBase.map((row) =>
      row.key === "deck.concrete_fill" ? fact("deck.concrete_fill", "partial") : row
    ),
    fact("deck.concrete_fill_depth_mm", 400),
  ]),
  wa()
);
const partial400Report = concreteReport("partial fill 400 mm", partial400);
check(
  "16 × 350 mm holes with 400 mm partial fill stay at 52 bags and 0.924 m³ bank spoil",
  partial400Report.material?.quantity === 52 &&
    partial400Report.spoilLine?.quantity === 0.924 &&
    (partial400Report.material.notes ?? "").includes("bottom 400 mm") &&
    (partial400Report.material.notes ?? "").includes("remaining 200 mm") &&
    (partial400Report.material.notes ?? "").includes("0.516")
);
check(
  "a company bag count replaces the volume takeoff",
  companyReport.material?.quantity === 48 &&
    companyReport.placement?.quantity === 48 &&
    (companyReport.material.notes ?? "").includes("Company-specified quantity") &&
    !(companyReport.material.notes ?? "").includes("Provisional")
);

const measuredStamp = measured.lineItems.find((item) => item.componentKey === "deck.hole.excavate")?.holeDraft;
const depthConflict = measuredStamp
  ? deckStatedCountConflict({
      facts: measuredBase.map((row) =>
        row.key === "deck.hole_depth_mm" ? fact("deck.hole_depth_mm", 800) : row
      ),
      lines: [
        { componentKey: "deck.posts.install", quantity: 16, unit: "ea" },
        { componentKey: "deck.hole.excavate", quantity: 16, unit: "hole", holeDraft: measuredStamp },
        { componentKey: "deck.concrete.bags", label: "Post-hole concrete", quantity: 78, unit: "bag" },
        {
          componentKey: "deck.concrete.place",
          label: "Concrete placement",
          quantity: 78,
          unit: "bag",
          labourHours: 5.2,
        },
      ],
    })
  : null;
check(
  "a depth change stales concrete bags and placement hours",
  depthConflict?.changes.some((change) => change.label === "Post-hole concrete" && change.from === 78 && change.to === 109) ===
    true &&
    depthConflict?.changes.some((change) => change.label === "Concrete placement" && change.to === 7.27) === true &&
    (depthConflict?.summary ?? "").includes("Update this estimate")
);
const yieldConflict = measuredStamp
  ? deckStatedCountConflict({
      facts: [...measuredBase, fact("deck.concrete_bag_yield_m3", 0.012)],
      lines: [
        { componentKey: "deck.posts.install", quantity: 16, unit: "ea" },
        { componentKey: "deck.hole.excavate", quantity: 16, unit: "hole", holeDraft: measuredStamp },
        { componentKey: "deck.concrete.bags", quantity: 78, unit: "bag" },
      ],
    })
  : null;
check(
  "a yield change stales the concrete quantity",
  yieldConflict != null && (yieldConflict.summary ?? "").includes("Update this estimate")
);
const postConflict = measuredStamp
  ? deckStatedCountConflict({
      facts: measuredBase.map((row) =>
        row.key === "deck.support_section" ? fact("deck.support_section", "100x100") : row
      ),
      lines: [
        { componentKey: "deck.posts.install", quantity: 16, unit: "ea" },
        { componentKey: "deck.hole.excavate", quantity: 16, unit: "hole", holeDraft: measuredStamp },
      ],
    })
  : null;
check("a post size change stales the draft", postConflict != null);
const settled = measuredStamp
  ? deckStatedCountConflict({
      facts: measuredBase,
      lines: [
        { componentKey: "deck.posts.install", quantity: 16, unit: "ea" },
        { componentKey: "deck.hole.excavate", quantity: 16, unit: "hole", holeDraft: measuredStamp },
      ],
    })
  : { summary: "missing" };
check("a measured unchanged concrete draft is not stale", settled == null);

const openFacts = [
  fact("deck.pile_or_post_count", 16),
  fact("deck.concrete_to_supports", true),
];
const openPlan = planDeckHoleExcavation({
  facts: openFacts,
  workAreaId: "deck",
  holeCount: 16,
});
const openTodo = deckPostHoleFinishItems({
  sizeConfirmed: openPlan.draftStamp?.sizeConfirmed ?? false,
  ground: "",
  method: "",
  spoil: "",
  concreteOn: true,
  fill: "",
  fillDepthMm: null,
  postSection: "",
  embedmentMm: null,
});
check(
  "the unconfirmed card says 93 bags provisional",
  deckConcreteResultLabel(openPlan.concrete.authority, openPlan.concrete.bags) ===
    "Concrete: 93 bags · Provisional"
);
check(
  "the unconfirmed card says 0.924 m³ bank volume",
  deckExcavationResultLabel(openPlan.geometry?.bankVolumeM3 ?? null) ===
    "Excavation: 0.924 m³ bank volume."
);
check(
  "the unconfirmed card names every open decision",
  openTodo.map((id) => DECK_POST_HOLE_FINISH[id]).join(" | ") ===
    [
      "Confirm hole dimensions",
      "Choose ground",
      "Choose excavation method",
      "Choose spoil destination",
      "Confirm concrete fill",
      "Select post size",
      "Enter embedded depth",
    ].join(" | ")
);
check(
  "the yield card shows 0.01 m³ per 20 kg bag",
  deckConcreteYieldCard(openPlan.concrete.yieldM3, false) === "Yield: 0.01 m³ per 20 kg bag"
);
const openCalculation = openPlan.geometry
  ? deckConcreteCalculationLines({
      holeCount: 16,
      geometry: openPlan.geometry,
      concrete: openPlan.concrete,
    }).join(" ")
  : "";
check(
  "the calculation disclosure keeps the yield explanation and the rounding rule",
  openCalculation.includes("0.01 m³ per bag") &&
    openCalculation.includes("rounded up to the next whole bag") &&
    !openCalculation.includes("Concrete: 93 bags")
);
check(
  "an estimating default post size is not confirmed",
  deckPostSizeStatus("").confirmed === false && deckPostSizeStatus("125x125").confirmed === true
);

const confirmedPlan = planDeckHoleExcavation({
  facts: measuredBase,
  workAreaId: "deck",
  holeCount: 16,
});
const confirmedTodo = deckPostHoleFinishItems({
  sizeConfirmed: true,
  ground: "ordinary",
  method: "hand",
  spoil: "on_site",
  concreteOn: true,
  fill: "full",
  fillDepthMm: null,
  postSection: "125x125",
  embedmentMm: 600,
});
const confirmedCalculation = confirmedPlan.geometry
  ? deckConcreteCalculationLines({
      holeCount: 16,
      geometry: confirmedPlan.geometry,
      concrete: confirmedPlan.concrete,
    }).join(" ")
  : "";
check(
  "the finished card says 78 bags confirmed",
  deckConcreteResultLabel(confirmedPlan.concrete.authority, confirmedPlan.concrete.bags) ===
    "Concrete: 78 bags · Confirmed" && confirmedTodo.length === 0
);
const concreteConfirmedSiteOpen = deckPostHoleFinishItems({
  sizeConfirmed: true,
  ground: "",
  method: "",
  spoil: "undecided",
  concreteOn: true,
  fill: "full",
  fillDepthMm: null,
  postSection: "125x125",
  embedmentMm: 600,
});
check(
  "confirmed concrete leaves ground, method, and spoil open",
  deckConcreteResultLabel(confirmedPlan.concrete.authority, confirmedPlan.concrete.bags) ===
    "Concrete: 78 bags · Confirmed" &&
    concreteConfirmedSiteOpen.map((id) => DECK_POST_HOLE_FINISH[id]).join(" | ") ===
      "Choose ground | Choose excavation method | Choose spoil destination"
);
check(
  "the finished calculation shows displacement, net fill, and bank spoil",
  confirmedPlan.geometry?.bankVolumeM3 === 0.924 &&
    Math.round((confirmedPlan.concrete.displacementM3 ?? 0) * 1000) / 1000 === 0.15 &&
    Math.round((confirmedPlan.concrete.netM3 ?? 0) * 1000) / 1000 === 0.774 &&
    confirmedCalculation.includes("0.150") &&
    confirmedCalculation.includes("0.774")
);
const openGaps = deckDetailGaps(
  [
    fact("deck.substructure_included", true),
    fact("deck.pile_or_post_count", 16),
    fact("deck.concrete_to_supports", true),
  ],
  "deck"
).map((gap) => gap.label);
check(
  "unanswered post holes stay open in the details contract",
  openGaps.join(" | ") ===
    [
      "Confirm hole dimensions",
      "Choose ground",
      "Choose excavation method",
      "Choose spoil destination",
      "Confirm concrete fill",
      "Select post size",
      "Enter embedded depth",
    ].join(" | ")
);
check(
  "a confirmed ordinary hole is complete",
  deckDetailGaps(
    [...measuredBase, fact("deck.spoil_destination", "on_site")],
    "deck"
  ).length === 0
);
check(
  "the first open post-hole answer is the control Complete Deck details focuses",
  firstDeckDetailTarget(
    [fact("deck.substructure_included", true), fact("deck.pile_or_post_count", 16), fact("deck.concrete_to_supports", true)],
    [{ id: "deck", type: "deck" }]
  )?.gapId === "dimensions" &&
    deckPostHoleControlId("deck", "dimensions") === "deck-hole-confirm-deck"
);
check(
  "a provisional concrete block is Needs details, and a changed hole is Needs updating",
  quantityConflictStageStatus(
    "Confirm the concrete fill, post size, and embedded depth before Pricing. The bag count is provisional."
  ) === "Needs details" &&
    quantityConflictStageStatus(
      "Update this estimate before Pricing. Post holes changed."
    ) === "Needs updating"
);

check(
  "partial fill stays on the list until a depth is entered",
  deckPostHoleFinishItems({
    sizeConfirmed: true,
    ground: "ordinary",
    method: "hand",
    spoil: "off_site",
    concreteOn: true,
    fill: "partial",
    fillDepthMm: null,
    postSection: "125x125",
    embedmentMm: 600,
  }).includes("fill") &&
    !deckPostHoleFinishItems({
      sizeConfirmed: true,
      ground: "ordinary",
      method: "hand",
      spoil: "off_site",
      concreteOn: true,
      fill: "partial",
      fillDepthMm: 300,
      postSection: "125x125",
      embedmentMm: 600,
    }).includes("fill")
);

const postHolesUi = readFileSync(
  join(process.cwd(), "components/assistant/job-plan/DeckPostHolesSection.tsx"),
  "utf8"
);
check(
  "post-hole labels name the count once and a saved setup cannot be replaced silently",
  postHolesUi.includes("Number of post holes") &&
    postHolesUi.includes('helper="Count"') &&
    !postHolesUi.includes("holes (count)") &&
    !postHolesUi.includes('unit="text"') &&
    postHolesUi.includes("data-setup-replace") &&
    postHolesUi.includes("data-setup-keep") &&
    !postHolesUi.includes("onClick={useTypicalSetup}") &&
    postHolesUi.includes("Company quantity, bag yield, ground, excavation method, and spoil stay as saved.")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
