/**
 * Explicit-exclusion precedence. Deterministic. No model, network, or database.
 * Expectations are frozen in scripts/fixtures/explicit-exclusion-expectations.json.
 */
import { readFileSync } from "node:fs";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { reanalysisFactWrite } from "../lib/ai/mappers";
import { validateAndFilterExtraction } from "../lib/ai/schema";
import { doorsJobPlanAdapter } from "../lib/assistant/job-plan/adapters/doors";
import { internalWallsJobPlanAdapter } from "../lib/assistant/job-plan/adapters/internal-walls";
import { calculateDoors, calculateInternalWalls, calculatePainting } from "../lib/estimate/calculators/fitout";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
} from "../lib/estimate/internal-walls-finish";
import { nextInternalWallsFinishField } from "../lib/estimate/internal-walls-finish";
import { parseInternalWallsJobScope } from "../lib/estimate/internal-walls-scope";
import {
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
  wallTypeFieldCurrentValue,
} from "../lib/estimate/internal-walls-wall-types";
import {
  explicitJobExclusionLines,
  jobExclusionLine,
  seedPricingClientExclusions,
} from "../lib/quotes/job-exclusions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { stripImplicitScopeExclusions } from "../lib/scopes/strip-implicit-scope-exclusions";

const expectations = JSON.parse(
  readFileSync(
    new URL("./fixtures/explicit-exclusion-expectations.json", import.meta.url),
    "utf8"
  )
) as {
  variation: CaseExpect;
  original: CaseExpect;
  shorthand: CaseExpect;
  mixed: MixedExpect;
  unmentioned: UnknownExpect;
  contradiction: { brief: string; painting: string; warning: string };
  userDecision: {
    existingSource: string;
    existingValue: boolean;
    extractedValue: boolean;
    action: string;
  };
  existingDraft: { lines: string[] };
};

type Stance = "excluded" | "unknown" | "contradiction";

type CaseExpect = {
  brief: string;
  painting: Stance;
  skirting: Stance;
  electrical: Stance;
  doorPainting?: Stance;
  wallHeightM?: number;
  wallLengthLm?: number;
  doorHeightMm?: number;
  doorHeightAuthority?: string;
  paintingWorkArea: boolean;
  cardExcluded: string[];
  cardMustNotInclude?: string[];
  cardMustNotConfirm?: string[];
  pricing: string[];
  pricingMustNotInclude?: string[];
};

type MixedExpect = {
  brief: string;
  painting: Stance;
  skirting: Stance;
  electrical: Stance;
  paintingWorkArea: boolean;
  paintingAreaM2: number;
  paintingLineQuantity: number;
  pricingIncludes: string[];
  pricingMustNotInclude: string[];
};

type UnknownExpect = {
  brief: string;
  painting: Stance;
  skirting: Stance;
  electrical: Stance;
  doorPainting: Stance;
  paintingWorkArea: boolean;
  cardMustNotInclude: string[];
  pricingMustNotInclude: string[];
};

const allowed = getAnalysisCapableWorkAreaTypes();
const catalogue = SCOPE_CATALOGUE.map((item) => item.type);
const ASKED = [
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
];
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log("ok", name);
    return;
  }
  failed += 1;
  console.log("FAIL", name, detail ?? "");
}

function emptyExtraction(): AIExtractionOutput {
  return {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  };
}

function analyse(brief: string, extraction = emptyExtraction()): AIExtractionOutput {
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction,
    allowedTypes: allowed,
  });
  return stripImplicitScopeExclusions(
    normaliseAIExtraction(
      validateAndFilterExtraction(enriched.extraction, allowed, catalogue)
    ),
    brief
  );
}

function fact(output: AIExtractionOutput, key: string) {
  return output.facts.find((row) => row.key === key);
}

function wallType(output: AIExtractionOutput): Record<string, unknown> | null {
  const value = fact(output, "internal_walls.wall_types")?.value;
  return Array.isArray(value) ? ((value[0] as Record<string, unknown>) ?? null) : null;
}

