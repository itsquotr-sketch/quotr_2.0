/**
 * Bathroom wall-lining choice, bathroom-owned floor substrate, and
 * unspecified nested ceiling lining. Run:
 * npx tsx scripts/verify-bathroom-ceiling-lining-01.ts
 */
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateCeilings } from "../lib/estimate/calculators/fitout";
import { suggestedBathroomWallLiningSystem } from "../lib/estimate/bathroom-scope";
import {
  CEILING_PROVISIONAL_INSTALL_KEY,
  CEILING_PROVISIONAL_MATERIALS_KEY,
} from "../lib/estimate/ceilings-provisional-package";
import {
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { derivePersistedPricingCostKnown } from "../lib/pricing/authoritative-document-totals";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  briefHasIndependentFlooring,
  clauseIsBathroomSubstrateRebuild,
} from "../lib/work-areas/ownership";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { AIExtractionOutput } from "../lib/ai/schema";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  console.log(`PASS  ${name}`);
}

const BATHROOM_BRIEF =
  "Bathroom renovation only. Room is 2.4 m long by 1.8 m wide, wall height 2.4 m. Relining the walls with specified GIB Aqualine. Rebuild the floor with 19 mm fibre-cement flooring, sheet size 1800 x 900, sheet cost unknown. Include an explicit complete strip-out of the existing bathroom. No tiling, no painting, no stopping, no plumbing changes, and no electrical changes.";

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value, source: "user" };
}

function context(
  area: EstimateWorkArea,
  facts: EstimateFact[],
  briefText: string
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
    facts,
    constraints: [],
    briefText,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 25,
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

function costKnown(item: EstimateLineItemInput): boolean {
  return derivePersistedPricingCostKnown({
    notes_internal: buildLineItemNotes(item),
    total_cost: item.recommendedCost,
    total_sell: item.recommendedSell,
    unit_cost: item.costRate,
  });
}

const bathroomArea: EstimateWorkArea = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom",
  sort_order: 1,
  status: "confirmed",
};

function bathroomFacts(system: string | null): EstimateFact[] {
  const rows: EstimateFact[] = [
    fact("bathroom.job_scope", "b1", "Reline bathroom"),
    fact("bathroom.length_m", "b1", 2.4),
    fact("bathroom.width_m", "b1", 1.8),
    fact("bathroom.wall_height_m", "b1", 2.4),
    fact("bathroom.wall_lining_included", "b1", true),
    fact("bathroom.ceiling_lining_included", "b1", false),
    fact("bathroom.floor_substrate_system", "b1", "19 mm fibre-cement flooring"),
    fact("bathroom.floor_substrate_sheet_size", "b1", "1800 × 900 mm"),
    fact("bathroom.demolition.components", "b1", ["Complete strip-out"]),
    fact("bathroom.demolition_required", "b1", true),
    fact("bathroom.framing_level", "b1", "None"),
    fact("bathroom.tiling_included", "b1", false),
    fact("bathroom.waterproofing_included", "b1", false),
    fact("bathroom.painting_included", "b1", false),
    fact("bathroom.stopping_included", "b1", false),
    fact("bathroom.plumbing.level", "b1", "None"),
    fact("bathroom.electrical.level", "b1", "None"),
  ];
  if (system) rows.push(fact("bathroom.wall_lining_system", "b1", system));
  return rows;
}

check(
  "bathroom brief does not create independent flooring",
  briefHasIndependentFlooring(BATHROOM_BRIEF) === false &&
    extractFlooringPortionsFromBrief(BATHROOM_BRIEF).length === 0
);
check(
  "fibre-cement floor sentence is bathroom substrate",
  clauseIsBathroomSubstrateRebuild(
    "Rebuild the floor with 19 mm fibre-cement flooring, sheet size 1800 x 900, sheet cost unknown",
    BATHROOM_BRIEF
  )
);
check(
  "hallway vinyl stays flooring beside a bathroom renovation",
  briefHasIndependentFlooring(
    "Bathroom renovation. Rebuild the hallway floor with new vinyl plank."
  ) === true
);
check(
  "stated GIB Aqualine is preselected",
  suggestedBathroomWallLiningSystem(BATHROOM_BRIEF) === "GIB Aqualine"
);
check(
  "floor fibre-cement does not preselect the wall",
  suggestedBathroomWallLiningSystem(
    "Bathroom renovation. Rebuild the floor with 19 mm fibre-cement flooring. Relining the walls."
  ) === null
);
check(
  "wall fibre cement is preselected",
  suggestedBathroomWallLiningSystem(
    "Bathroom renovation. Relining the walls with fibre cement sheet."
  ) === "Fibre cement"
);

function labels(items: readonly { label: string }[]): string[] {
  return items.map((item) => item.label);
}

