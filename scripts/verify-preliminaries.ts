/**
 * Project preliminaries. Deterministic. No network.
 * Run: npx tsx scripts/verify-preliminaries.ts
 */
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate } from "../components/setup/types";
import { composeBuilderReview, mapRateLabel } from "../lib/assistant/builder-review/compose";
import { projectLabourTakeoff } from "../lib/assistant/presentation/estimate-takeoffs";
import { classifyRateSource, getRateSourceLabel } from "../lib/estimate/rate-source-labels";
import { STAGE_2A_OFFICE_FITOUT_BRIEF } from "./fixtures/stage-2a-original-briefs";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  calculatePreliminaries,
  mergePreliminaries,
  planFromDescriptions,
  planFromFacts,
  preliminaryLabourRate,
  PRELIMINARIES_FACT_KEY,
  quotePreliminary,
  recognisePreliminaries,
  type PreliminaryItem,
  type PreliminariesPlan,
} from "../lib/estimate/preliminaries";
import type { EstimateContext, EstimateLineItemInput } from "../lib/estimate/types";
import {
  buildRecalibrationPreviewData,
  pricingDraftReconciliationBlocked,
  shouldApplyMatchedPricingUpdate,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import { buildPricingCalculationDetails } from "../lib/pricing/calculation-details";
import { presentPricingLine } from "../lib/pricing/line-presentation";
import type { PricingItem } from "../lib/pricing/types";

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error("FAIL", name, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log("ok", name);
}

const labourer: OrganisationRate = {
  id: "rate-labourer",
  rate_type: "labour",
  trade: "labourer",
  work_area_type: null,
  item_key: "labour.labourer.hour",
  label: "Labourer",
  unit: "h",
  cost_rate: 40,
  sell_rate: null,
  markup_percent: null,
  active: true,
};

const carpenter: OrganisationRate = {
  id: "rate-carpenter",
  rate_type: "labour",
  trade: "carpenter",
  work_area_type: null,
  item_key: "labour.carpenter.hour",
  label: "Carpenter",
  unit: "h",
  cost_rate: 75,
  sell_rate: null,
  markup_percent: null,
  active: true,
};

const area = {
  id: "pg",
  type: "preliminaries",
  name: "Preliminaries",
  sort_order: 900,
};

function item(id: string, patch: Partial<PreliminaryItem>): PreliminaryItem {
  const base = recognisePreliminaries(
    id === "site_establishment"
      ? "site establishment"
      : id === "daily_cleaning"
        ? "daily cleaning"
        : id === "supervision"
          ? "supervision"
          : id === "deliveries"
            ? "deliveries"
            : id === "stair_protection"
              ? "protect the stairs"
              : "final cleaning"
  ).items[0];
  if (!base || base.id !== id) throw new Error(`missing ${id}`);
  return { ...base, ...patch };
}

function run(plan: PreliminariesPlan, siblings: EstimateLineItemInput[] = []) {
  return calculatePreliminaries(
    {
      facts: [{ key: PRELIMINARIES_FACT_KEY, work_area_id: null, value: plan }],
      organisationSettings: null,
      rates: [carpenter],
      briefText: null,
    },
    area,
    siblings
  );
}

const office = recognisePreliminaries(STAGE_2A_OFFICE_FITOUT_BRIEF);
check(
  "office keeps the requested preliminaries",
  ["site_establishment", "common_area_protection", "daily_cleaning", "final_cleaning", "deliveries", "supervision"].every(
    (id) => office.items.some((item) => item.id === id)
  )
);
check(
  "office delivery windows are not a delivery charge",
  office.deliveryWindow != null && office.items.filter((item) => item.id === "deliveries").length === 1
);
check(
  "office duration is not a number of days",
  office.items.every((item) => item.occurrences == null && item.hours == null)
);
check(
  "daily cleaning included is not one day",
  recognisePreliminaries("Daily cleaning included.").items[0]?.occurrences == null &&
    recognisePreliminaries("Daily cleaning included.").items[0]?.basis === "unresolved"
);
check(
  "a delivery window alone is not a delivery service",
  recognisePreliminaries("Access is by goods lift during booked delivery windows.").items.every(
    (item) => item.id !== "deliveries"
  ) &&
    recognisePreliminaries("Access is by goods lift during booked delivery windows.").deliveryWindow != null
);

const shared = mergePreliminaries(
  recognisePreliminaries("We need daily cleaning and protection of common areas."),
  recognisePreliminaries("Protect the stairs and clean up daily. Daily cleaning again.")
);
check(
  "shared tasks are not duplicated",
  shared.items.filter((row) => row.id === "daily_cleaning").length === 1 &&
    shared.items.some((row) => row.id === "stair_protection") &&
    shared.items.some((row) => row.id === "common_area_protection")
);
check(
  "repeating recognition does not add a second copy",
  mergePreliminaries(shared, shared).items.length === shared.items.length
);

const priced = run({
  deliveryWindow: office.deliveryWindow,
  items: [
    item("site_establishment", { treatment: "included", basis: "fixed", fixedCost: 1000 }),
    item("daily_cleaning", {
      treatment: "included",
      basis: "occurrences",
      occurrences: 10,
      occurrenceUnit: "day",
      unitCost: 80,
    }),
    item("supervision", {
      treatment: "included",
      basis: "labour_hours",
      hours: 8,
      role: "carpenter",
    }),
    item("final_cleaning", { treatment: "requested" }),
    item("deliveries", {
      treatment: "included",
      provisional: true,
      basis: "fixed",
      fixedCost: 500,
    }),
  ],
});

const establishment = priced.lineItems.find((line) => line.label === "Site establishment");
check(
  "fixed establishment is a combined amount",
  establishment?.recommendedCost === 1000 &&
    establishment.recommendedSell === 1250 &&
    establishment.category === "allowance" &&
    establishment.category !== "materials" &&
    establishment.costComponents == null &&
    establishment.quantityBasis?.formula?.includes("combined amount") === true &&
    establishment.rateSource === "Entered amount"
);
const cleaning = priced.lineItems.find((line) => line.label === "Daily cleaning");
check(
  "an entered amount is not labelled as a benchmark",
  mapRateLabel("Entered amount") === "Entered amount" &&
    mapRateLabel("Entered amount · provisional") === "Entered amount · provisional" &&
    classifyRateSource("Entered amount") !== "benchmark"
);
check(
  "daily cleaning uses the entered days",
  cleaning?.recommendedCost === 800 &&
    cleaning.recommendedSell === 1000 &&
    cleaning.quantity === 10 &&
    cleaning.quantityBasis?.formula === "10 day × $80.00/day."
);
const supervision = priced.lineItems.find((line) => line.label === "Supervision");
check(
  "supervision uses the company labour cost",
  supervision?.recommendedCost === 600 &&
    supervision.recommendedSell === 750 &&
    supervision.category === "labour" &&
    supervision.labourHours === 8 &&
    supervision.rateSource === "Your company rate"
);
const open = priced.lineItems.find((line) => line.label === "Final cleaning");
check(
  "unknown duration stays unresolved",
  open?.includedInTotal === false &&
    open.clientVisible === false &&
    open.recommendedCost === 0 &&
    priced.missingInfo.some((row) => row.includes("Final cleaning") && row.includes("Coverage is unresolved")) &&
    !priced.exclusions.some((row) => row.includes("Final cleaning"))
);
const provisional = priced.lineItems.find((line) => line.label === "Deliveries");
check(
  "a provisional amount stays provisional and priced",
  provisional?.provisional === true &&
    provisional.category === "allowance" &&
    provisional.recommendedCost === 500 &&
    provisional.recommendedSell === 625 &&
    provisional.includedInTotal === true &&
    provisional.rateSource === "Entered amount · provisional"
);
check(
  "accepted office preliminary totals stay priced work only",
  priced.lineItems
    .filter((line) => line.includedInTotal !== false)
    .reduce((sum, line) => sum + line.recommendedCost, 0) === 2900 &&
    priced.lineItems
      .filter((line) => line.includedInTotal !== false)
      .reduce((sum, line) => sum + line.recommendedSell, 0) === 3625
);

const split = run({
  items: [
    item("site_establishment", {
      treatment: "included",
      basis: "fixed",
      materialCost: 400,
      labourCost: 600,
    }),
  ],
  deliveryWindow: null,
});
const splitLine = split.lineItems[0];
check(
  "a supplied split stays materials plus labour",
  splitLine?.category === "mixed" &&
    splitLine.recommendedCost === 1000 &&
    splitLine.costComponents?.materialCost === 400 &&
    splitLine.costComponents.labourCost === 600
);

const noRate = calculatePreliminaries(
  {
    facts: [
      {
        key: PRELIMINARIES_FACT_KEY,
        work_area_id: null,
        value: {
          items: [
            item("supervision", {
              treatment: "included",
              basis: "labour_hours",
              hours: 8,
              role: "carpenter",
            }),
          ],
          deliveryWindow: null,
        },
      },
    ],
    organisationSettings: null,
    rates: [],
    briefText: null,
  },
  area
);
check(
  "missing company labour is not a benchmark amount",
  noRate.lineItems[0]?.includedInTotal === false && noRate.lineItems[0]?.recommendedCost === 0
);

const occupied: EstimateLineItemInput = {
  workAreaId: "bath",
  workAreaName: "Bathroom",
  label: "Demolition",
  category: "labour",
  costLow: 0,
  costHigh: 0,
  sellLow: 0,
  sellHigh: 0,
  recommendedCost: 100,
  recommendedSell: 125,
  grossProfit: 25,
  marginPercent: 20,
  markupPercent: 25,
  rateSource: "Your company rate",
  scopeKey: "bathroom.demolition",
  notes: "Occupied site adds 5% to demolition labour.",
  sortOrder: 1,
};
const besideOccupied = run(
  {
    items: [
      item("daily_cleaning", {
        treatment: "included",
        basis: "occurrences",
        occurrences: 10,
        occurrenceUnit: "day",
        unitCost: 80,
      }),
    ],
    deliveryWindow: null,
  },
  [occupied]
);
check(
  "occupied labour is not payment for daily cleaning",
  besideOccupied.lineItems[0]?.includedInTotal === true &&
    besideOccupied.lineItems[0]?.recommendedCost === 800
);

const namedLikeDelivery: EstimateLineItemInput = {
  ...occupied,
  label: "Delivery of tiles",
  scopeKey: "flooring.material",
  componentKey: "flooring.material",
};
const notNameOverlap = run(
  {
    items: [
      item("deliveries", { treatment: "included", basis: "fixed", fixedCost: 200 }),
    ],
    deliveryWindow: null,
  },
  [namedLikeDelivery]
);
check(
  "a similar name does not suppress deliveries",
  notNameOverlap.lineItems[0]?.includedInTotal === true &&
    notNameOverlap.lineItems[0]?.recommendedCost === 200
);

const realOverlap: EstimateLineItemInput = {
  ...occupied,
  label: "Cartage",
  scopeKey: "project.delivery.cost",
  componentKey: "project.delivery.cost",
};
const blocked = run(
  {
    items: [
      item("deliveries", { treatment: "included", basis: "fixed", fixedCost: 200 }),
    ],
    deliveryWindow: null,
  },
  [realOverlap]
);
check(
  "a matching delivery identity needs clarification",
  blocked.lineItems[0]?.includedInTotal === false &&
    blocked.missingInfo.some((row) => row.includes("project.delivery.cost"))
);
const acknowledged = run(
  {
    items: [
      item("deliveries", {
        treatment: "included",
        basis: "fixed",
        fixedCost: 200,
        overlapAcknowledged: true,
      }),
    ],
    deliveryWindow: null,
  },
  [realOverlap]
);
check(
  "an acknowledged overlap can be priced",
  acknowledged.lineItems[0]?.includedInTotal === true &&
    acknowledged.lineItems[0]?.recommendedCost === 200
);

function persisted(line: EstimateLineItemInput, id: string): EstimateLineItemRow {
  return {
    id,
    work_area_id: line.workAreaId,
    label: line.label,
    category: line.category,
    recommended_cost: line.recommendedCost,
    recommended_sell: line.recommendedSell,
    notes: buildLineItemNotes(line),
    sort_order: line.sortOrder,
    component_key: line.componentKey ?? null,
  };
}

const before = run({
  items: [
    item("daily_cleaning", {
      treatment: "included",
      basis: "occurrences",
      occurrences: 10,
      occurrenceUnit: "day",
      unitCost: 80,
    }),
  ],
  deliveryWindow: null,
});
const after = run({
  items: [
    item("daily_cleaning", {
      treatment: "included",
      basis: "occurrences",
      occurrences: 12,
      occurrenceUnit: "day",
      unitCost: 80,
    }),
  ],
  deliveryWindow: null,
});
const beforeLine = before.lineItems[0];
const afterLine = after.lineItems[0];
if (!beforeLine || !afterLine) throw new Error("missing cleaning lines");
const pricing = {
  id: "price-1",
  org_id: "org",
  pricing_document_id: "doc",
  project_id: "project",
  work_area_id: "pg",
  source_estimate_line_item_id: "line-1",
  component_key: "preliminaries.daily_cleaning",
  item_type: "material",
  delivery_method: "in_house",
  internal_label: beforeLine.label,
  client_label: beforeLine.label,
  internal_description: beforeLine.notes ?? null,
  client_description: null,
  quantity: beforeLine.quantity ?? null,
  unit: beforeLine.unit ?? null,
  unit_cost: null,
  unit_sell: null,
  total_cost: beforeLine.recommendedCost,
  total_sell: beforeLine.recommendedSell,
  gross_profit: 0,
  margin_percent: 0,
  markup_percent: 0,
  visible_on_quote: true,
  optional: false,
  sort_order: 1,
  notes_internal: buildLineItemNotes(beforeLine),
  notes_client: null,
  created_at: "",
  updated_at: "",
  manually_edited: false,
  orphaned: false,
  recalibration_note: null,
  calculation_mode: "lump_sum",
  productivity_rate: null,
  productivity_unit: null,
  calculated_quantity: null,
  cost_known: true,
} satisfies PricingItem;
const preview = buildRecalibrationPreviewData(
  [persisted(afterLine, "line-1")],
  [pricing],
  beforeLine.recommendedSell,
  afterLine.recommendedSell
);
check(
  "a later day count is a pricing change",
  afterLine.recommendedCost === 960 &&
    afterLine.recommendedSell === 1200 &&
    preview.items.some((row) => row.classification === "will_update") &&
    preview.difference === 200
);
const edited = { ...pricing, manually_edited: true };
check(
  "a manual pricing edit is not replaced",
  shouldApplyMatchedPricingUpdate(edited, persisted(afterLine, "line-1")) === false
);
check(
  "an issued snapshot is not reconciled",
  pricingDraftReconciliationBlocked("converted_to_quote") != null
);

const bathroomBrief =
  "Bathroom 2.4 x 2.1. Protect the stairs and clean up daily. Occupied upstairs house.";
const context: EstimateContext = {
  project: { id: "project", qualityLevel: null },
  confirmedWorkAreas: [
    { id: "bath", type: "bathroom", name: "Bathroom", sort_order: 1 },
    area,
  ],
  facts: [
    {
      key: PRELIMINARIES_FACT_KEY,
      work_area_id: null,
      value: planFromFacts([], bathroomBrief),
    },
  ],
  constraints: [],
  organisationSettings: null,
  materialWastageSettings: null,
  rates: [carpenter],
  briefText: bathroomBrief,
};
const estimate = calculateEstimate(context);
const stairLines = estimate.lineItems.filter((line) => line.label === "Stair protection");
const cleaningLines = estimate.lineItems.filter((line) => line.label === "Daily cleaning");
check(
  "bathroom stair protection and daily cleaning are one project item each",
  stairLines.length === 1 &&
    cleaningLines.length === 1 &&
    stairLines[0]?.workAreaName === "Preliminaries" &&
    cleaningLines[0]?.includedInTotal === false &&
    estimate.missingInfo.some((row) => row.includes("Stair protection") && row.includes("Coverage is unresolved"))
);

const repeated = planFromDescriptions([
  {
    role: "project",
    text: "We need daily cleaning and protection of common areas.",
  },
  {
    role: "trade",
    text: "Clean up daily. Include protection of common areas while the walls are open.",
  },
]);
check(
  "the same daily cleaning and protection are one item each",
  repeated.items.filter((row) => row.id === "daily_cleaning").length === 1 &&
    repeated.items.filter((row) => row.id === "common_area_protection").length === 1 &&
    (repeated.reviews ?? []).length === 0
);
const different = planFromDescriptions([
  { role: "project", text: "Include daily cleaning and protection of common areas." },
  { role: "trade", text: "The bathroom needs final cleaning and we must protect the stairs." },
]);
check(
  "daily and final cleaning stay separate, as do the two protections",
  ["daily_cleaning", "final_cleaning", "common_area_protection", "stair_protection"].every(
    (id) => different.items.some((row) => row.id === id)
  ) &&
    different.items.length === 4 &&
    (different.reviews ?? []).length === 0
);
const paraphrased = planFromDescriptions([
  {
    role: "project",
    text: "The job includes daily cleaning. Also include protection of common areas.",
  },
  {
    role: "trade",
    text: "Clean the work area at the end of each working day. Keep the common areas protected while the walls are open.",
  },
]);
check(
  "a paraphrase of the same cleaning or protection is still one charge",
  paraphrased.items.filter((row) => row.id === "daily_cleaning").length === 1 &&
    paraphrased.items.filter((row) => row.id === "common_area_protection").length === 1 &&
    paraphrased.items.length === 2 &&
    (paraphrased.reviews ?? []).length === 0
);
const paraphrasedPriced = calculatePreliminaries(
  {
    facts: [
      {
        key: PRELIMINARIES_FACT_KEY,
        work_area_id: null,
        value: {
          items: paraphrased.items.map((row) =>
            row.id === "daily_cleaning"
              ? { ...row, treatment: "included", basis: "occurrences", occurrences: 10, occurrenceUnit: "day", unitCost: 80 }
              : { ...row, treatment: "included", basis: "fixed", fixedCost: 200 }
          ),
          deliveryWindow: null,
        },
      },
    ],
    organisationSettings: null,
    rates: [carpenter],
    briefText: "The job includes daily cleaning. Also include protection of common areas.",
    confirmedWorkAreas: [
      {
        ...area,
        id: "paint",
        type: "painting",
        name: "Painting",
        quoteDescription:
          "Clean the work area at the end of each working day. Keep the common areas protected while the walls are open.",
      },
    ],
  },
  area
);
check(
  "a paraphrased repeat is not charged a second time",
  paraphrasedPriced.lineItems.filter((line) => line.label === "Daily cleaning").length === 1 &&
    paraphrasedPriced.lineItems.filter((line) => line.label === "Common-area protection").length === 1 &&
    paraphrasedPriced.lineItems.filter((line) => line.includedInTotal !== false).length === 2 &&
    paraphrasedPriced.lineItems
      .filter((line) => line.includedInTotal !== false)
      .reduce((sum, line) => sum + line.recommendedCost, 0) === 1000
);
const uncertain = planFromDescriptions([
  { role: "project", text: "We need daily cleaning and protection of common areas." },
  {
    role: "trade",
    text: "Painting includes a clean of the finished rooms. Also protect the new paint.",
  },
]);
check(
  "an uncertain second mention is a review and not another charge",
  uncertain.items.filter((row) => row.id === "daily_cleaning").length === 1 &&
    uncertain.items.filter((row) => row.id === "common_area_protection").length === 1 &&
    !uncertain.items.some((row) => row.id === "additional_cleaning" || row.id === "additional_protection") &&
    uncertain.reviews?.some((row) => row.id === "cleaning_identity" && row.separate === false) === true &&
    uncertain.reviews?.some((row) => row.id === "protection_identity" && row.separate === false) === true
);
const uncertainPriced = calculatePreliminaries(
  {
    facts: [
      {
        key: PRELIMINARIES_FACT_KEY,
        work_area_id: null,
        value: {
          items: uncertain.items.map((row) =>
            row.id === "daily_cleaning"
              ? { ...row, treatment: "included", basis: "occurrences", occurrences: 10, occurrenceUnit: "day", unitCost: 80 }
              : row.id === "common_area_protection"
                ? { ...row, treatment: "included", basis: "fixed", fixedCost: 200 }
                : row
          ),
          deliveryWindow: null,
        },
      },
    ],
    organisationSettings: null,
    rates: [carpenter],
    briefText: "We need daily cleaning and protection of common areas.",
    confirmedWorkAreas: [
      {
        ...area,
        id: "paint",
        type: "painting",
        name: "Painting",
        quoteDescription: "Painting includes a clean of the finished rooms. Also protect the new paint.",
      },
    ],
  },
  area
);
check(
  "uncertain identity stays out of the total until it is a different service",
  uncertainPriced.lineItems.filter((line) => line.includedInTotal !== false).length === 2 &&
    uncertainPriced.lineItems
      .filter((line) => line.includedInTotal !== false)
      .reduce((sum, line) => sum + line.recommendedCost, 0) === 1000 &&
    uncertainPriced.lineItems.some(
      (line) => line.label === "Cleaning identity" && line.includedInTotal === false && line.recommendedCost === 0
    ) &&
    uncertainPriced.lineItems.some(
      (line) => line.label === "Protection identity" && line.includedInTotal === false
    )
);
const separateDecision = {
  ...uncertain,
  reviews: (uncertain.reviews ?? []).map((review) => ({ ...review, separate: true })),
  items: uncertain.items,
};
const separated = calculatePreliminaries(
  {
    facts: [{ key: PRELIMINARIES_FACT_KEY, work_area_id: null, value: separateDecision }],
    organisationSettings: null,
    rates: [carpenter],
    briefText: null,
  },
  area
);
check(
  "a separate service is still unpriced until an amount is entered",
  separated.lineItems.every(
    (line) =>
      line.label === "Daily cleaning" ||
      line.label === "Common-area protection" ||
      line.includedInTotal === false
  ) &&
    !separated.lineItems.some(
      (line) =>
        (line.label === "Additional cleaning" || line.label === "Additional protection") &&
        line.includedInTotal !== false
    )
);

const labourPreview = preliminaryLabourRate({
  item: item("supervision", { role: "carpenter" }),
  rates: [carpenter],
  settings: null,
});
check(
  "capture uses the company role rate generation will use",
  labourPreview?.hourlyCost === 75 &&
    labourPreview.sourceLabel === "Your company rate" &&
    labourPreview.role === "carpenter"
);
const overridePreview = preliminaryLabourRate({
  item: item("supervision", { role: "carpenter", hourlyCostOverride: 90 }),
  rates: [carpenter],
  settings: null,
});
const overrideQuote = quotePreliminary(
  item("supervision", {
    treatment: "included",
    basis: "labour_hours",
    hours: 8,
    role: "carpenter",
    hourlyCostOverride: 90,
  }),
  [carpenter],
  null
);
check(
  "an explicit project hourly cost replaces the company rate and names its source",
  overridePreview?.hourlyCost === 90 &&
    overridePreview.sourceLabel === "Project hourly cost" &&
    overrideQuote.sourceLabel === "Project hourly cost" &&
    overrideQuote.formula.includes("Project hourly cost")
);
const overridden = run({
  items: [
    item("supervision", {
      treatment: "included",
      basis: "labour_hours",
      hours: 8,
      role: "carpenter",
      hourlyCostOverride: 90,
    }),
  ],
  deliveryWindow: null,
});
check(
  "generation prices the project hourly cost",
  overridden.lineItems[0]?.recommendedCost === 720 &&
    overridden.lineItems[0]?.recommendedSell === 900 &&
    overridden.lineItems[0]?.rateSource === "Project hourly cost" &&
    overridden.lineItems[0]?.itemKey === "labour.carpenter.hour" &&
    presentPricingLine({
      ...pricing,
      id: "price-override",
      item_type: "labour",
      notes_internal: buildLineItemNotes(overridden.lineItems[0]!),
    }).source === "Project hourly cost"
);

const recurring = calculatePreliminaries(
  {
    facts: [
      {
        key: PRELIMINARIES_FACT_KEY,
        work_area_id: null,
        value: {
          items: [
            item("daily_cleaning", {
              treatment: "included",
              basis: "recurring_labour",
              occurrences: 4,
              occurrenceUnit: "day",
              hoursPerOccurrence: 2,
              role: "labourer",
            }),
          ],
          deliveryWindow: null,
        },
      },
    ],
    organisationSettings: null,
    rates: [carpenter, labourer],
    briefText: null,
  },
  area
);
const recurringLine = recurring.lineItems[0];
check(
  "recurring labour is occurrences times hours times the selected role rate",
  recurringLine?.quantity === 4 &&
    recurringLine.labourHours === 8 &&
    recurringLine.recommendedCost === 320 &&
    recurringLine.recommendedSell === 400 &&
    recurringLine.itemKey === "labour.labourer.hour" &&
    recurringLine.costRate === 40 &&
    recurringLine.quantityBasis?.formula === "4 day × 2 h × $40.00/h (Your company rate, Labourer)."
);
const reloaded = calculatePreliminaries(
  {
    facts: [
      {
        key: PRELIMINARIES_FACT_KEY,
        work_area_id: null,
        value: {
          items: [
            item("daily_cleaning", {
              treatment: "included",
              basis: "recurring_labour",
              occurrences: 4,
              occurrenceUnit: "day",
              hoursPerOccurrence: 2,
              role: "labourer",
            }),
          ],
          deliveryWindow: null,
        },
      },
    ],
    organisationSettings: null,
    rates: [carpenter, labourer],
    briefText: null,
  },
  area
);
check(
  "reloading the same recurring plan keeps quantity, hours, cost and sell",
  reloaded.lineItems[0]?.quantity === recurringLine?.quantity &&
    reloaded.lineItems[0]?.labourHours === recurringLine?.labourHours &&
    reloaded.lineItems[0]?.recommendedCost === 320 &&
    reloaded.lineItems[0]?.recommendedSell === 400
);

check(
  "supervision carries the selected role",
  supervision?.itemKey === "labour.carpenter.hour"
);
const supervisionRow: EstimateLineItem = {
  id: "supervision",
  workAreaId: area.id,
  workAreaName: area.name,
  label: supervision?.label ?? "Supervision",
  category: "labour",
  costLow: 0,
  costHigh: 0,
  sellLow: 0,
  sellHigh: 0,
  recommendedCost: supervision?.recommendedCost ?? 0,
  recommendedSell: supervision?.recommendedSell ?? 0,
  grossProfit: 0,
  marginPercent: 20,
  rateSource: supervision?.rateSource ?? "",
  labourHours: supervision?.labourHours,
  quantity: supervision?.quantity,
  unit: supervision?.unit,
  costRate: supervision?.costRate,
  itemKey: supervision?.itemKey,
  includedInTotal: true,
};
const takeoff = projectLabourTakeoff(
  composeBuilderReview({
    estimate: {
      recommendedCost: supervisionRow.recommendedCost,
      recommendedSell: supervisionRow.recommendedSell,
      marginPercent: 20,
      confidence: 70,
      assumptions: [],
      missingInfo: [],
      lineItems: [supervisionRow],
    },
    workAreas: [{ id: area.id, name: area.name, type: area.type, status: "confirmed" }],
  })
);
const takeoffRow = takeoff.groups.flatMap((group) => group.rows).find((row) => row.description === "Supervision");
check(
  "labour takeoff names the selected supervision role",
  takeoffRow?.workerType === "Carpenter" &&
    takeoffRow.hourlyCost === "$75/h" &&
    takeoffRow.hours === "8.00 hrs",
  takeoffRow
);

const fixedQuote = quotePreliminary(
  item("site_establishment", { treatment: "included", basis: "fixed", fixedCost: 1000 }),
  [carpenter],
  null
);
const enteredNotes = buildLineItemNotes(establishment!);
const enteredPricing: PricingItem = {
  ...pricing,
  id: "price-entered",
  item_type: "allowance",
  client_label: "Site establishment",
  internal_label: "Site establishment",
  total_cost: 1000,
  total_sell: 1250,
  notes_internal: enteredNotes,
};
check(
  "a fixed entered amount stays Entered amount through capture, Estimate and Pricing",
  fixedQuote.sourceLabel === "Entered amount" &&
    establishment?.rateSource === "Entered amount" &&
    presentPricingLine(enteredPricing).source === "Entered amount" &&
    buildPricingCalculationDetails(enteredPricing)?.rows.some(
      (row) => row.label === "Rate source" && row.value === "Entered amount"
    ) === true
);
const defaultOnly: PricingItem = {
  ...pricing,
  id: "price-default",
  notes_internal: buildLineItemNotes({
    ...establishment!,
    rateSource: "Default allowance",
    rateSourceType: "default",
  }),
};
check(
  "Default allowance is only the label when that is the source",
  getRateSourceLabel("default") === "Default allowance" &&
    presentPricingLine(defaultOnly).source === "Default allowance" &&
    classifyRateSource("Entered amount") === "default" &&
    mapRateLabel("Entered amount") === "Entered amount"
);

if (process.exitCode) {
  throw new Error("preliminaries verifier failed");
}
console.log("preliminaries verifier passed");