function stanceOf(
  output: AIExtractionOutput,
  booleanKey: string,
  field: "painting" | "skirting" | "electrical"
): Stance {
  const value = fact(output, booleanKey)?.value;
  const stored = wallType(output)?.[field];
  if (value === false || stored === "none") return "excluded";
  if (value == null && (stored == null || stored === undefined)) return "unknown";
  return "contradiction";
}

function idsFor(output: AIExtractionOutput): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const area of output.workAreas) {
    if (!ids[area.type]) ids[area.type] = area.type;
  }
  if (!ids.internal_walls) ids.internal_walls = "internal_walls";
  if (!ids.doors) ids.doors = "doors";
  if (!ids.painting) ids.painting = "painting";
  return ids;
}

function estimateFacts(output: AIExtractionOutput): EstimateFact[] {
  const ids = idsFor(output);
  return output.facts.map((row) => ({
    key: row.key,
    work_area_id: row.work_area_type ? ids[row.work_area_type] ?? row.work_area_type : null,
    value: row.value,
    source: "ai_extracted",
  }));
}

function workAreas(output: AIExtractionOutput): EstimateWorkArea[] {
  const ids = idsFor(output);
  return output.workAreas.map((area, index) => ({
    id: ids[area.type] ?? area.type,
    type: area.type,
    name: area.name ?? area.type,
    sort_order: index,
  })) as EstimateWorkArea[];
}

function context(output: AIExtractionOutput): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas(output),
    facts: estimateFacts(output),
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function chargeText(output: AIExtractionOutput): string {
  const ctx = context(output);
  const areas = workAreas(output);
  const walls = areas.find((area) => area.type === "internal_walls");
  const doors = areas.find((area) => area.type === "doors");
  const chunks: unknown[] = [];
  if (walls) {
    const result = calculateInternalWalls(ctx, walls);
    chunks.push(result.lineItems, result.requirements ?? []);
  }
  if (doors) {
    const result = calculateDoors(ctx, doors);
    chunks.push(result.lineItems, result.requirements ?? []);
  }
  return JSON.stringify(chunks).toLowerCase();
}

function cardLabels(output: AIExtractionOutput): { included: string[]; excluded: string[]; confirm: string[] } {
  const facts = estimateFacts(output);
  const included: string[] = [];
  const excluded: string[] = [];
  const confirm: string[] = [];
  const adapterContext = {
    facts,
    constraints: [],
    qualityLevel: null,
    briefText: null,
  };
  for (const area of output.workAreas) {
    const input = {
      id: idsFor(output)[area.type] ?? area.type,
      type: area.type,
      name: area.name ?? area.type,
      status: "confirmed" as const,
    };
    const card =
      area.type === "internal_walls"
        ? internalWallsJobPlanAdapter.project(input, adapterContext)
        : area.type === "doors"
          ? doorsJobPlanAdapter.project(input, adapterContext)
          : null;
    if (!card) continue;
    included.push(...card.included.map((item) => item.label));
    excluded.push(...card.notIncluded.map((item) => item.label));
    confirm.push(...card.notConfirmed.map((item) => item.label));
  }
  return { included, excluded, confirm };
}

function finishQuestion(output: AIExtractionOutput): string | null {
  const facts = estimateFacts(output);
  const wallsId = idsFor(output).internal_walls ?? "internal_walls";
  const resolved = resolveInternalWallsWallTypes({ facts, workAreaId: wallsId });
  const type = resolved.types[0] ?? null;
  const jobScope = parseInternalWallsJobScope(
    facts.find((row) => row.key === "internal_walls.job_scope" && row.work_area_id === wallsId)?.value
  );
  return nextInternalWallsFinishField({ type, jobScope });
}