const gib = calculateBathroom(
  context(bathroomArea, bathroomFacts("GIB Aqualine"), BATHROOM_BRIEF),
  bathroomArea
);
const gibSheets = gib.lineItems.filter((item) =>
  item.label.includes("GIB Aqualine")
);
const gibLabour = gib.lineItems.filter((item) => item.label === "Wall lining labour");
check("GIB sheet is emitted once", gibSheets.length === 1, labels(gib.lineItems).join(" | "));
check("GIB wall labour is emitted once", gibLabour.length === 1);
check(
  "GIB sheet is a known cost",
  gibSheets[0] != null && costKnown(gibSheets[0]) && (gibSheets[0].recommendedCost ?? 0) > 0
);
check(
  "complete strip-out is one labour line",
  gib.lineItems.filter((item) => /complete bathroom strip-out/i.test(item.label))
    .length === 1
);
check(
  "bathroom disposal stays visible",
  gib.lineItems.some((item) => /disposal/i.test(item.label))
);
check(
  "GIB estimate has no flooring removal line",
  !gib.lineItems.some((item) => /existing-finish removal|ordinary flooring/i.test(item.label))
);

const fibre = calculateBathroom(
  context(bathroomArea, bathroomFacts("Fibre cement"), BATHROOM_BRIEF),
  bathroomArea
);
const fibreSheets = fibre.lineItems.filter((item) =>
  item.label.includes("fibre cement")
);
check(
  "fibre cement uses its own sheet",
  fibreSheets.length === 1 && !fibre.lineItems.some((item) => /GIB|Aqualine/i.test(item.label)),
  labels(fibre.lineItems).join(" | ")
);
check(
  "unpriced fibre-cement sheet is not a known $0",
  fibreSheets[0] != null &&
    fibreSheets[0].rateSourceType === "missing" &&
    costKnown(fibreSheets[0]) === false
);

const unsure = calculateBathroom(
  context(bathroomArea, bathroomFacts("Not sure"), BATHROOM_BRIEF),
  bathroomArea
);
check(
  "Not sure does not emit GIB",
  !unsure.lineItems.some((item) => /GIB|Aqualine/i.test(item.label))
);
const unsureLining = unsure.lineItems.filter((item) =>
  /wall lining/i.test(item.label)
);
check(
  "Not sure lining supply and install stay Pricing Required",
  unsureLining.length === 2 &&
    unsureLining.every(
      (item) => item.rateSourceType === "missing" && costKnown(item) === false
    ) &&
    unsureLining.every((item) => item.unit === "m2" && (item.quantity ?? 0) > 0),
  labels(unsureLining).join(" | ")
);

function portion(id: string, patch: Partial<CeilingPortion>): CeilingPortion {
  const row = createEmptyCeilingPortion({ id });
  return {
    ...row,
    ...patch,
    geometry: { ...row.geometry, ...patch.geometry },
    structure: { ...row.structure, ...patch.structure },
    lining: { ...row.lining, ...patch.lining },
    finish: { ...row.finish, ...patch.finish },
  };
}

const ceilingArea: EstimateWorkArea = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  sort_order: 1,
  status: "confirmed",
};

const specified = portion("ceiling-portion-a", {
  label: "Portion A",
  geometry: {
    mode: "length_width",
    length_m: 3,
    width_m: 2,
    area_m2: 6,
  },
  structure: { family: "existing_framing", job_scope: "new_ceiling" },
  lining: {
    family: "plasterboard",
    plasterboard_product: "standard",
    thickness_mm: 10,
  },
});
const unknown = portion("ceiling-portion-b", {
  label: "Portion B",
  geometry: {
    mode: "length_width",
    length_m: 4,
    width_m: 3,
    area_m2: 12,
  },
  structure: { family: "existing_framing", job_scope: "new_ceiling" },
  lining: { family: "not_sure" },
});

const nested = calculateCeilings(
  context(
    ceilingArea,
    [fact(CEILINGS_PORTIONS_FACT_KEY, "c1", [specified, unknown])],
    "Ceilings only, two portions."
  ),
  ceilingArea
);
const nestedLabels = labels(nested.lineItems);
check(
  "nested portions do not use the flat provisional package",
  !nested.lineItems.some(
    (item) =>
      item.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY ||
      item.componentKey === CEILING_PROVISIONAL_INSTALL_KEY ||
      /\$75/.test(item.notes ?? "") ||
      /provisional ceiling/i.test(item.label)
  ),
  nestedLabels.join(" | ")
);
const specifiedSheet = nested.lineItems.filter((item) =>
  /portion a/i.test(item.label) && /plasterboard|sheet|fixing/i.test(item.label)
);
check(
  "specified 10 mm portion keeps a detailed lining path",
  nested.lineItems.some(
    (item) =>
      /portion a/i.test(item.label) &&
      /plasterboard/i.test(item.label) &&
      item.unit !== "m2"
  ) &&
    nested.lineItems.some((item) => /portion a/i.test(item.label) && /fixing/i.test(item.label)),
  nestedLabels.join(" | ")
);
const unknownLines = nested.lineItems.filter((item) => /portion b/i.test(item.label));
check(
  "unknown nested lining is Pricing Required at the known area",
  unknownLines.some(
    (item) =>
      item.category === "materials" &&
      item.quantity === 12 &&
      item.unit === "m2" &&
      item.rateSourceType === "missing" &&
      costKnown(item) === false
  ) &&
    unknownLines.some(
      (item) =>
        item.category === "labour" &&
        item.quantity === 12 &&
        item.unit === "m2" &&
        item.rateSourceType === "missing" &&
        costKnown(item) === false &&
        (item.labourHours == null || item.labourHours === 0)
    ) &&
    !unknownLines.some((item) => item.unit === "each" || /sheet/i.test(item.label)),
  unknownLines
    .map((item) => `${item.label} ${item.quantity} ${item.unit} cost ${item.recommendedCost}`)
    .join(" | ")
);

