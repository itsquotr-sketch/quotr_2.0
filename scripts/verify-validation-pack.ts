/**
 * Validation pack — 15-job briefs with key behaviour assertions.
 *
 * Run: npx tsx scripts/verify-validation-pack.ts
 *
 * Uses deterministic brief enrichment (no API key required).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import {
  enrichExtractionFromBrief,
  extractConstraintsFromBrief,
  extractQualityFromBrief,
} from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload } from "../lib/ai/schema";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import {
  shouldHideConditionalQuestion,
  isQuestionAnswered,
} from "../lib/scopes/conditional-rules";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { formatSelectAnswerValue } from "../lib/scopes/fact-labels";
import {
  buildFactLookup,
  factHasValue,
  type ProjectFactRecord,
} from "../lib/scopes/fact-values";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { getScopeQuestions } from "../lib/scopes/registry";
import {
  buildQuestionBlockFromProjectState,
  shouldSkipTemplateQuestion,
} from "../lib/scopes/questions";
import { validateMarginPercent } from "../lib/security/margin-validation";
import { buildPricingItemFieldsFromEstimateLineItem } from "../lib/pricing/pricing-item-calculation";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import { resolveLineItemCategorySplit } from "../lib/estimate/category-breakdown";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getCombinedLabourAccessFactor } from "../lib/estimate/adjustments";
import { assertNoDuplicateEstimateLineItems } from "../lib/estimate/commercial-realism";
import { countOverlapGroups } from "../lib/estimate/pricing-ownership";
import { applyScopeCrossoverResolution } from "../lib/scopes/scope-crossover";

type Severity = "P0" | "P1" | "P2";

type ValidationBrief = {
  id: number;
  name: string;
  brief: string;
  expectedWorkAreas: string[];
  requireOneOf?: string[][];
  forbiddenWorkAreas?: string[];
  expectedFacts?: Array<{
    key: string;
    workAreaType: string;
    booleanTrue?: boolean;
    booleanFalse?: boolean;
    includes?: string;
    value?: string | number | boolean;
  }>;
  forbiddenQuestions?: Array<{ workAreaType: string; factKey: string }>;
  qualityLevel?: string;
    constraintKeys?: string[];
    expectedProjectConditions?: Array<{
      key: string;
      includes?: string;
    }>;
    forbiddenFacts?: Array<{ key: string }>;
  };

const ALLOWED_TYPES = SCOPE_CATALOGUE.map((item) => item.type);

const BRIEFS: ValidationBrief[] = [
  {
    id: 1,
    name: "Simple Kwila Deck",
    brief:
      "Build a 36m² ground-level kwila deck using 140mm boards. Include vertical face boards around the exposed edge. No stairs, no balustrade, easy access, no existing deck removal.",
    expectedWorkAreas: ["deck"],
    forbiddenWorkAreas: ["external_stairs"],
    forbiddenQuestions: [{ workAreaType: "deck", factKey: "deck.pergola_included" }],
  },
  {
    id: 2,
    name: "Larger Deck with Removal, Stairs and Balustrade",
    brief:
      "Remove existing timber deck and build a new 70m² hardwood deck using 140mm boards. Include stairs down to lawn and balustrade around two sides. Access is moderate.",
    expectedWorkAreas: ["deck"],
    requireOneOf: [["external_stairs"], ["deck"]],
    expectedFacts: [
      { key: "deck.existing_deck_removal", workAreaType: "deck", booleanTrue: true },
    ],
  },
  {
    id: 3,
    name: "Full Bathroom Renovation",
    brief:
      "Full bathroom renovation including strip-out, tiled shower, waterproofing, 8m² floor tiling and 15m² wall tiling, plumbing, electrical, extractor fan, client supplying vanity and tapware. Moderate access.",
    expectedWorkAreas: ["bathroom"],
    expectedFacts: [
      { key: "bathroom.tiling_included", workAreaType: "bathroom", booleanTrue: true },
      { key: "bathroom.demolition_required", workAreaType: "bathroom", booleanTrue: true },
    ],
  },
  {
    id: 4,
    name: "Bathroom Refresh",
    brief:
      "Bathroom refresh only. Replace vanity and toilet, client supplying both. New vinyl flooring to 6m². Paint walls and ceiling. No waterproofing, no shower changes, no tiling, plumbing minor only.",
    expectedWorkAreas: ["bathroom"],
    expectedFacts: [
      { key: "bathroom.tiling_included", workAreaType: "bathroom", booleanFalse: true },
    ],
    forbiddenQuestions: [
      { workAreaType: "bathroom", factKey: "bathroom.tile_extent" },
      { workAreaType: "bathroom", factKey: "bathroom.wall_tile_height" },
      { workAreaType: "bathroom", factKey: "bathroom.floor_tiling_area_m2" },
    ],
  },
  {
    id: 5,
    name: "Kitchen Install-Only",
    brief:
      "Remove existing kitchen and install client-supplied flatpack cabinetry. New benchtop and tiled splashback included. Rangehood included. Plumbing and electrical by others.",
    expectedWorkAreas: ["kitchen"],
    expectedFacts: [
      { key: "kitchen.demolition_required", workAreaType: "kitchen", booleanTrue: true },
    ],
  },
  {
    id: 6,
    name: "Internal Fitout",
    brief:
      "Build 10m of 2.4m high timber framed internal wall. Line both sides with 13mm GIB, insulate and add skirting. Install 4 solid core doors with frames and hardware. Paint walls, doors and trims, two coats.",
    expectedWorkAreas: ["internal_walls", "doors", "painting"],
    forbiddenQuestions: [
      { workAreaType: "internal_walls", factKey: "internal_walls.painting_included" },
      { workAreaType: "doors", factKey: "doors.painting_included" },
    ],
  },
  {
    id: 7,
    name: "Office Soft Strip",
    brief:
      "Soft strip 80m² office including removal of internal partitions, ceiling tiles, carpet tiles, joinery and fixtures. Waste to be carted 45m to bin. Works are on level 2. Services isolated by others.",
    expectedWorkAreas: ["demolition"],
    expectedProjectConditions: [
      { key: "material_carry_distance", includes: "30" },
    ],
    expectedFacts: [
      { key: "demolition.disposal_included", workAreaType: "demolition", booleanTrue: true },
    ],
    forbiddenFacts: [{ key: "demolition.carting_distance_m" }],
  },
  {
    id: 8,
    name: "Retaining Wall",
    brief:
      "Build a 14.6m raking face-fixed timber retaining wall from 1m high down to 0.4m. Include excavation, backfill, novacoil drainage and disposal. Poor access and 45m carting distance.",
    expectedWorkAreas: ["retaining_wall"],
    expectedProjectConditions: [
      { key: "site_access" },
      { key: "material_carry_distance", includes: "30" },
    ],
    forbiddenFacts: [{ key: "retaining_wall.carting_distance_m" }],
  },
  {
    id: 9,
    name: "External Stairs",
    brief:
      "Build 8-step treated timber external stairs to an existing deck, 1m wide, with handrail. Remove existing stairs. Ground is slightly sloping. Easy access.",
    expectedWorkAreas: ["external_stairs"],
    expectedFacts: [
      { key: "external_stairs.risers_count", workAreaType: "external_stairs", value: 8 },
      { key: "external_stairs.handrail_included", workAreaType: "external_stairs", booleanTrue: true },
      { key: "external_stairs.existing_removal", workAreaType: "external_stairs", booleanTrue: true },
    ],
  },
  {
    id: 10,
    name: "Deck + External Stairs",
    brief:
      "Build a 36m² kwila deck using 140mm boards with vertical face boards. Add 8-step treated timber external stairs with handrail. Ground level deck, easy access, no balustrade.",
    expectedWorkAreas: ["deck", "external_stairs"],
    expectedFacts: [
      { key: "external_stairs.risers_count", workAreaType: "external_stairs", value: 8 },
    ],
    forbiddenQuestions: [{ workAreaType: "deck", factKey: "deck.access_type" }],
  },
  {
    id: 11,
    name: "Flooring Removal Only",
    brief:
      "Remove 60m² carpet and vinyl flooring and dispose to skip. No new flooring. Access is moderate and waste must be carried 25m.",
    expectedWorkAreas: ["demolition"],
    expectedFacts: [
      { key: "demolition.disposal_included", workAreaType: "demolition", booleanTrue: true },
    ],
  },
  {
    id: 12,
    name: "Painting and Plastering",
    brief:
      "Level 4 stop 80m² of new plasterboard walls, sand ready for paint. Paint internal walls and ceilings, 120m² total, two coats, minor prep. Paint supplied by contractor.",
    expectedWorkAreas: ["plastering", "painting"],
    expectedFacts: [
      { key: "plastering.level", workAreaType: "plastering", includes: "Level 4" },
      { key: "plastering.sanding_included", workAreaType: "plastering", booleanTrue: true },
    ],
  },
  {
    id: 13,
    name: "Pergola",
    brief:
      "Install a 4m by 6m attached aluminium pergola with Colorsteel roofing and gutters. Standard access. No painting or staining required.",
    expectedWorkAreas: ["pergola"],
  },
  {
    id: 14,
    name: "Fence with Gate and Removal",
    brief:
      "Remove existing fence and build 30lm of 2m high timber fence on a sloping boundary. Include one pedestrian gate and disposal of old fence. Access is poor.",
    expectedWorkAreas: ["fence"],
    expectedFacts: [
      { key: "fence.demolition_required", workAreaType: "fence", booleanTrue: true },
    ],
    constraintKeys: ["site_access", "site_slope"],
  },
  {
    id: 15,
    name: "Messy Multi-Scope Renovation",
    brief:
      "Client wants a small renovation. Remove existing kitchen, remove 20m² vinyl flooring, build 6m of new internal wall at 2.4m high lined both sides with GIB, install 2 internal doors, repaint walls and trims, and allow for minor electrical changes. Client supplying kitchen cabinets and doors. Waste to be carted 30m to skip.",
    expectedWorkAreas: ["kitchen", "demolition", "internal_walls", "doors", "painting"],
    requireOneOf: [["plastering"], ["internal_walls"]],
    qualityLevel: "standard",
    constraintKeys: ["material_carry_distance", "client_supplied_items"],
    forbiddenQuestions: [
      { workAreaType: "kitchen", factKey: "kitchen.finish_level" },
      { workAreaType: "internal_walls", factKey: "internal_walls.painting_included" },
      { workAreaType: "doors", factKey: "doors.painting_included" },
    ],
  },
];

type Failure = {
  briefId: number;
  briefName: string;
  message: string;
  severity: Severity;
};

const failures: Failure[] = [];
const warnings: Failure[] = [];

function fail(
  brief: ValidationBrief,
  message: string,
  severity: Severity = "P0"
) {
  const entry = { briefId: brief.id, briefName: brief.name, message, severity };
  if (severity === "P0") failures.push(entry);
  else warnings.push(entry);
}

function pass(label: string) {
  console.log("PASS", label);
}

function assertFactValue(
  facts: ProjectFactRecord[],
  workAreaId: string,
  key: string,
  expectation: NonNullable<ValidationBrief["expectedFacts"]>[number]
): boolean {
  const fact = facts.find(
    (item) => item.key === key && item.work_area_id === workAreaId
  );
  if (!fact || !factHasValue(fact.value)) return false;

  if (expectation.booleanTrue) {
    return fact.value === true || fact.value === "true" || fact.value === "Yes";
  }
  if (expectation.booleanFalse) {
    return fact.value === false || fact.value === "false" || fact.value === "No";
  }
  if (expectation.includes) {
    return String(fact.value).toLowerCase().includes(expectation.includes.toLowerCase());
  }
  if (expectation.value !== undefined) {
    return String(fact.value) === String(expectation.value);
  }
  return true;
}

function runDeterministicBrief(brief: ValidationBrief) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief.brief,
    extraction: coerceExtractionPayload({
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    }),
    allowedTypes: ALLOWED_TYPES,
  });

  const normalised = normaliseAIExtraction(enriched.extraction);
  const workAreaTypes = normalised.workAreas.map((wa) => wa.type);

  if (workAreaTypes.length === 0) {
    fail(brief, "No work areas recognised after enrichment", "P0");
    return;
  }

  for (const expected of brief.expectedWorkAreas) {
    if (!workAreaTypes.includes(expected)) {
      fail(brief, `Missing expected work area: ${expected}`, "P0");
    }
  }

  for (const forbidden of brief.forbiddenWorkAreas ?? []) {
    if (workAreaTypes.includes(forbidden)) {
      fail(brief, `Unexpected work area present: ${forbidden}`, "P1");
    }
  }

  if (brief.requireOneOf) {
    for (const group of brief.requireOneOf) {
      if (!group.some((type) => workAreaTypes.includes(type))) {
        fail(brief, `Expected one of: ${group.join(", ")}`, "P1");
      }
    }
  }

  const workAreas = normalised.workAreas.map((wa, index) => ({
    id: `wa-${brief.id}-${wa.type}`,
    type: wa.type,
    name: wa.type,
    sort_order: index + 1,
    status: "confirmed" as const,
  }));

  const factRows: ProjectFactRecord[] = normalised.facts.map((fact) => ({
    key: fact.key,
    work_area_id:
      workAreas.find((wa) => wa.type === fact.work_area_type)?.id ?? null,
    value: fact.value,
    source: "ai_extracted" as const,
  }));

  const derived = deriveFactsForProject({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: factRows,
  });
  const mergedFacts = mergeDerivedFactsIntoRecords(factRows, derived);
  const lookup = buildFactLookup(mergedFacts);
  const confirmedTypes = new Set(workAreas.map((wa) => wa.type));

  for (const expected of brief.expectedFacts ?? []) {
    const workAreaId = workAreas.find((wa) => wa.type === expected.workAreaType)?.id;
    if (!workAreaId) {
      fail(brief, `Cannot check fact ${expected.key} — work area missing`, "P0");
      continue;
    }
    if (!assertFactValue(mergedFacts, workAreaId, expected.key, expected)) {
      fail(
        brief,
        `Expected fact ${expected.key} on ${expected.workAreaType}`,
        "P0"
      );
    }
  }

  const quality =
    brief.qualityLevel ?? extractQualityFromBrief(brief.brief);
  if (brief.qualityLevel && quality !== brief.qualityLevel) {
    fail(brief, `Expected quality ${brief.qualityLevel}, got ${quality}`, "P1");
  }

  const constraints = extractConstraintsFromBrief(brief.brief);
  for (const expected of brief.expectedProjectConditions ?? []) {
    const row = constraints.find((item) => item.key === expected.key);
    if (!row) {
      fail(brief, `Expected project condition ${expected.key}`, "P0");
      continue;
    }
    if (
      expected.includes &&
      !String(row.value).toLowerCase().includes(expected.includes.toLowerCase())
    ) {
      fail(
        brief,
        `Expected project condition ${expected.key} to include ${expected.includes}, got ${String(row.value)}`,
        "P0"
      );
    }
  }
  for (const key of brief.constraintKeys ?? []) {
    if (!constraints.some((item) => item.key === key)) {
      fail(brief, `Expected constraint ${key}`, "P1");
    }
  }

  for (const forbidden of brief.forbiddenFacts ?? []) {
    const present = mergedFacts.some(
      (item) => item.key === forbidden.key && factHasValue(item.value)
    );
    if (present) {
      fail(
        brief,
        `Obsolete Work Area fact ${forbidden.key} must not be extracted (Project Conditions own carry)`,
        "P0"
      );
    }
  }

  for (const forbidden of brief.forbiddenQuestions ?? []) {
    const workArea = workAreas.find((wa) => wa.type === forbidden.workAreaType);
    if (!workArea) continue;

    const template = getScopeQuestions(forbidden.workAreaType).find(
      (item) => item.factKey === forbidden.factKey
    );
    if (!template) continue;

    const skipped = shouldSkipTemplateQuestion(
      template,
      workArea,
      lookup,
      confirmedTypes,
      { quality_level: quality ?? "standard" }
    );
    const hidden = shouldHideConditionalQuestion(
      template,
      workArea.id,
      lookup,
      confirmedTypes
    );
    const answered = isQuestionAnswered(lookup, workArea.id, forbidden.factKey);

    if (!skipped && !hidden && !answered) {
      fail(
        brief,
        `Should not ask ${forbidden.factKey} for ${forbidden.workAreaType}`,
        "P0"
      );
    }
  }

  const questionBlock = buildQuestionBlockFromProjectState({
    project: { quality_level: quality ?? "standard" },
    confirmedWorkAreas: workAreas,
    projectFacts: mergedFacts,
  });

  if (quality) {
    const finishQuestions = questionBlock.questions.filter((q) =>
      q.key.includes("finish_level")
    );
    if (finishQuestions.length > 0) {
      fail(
        brief,
        `Project quality set but finish_level questions still asked: ${finishQuestions.map((q) => q.key).join(", ")}`,
        "P1"
      );
    }
  }

  pass(`${brief.id}. ${brief.name} — enrichment (${workAreaTypes.join(", ")})`);
}

function runMessyRenovationEstimateChecks() {
  const brief = BRIEFS[14].brief;
  const enriched = enrichExtractionFromBrief({
    briefText: brief,
    extraction: coerceExtractionPayload({
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    }),
    allowedTypes: ALLOWED_TYPES,
  });

  const normalised = normaliseAIExtraction(enriched.extraction);
  const workAreas = normalised.workAreas.map((wa, index) => ({
    id: `wa-messy-${wa.type}`,
    type: wa.type,
    name: wa.type,
    sort_order: index + 1,
    status: "confirmed" as const,
  }));

  const factRows: ProjectFactRecord[] = normalised.facts.map((fact) => ({
    key: fact.key,
    work_area_id:
      workAreas.find((wa) => wa.type === fact.work_area_type)?.id ?? null,
    value: fact.value,
    source: "ai_extracted" as const,
  }));

  const derived = deriveFactsForProject({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: factRows,
  });

  const mergedFacts = applyScopeCrossoverResolution({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: mergeDerivedFactsIntoRecords(factRows, derived),
  });

  const estimate = calculateEstimate({
    project: { id: "messy", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts: mergedFacts,
    constraints: enriched.constraints.map((c) => ({
      key: c.key,
      label: c.label,
      value: c.value,
    })),
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as Parameters<typeof calculateEstimate>[0]);

  const included = estimate.lineItems.filter(
    (item) => item.includedInTotal !== false
  );
  const labels = included.map((item) => item.label);
  const kitchenItems = included.filter((item) =>
    item.workAreaName.toLowerCase().includes("kitchen")
  );

  const checks: Array<{ ok: boolean; message: string; severity: Severity }> = [
    {
      ok: !labels.includes("Cabinetry allowance"),
      message: "No cabinetry supply cost for client-supplied cabinets",
      severity: "P0",
    },
    {
      ok: countOverlapGroups(estimate.lineItems, "kitchen_cabinetry_install") <= 1,
      message: "Cabinetry install priced once only",
      severity: "P0",
    },
    {
      ok: !labels.includes("Cabinetry installation allowance"),
      message: "No cabinetry install labour + allowance double count",
      severity: "P0",
    },
    {
      ok: !labels.some((l) => /benchtop labour/i.test(l)),
      message: "Benchtop not categorised as labour allowance",
      severity: "P0",
    },
    {
      ok: !labels.includes("Kitchen materials/finishes allowance"),
      message: "No broad kitchen package double-count",
      severity: "P0",
    },
    {
      ok: !labels.includes("Door supply/install allowance"),
      message: "Doors client supplied — install only, not full supply/install",
      severity: "P0",
    },
    {
      ok: !labels.some((l) => /flooring materials allowance|flooring labour/i.test(l)),
      message: "No flooring supply/install for removal-only scope",
      severity: "P0",
    },
    {
      ok: included.every((item) => item.quantity != null && item.unit),
      message: "All line items have quantity and unit",
      severity: "P0",
    },
    {
      ok: assertNoDuplicateEstimateLineItems(estimate.lineItems).duplicateLabels
        .length === 0,
      message: "No duplicate included line item labels",
      severity: "P1",
    },
    {
      ok: estimate.recommendedSell < 120000,
      message: `Messy renovation sell commercially plausible (<$120k), got $${estimate.recommendedSell.toFixed(0)}`,
      severity: "P1",
    },
    {
      ok: kitchenItems.some((item) => /electrical allowance/i.test(item.label)),
      message: "Minor electrical allowance priced",
      severity: "P1",
    },
  ];

  for (const check of checks) {
    if (check.ok) {
      pass(`Messy estimate: ${check.message}`);
    } else if (check.severity === "P0") {
      failures.push({
        briefId: 15,
        briefName: "Messy Multi-Scope Renovation",
        message: check.message,
        severity: "P0",
      });
    } else {
      warnings.push({
        briefId: 15,
        briefName: "Messy Multi-Scope Renovation",
        message: check.message,
        severity: "P1",
      });
    }
  }
}

function estimateFromBrief(brief: ValidationBrief) {
  const enriched = enrichExtractionFromBrief({
    briefText: brief.brief,
    extraction: coerceExtractionPayload({
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    }),
    allowedTypes: ALLOWED_TYPES,
  });
  const normalised = normaliseAIExtraction(enriched.extraction);
  const workAreas = normalised.workAreas.map((wa, index) => ({
    id: `wa-carry-${brief.id}-${wa.type}`,
    type: wa.type,
    name: wa.type,
    sort_order: index + 1,
    status: "confirmed" as const,
  }));
  const factRows: ProjectFactRecord[] = normalised.facts.map((fact) => ({
    key: fact.key,
    work_area_id:
      workAreas.find((wa) => wa.type === fact.work_area_type)?.id ?? null,
    value: fact.value,
    source: "ai_extracted" as const,
  }));
  const derived = deriveFactsForProject({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: factRows,
  });
  const mergedFacts = mergeDerivedFactsIntoRecords(factRows, derived);
  const constraints = extractConstraintsFromBrief(brief.brief).map((c) => ({
    key: c.key,
    label: c.label,
    value: c.value,
  }));
  const estimate = calculateEstimate({
    project: { id: `carry-${brief.id}`, qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts: mergedFacts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as Parameters<typeof calculateEstimate>[0]);
  return { mergedFacts, constraints, estimate };
}

function runProjectCarryAuthorityChecks() {
  const demoBrief = BRIEFS.find((b) => b.id === 7)!;
  const rwBrief = BRIEFS.find((b) => b.id === 8)!;

  const demo = estimateFromBrief(demoBrief);
  const demoHasWaCarting = demo.mergedFacts.some(
    (f) => f.key === "demolition.carting_distance_m" && factHasValue(f.value)
  );
  const demoHasHaulage = demo.estimate.lineItems.some((item) =>
    /carting\/haulage/i.test(item.label)
  );
  const demoCarry = demo.constraints.find((c) => c.key === "material_carry_distance");
  const demoLabourFactor = getCombinedLabourAccessFactor({
    constraints: demo.constraints,
  });

  if (!demoCarry) {
    fail(demoBrief, "Office Soft Strip missing project material_carry_distance", "P0");
  } else if (demoHasWaCarting) {
    fail(
      demoBrief,
      "Office Soft Strip extracted obsolete demolition.carting_distance_m",
      "P0"
    );
  } else if (demoHasHaulage) {
    fail(
      demoBrief,
      "Office Soft Strip priced WA carting/haulage while only Project Conditions carry exists",
      "P0"
    );
  } else if (demoLabourFactor <= 1) {
    fail(
      demoBrief,
      `Office Soft Strip expected labour carry factor from project condition, got ${demoLabourFactor}`,
      "P0"
    );
  } else {
    pass("Office Soft Strip: project carry exists; no WA carting Fact; no haulage duplicate");
  }

  const rw = estimateFromBrief(rwBrief);
  const rwHasWaCarting = rw.mergedFacts.some(
    (f) => f.key === "retaining_wall.carting_distance_m" && factHasValue(f.value)
  );
  const rwHasHaulage = rw.estimate.lineItems.some((item) =>
    /carting\/material handling/i.test(item.label)
  );
  const rwCarry = rw.constraints.find((c) => c.key === "material_carry_distance");

  if (!rwCarry) {
    fail(rwBrief, "Retaining Wall missing project material_carry_distance", "P0");
  } else if (rwHasWaCarting) {
    fail(
      rwBrief,
      "Retaining Wall extracted obsolete retaining_wall.carting_distance_m",
      "P0"
    );
  } else if (rwHasHaulage) {
    fail(
      rwBrief,
      "Retaining Wall priced WA carting allowance while only Project Conditions carry exists",
      "P0"
    );
  } else {
    pass("Retaining Wall: project carry exists; no WA carting Fact; no haulage duplicate");
  }
}

function runInfrastructureChecks() {
  const marginZero = validateMarginPercent(0);
  if (!marginZero.ok) {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: `0% margin rejected: ${marginZero.message}`,
      severity: "P0",
    });
  } else {
    pass("Margin accepts 0%");
  }

  const pricingFields = buildPricingItemFieldsFromEstimateLineItem({
    category: "allowance",
    recommended_cost: 500,
    recommended_sell: 650,
    notes: null,
  });
  if (!pricingFields.quantity || !pricingFields.unit) {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: "Allowance pricing item missing quantity/unit",
      severity: "P0",
    });
  } else {
    pass(`Allowance defaults: ${pricingFields.quantity} ${pricingFields.unit}`);
  }

  const quoteItems = mapPricingItemsToQuoteItems(
    [
      {
        id: "p1",
        org_id: "o1",
        pricing_document_id: "d1",
        project_id: "proj1",
        work_area_id: null,
        source_estimate_line_item_id: null,
        item_type: "allowance",
        delivery_method: "in_house",
        internal_label: "Allowance",
        client_label: "Allowance",
        internal_description: null,
        client_description: null,
        quantity: null,
        unit: null,
        unit_cost: 100,
        unit_sell: 125,
        total_cost: 100,
        total_sell: 125,
        gross_profit: 25,
        margin_percent: 20,
        markup_percent: 25,
        calculation_mode: "lump_sum",
        productivity_rate: null,
        productivity_unit: null,
        calculated_quantity: null,
        visible_on_quote: true,
        optional: false,
        sort_order: 0,
        notes_internal: null,
        notes_client: null,
        manually_edited: false,
        orphaned: false,
        recalibration_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies PricingItem,
    ],
    new Map()
  );
  const quoteQty = quoteItems[0]?.quantity;
  const quoteUnit = quoteItems[0]?.unit;
  if (quoteQty !== 1 || quoteUnit !== "allow") {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: `Quote item defaults wrong: ${quoteQty} ${quoteUnit}`,
      severity: "P0",
    });
  } else {
    pass("Quote item allowance defaults: 1 allow");
  }

  const split = resolveLineItemCategorySplit({
    workAreaId: "wa1",
    workAreaName: "Test",
    label: "Mixed package",
    category: "mixed",
    costLow: 100,
    costHigh: 120,
    sellLow: 130,
    sellHigh: 150,
    recommendedCost: 110,
    recommendedSell: 140,
    grossProfit: 30,
    marginPercent: 21,
    markupPercent: 27,
    rateSource: "benchmark",
    sortOrder: 1,
    costComponents: { labourCost: 60, materialCost: 50 },
  });
  if (!split) {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: "Mixed costComponents not recognised",
      severity: "P1",
    });
  } else {
    pass("Mixed category split recognised");
  }

  const friendly = formatSelectAnswerValue("good_existing");
  if (friendly !== "Good existing") {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: `Friendly enum label failed: ${friendly}`,
      severity: "P1",
    });
  } else {
    pass("Friendly enum labels for deck substructure");
  }

  const messy = enrichExtractionFromBrief({
    briefText: BRIEFS[14].brief,
    extraction: coerceExtractionPayload({
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.4,
      warnings: [],
    }),
    allowedTypes: ALLOWED_TYPES,
  });
  if (messy.extraction.workAreas.length < 3) {
    failures.push({
      briefId: 15,
      briefName: "Messy Multi-Scope Renovation",
      message: `Messy brief only got ${messy.extraction.workAreas.length} work areas`,
      severity: "P0",
    });
  } else {
    pass(`Messy multi-scope enrichment: ${messy.extraction.workAreas.length} work areas`);
  }

  const messyCoerced = coerceExtractionPayload({
    workAreas: [{ type: "kitchen", confidence: 0.7 }],
    facts: [{ work_area_type: "kitchen", key: "kitchen.demolition_required", value: true }],
    assumptions: [],
  });
  if (messyCoerced.workAreas.length !== 1) {
    failures.push({
      briefId: 0,
      briefName: "Infrastructure",
      message: "Partial AI payload coercion failed",
      severity: "P0",
    });
  } else {
    pass("Partial AI payload coercion");
  }
}

console.log("=== Quotr Validation Pack (deterministic) ===\n");

for (const brief of BRIEFS) {
  runDeterministicBrief(brief);
}

console.log("\n=== Messy renovation estimate checks ===\n");
runMessyRenovationEstimateChecks();

console.log("\n=== Project carry authority (FOUNDATION-R1) ===\n");
runProjectCarryAuthorityChecks();

console.log("\n=== Infrastructure checks ===\n");
runInfrastructureChecks();

console.log("\n=== Summary ===");
console.log(`P0 failures: ${failures.length}`);
console.log(`P1/P2 warnings: ${warnings.length}`);

if (failures.length > 0) {
  console.log("\n--- P0 Failures ---");
  for (const item of failures) {
    console.log(`[${item.briefId}] ${item.briefName}: ${item.message}`);
  }
}

if (warnings.length > 0) {
  console.log("\n--- P1/P2 Warnings ---");
  for (const item of warnings) {
    console.log(`[${item.briefId}] ${item.briefName}: ${item.message}`);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nValidation pack passed (no P0 failures).");
}