function assertExcludedCase(name: string, expected: CaseExpect, output: AIExtractionOutput): void {
  const wall = wallType(output);
  const door = fact(output, "doors.portions");
  const portion = Array.isArray(door?.value)
    ? (door.value[0] as Record<string, unknown> | undefined)
    : undefined;
  check(`${name} painting excluded`, stanceOf(output, "internal_walls.painting_included", "painting") === "excluded", wall);
  check(`${name} skirting excluded`, stanceOf(output, "internal_walls.skirtings_included", "skirting") === "excluded", wall);
  const resolvedElectrical = resolveInternalWallsWallTypes({
    facts: estimateFacts(output),
    workAreaId: idsFor(output).internal_walls ?? "internal_walls",
  }).types[0]?.electrical;
  check(`${name} electrical excluded`, resolvedElectrical === "none" || wall?.electrical === "none", {
    raw: wall?.electrical,
    resolved: resolvedElectrical,
  });
  if (expected.doorPainting === "excluded") {
    check(
      `${name} door painting excluded`,
      fact(output, "doors.painting_included")?.value === false,
      fact(output, "doors.painting_included")
    );
  }
  if (expected.wallHeightM != null) {
    check(`${name} wall height`, wall?.height_m === expected.wallHeightM, wall?.height_m);
  }
  if (expected.wallLengthLm != null) {
    check(`${name} wall length`, wall?.length_lm === expected.wallLengthLm, wall?.length_lm);
  }
  if (expected.doorHeightMm != null) {
    check(
      `${name} door height stays the disclosed default`,
      portion?.height_mm === expected.doorHeightMm &&
        (expected.doorHeightAuthority == null ||
          portion?.height_authority === expected.doorHeightAuthority),
      portion
    );
  }
  check(
    `${name} painting work area`,
    output.workAreas.some((area) => area.type === "painting") === expected.paintingWorkArea,
    output.workAreas.map((area) => area.type)
  );
  const cards = cardLabels(output);
  for (const label of expected.cardExcluded) {
    check(`${name} card shows ${label}`, cards.excluded.includes(label), cards);
  }
  for (const label of expected.cardMustNotInclude ?? []) {
    check(
      `${name} card omits ${label}`,
      !cards.included.includes(label) && !cards.excluded.includes(label),
      cards
    );
  }
  for (const label of expected.cardMustNotConfirm ?? []) {
    check(
      `${name} card does not leave ${label} unconfirmed`,
      cards.confirm.every((row) => !row.includes(label)),
      cards.confirm
    );
  }
  const asked = finishQuestion(output);
  check(
    `${name} details do not ask for excluded finishes`,
    asked == null || !ASKED.includes(asked),
    asked
  );
  const current = (() => {
    const facts = estimateFacts(output);
    const resolved = resolveInternalWallsWallTypes({
      facts,
      workAreaId: idsFor(output).internal_walls ?? "internal_walls",
    }).types[0];
    return {
      painting: wallTypeFieldCurrentValue(resolved ?? null, INTERNAL_WALLS_PAINTING_SIDES_KEY),
      skirting: wallTypeFieldCurrentValue(resolved ?? null, INTERNAL_WALLS_SKIRTING_SIDES_KEY),
      electrical: wallTypeFieldCurrentValue(resolved ?? null, INTERNAL_WALLS_ELECTRICAL_KEY),
      next: nextInternalWallsWallTypeField({
        type: resolved ?? null,
        jobScope: parseInternalWallsJobScope(
          facts.find((row) => row.key === "internal_walls.job_scope")?.value
        ),
      }),
    };
  })();
  check(`${name} painting answer is No`, current.painting === "No", current);
  check(`${name} skirting answer is No`, current.skirting === "No", current);
  check(`${name} electrical answer is No`, current.electrical === "No", current);
  const charges = chargeText(output);
  check(`${name} quantities omit painting`, !charges.includes("paint"), charges);
  check(`${name} quantities omit skirting`, !charges.includes("skirt"), charges);
  check(`${name} quantities omit electrical`, !charges.includes("electric"), charges);
  const pricing = explicitJobExclusionLines(output.facts);
  for (const label of expected.pricing) {
    check(`${name} pricing keeps ${label}`, pricing.some((line) => line.includes(label)), pricing);
  }
  for (const label of expected.pricingMustNotInclude ?? []) {
    check(`${name} pricing omits ${label}`, pricing.every((line) => !line.includes(label)), pricing);
  }
}

