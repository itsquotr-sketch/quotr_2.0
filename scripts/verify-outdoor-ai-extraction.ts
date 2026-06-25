/**
 * Live AI extraction verification for outdoor calibration briefs.
 *
 * Run: npx tsx scripts/verify-outdoor-ai-extraction.ts
 *
 * Requires ANTHROPIC_API_KEY in the environment. If unavailable, the script
 * documents expected assertions and exits with code 0 after printing instructions.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  BRIEF_EXTRACTION_SYSTEM_PROMPT,
  buildBriefExtractionUserPrompt,
} from "../lib/ai/brief-extraction-prompt";
import { validateAndFilterExtraction } from "../lib/ai/schema";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";

type BriefCase = {
  name: string;
  brief: string;
  expectedWorkAreaTypes: string[];
  expectedFacts: Array<{ key: string; value?: string | number | boolean }>;
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
    expectedFacts: [
      { key: "pergola.length_m", value: 4 },
      { key: "pergola.width_m", value: 6 },
      { key: "pergola.material", value: "Aluminium" },
      { key: "pergola.attached", value: "Attached" },
      { key: "pergola.roofing_included", value: true },
      { key: "pergola.roofing_type", value: "Colorsteel" },
      { key: "pergola.gutters_included", value: true },
    ],
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

function factMatches(
  facts: Array<{ key: string; value: unknown }>,
  expected: { key: string; value?: string | number | boolean }
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

  const result = validateAndFilterExtraction(
    extractJsonFromText(textBlock.text),
    OUTDOOR_TYPES,
    catalogueTypes
  );

  for (const type of testCase.expectedWorkAreaTypes) {
    assert(
      result.workAreas.some((area) => area.type === type),
      `${testCase.name}: work area ${type} recognised`
    );
  }

  for (const expected of testCase.expectedFacts) {
    assert(
      factMatches(result.facts, expected),
      `${testCase.name}: fact ${expected.key} extracted`
    );
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

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY not set — skipping live AI calls.");
    console.log("\nTo run live extraction tests:");
    console.log("  ANTHROPIC_API_KEY=... npx tsx scripts/verify-outdoor-ai-extraction.ts");
    console.log("\nExpected assertions per brief:");
    for (const testCase of CASES) {
      console.log(`\n${testCase.name}:`);
      console.log(`  Work areas: ${testCase.expectedWorkAreaTypes.join(", ")}`);
      console.log(
        `  Facts: ${testCase.expectedFacts.map((f) => f.key).join(", ")}`
      );
      console.log("  No pricing fields in AI output");
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
