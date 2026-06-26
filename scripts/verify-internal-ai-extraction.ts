/**
 * Live AI extraction verification for internal calibration briefs.
 *
 * Run: npx tsx scripts/verify-internal-ai-extraction.ts
 *
 * Requires ANTHROPIC_API_KEY in the environment. If unavailable, the script
 * documents expected assertions and exits with code 0 after printing instructions.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "../lib/ai/brief-extraction-prompt";
import { validateAndFilterExtraction, type AIExtractionOutput } from "../lib/ai/schema";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import {
  FORBIDDEN_PRICING_KEY_FRAGMENTS,
  normaliseAIExtraction,
} from "../lib/scopes/normalise-extracted-facts";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";
import { toPositiveNumber } from "../lib/scopes/fact-values";

type ExpectedFact = {
  key: string;
  value?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  includes?: string;
  booleanTrue?: boolean;
  booleanFalse?: boolean;
};

type DerivedAreaAssertion = {
  key: string;
  expectedValue: number;
  tolerance?: number;
  workAreaType?: string;
};

type BriefCase = {
  name: string;
  brief: string;
  expectedWorkAreaTypes: string[];
  expectedFacts?: ExpectedFact[];
  derivedArea?: DerivedAreaAssertion;
  forbiddenFactKeys?: string[];
};

const INTERNAL_TYPES = [
  "bathroom",
  "kitchen",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
];

const GLOBAL_FORBIDDEN_KEYS = FORBIDDEN_PRICING_KEY_FRAGMENTS;

const CASES: BriefCase[] = [
  {
    name: "Bathroom",
    brief:
      "Full bathroom renovation including strip-out, tiled shower, waterproofing, floor and wall tiling, plumbing, electrical, extractor fan, client supplying vanity and tapware.",
    expectedWorkAreaTypes: ["bathroom"],
    expectedFacts: [
      { key: "bathroom.renovation_type", includes: "full" },
      { key: "bathroom.demolition_required", booleanTrue: true },
      { key: "bathroom.shower_type", oneOf: ["Tiled shower", "tiled_shower", "walk_in_tiled_shower"] },
      { key: "bathroom.waterproofing_included", booleanTrue: true },
      { key: "bathroom.tiling_included", booleanTrue: true },
      { key: "bathroom.plumbing_changes", oneOf: ["Minor", "Major", "minor", "major"] },
      { key: "bathroom.electrical_changes", oneOf: ["Minor", "Major", "minor", "major"] },
      { key: "bathroom.ventilation_included", booleanTrue: true },
      { key: "bathroom.fixtures_client_supplied", booleanTrue: true },
    ],
  },
  {
    name: "Kitchen",
    brief:
      "Remove existing kitchen and install client-supplied flatpack cabinetry, new benchtop, tiled splashback and rangehood. Plumbing and electrical by others.",
    expectedWorkAreaTypes: ["kitchen"],
    expectedFacts: [
      { key: "kitchen.demolition_required", booleanTrue: true },
      { key: "kitchen.cabinetry_client_supplied", booleanTrue: true },
      { key: "kitchen.cabinetry_type", includes: "flatpack" },
      { key: "kitchen.benchtop_included", booleanTrue: true },
      { key: "kitchen.splashback_included", booleanTrue: true },
      { key: "kitchen.rangehood_included", booleanTrue: true },
      { key: "kitchen.plumbing_changes", oneOf: ["None", "none", "No"] },
      { key: "kitchen.electrical_changes", oneOf: ["None", "none", "No"] },
    ],
  },
  {
    name: "Internal walls",
    brief:
      "Build 10m of 2.4m high timber framed internal wall, line both sides with 13mm GIB, insulate and add skirting.",
    expectedWorkAreaTypes: ["internal_walls"],
    expectedFacts: [
      { key: "internal_walls.length_lm", value: 10 },
      { key: "internal_walls.height_m", value: 2.4 },
      { key: "internal_walls.framing_type", includes: "timber" },
      { key: "internal_walls.wall_lining_type", includes: "plasterboard" },
      { key: "internal_walls.lining_sides", includes: "both" },
      { key: "internal_walls.insulation_included", booleanTrue: true },
      { key: "internal_walls.skirtings_included", booleanTrue: true },
    ],
    derivedArea: {
      key: "internal_walls.area_m2",
      expectedValue: 48,
      tolerance: 0.01,
      workAreaType: "internal_walls",
    },
  },
  {
    name: "Ceilings",
    brief:
      "Install 40m² plasterboard ceiling with battens, stopping and painting.",
    expectedWorkAreaTypes: ["ceilings"],
    expectedFacts: [
      { key: "ceilings.area_m2", value: 40 },
      { key: "ceilings.ceiling_type", includes: "plasterboard" },
      { key: "ceilings.battens_included", booleanTrue: true },
      { key: "ceilings.stopping_included", booleanTrue: true },
      { key: "ceilings.painting_included", booleanTrue: true },
    ],
  },
  {
    name: "Doors",
    brief:
      "Supply and install 4 solid core internal doors with frames, architraves and hardware.",
    expectedWorkAreaTypes: ["doors"],
    expectedFacts: [
      { key: "doors.count", value: 4 },
      { key: "doors.door_type", includes: "solid" },
      { key: "doors.supply_scope", includes: "supply" },
      { key: "doors.frames_included", booleanTrue: true },
      { key: "doors.architraves_included", booleanTrue: true },
      { key: "doors.hardware_install_included", booleanTrue: true },
    ],
  },
  {
    name: "Flooring",
    brief:
      "Lay 60m² vinyl flooring, remove existing carpet, allow for minor floor prep and scotia. Flooring supplied by client.",
    expectedWorkAreaTypes: ["flooring"],
    expectedFacts: [
      { key: "flooring.area_m2", value: 60 },
      { key: "flooring.type", includes: "vinyl" },
      { key: "flooring.existing_flooring_removal", booleanTrue: true },
      { key: "flooring.floor_prep_level", includes: "minor" },
      { key: "flooring.scotia_included", booleanTrue: true },
      { key: "flooring.client_supplied", booleanTrue: true },
    ],
  },
  {
    name: "Painting",
    brief:
      "Paint internal walls, ceilings, doors and trims, 120m² total, two coats, minor prep, client supplying paint.",
    expectedWorkAreaTypes: ["painting"],
    expectedFacts: [
      { key: "painting.location", includes: "internal" },
      { key: "painting.internal_area_m2", value: 120 },
      { key: "painting.coats_required", oneOf: ["2", 2] },
      { key: "painting.prep_level", oneOf: ["Light", "Standard", "light", "minor"] },
      { key: "painting.paint_client_supplied", booleanTrue: true },
      { key: "painting.door_painting_included", booleanTrue: true },
    ],
  },
  {
    name: "Plastering",
    brief:
      "Level 4 stop 80m² new plasterboard walls and sand ready for paint.",
    expectedWorkAreaTypes: ["plastering"],
    expectedFacts: [
      { key: "plastering.level", includes: "level 4" },
      { key: "plastering.area_m2", value: 80 },
      { key: "plastering.surface_type", includes: "plasterboard" },
      { key: "plastering.sanding_included", booleanTrue: true },
    ],
  },
];

type NormalizedExtraction = {
  workAreaIdByType: Map<string, string>;
  normalizedFacts: ProjectFactRecord[];
  extractionFacts: AIExtractionOutput["facts"];
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

function normalizeValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim().toLowerCase();
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)).join(",");
  }
  return "";
}

function applyDerivedFactsPipeline(result: AIExtractionOutput): NormalizedExtraction {
  const workAreaIdByType = new Map<string, string>();
  const workAreas = result.workAreas.map((workArea, index) => {
    const id = `test-wa-${workArea.type}-${index}`;
    workAreaIdByType.set(workArea.type, id);
    return { id, type: workArea.type };
  });

  const projectFacts: ProjectFactRecord[] = result.facts
    .filter((fact) => fact.work_area_type !== null)
    .map((fact) => ({
      key: fact.key,
      work_area_id: workAreaIdByType.get(fact.work_area_type!) ?? null,
      value: fact.value,
      source: "ai_extracted",
    }));

  const derivedFacts = deriveFactsForProject({ workAreas, projectFacts });
  const normalizedFacts = mergeDerivedFactsIntoRecords(projectFacts, derivedFacts);

  return {
    workAreaIdByType,
    normalizedFacts,
    extractionFacts: result.facts,
  };
}

function getWorkAreaId(
  normalized: NormalizedExtraction,
  workAreaType?: string
): string | undefined {
  if (workAreaType) {
    return normalized.workAreaIdByType.get(workAreaType);
  }
  return normalized.workAreaIdByType.values().next().value;
}

function getNumericFact(
  facts: ProjectFactRecord[],
  key: string,
  workAreaId?: string
): number | null {
  const match = facts.find(
    (fact) =>
      fact.key === key && (workAreaId == null || fact.work_area_id === workAreaId)
  );
  if (!match) return null;
  return toPositiveNumber(match.value);
}

function factsForAssertions(
  normalized: NormalizedExtraction
): Array<{ key: string; value: unknown; work_area_id?: string | null; source?: string | null }> {
  return normalized.normalizedFacts.map((fact) => ({
    key: fact.key,
    value: fact.value,
    work_area_id: fact.work_area_id,
    source: fact.source,
  }));
}

function getFactValue(
  facts: Array<{ key: string; value: unknown }>,
  key: string
): unknown {
  return facts.find((fact) => fact.key === key)?.value;
}

function factMatches(
  facts: Array<{ key: string; value: unknown }>,
  expected: ExpectedFact
): boolean {
  const match = getFactValue(facts, expected.key);
  if (match === undefined) {
    return expected.booleanFalse === true ? true : false;
  }

  if (expected.booleanTrue) {
    return match === true || normalizeValue(match) === "true" || normalizeValue(match) === "yes";
  }

  if (expected.booleanFalse) {
    return match === false || normalizeValue(match) === "false" || normalizeValue(match) === "no";
  }

  if (expected.includes) {
    return normalizeValue(match).includes(expected.includes.toLowerCase());
  }

  if (expected.oneOf?.length) {
    const actual = normalizeValue(match);
    return expected.oneOf.some(
      (candidate) => normalizeValue(candidate) === actual || actual.includes(normalizeValue(candidate))
    );
  }

  if (expected.value === undefined) {
    return true;
  }

  const actual = normalizeValue(match);
  const wanted = normalizeValue(expected.value);

  if (typeof expected.value === "string" && typeof match === "string") {
    return actual.includes(wanted) || wanted.includes(actual);
  }

  return actual === wanted;
}

function surfacesInclude(
  facts: Array<{ key: string; value: unknown }>,
  surfaceName: string
): boolean {
  const surfaces = getFactValue(facts, "painting.surfaces");
  if (!Array.isArray(surfaces)) {
    return false;
  }
  return surfaces.some((surface) =>
    normalizeValue(surface).includes(surfaceName.toLowerCase())
  );
}

type AssertionDebugContext = {
  testCase: BriefCase;
  workAreas: Array<{ type: string; confidence?: number; rationale?: string }>;
  facts: Array<{ key: string; value: unknown; [key: string]: unknown }>;
  normalized: NormalizedExtraction;
  rawResponseText: string;
  rawParsedJson: unknown;
  validatedResult: unknown;
};

type FactAssertionDebugContext = AssertionDebugContext & {
  expectedFact: ExpectedFact;
};

function logAssertionFailure(
  context: AssertionDebugContext,
  details: {
    label: string;
    expected?: string;
    actual?: string;
    expectedFactKey?: string;
  }
): void {
  console.error("\n--- ASSERTION FAILED ---");
  console.error(`Scenario: ${context.testCase.name}`);
  console.error(`Brief:\n${context.testCase.brief}`);
  console.error(`Check: ${details.label}`);
  if (details.expectedFactKey) {
    console.error(`Expected fact key: ${details.expectedFactKey}`);
  }
  if (details.expected !== undefined) {
    console.error(`Expected: ${details.expected}`);
  }
  if (details.actual !== undefined) {
    console.error(`Actual: ${details.actual}`);
  }
  console.error(
    "Recognised work areas:",
    JSON.stringify(
      context.workAreas.map((area) => ({
        type: area.type,
        confidence: area.confidence,
        rationale: area.rationale,
      })),
      null,
      2
    )
  );
  console.error(
    "All extracted facts (raw):",
    JSON.stringify(
      context.normalized.extractionFacts.map((fact) => ({
        key: fact.key,
        value: fact.value,
        work_area_type: fact.work_area_type,
        label: fact.label,
        confidence: fact.confidence,
      })),
      null,
      2
    )
  );
  console.error(
    "Normalized facts (with derived):",
    JSON.stringify(
      context.normalized.normalizedFacts.map((fact) => ({
        key: fact.key,
        value: fact.value,
        work_area_id: fact.work_area_id,
        source: fact.source,
      })),
      null,
      2
    )
  );
  console.error("Raw parsed JSON:", JSON.stringify(context.rawParsedJson, null, 2));
  console.error("Validated result:", JSON.stringify(context.validatedResult, null, 2));
  console.error("Raw response text:\n", context.rawResponseText);
  console.error("--- END ASSERTION DEBUG ---\n");
}

function logFactAssertionFailure(context: FactAssertionDebugContext): void {
  const { expectedFact } = context;
  const matchedFact = context.facts.find((fact) => fact.key === expectedFact.key);

  logAssertionFailure(context, {
    label: `fact ${expectedFact.key} extracted`,
    expectedFactKey: expectedFact.key,
    expected: JSON.stringify(expectedFact),
    actual: matchedFact ? JSON.stringify(matchedFact.value) : "(missing)",
  });
}

function assertFactExtracted(
  context: Omit<FactAssertionDebugContext, "expectedFact">,
  expected: ExpectedFact
): void {
  if (factMatches(context.facts, expected)) {
    return;
  }

  logFactAssertionFailure({ ...context, expectedFact: expected });
  throw new Error(`FAIL: ${context.testCase.name}: fact ${expected.key} extracted`);
}

function assertNumericFact(
  context: AssertionDebugContext,
  key: string,
  expectedValue: number,
  tolerance: number,
  workAreaType?: string
): void {
  const workAreaId = getWorkAreaId(context.normalized, workAreaType);
  const actual = getNumericFact(context.normalized.normalizedFacts, key, workAreaId);

  if (actual == null || Math.abs(actual - expectedValue) > tolerance) {
    logAssertionFailure(context, {
      label: `numeric fact ${key}`,
      expectedFactKey: key,
      expected: String(expectedValue),
      actual: actual == null ? "(missing)" : String(actual),
    });
    throw new Error(`FAIL: ${context.testCase.name}: fact ${key} = ${expectedValue}`);
  }
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Failed to parse AI response as JSON.");
  }
}

async function runCase(client: Anthropic, model: string, testCase: BriefCase) {
  const catalogueTypes = SCOPE_CATALOGUE.map((item) => item.type);
  const userPrompt = buildBriefExtractionUserPrompt(testCase.brief, INTERNAL_TYPES);

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    temperature: 0,
    system: BRIEF_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response did not contain text.");
  }

  const rawResponseText = textBlock.text;
  const rawParsedJson = extractJsonFromText(rawResponseText);

  const validated = validateAndFilterExtraction(
    rawParsedJson,
    INTERNAL_TYPES,
    catalogueTypes
  );
  const result = normaliseAIExtraction(validated);
  const normalized = applyDerivedFactsPipeline(result);

  const assertionContext: AssertionDebugContext = {
    testCase,
    workAreas: result.workAreas,
    facts: factsForAssertions(normalized),
    normalized,
    rawResponseText,
    rawParsedJson,
    validatedResult: result,
  };

  for (const type of testCase.expectedWorkAreaTypes) {
    assert(
      result.workAreas.some((area) => area.type === type),
      `${testCase.name}: work area ${type} recognised`
    );
  }

  for (const expected of testCase.expectedFacts ?? []) {
    assertFactExtracted(assertionContext, expected);
    console.log(`PASS: ${testCase.name}: fact ${expected.key} OK`);
  }

  if (testCase.name === "Painting") {
    for (const surface of ["wall", "ceiling", "door", "trim"]) {
      const surfacesFact = getFactValue(assertionContext.facts, "painting.surfaces");
      const ok =
        surfacesInclude(assertionContext.facts, surface) ||
        (surface === "door" &&
          getFactValue(assertionContext.facts, "painting.door_painting_included") === true);
      assert(
        ok,
        `${testCase.name}: painting surfaces include ${surface} (surfaces=${JSON.stringify(surfacesFact)})`
      );
    }
  }

  if (testCase.derivedArea) {
    assertNumericFact(
      assertionContext,
      testCase.derivedArea.key,
      testCase.derivedArea.expectedValue,
      testCase.derivedArea.tolerance ?? 0.01,
      testCase.derivedArea.workAreaType
    );
    console.log(
      `PASS: ${testCase.name}: derived ${testCase.derivedArea.key} = ${testCase.derivedArea.expectedValue}`
    );
  }

  const rawJson = JSON.stringify(result).toLowerCase();
  for (const fragment of ["recommended_sell", "recommended_cost", "quote_total"]) {
    assert(!rawJson.includes(fragment), `${testCase.name}: no AI pricing (${fragment})`);
  }

  for (const key of testCase.forbiddenFactKeys ?? GLOBAL_FORBIDDEN_KEYS) {
    assert(
      !result.facts.some((fact) => fact.key.toLowerCase().includes(key)),
      `${testCase.name}: no forbidden key ${key}`
    );
  }
}

function describeCase(testCase: BriefCase): void {
  console.log(`\n${testCase.name}:`);
  console.log(`  Work areas: ${testCase.expectedWorkAreaTypes.join(", ")}`);
  if (testCase.derivedArea) {
    console.log(
      `  Derived area: ${testCase.derivedArea.key} = ${testCase.derivedArea.expectedValue}`
    );
  }
  if (testCase.expectedFacts?.length) {
    console.log(
      `  Facts: ${testCase.expectedFacts.map((f) => f.key).join(", ")}`
    );
  }
  console.log("  No pricing fields in AI output");
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY not set — skipping live AI calls.");
    console.log("\nTo run live extraction tests:");
    console.log("  ANTHROPIC_API_KEY=... npx tsx scripts/verify-internal-ai-extraction.ts");
    console.log("\nExpected assertions per brief:");
    for (const testCase of CASES) {
      describeCase(testCase);
    }
    process.exit(0);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  for (const testCase of CASES) {
    console.log(`\n--- ${testCase.name} ---`);
    await runCase(client, model, testCase);
  }

  console.log("\nInternal AI extraction checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