const variation = analyse(expectations.variation.brief);
assertExcludedCase("variation", expectations.variation, variation);

const modelIncluded = emptyExtraction();
modelIncluded.facts.push({
  work_area_type: "internal_walls",
  key: "internal_walls.painting_included",
  label: "Painting",
  value: true,
  confidence: 0.9,
});
modelIncluded.workAreas.push({
  type: "internal_walls",
  confidence: 0.9,
  rationale: "Model kept the wall and reversed the painting exclusion.",
});
const corrected = analyse(expectations.variation.brief, modelIncluded);
check(
  "model inclusion does not survive an explicit exclusion",
  fact(corrected, "internal_walls.painting_included")?.value === false &&
    wallType(corrected)?.painting === "none",
  {
    boolean: fact(corrected, "internal_walls.painting_included")?.value,
    painting: wallType(corrected)?.painting,
  }
);

assertExcludedCase("original", expectations.original, analyse(expectations.original.brief));
assertExcludedCase("shorthand", expectations.shorthand, analyse(expectations.shorthand.brief));

const mixed = analyse(expectations.mixed.brief);
check(
  "mixed wall painting stays excluded",
  stanceOf(mixed, "internal_walls.painting_included", "painting") === "excluded",
  wallType(mixed)
);
check(
  "mixed skirting stays excluded",
  stanceOf(mixed, "internal_walls.skirtings_included", "skirting") === "excluded"
);
check("mixed electrical stays excluded", wallType(mixed)?.electrical === "none", wallType(mixed)?.electrical);
check(
  "mixed ceiling painting remains a work area",
  mixed.workAreas.some((area) => area.type === "painting"),
  mixed.workAreas.map((area) => area.type)
);
check(
  "mixed ceiling area is kept",
  fact(mixed, "painting.internal_area_m2")?.value === expectations.mixed.paintingAreaM2,
  fact(mixed, "painting.internal_area_m2")
);
const mixedCharges = chargeText(mixed);
check("mixed wall quantities omit painting", !mixedCharges.includes("paint"), mixedCharges);
check("mixed wall quantities omit skirting", !mixedCharges.includes("skirt"), mixedCharges);
check("mixed wall quantities omit electrical", !mixedCharges.includes("electric"), mixedCharges);
const paintingArea = workAreas(mixed).find((area) => area.type === "painting");
const paintingResult = paintingArea
  ? calculatePainting(context(mixed), paintingArea)
  : null;
const paintingQuantity = paintingResult?.lineItems.find((row) =>
  /paint/i.test(row.label)
)?.quantity;
check(
  "mixed ceiling painting is generated",
  paintingQuantity === expectations.mixed.paintingLineQuantity,
  paintingResult?.lineItems
);
const mixedPricing = explicitJobExclusionLines(mixed.facts);
for (const label of expectations.mixed.pricingIncludes) {
  check(`mixed pricing keeps ${label}`, mixedPricing.some((line) => line.includes(label)), mixedPricing);
}
for (const label of expectations.mixed.pricingMustNotInclude) {
  check(`mixed pricing omits blanket ${label}`, mixedPricing.every((line) => line !== label), mixedPricing);
}