const flat = calculateCeilings(
  context(
    ceilingArea,
    [fact("ceilings.area_m2", "c1", 12)],
    "Flat ceiling, no product named."
  ),
  ceilingArea
);
check(
  "flat unspecified ceiling keeps the provisional package",
  flat.lineItems.some((item) => item.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY) &&
    flat.lineItems.some((item) => item.componentKey === CEILING_PROVISIONAL_INSTALL_KEY)
);

function extractBrief(brief: string): AIExtractionOutput {
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
  }).extraction;
}

const flatBrief =
  "Ceilings only. One ceiling of 12 square metres. No lining product is named and the ceiling is not split into portions. No demolition, no painting, no insulation, and no new framing.";
const flatExtracted = enrichExtractionFromBrief({
  briefText: flatBrief,
  extraction: {
    workAreas: [{ type: "ceilings", confidence: 0.9, rationale: "ai" }],
    facts: [
      {
        work_area_type: "ceilings",
        key: CEILINGS_PORTIONS_FACT_KEY,
        label: "Ceiling portions",
        value: [{ id: "ai-flat", geometry: { area_m2: 12 }, lining: {} }],
        confidence: 0.8,
      },
    ],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  },
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
check(
  "a single unspecified ceiling stays on the flat area",
  flatExtracted.facts.some(
    (fact) => fact.key === "ceilings.area_m2" && fact.value === 12
  ) &&
    !flatExtracted.facts.some((fact) => fact.key === CEILINGS_PORTIONS_FACT_KEY),
  flatExtracted.facts
    .filter((fact) => fact.work_area_type === "ceilings")
    .map((fact) => `${fact.key}=${JSON.stringify(fact.value)}`)
    .join(", ")
);
const specifiedBrief =
  "Ceilings only. One new plasterboard ceiling, standard 10 mm, 3 m long by 2 m wide. No demolition and no new framing.";
const specifiedExtracted = extractBrief(specifiedBrief);
check(
  "a specified 10 mm ceiling stays a nested portion",
  specifiedExtracted.facts.some((fact) => fact.key === CEILINGS_PORTIONS_FACT_KEY)
);
const portionA = createEmptyCeilingPortion({
  id: "ceiling-portion-a",
  label: "Portion A",
});
portionA.geometry = {
  mode: "length_width",
  length_m: 3,
  width_m: 2,
  area_m2: 6,
  perimeter_m: null,
};
portionA.lining.family = "plasterboard";
portionA.lining.thickness_mm = 10;
portionA.lining.plasterboard_product = "standard";
const portionB = createEmptyCeilingPortion({
  id: "ceiling-portion-b",
  label: "Portion B",
});
portionB.geometry = {
  mode: "length_width",
  length_m: 4,
  width_m: 3,
  area_m2: 12,
  perimeter_m: null,
};
portionB.lining.family = "plasterboard";
portionB.lining.plasterboard_product = "standard";
const nestedBrief =
  "Ceilings only, two portions. Portion A is a specified nested plasterboard ceiling, 10 mm standard plasterboard, 3 m long by 2 m wide. Portion B is an unspecified flat ceiling, 4 m long by 3 m wide, no product, thickness, or sheet count.";
const nestedExtracted = enrichExtractionFromBrief({
  briefText: nestedBrief,
  extraction: {
    workAreas: [{ type: "ceilings", confidence: 0.9, rationale: "ai" }],
    facts: [
      {
        work_area_type: "ceilings",
        key: CEILINGS_PORTIONS_FACT_KEY,
        label: "Ceiling portions",
        value: [portionA, portionB],
        confidence: 0.9,
      },
    ],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  },
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
}).extraction;
const nestedPortions = nestedExtracted.facts.find(
  (fact) => fact.key === CEILINGS_PORTIONS_FACT_KEY
)?.value;
const storedPortions = Array.isArray(nestedPortions)
  ? (nestedPortions as CeilingPortion[])
  : [];
const storedA = storedPortions.find((row) => row.label === "Portion A");
const storedB = storedPortions.find((row) => row.label === "Portion B");
check(
  "two ceiling portions stay nested",
  storedPortions.length === 2 &&
    !nestedExtracted.facts.some((fact) => fact.key === "ceilings.area_m2"),
  `count ${storedPortions.length}`
);
check(
  "an unnamed nested portion does not inherit another lining",
  storedA?.lining.family === "plasterboard" &&
    storedA.lining.thickness_mm === 10 &&
    storedB?.lining.family == null &&
    storedB?.lining.plasterboard_product == null &&
    storedB?.geometry.area_m2 === 12,
  `B family ${storedB?.lining.family ?? "null"}`
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("bathroom and ceiling lining checks passed");
