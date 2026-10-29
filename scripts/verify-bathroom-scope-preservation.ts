/**
 * Bathroom scope stays on the work card, in the estimate, and in a new draft.
 * Run: npx tsx scripts/verify-bathroom-scope-preservation.ts
 */
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { bathroomJobPlanAdapter } from "../lib/assistant/job-plan/adapters/bathroom";
import { classifyReviewNotice } from "../lib/assistant/presentation/estimate-issues";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
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
  check(`${name} stairs and cleaning`, note.includes("Stair protection is requested") && note.includes("Daily cleaning is requested"));
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
  for (const sentence of [
    "Partial wall lining, extent unknown.",
    "Stair protection is requested.",
    "Daily cleaning is requested.",
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
}

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
