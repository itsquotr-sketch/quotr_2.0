/**
 * Live AI extraction verification for outdoor calibration briefs.
 *
 * Run: npx tsx scripts/verify-outdoor-ai-extraction.ts
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
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";
import { toPositiveNumber } from "../lib/scopes/fact-values";

type ExpectedFact = { key: string; value?: string | number | boolean };

type DimensionPairAssertion = {
  keys: [string, string];
  expectedValues: [number, number];
  tolerance?: number;
  areaKey?: string;
  expectedArea?: number;
  workAreaType?: string;
};

type StrictDimensionsAssertion = {
  lengthKey: string;
  widthKey: string;
  length: number;
  width: number;
  tolerance?: number;
  areaKey?: string;
  expectedArea?: number;
  workAreaType?: string;
};

type BriefCase = {
  name: string;
  brief: string;
  expectedWorkAreaTypes: string[];
  expectedFacts?: ExpectedFact[];
  dimensionPair?: DimensionPairAssertion;
  strictDimensions?: StrictDimensionsAssertion;
  forbiddenFactKeys?: string[];
};

const OUTDOOR_TYPES = ["deck", "fence", "pergola", "retaining_wall"];

const CASES: BriefCase[] = [
  {
    name: "Deck",
    brief:
      "Build a 70m² kwila deck using 140mm boards, remove the existing deck, include stairs and balustrade. Access is moderate.",
    expectedWorkAreaTypes: ["deck"],
    expectedFacts: [
      { key: "deck.board_material", value: "Kwila" },
      { key: "deck.board_width_mm", value: 140 },
      { key: "deck.existing_deck_removal", value: true },
      { key: "deck.balustrade_required", value: true },
      { key: "deck.access", value: "Moderate" },
    ],
    forbiddenFactKeys: ["recommended_cost", "recommended_sell", "price"],
  },
  {
    name: "Fence",
    brief:
      "Replace 30lm of 2m timber fence on a sloping boundary with one gate. Remove the old fence and allow for disposal.",
    expectedWorkAreaTypes: ["fence"],
    expectedFacts: [
      { key: "fence.length_m", value: 30 },
      { key: "fence.height_m", value: 2 },
      { key: "fence.material", value: "Timber" },
      { key: "fence.gate_included", value: true },
      { key: "fence.demolition_required", value: true },
      { key: "fence.disposal_required", value: true },
    ],
  },
  {
    name: "Pergola",
    brief:
      "Install a 4m by 6m attached aluminium pergola with Colorsteel roofing and gutters.",
    expectedWorkAreaTypes: ["pergola"],
    dimensionPair: {
      keys: ["pergola.length_m", "pergola.width_m"],
      expectedValues: [4, 6],
      tolerance: 0.01,
      areaKey: "pergola.area_m2",
      expectedArea: 24,
      workAreaType: "pergola",
    },
    expectedFacts: [
      { key: "pergola.material", value: "Aluminium" },
      { key: "pergola.attached", value: "Attached" },
      { key: "pergola.roofing_included", value: true },
      { key: "pergola.roofing_type", value: "Colorsteel" },
      { key: "pergola.gutters_included", value: true },
    ],
  },
  {
    name: "Pergola explicit orientation",
    brief: "Construct a 6m long by 3m wide roofed pergola.",
    expectedWorkAreaTypes: ["pergola"],
    strictDimensions: {
      lengthKey: "pergola.length_m",
      widthKey: "pergola.width_m",
      length: 6,
      width: 3,
      tolerance: 0.01,
      areaKey: "pergola.area_m2",
      expectedArea: 18,
      workAreaType: "pergola",
    },
    expectedFacts: [{ key: "pergola.roofing_included", value: true }],
  },
  {
    name: "Retaining wall",
    brief:
      "Build a 14.6m raking face-fixed retaining wall from 1m down to 0.4m with poor access, backfill, novacoil drainage and 45m carting distance.",
    expectedWorkAreaTypes: ["retaining_wall"],
    expectedFacts: [
      { key: "retaining_wall.length_m", value: 14.6 },
      { key: "retaining_wall.is_raking", value: true },
      { key: "retaining_wall.height_high_m", value: 1 },
      { key: "retaining_wall.height_low_m", value: 0.4 },
      { key: "retaining_wall.fixing_type", value: "Face-fixed" },
      { key: "retaining_wall.backfill_included", value: true },
      { key: "retaining_wall.drainage_required", value: true },
      { key: "retaining_wall.carting_distance_m", value: 45 },
      { key: "retaining_wall.access", value: "Difficult" },
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

function factMatches(
  facts: Array<{ key: string; value: unknown }>,
  expected: ExpectedFact
): boolean {
  const match = facts.find((fact) => fact.key === expected.key);
  if (!match) return false;
  if (expected.value === undefined) return true;

  const actual = normalizeValue(match.value);
  const wanted = normalizeValue(expected.value);

  if (typeof expected.value === "string" && typeof match.value === "string") {
    return actual.includes(wanted) || wanted.includes(actual);
  }

  return actual === wanted;
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
    expected:
      expectedFact.value !== undefined
        ? JSON.stringify(expectedFact.value)
        : "(any value)",
    actual: matchedFact
      ? JSON.stringify(matchedFact.value)
      : "(missing)",
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

function assertDimensionPair(
  context: AssertionDebugContext,
  assertion: DimensionPairAssertion
): void {
  const tolerance = assertion.tolerance ?? 0.01;
  const workAreaId = getWorkAreaId(context.normalized, assertion.workAreaType);
  const [keyA, keyB] = assertion.keys;

  const valueA = getNumericFact(context.normalized.normalizedFacts, keyA, workAreaId);
  const valueB = getNumericFact(context.normalized.normalizedFacts, keyB, workAreaId);

  if (valueA == null || valueB == null) {
    logAssertionFailure(context, {
      label: `dimension pair ${keyA} / ${keyB}`,
      expected: JSON.stringify(assertion.expectedValues),
      actual: JSON.stringify([valueA ?? null, valueB ?? null]),
    });
    throw new Error(
      `FAIL: ${context.testCase.name}: dimension pair ${keyA}, ${keyB} missing`
    );
  }

  const expectedSorted = [...assertion.expectedValues].sort((a, b) => a - b);
  const actualSorted = [valueA, valueB].sort((a, b) => a - b);
  const pairMatches = expectedSorted.every(
    (expected, index) => Math.abs(actualSorted[index] - expected) <= tolerance
  );

  if (!pairMatches) {
    logAssertionFailure(context, {
      label: `unordered dimension pair ${keyA} / ${keyB}`,
      expected: JSON.stringify(assertion.expectedValues),
      actual: JSON.stringify({ [keyA]: valueA, [keyB]: valueB }),
    });
    throw new Error(
      `FAIL: ${context.testCase.name}: dimension pair does not match ${assertion.expectedValues.join(", ")}`
    );
  }

  if (assertion.areaKey != null && assertion.expectedArea != null) {
    assertNumericFact(
      context,
      assertion.areaKey,
      assertion.expectedArea,
      tolerance,
      assertion.workAreaType
    );
  }
}

function assertStrictDimensions(
  context: AssertionDebugContext,
  assertion: StrictDimensionsAssertion
): void {
  const tolerance = assertion.tolerance ?? 0.01;
  const workAreaId = getWorkAreaId(context.normalized, assertion.workAreaType);

  const length = getNumericFact(
    context.normalized.normalizedFacts,
    assertion.lengthKey,
    workAreaId
  );
  const width = getNumericFact(
    context.normalized.normalizedFacts,
    assertion.widthKey,
    workAreaId
  );

  const lengthOk =
    length != null && Math.abs(length - assertion.length) <= tolerance;
  const widthOk = width != null && Math.abs(width - assertion.width) <= tolerance;

  if (!lengthOk || !widthOk) {
    logAssertionFailure(context, {
      label: `strict dimensions ${assertion.lengthKey} / ${assertion.widthKey}`,
      expected: JSON.stringify({
        [assertion.lengthKey]: assertion.length,
        [assertion.widthKey]: assertion.width,
      }),
      actual: JSON.stringify({
        [assertion.lengthKey]: length ?? null,
        [assertion.widthKey]: width ?? null,
      }),
    });
    throw new Error(
      `FAIL: ${context.testCase.name}: strict dimension mapping failed`
    );
  }

  if (assertion.areaKey != null && assertion.expectedArea != null) {
    assertNumericFact(
      context,
      assertion.areaKey,
      assertion.expectedArea,
      tolerance,
      assertion.workAreaType
    );
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
  const userPrompt = buildBriefExtractionUserPrompt(testCase.brief, OUTDOOR_TYPES);

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
    OUTDOOR_TYPES,
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

  if (testCase.dimensionPair) {
    assertDimensionPair(assertionContext, testCase.dimensionPair);
    console.log(
      `PASS: ${testCase.name}: dimension pair ${testCase.dimensionPair.keys.join(", ")} matches ${testCase.dimensionPair.expectedValues.join(" × ")}`
    );
    if (
      testCase.dimensionPair.areaKey &&
      testCase.dimensionPair.expectedArea != null
    ) {
      console.log(
        `PASS: ${testCase.name}: derived ${testCase.dimensionPair.areaKey} = ${testCase.dimensionPair.expectedArea}`
      );
    }
  }

  if (testCase.strictDimensions) {
    assertStrictDimensions(assertionContext, testCase.strictDimensions);
    console.log(
      `PASS: ${testCase.name}: strict dimensions ${testCase.strictDimensions.lengthKey}=${testCase.strictDimensions.length}, ${testCase.strictDimensions.widthKey}=${testCase.strictDimensions.width}`
    );
    if (
      testCase.strictDimensions.areaKey &&
      testCase.strictDimensions.expectedArea != null
    ) {
      console.log(
        `PASS: ${testCase.name}: derived ${testCase.strictDimensions.areaKey} = ${testCase.strictDimensions.expectedArea}`
      );
    }
  }

  for (const expected of testCase.expectedFacts ?? []) {
    assertFactExtracted(assertionContext, expected);
  }

  const rawJson = JSON.stringify(result).toLowerCase();
  assert(
    !rawJson.includes("recommended_sell") && !rawJson.includes("recommended_cost"),
    `${testCase.name}: no AI pricing in output`
  );

  for (const key of testCase.forbiddenFactKeys ?? []) {
    assert(
      !result.facts.some((fact) => fact.key.toLowerCase().includes(key)),
      `${testCase.name}: no forbidden key ${key}`
    );
  }
}

function describeCase(testCase: BriefCase): void {
  console.log(`\n${testCase.name}:`);
  console.log(`  Work areas: ${testCase.expectedWorkAreaTypes.join(", ")}`);
  if (testCase.dimensionPair) {
    console.log(
      `  Dimensions (unordered): ${testCase.dimensionPair.expectedValues.join(" × ")} via ${testCase.dimensionPair.keys.join(", ")}`
    );
    if (testCase.dimensionPair.expectedArea != null) {
      console.log(
        `  Derived area: ${testCase.dimensionPair.areaKey} = ${testCase.dimensionPair.expectedArea}`
      );
    }
  }
  if (testCase.strictDimensions) {
    console.log(
      `  Dimensions (strict): ${testCase.strictDimensions.lengthKey}=${testCase.strictDimensions.length}, ${testCase.strictDimensions.widthKey}=${testCase.strictDimensions.width}`
    );
    if (testCase.strictDimensions.expectedArea != null) {
      console.log(
        `  Derived area: ${testCase.strictDimensions.areaKey} = ${testCase.strictDimensions.expectedArea}`
      );
    }
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
    console.log("  ANTHROPIC_API_KEY=... npx tsx scripts/verify-outdoor-ai-extraction.ts");
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

  console.log("\nOutdoor AI extraction checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