const unknown = analyse(expectations.unmentioned.brief);
check(
  "unmentioned painting stays unknown",
  fact(unknown, "internal_walls.painting_included") == null &&
    (wallType(unknown)?.painting == null),
  { boolean: fact(unknown, "internal_walls.painting_included"), painting: wallType(unknown)?.painting }
);
check(
  "unmentioned skirting stays unknown",
  fact(unknown, "internal_walls.skirtings_included") == null && wallType(unknown)?.skirting == null,
  wallType(unknown)?.skirting
);
check(
  "unmentioned electrical stays unknown",
  wallType(unknown)?.electrical == null,
  wallType(unknown)?.electrical
);
check(
  "unmentioned door painting stays unknown",
  fact(unknown, "doors.painting_included") == null
);
check(
  "unmentioned painting does not become its own work area",
  !unknown.workAreas.some((area) => area.type === "painting")
);
const unknownCards = cardLabels(unknown);
for (const label of expectations.unmentioned.cardMustNotInclude) {
  check(
    `unmentioned card omits ${label}`,
    !unknownCards.included.includes(label) && !unknownCards.excluded.includes(label),
    unknownCards
  );
}
const unknownPricing = explicitJobExclusionLines(unknown.facts);
for (const label of expectations.unmentioned.pricingMustNotInclude) {
  check(
    `unmentioned pricing omits ${label}`,
    unknownPricing.every((line) => !line.includes(label)),
    unknownPricing
  );
}
const unknownResolved = resolveInternalWallsWallTypes({
  facts: estimateFacts(unknown),
  workAreaId: idsFor(unknown).internal_walls ?? "internal_walls",
}).types[0];
check(
  "unmentioned painting is not stored as an exclusion",
  wallTypeFieldCurrentValue(unknownResolved ?? null, INTERNAL_WALLS_PAINTING_SIDES_KEY) == null &&
    wallTypeFieldCurrentValue(unknownResolved ?? null, INTERNAL_WALLS_SKIRTING_SIDES_KEY) == null &&
    wallTypeFieldCurrentValue(unknownResolved ?? null, INTERNAL_WALLS_ELECTRICAL_KEY) == null,
  finishQuestion(unknown)
);

const conflict = analyse(expectations.contradiction.brief);
check(
  "contradiction does not store painting as included",
  fact(conflict, "internal_walls.painting_included") == null &&
    wallType(conflict)?.painting == null,
  { boolean: fact(conflict, "internal_walls.painting_included"), painting: wallType(conflict)?.painting }
);
check(
  "contradiction is flagged",
  conflict.warnings.includes(expectations.contradiction.warning),
  conflict.warnings
);
const conflictCards = cardLabels(conflict);
check(
  "contradiction is not shown as included or excluded painting",
  !conflictCards.included.some((label) => /painting/i.test(label)) &&
    !conflictCards.excluded.some((label) => /painting/i.test(label)),
  conflictCards
);

const decision = reanalysisFactWrite({
  existingSource: expectations.userDecision.existingSource,
  existingValue: expectations.userDecision.existingValue,
  extractedValue: expectations.userDecision.extractedValue,
});
check(
  "a confirmed painting answer is kept when extraction disagrees",
  decision.action === expectations.userDecision.action &&
    decision.action === "keep" &&
    decision.conflictWarning != null,
  decision
);

const preserved = seedPricingClientExclusions({
  templateLines: [],
  jobLines: explicitJobExclusionLines(variation.facts),
  existingDraftLines: expectations.existingDraft.lines,
});
check(
  "an existing pricing draft is not reseeded",
  preserved.preservedEdit === true &&
    preserved.lines.length === expectations.existingDraft.lines.length &&
    preserved.lines[0] === expectations.existingDraft.lines[0],
  preserved
);

const fresh = seedPricingClientExclusions({
  templateLines: [],
  jobLines: explicitJobExclusionLines(variation.facts),
});
check(
  "a new draft carries the client exclusions",
  fresh.preservedEdit === false &&
    expectations.variation.pricing.every((label) =>
      fresh.lines.some((line) => line === jobExclusionLine(label))
    ),
  fresh.lines
);

if (failed > 0) {
  console.log(`FAILED ${failed}`);
  process.exit(1);
}
console.log("explicit exclusions passed");
