/**
 * Bathroom scope stays on the work card, in the estimate, and in a new draft.
 * Run: npx tsx scripts/verify-bathroom-scope-preservation.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { bathroomJobPlanAdapter } from "../lib/assistant/job-plan/adapters/bathroom";
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { recognisePreliminaries } from "../lib/estimate/preliminaries";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  buildPricingItemRowFromEstimate,
  buildRecalibrationPreviewData,
  untouchedGeneratedQuoteChange,
  valuesMateriallyMatch,
} from "../lib/pricing/recalibration-helpers";
import {
  estimateLineIsQuoteVisible,
  quoteVisibleExcludedLineBlock,
  unresolvedScopeReviewBlock,
} from "../lib/pricing/scope-finalisation";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import {
  interpretBathroomBrief,
  BATHROOM_PARTIAL_LINING_VALUE,
} from "../lib/estimate/bathroom-brief";
import { suggestedBathroomWallLiningSystem } from "../lib/estimate/bathroom-scope";
import {
  briefHasIndependentFlooring,
  briefHasIndependentPainting,
} from "../lib/work-areas/ownership";
import {
  explicitJobExclusionLines,
  seedPricingClientExclusions,
} from "../lib/quotes/job-exclusions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

const ORIGINAL =
  "bathroom job — floor 2.4 x 2.1, height 2.4. rip out old vanity shower toilet and vinyl. new shower same spot, vanity 900, toilet same spot. gib walls where damaged only, dunno how much yet. tile floor, paint walls ceiling. plumber and sparky separate, don't include their charges. customer buying vanity toilet shower and tiles. we supply other materials. upstairs occupied house, protect stairs and clean up daily. need proper quote.";

const PARAPHRASE =
  "Occupied upstairs bathroom 2.4 by 2.1, 2.4 high. Remove the old vanity, shower, toilet and vinyl. Replace the shower and toilet in the same place and fit a 900 vanity. Repair damaged gib only, extent unknown. Tile the floor and paint the walls and ceiling. Customer supplies the vanity, toilet, shower and tiles. We supply the other materials. Plumbing and electrical are separate and excluded. Protect the stairs and clean up each day.";

const MIXED =
  "Bathroom 2.4 x 2.1 x 2.4 high. Rip out vanity, shower, toilet and vinyl. New shower and toilet same locations, 900mm vanity. Customer supplies the vanity and tiles. We supply the toilet and shower plus other materials. Gib only where damaged, amount unknown. Tile the floor, paint walls and ceiling. Plumber and electrician by others, exclude their charges. Occupied upstairs house, protect stairs, daily cleanup.";

const RELINE =
  "Bathroom renovation only. Room is 2.4 m long by 1.8 m wide, wall height 2.4 m. Relining the walls with specified GIB Aqualine. Rebuild the floor with 19 mm fibre-cement flooring, sheet size 1800 x 900, sheet cost unknown. Include an explicit complete strip-out of the existing bathroom. No tiling, no painting, no stopping, no plumbing changes, and no electrical changes.";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  console.log(`ok    ${name}`);
}

function factValue(
  facts: readonly { key: string; work_area_type?: string | null; value: unknown }[],
  key: string
): unknown {
  return facts.find((fact) => fact.key === key && fact.work_area_type === "bathroom")?.value;
}

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: {
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    },
    allowedTypes: getAnalysisCapableWorkAreaTypes(),
  });
}

function toEstimateFacts(
  facts: readonly { key: string; work_area_type?: string | null; value: unknown }[]
): EstimateFact[] {
  return facts
    .filter((fact) => fact.work_area_type === "bathroom")
    .map((fact) => ({
      key: fact.key,
      work_area_id: "b1",
      value: fact.value,
      source: "ai" as const,
    }));
}

const area: EstimateWorkArea = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
  status: "confirmed",
};

function context(facts: EstimateFact[], brief: string): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
    facts,
    constraints: [{ key: "occupied_site", value: "Yes" }],
    briefText: brief,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function assertPackage(name: string, brief: string, mixedSupply: boolean) {
  const enriched = extract(brief);
  const types = enriched.extraction.workAreas.map((row) => row.type);
  check(`${name} bathroom only`, types.includes("bathroom") && !types.includes("flooring") && !types.includes("painting"), types.join(","));
  check(`${name} no independent floor`, briefHasIndependentFlooring(brief) === false);
  check(`${name} no independent paint`, briefHasIndependentPainting(brief) === false);
  const facts = enriched.extraction.facts;
  check(`${name} scope`, factValue(facts, "bathroom.job_scope") === "custom");
  check(`${name} plan`, factValue(facts, "bathroom.length_m") === 2.4 && factValue(facts, "bathroom.width_m") === 2.1);
  check(`${name} height`, factValue(facts, "bathroom.wall_height_m") === 2.4);
  const components = factValue(facts, "bathroom.demolition.components");
  check(
    `${name} removals`,
    Array.isArray(components) &&
      ["vanity", "shower", "toilet", "floor_finish"].every((id) => components.includes(id))
  );
  check(`${name} partial lining`, factValue(facts, "bathroom.wall_lining_included") === BATHROOM_PARTIAL_LINING_VALUE);
  check(`${name} no lining system`, factValue(facts, "bathroom.wall_lining_system") == null);
  check(`${name} floor tile`, factValue(facts, "bathroom.floor_finish_system") === "tile");
  check(`${name} walls not tiled`, factValue(facts, "bathroom.tile_extent") === "none");
  check(`${name} paint`, factValue(facts, "bathroom.painting_included") === true);
  check(`${name} trades excluded`, factValue(facts, "bathroom.plumbing.level") === "none" && factValue(facts, "bathroom.electrical.level") === "none");
  check(`${name} waterproofing not inferred`, factValue(facts, "bathroom.waterproofing_included") == null && factValue(facts, "bathroom.waterproofing_extent") == null);
  const note = String(factValue(facts, "bathroom.coverage_note") ?? "");
  check(`${name} vanity 900`, note.includes("Vanity specification: 900 mm."));
  check(`${name} same spots`, note.includes("Shower replacement stays in the existing location.") && note.includes("Toilet replacement stays in the existing location."));
  check(`${name} occupied`, note.includes("Upstairs occupied house."));
  check(
    `${name} stairs and cleaning are project preliminaries`,
    !note.includes("Stair protection is requested") &&
      !note.includes("Daily cleaning is requested") &&
      recognisePreliminaries(brief).items.some((item) => item.id === "stair_protection") &&
      recognisePreliminaries(brief).items.some((item) => item.id === "daily_cleaning")
  );
  check(`${name} ancillaries`, note.includes("Contractor-supplied ancillary materials"));
  check(`${name} exclusion sentence`, note.includes("Excluded trades: plumbing, electrical."));
  check(
    `${name} occupied constraint`,
    enriched.constraints.some((row) => row.key === "occupied_site")
  );
  if (mixedSupply) {
    check(`${name} vanity install only`, factValue(facts, "bathroom.fixture.vanity.ownership") === "Install only");
    check(`${name} toilet supplied by us`, factValue(facts, "bathroom.fixture.toilet.ownership") === "Supply and install");
    check(`${name} shower supplied by us`, factValue(facts, "bathroom.fixture.shower.ownership") === "Supply and install");
    check(`${name} not all fixtures client supplied`, factValue(facts, "bathroom.fixtures_client_supplied") !== true);
    check(`${name} tiles customer`, note.includes("Customer-supplied: vanity, tiles."));
  } else {
    check(`${name} fixtures client supplied`, factValue(facts, "bathroom.fixtures_client_supplied") === true);
    check(`${name} vanity install only`, factValue(facts, "bathroom.fixture.vanity.ownership") === "Install only");
    check(`${name} tiles customer`, /Customer-supplied:.*tiles/.test(note));
  }

  const estimateFacts = toEstimateFacts(facts);
  const card = bathroomJobPlanAdapter.project(
    { id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" },
    { facts: estimateFacts, constraints: [], qualityLevel: null, briefText: brief }
  );
  const labels = [...card.included, ...card.notIncluded, ...card.notConfirmed].map((row) => row.label);
  for (const expected of [
    "Remove existing vanity",
    "Remove existing shower",
    "Remove existing toilet",
    "Remove existing vinyl",
    "900 mm vanity",
    "New shower in the existing location",
    "New toilet in the existing location",
    "Floor tiling",
    "Paint walls and ceiling",
    "Partial wall lining, extent unknown. Full-wall relining is not assumed. Coverage is unresolved.",
    "Plumbing charges excluded",
    "Electrical charges excluded",
    "Upstairs occupied house",
  ]) {
    check(`${name} card ${expected.slice(0, 42)}`, labels.some((label) => label.includes(expected.slice(0, 24))));
  }
  check(`${name} waterproofing still open`, card.notConfirmed.some((row) => row.label === "Waterproofing"));
  const titledFacts = estimateFacts.map((fact) =>
    fact.key === "bathroom.plumbing.level" || fact.key === "bathroom.electrical.level"
      ? { ...fact, value: "None" }
      : fact
  );
  const titledCard = bathroomJobPlanAdapter.project(
    { id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" },
    { facts: titledFacts, constraints: [], qualityLevel: null, briefText: brief }
  );
  check(
    `${name} None still excludes trades`,
    titledCard.notIncluded.some((row) => row.label === "Plumbing charges excluded") &&
      titledCard.notIncluded.some((row) => row.label === "Electrical charges excluded")
  );
  const clarify = composeClarifyView({
    stage: "work_area_questions",
    briefText: brief,
    qualityLevel: null,
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts: estimateFacts,
    constraints: [
      { key: "site_access", value: "Easy" },
      { key: "occupied_site", value: "Yes" },
    ],
    jobPlan: {
      cards: [
        {
          workAreaId: "b1",
          workAreaType: "bathroom",
          name: "Bathroom",
          included: [],
          notIncluded: [],
          notConfirmed: card.notConfirmed.map((row) => ({
            id: row.id,
            label: row.label,
            sourceFactKey: row.sourceFactKey,
            write: row.write,
            workAreaId: "b1",
          })),
        },
      ],
    },
  });
  const waterproofing = [...clarify.candidates, ...clarify.deferred].find(
    (row) => row.factKey === "bathroom.waterproofing_included"
  );
  check(
    `${name} waterproofing stays asked`,
    waterproofing != null && waterproofing.question === "Is waterproofing required?"
  );
  check(
    `${name} waterproofing does not block the partial estimate`,
    waterproofing != null &&
      !isInitialCaptureQuestion(waterproofing) &&
      waterproofing.blocksEstimate === false &&
      waterproofing.assumable === false
  );
  check(
    `${name} waterproofing is not assumed`,
    !clarify.assumptions.some((row) => /waterproof/i.test(row.statement)) &&
      !clarify.estimateNowAssumptions.some((row) => /waterproof/i.test(row.statement))
  );

  const result = calculateBathroom(context(estimateFacts, brief), area);
  const included = result.lineItems.filter((item) => item.includedInTotal !== false);
  const labelsOut = result.lineItems.map((item) => `${item.label} ${item.includedInTotal === false ? "OUT" : "IN"} ${item.recommendedCost}`);
  check(`${name} vanity install priced`, included.some((item) => item.label === "Vanity installation" && item.recommendedCost > 0), labelsOut.join(" | "));
  check(`${name} tile install kept`, included.some((item) => item.label === "Floor tiler installation"));
  check(`${name} tile supply not in total`, result.lineItems.some((item) => item.label === "Floor tile supply allowance" && item.includedInTotal === false && item.recommendedCost === 0));
  check(`${name} tile supply not included`, !included.some((item) => item.label === "Floor tile supply allowance"));
  check(`${name} painting priced`, included.some((item) => item.label === "Painting" && item.recommendedCost > 0));
  check(`${name} demolition priced`, included.some((item) => /demolition|removal/i.test(item.label) && item.recommendedCost > 0), labelsOut.join(" | "));
  check(`${name} no plumbing charge`, !included.some((item) => /plumb/i.test(item.label)));
  check(`${name} no electrical charge`, !included.some((item) => /electr/i.test(item.label)));
  check(`${name} no waterproofing charge`, !included.some((item) => /waterproof/i.test(item.label)));
  check(
    `${name} partial lining not full wall`,
    result.lineItems.some((item) => item.label === "Partial wall lining" && item.includedInTotal === false) &&
      !result.lineItems.some((item) => item.label === "Wall lining" && item.quantity > 10)
  );
  check(
    `${name} stair and daily cleaning are not bathroom lines`,
    !result.lineItems.some((item) => item.label === "Stair protection" || item.label === "Daily cleaning") &&
      !result.missingInfo.some((row) => /Stair protection|Daily cleaning/.test(row))
  );
  for (const sentence of [
    "Partial wall lining, extent unknown.",
    "Contractor-supplied ancillary materials are requested.",
  ]) {
    check(
      `${name} gap ${sentence.slice(0, 28)}`,
      result.missingInfo.some((row) => row.includes(sentence)) &&
        result.missingInfo.some((row) => row.includes(sentence) && classifyReviewNotice(row) === "scope_gap")
    );
  }
  check(`${name} exclusions`, result.exclusions.includes("Plumbing charges") && result.exclusions.includes("Electrical charges"));
  const draft = seedPricingClientExclusions({
    templateLines: [],
    jobLines: explicitJobExclusionLines(estimateFacts),
  });
  check(
    `${name} draft exclusions`,
    draft.lines.some((line) => line.toLowerCase().includes("plumbing")) &&
      draft.lines.some((line) => line.toLowerCase().includes("electrical")) &&
      draft.preservedEdit === false
  );
  const known = included
    .filter((item) => item.rateSourceType !== "missing")
    .reduce((sum, item) => sum + item.recommendedCost, 0);
  check(`${name} known cost is partial`, known > 0 && result.missingInfo.some((row) => /coverage is unresolved/i.test(row)));
  const quoteRow = (label: string) => {
    const item = result.lineItems.find((row) => row.label === label);
    if (!item) return null;
    return buildPricingItemRowFromEstimate(
      {
        id: "line",
        work_area_id: "b1",
        label: item.label,
        category: item.category,
        recommended_cost: item.recommendedCost,
        recommended_sell: item.recommendedSell,
        notes: buildLineItemNotes(item),
        sort_order: item.sortOrder,
      },
      "org",
      "doc",
      "project",
      1
    );
  };
  check(`${name} priced work stays on the quote`, quoteRow("Vanity installation")?.visible_on_quote === true);
  check(`${name} tile supply stays off the quote`, quoteRow("Floor tile supply allowance")?.visible_on_quote === false);
  check(`${name} unresolved lining stays off the quote`, quoteRow("Partial wall lining")?.visible_on_quote === false);
  check(`${name} stair protection is not a bathroom quote row`, quoteRow("Stair protection") == null);

  const vanity = included.find((item) => item.label === "Vanity installation");
  const tiler = included.find((item) => item.label === "Floor tiler installation");
  const painting = included.find((item) => item.label === "Painting");
  const disposal = included.find((item) => item.label === "Bathroom disposal");
  check(`${name} vanity hours stay 4`, vanity?.quantity === 4, String(vanity?.quantity));
  check(`${name} tiler uses net floor`, tiler?.quantity === 5.04, String(tiler?.quantity));
  check(`${name} paint uses walls and ceiling`, painting?.quantity === 26.64, String(painting?.quantity));
  check(`${name} disposal is the standard allowance`, disposal?.recommendedCost === 650, String(disposal?.recommendedCost));
  check(
    `${name} occupied adjusts demolition only`,
    result.assumptions.some((row) =>
      row.includes("Occupied site adds 5% to bathroom demolition labour hours only.")
    ) &&
      included.find((item) => item.label === "Floor finish removal")?.quantity === 1.32 &&
      included.find((item) => item.label === "Vanity removal")?.quantity === 0.35 &&
      included.find((item) => item.label === "Toilet removal")?.quantity === 0.18 &&
      included.find((item) => item.label === "Shower / enclosure removal")?.quantity === 1.58
  );
  check(
    `${name} open specs are not priced`,
    !result.lineItems.some((item) => /waterproof|substrate|tile format|wall lining system/i.test(item.label))
  );

  if (mixedSupply) {
    const toiletSupply = included.find((item) => item.label === "Toilet supply PC allowance");
    const showerSupply = included.find((item) => item.label === "Shower tray/base supply PC allowance");
    check(`${name} contractor toilet supply priced`, (toiletSupply?.recommendedCost ?? 0) > 0, String(toiletSupply?.recommendedCost));
    check(`${name} contractor shower supply priced`, (showerSupply?.recommendedCost ?? 0) > 0, String(showerSupply?.recommendedCost));
    check(
      `${name} supply does not add plumber install`,
      !result.lineItems.some((item) => /toilet installation|shower installation/i.test(item.label)) &&
        result.lineItems
          .filter((item) => item.label.endsWith("supply PC allowance"))
          .every((item) => !/included in plumbing scope/i.test(item.identitySummary ?? ""))
    );
    check(
      `${name} plumber install stays excluded`,
      result.assumptions.some((row) => row.includes("Toilet installation is a plumber charge and is excluded")) &&
        result.assumptions.some((row) => row.includes("Shower tray/base installation is a plumber charge and is excluded"))
    );
    check(
      `${name} customer supply keeps ancillaries`,
      result.lineItems.some(
        (item) => item.label === "Ancillary materials" && item.includedInTotal === false
      ) && included.some((item) => item.label === "Vanity installation")
    );
  }

  const lining = quoteRow("Partial wall lining");
  const liningEstimate = result.lineItems.find((item) => item.label === "Partial wall lining");
  if (lining && liningEstimate) {
    const estimateLine = {
      id: "line",
      work_area_id: "b1",
      label: liningEstimate.label,
      category: liningEstimate.category,
      recommended_cost: liningEstimate.recommendedCost,
      recommended_sell: liningEstimate.recommendedSell,
      notes: buildLineItemNotes(liningEstimate),
      sort_order: liningEstimate.sortOrder,
      quantity: liningEstimate.quantity,
      unit: liningEstimate.unit,
    };
    const hidden = lining as unknown as PricingItem;
    const shown = { ...hidden, visible_on_quote: true } as PricingItem;
    check(
      `${name} money match ignores quote visibility`,
      valuesMateriallyMatch(hidden, estimateLine as never) &&
        valuesMateriallyMatch(shown, estimateLine as never)
    );
    const visibilityPreview = buildRecalibrationPreviewData(
      [estimateLine as never],
      [shown],
      shown.total_sell,
      shown.total_sell
    );
    const visibilityRow = visibilityPreview.items.find(
      (row) => row.pricingItemId === shown.id
    );
    check(
      `${name} visibility-only change is offered for update`,
      untouchedGeneratedQuoteChange(hidden, estimateLine as never) === "same" &&
        untouchedGeneratedQuoteChange(shown, estimateLine as never) === "hide" &&
        visibilityRow?.classification === "will_update" &&
        visibilityRow.beforeSell === visibilityRow.afterSell &&
        visibilityPreview.difference === 0
    );
    check(`${name} hidden row is not a free quote item`, quoteVisibleExcludedLineBlock([hidden]) == null);
    check(
      `${name} showing the row blocks review`,
      quoteVisibleExcludedLineBlock([shown]) != null
    );
    const projected = mapPricingItemsToQuoteItems(
      [hidden, quoteRow("Vanity installation") as unknown as PricingItem],
      new Map([["b1", "Bathroom"]])
    );
    check(
      `${name} quote projection omits the unresolved row`,
      projected.every((item) => item.label !== "Partial wall lining") &&
        projected.some((item) => item.label === "Vanity installation")
    );
  }
  check(
    `${name} coverage gaps still block review`,
    unresolvedScopeReviewBlock(result.missingInfo) != null
  );
  check(
    `${name} hiding does not clear the gap`,
    result.missingInfo.some((row) => row.includes("Partial wall lining")) &&
      result.missingInfo.some((row) => classifyReviewNotice(row) === "scope_gap")
  );
}

check(
  "a new pricing row hides work that is outside the total",
  estimateLineIsQuoteVisible({ includedInTotal: false }) === false &&
    estimateLineIsQuoteVisible({ clientVisible: false }) === false &&
    estimateLineIsQuoteVisible({}) === true
);
check("reline brief is not this package", interpretBathroomBrief(RELINE) == null);
check("damaged gib is not full aqualine", suggestedBathroomWallLiningSystem(ORIGINAL) == null);
check(
  "stated aqualine still preselects",
  suggestedBathroomWallLiningSystem(RELINE) === "GIB Aqualine"
);
check(
  "hallway vinyl stays flooring",
  briefHasIndependentFlooring("Bathroom renovation. Lay vinyl plank in the hallway.") === true
);

assertPackage("original", ORIGINAL, false);
assertPackage("paraphrase", PARAPHRASE, false);
assertPackage("mixed", MIXED, true);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("bathroom scope preservation passed");
