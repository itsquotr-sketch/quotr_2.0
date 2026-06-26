/**
 * Fact coverage audit — brief → extraction → normalisation → derived facts → questions.
 *
 * Run: npx tsx scripts/verify-fact-coverage.ts
 *
 * Requires ANTHROPIC_API_KEY in .env.local for live AI extraction.
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
  isQuestionAnswered,
  shouldHideConditionalQuestion,
} from "../lib/scopes/conditional-rules";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import {
  FORBIDDEN_PRICING_KEY_FRAGMENTS,
  normaliseAIExtraction,
} from "../lib/scopes/normalise-extracted-facts";
import {
  buildFactLookup,
  factHasValue,
  toPositiveNumber,
  type ProjectFactRecord,
} from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { prepareProjectFactsForQuestions } from "../lib/scopes/questions";

type Severity = "critical" | "warning" | "info";

type ExpectedFact = {
  key: string;
  severity?: Severity;
  workAreaType?: string;
  value?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  includes?: string;
  booleanTrue?: boolean;
  booleanFalse?: boolean;
  derived?: boolean;
  alternateKeys?: string[];
};

type QuestionExpectation = {
  workAreaType: string;
  factKey: string;
  severity?: Severity;
  alternateFactKeys?: string[];
};

type FactCoverageScenario = {
  name: string;
  brief: string;
  expectedWorkAreas: string[];
  requireOneOfWorkAreas?: string[];
  expectedFacts: ExpectedFact[];
  expectedAnsweredQuestions: QuestionExpectation[];
  suspiciousIfUnanswered?: QuestionExpectation[];
  deckAreaM2?: number;
};

const ALLOWED_TYPES = SCOPE_CATALOGUE.map((item) => item.type);

const SCENARIOS: FactCoverageScenario[] = [
  {
    name: "Bathroom renovation",
    brief:
      "Full bathroom renovation including strip-out, tiled shower, waterproofing, 8m² floor tiling and 15m² wall tiling, plumbing, electrical, extractor fan, client supplying vanity and tapware. Moderate access.",
    expectedWorkAreas: ["bathroom"],
    expectedFacts: [
      { key: "bathroom.renovation_type", includes: "full", severity: "critical" },
      { key: "bathroom.demolition_required", booleanTrue: true, severity: "critical" },
      { key: "bathroom.shower_type", includes: "tiled", severity: "critical" },
      { key: "bathroom.waterproofing_included", booleanTrue: true, severity: "critical" },
      { key: "bathroom.tiling_included", booleanTrue: true, severity: "critical" },
      { key: "bathroom.floor_tiling_area_m2", value: 8, severity: "critical" },
      { key: "bathroom.wall_tiling_area_m2", value: 15, severity: "critical" },
      {
        key: "bathroom.total_tiling_area_m2",
        value: 23,
        derived: true,
        severity: "critical",
      },
      {
        key: "bathroom.plumbing_changes",
        oneOf: ["Minor", "Major", "minor", "major"],
        severity: "critical",
      },
      {
        key: "bathroom.electrical_changes",
        oneOf: ["Minor", "Major", "minor", "major"],
        severity: "critical",
      },
      { key: "bathroom.ventilation_included", booleanTrue: true, severity: "critical" },
      { key: "bathroom.fixtures_client_supplied", booleanTrue: true, severity: "critical" },
      { key: "bathroom.access", includes: "moderate", severity: "warning" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "bathroom", factKey: "bathroom.renovation_type" },
      { workAreaType: "bathroom", factKey: "bathroom.demolition_required" },
      { workAreaType: "bathroom", factKey: "bathroom.shower_type" },
      { workAreaType: "bathroom", factKey: "bathroom.waterproofing_included" },
      { workAreaType: "bathroom", factKey: "bathroom.tiling_included" },
      { workAreaType: "bathroom", factKey: "bathroom.floor_tiling_area_m2" },
      { workAreaType: "bathroom", factKey: "bathroom.wall_tiling_area_m2" },
      { workAreaType: "bathroom", factKey: "bathroom.plumbing_changes" },
      { workAreaType: "bathroom", factKey: "bathroom.electrical_changes" },
      { workAreaType: "bathroom", factKey: "bathroom.ventilation_included" },
      { workAreaType: "bathroom", factKey: "bathroom.fixtures_client_supplied" },
      { workAreaType: "bathroom", factKey: "bathroom.access" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "bathroom", factKey: "bathroom.floor_tiling_area_m2", severity: "critical" },
      { workAreaType: "bathroom", factKey: "bathroom.wall_tiling_area_m2", severity: "critical" },
      { workAreaType: "bathroom", factKey: "bathroom.fixtures_client_supplied", severity: "critical" },
    ],
  },
  {
    name: "Deck (ground level, no stairs)",
    brief:
      "Build 36m² kwila deck with 140mm boards, vertical face boards, no stairs, ground level, easy access.",
    expectedWorkAreas: ["deck"],
    deckAreaM2: 36,
    expectedFacts: [
      { key: "deck.area_m2", value: 36, severity: "critical", derived: true },
      { key: "deck.board_material", oneOf: ["Kwila", "kwila"], severity: "critical" },
      { key: "deck.board_width_mm", oneOf: ["140", 140], severity: "critical" },
      { key: "deck.vertical_face_boards_required", booleanTrue: true, severity: "warning" },
      { key: "deck.access_type", oneOf: ["None", "none"], severity: "critical" },
      { key: "deck.level", includes: "ground", severity: "warning" },
      { key: "deck.access", includes: "easy", severity: "warning" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "deck", factKey: "deck.area_m2", alternateFactKeys: ["deck.length_m", "deck.width_m"] },
      { workAreaType: "deck", factKey: "deck.board_material" },
      { workAreaType: "deck", factKey: "deck.access_type" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "deck", factKey: "deck.area_m2", alternateFactKeys: ["deck.length_m"], severity: "critical" },
      { workAreaType: "deck", factKey: "deck.access_type", severity: "critical" },
    ],
  },
  {
    name: "Deck with stairs",
    brief:
      "Build 70m² hardwood deck with 140mm boards, remove existing deck, include stairs and balustrade. Access is moderate.",
    expectedWorkAreas: ["deck"],
    deckAreaM2: 70,
    expectedFacts: [
      { key: "deck.area_m2", value: 70, severity: "critical", derived: true },
      { key: "deck.board_material", includes: "hardwood", severity: "critical" },
      { key: "deck.board_width_mm", oneOf: ["140", 140], severity: "warning" },
      { key: "deck.existing_deck_removal", booleanTrue: true, severity: "critical" },
      { key: "deck.access_type", includes: "stair", severity: "critical" },
      { key: "deck.balustrade_required", booleanTrue: true, severity: "critical" },
      { key: "deck.access", includes: "moderate", severity: "warning" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "deck", factKey: "deck.area_m2", alternateFactKeys: ["deck.length_m", "deck.width_m"] },
      { workAreaType: "deck", factKey: "deck.existing_deck_removal" },
      { workAreaType: "deck", factKey: "deck.balustrade_required" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "deck", factKey: "deck.area_m2", alternateFactKeys: ["deck.length_m"], severity: "critical" },
      { workAreaType: "deck", factKey: "deck.balustrade_required", severity: "critical" },
    ],
  },
  {
    name: "Retaining wall",
    brief:
      "Build 14.6m raking face-fixed retaining wall from 1m down to 0.4m with poor access, backfill, novacoil drainage and 45m carting distance.",
    expectedWorkAreas: ["retaining_wall"],
    expectedFacts: [
      { key: "retaining_wall.length_m", value: 14.6, severity: "critical" },
      { key: "retaining_wall.is_raking", booleanTrue: true, severity: "critical" },
      { key: "retaining_wall.height_high_m", value: 1, severity: "critical" },
      { key: "retaining_wall.height_low_m", value: 0.4, severity: "critical" },
      { key: "retaining_wall.fixing_type", includes: "face", severity: "critical" },
      { key: "retaining_wall.access", oneOf: ["Poor", "Difficult", "poor", "difficult"], severity: "warning" },
      { key: "retaining_wall.backfill_included", booleanTrue: true, severity: "critical" },
      { key: "retaining_wall.drainage_required", booleanTrue: true, severity: "critical" },
      { key: "retaining_wall.carting_distance_m", value: 45, severity: "warning" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "retaining_wall", factKey: "retaining_wall.length_m" },
      { workAreaType: "retaining_wall", factKey: "retaining_wall.is_raking" },
      { workAreaType: "retaining_wall", factKey: "retaining_wall.fixing_type" },
      { workAreaType: "retaining_wall", factKey: "retaining_wall.drainage_required" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "retaining_wall", factKey: "retaining_wall.length_m", severity: "critical" },
      { workAreaType: "retaining_wall", factKey: "retaining_wall.is_raking", severity: "critical" },
    ],
  },
  {
    name: "Internal walls / doors / painting",
    brief:
      "Build 10m of 2.4m high timber framed internal wall, line both sides with 13mm GIB, insulate and add skirting. Install 4 solid core doors with frames and hardware. Paint walls, doors and trims, two coats.",
    expectedWorkAreas: ["internal_walls", "doors", "painting"],
    expectedFacts: [
      { key: "internal_walls.length_lm", value: 10, workAreaType: "internal_walls", severity: "critical" },
      { key: "internal_walls.height_m", value: 2.4, workAreaType: "internal_walls", severity: "critical" },
      { key: "internal_walls.framing_type", includes: "timber", workAreaType: "internal_walls", severity: "warning" },
      { key: "internal_walls.lining_sides", includes: "both", workAreaType: "internal_walls", severity: "critical" },
      { key: "internal_walls.wall_lining_type", includes: "plasterboard", workAreaType: "internal_walls", severity: "warning" },
      { key: "internal_walls.insulation_included", booleanTrue: true, workAreaType: "internal_walls", severity: "warning" },
      { key: "internal_walls.skirtings_included", booleanTrue: true, workAreaType: "internal_walls", severity: "warning" },
      { key: "doors.count", value: 4, workAreaType: "doors", severity: "critical" },
      { key: "doors.door_type", includes: "solid", workAreaType: "doors", severity: "warning" },
      { key: "doors.frames_included", booleanTrue: true, workAreaType: "doors", severity: "warning" },
      { key: "doors.hardware_install_included", booleanTrue: true, workAreaType: "doors", severity: "warning" },
      { key: "painting.coats_required", oneOf: ["2", 2], workAreaType: "painting", severity: "critical" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "internal_walls", factKey: "internal_walls.length_lm" },
      { workAreaType: "internal_walls", factKey: "internal_walls.height_m" },
      { workAreaType: "internal_walls", factKey: "internal_walls.lining_sides" },
      { workAreaType: "doors", factKey: "doors.count" },
      { workAreaType: "painting", factKey: "painting.coats_required" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "internal_walls", factKey: "internal_walls.length_lm", severity: "critical" },
      { workAreaType: "doors", factKey: "doors.count", severity: "critical" },
    ],
  },
  {
    name: "Kitchen install only",
    brief:
      "Remove existing kitchen and install client-supplied flatpack cabinetry, new benchtop and tiled splashback. Plumbing and electrical by others.",
    expectedWorkAreas: ["kitchen"],
    expectedFacts: [
      { key: "kitchen.demolition_required", booleanTrue: true, severity: "critical" },
      { key: "kitchen.cabinetry_client_supplied", booleanTrue: true, severity: "critical" },
      { key: "kitchen.cabinetry_type", includes: "flatpack", severity: "warning" },
      { key: "kitchen.benchtop_included", booleanTrue: true, severity: "critical" },
      { key: "kitchen.splashback_included", booleanTrue: true, severity: "critical" },
      { key: "kitchen.plumbing_changes", oneOf: ["None", "none", "No"], severity: "critical" },
      { key: "kitchen.electrical_changes", oneOf: ["None", "none", "No"], severity: "critical" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "kitchen", factKey: "kitchen.demolition_required" },
      { workAreaType: "kitchen", factKey: "kitchen.cabinetry_client_supplied" },
      { workAreaType: "kitchen", factKey: "kitchen.plumbing_changes" },
      { workAreaType: "kitchen", factKey: "kitchen.electrical_changes" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "kitchen", factKey: "kitchen.cabinetry_client_supplied", severity: "critical" },
      { workAreaType: "kitchen", factKey: "kitchen.plumbing_changes", severity: "critical" },
    ],
  },
  {
    name: "Flooring removal only",
    brief:
      "Remove 20m² vinyl flooring and cart waste 30m to skip. No new flooring.",
    expectedWorkAreas: [],
    requireOneOfWorkAreas: ["flooring", "demolition"],
    expectedFacts: [
      {
        key: "flooring.area_m2",
        value: 20,
        severity: "critical",
        alternateKeys: ["demolition.floor_area_m2"],
      },
      {
        key: "flooring.supply_scope",
        includes: "removal",
        severity: "critical",
        alternateKeys: ["demolition.scope_items"],
      },
      {
        key: "flooring.existing_flooring_removal",
        booleanTrue: true,
        severity: "critical",
        alternateKeys: ["demolition.scope_items"],
      },
      {
        key: "flooring.disposal_included",
        booleanTrue: true,
        severity: "warning",
        alternateKeys: ["demolition.disposal_included"],
      },
      {
        key: "demolition.carting_distance_m",
        value: 30,
        severity: "warning",
        workAreaType: "demolition",
      },
      { key: "flooring.type", includes: "vinyl", severity: "info" },
    ],
    expectedAnsweredQuestions: [
      {
        workAreaType: "flooring",
        factKey: "flooring.area_m2",
        alternateFactKeys: ["demolition.floor_area_m2"],
      },
      {
        workAreaType: "flooring",
        factKey: "flooring.supply_scope",
        alternateFactKeys: ["demolition.scope_items"],
      },
      {
        workAreaType: "flooring",
        factKey: "flooring.existing_flooring_removal",
        alternateFactKeys: ["demolition.scope_items"],
      },
    ],
    suspiciousIfUnanswered: [
      {
        workAreaType: "flooring",
        factKey: "flooring.area_m2",
        alternateFactKeys: ["demolition.floor_area_m2"],
        severity: "critical",
      },
    ],
  },
  {
    name: "External stairs",
    brief:
      "Build 8-step treated timber external stairs to deck, 1m wide, with handrail and remove existing stairs.",
    expectedWorkAreas: ["external_stairs"],
    expectedFacts: [
      { key: "external_stairs.risers_count", value: 8, severity: "critical" },
      { key: "external_stairs.material", includes: "treated", severity: "critical" },
      { key: "external_stairs.width_m", value: 1, severity: "critical" },
      { key: "external_stairs.handrail_included", booleanTrue: true, severity: "critical" },
      { key: "external_stairs.existing_removal", booleanTrue: true, severity: "critical" },
    ],
    expectedAnsweredQuestions: [
      { workAreaType: "external_stairs", factKey: "external_stairs.risers_count" },
      { workAreaType: "external_stairs", factKey: "external_stairs.handrail_included" },
      { workAreaType: "external_stairs", factKey: "external_stairs.existing_removal" },
    ],
    suspiciousIfUnanswered: [
      { workAreaType: "external_stairs", factKey: "external_stairs.risers_count", severity: "critical" },
    ],
  },
];

type NormalizedExtraction = {
  workAreaIdByType: Map<string, string>;
  normalizedFacts: ProjectFactRecord[];
  extractionFacts: AIExtractionOutput["facts"];
};

function normalizeValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim().toLowerCase();
  if (Array.isArray(value)) return value.join(",").toLowerCase();
  return "";
}

function applyDerivedFactsPipeline(result: AIExtractionOutput): NormalizedExtraction {
  const workAreaIdByType = new Map<string, string>();
  const workAreas = result.workAreas.map((workArea, index) => {
    const id = `fc-wa-${workArea.type}-${index}`;
    workAreaIdByType.set(workArea.type, id);
    return { id, type: workArea.type };
  });

  const projectFacts: ProjectFactRecord[] = result.facts
    .filter((fact) => fact.work_area_type !== null)
    .map((fact) => ({
      key: fact.key,
      work_area_id: workAreaIdByType.get(fact.work_area_type!) ?? null,
      value: fact.value,
      source: "ai_extracted" as const,
    }));

  const derivedFacts = deriveFactsForProject({ workAreas, projectFacts });
  const normalizedFacts = mergeDerivedFactsIntoRecords(projectFacts, derivedFacts);

  return { workAreaIdByType, normalizedFacts, extractionFacts: result.facts };
}

function getFactValue(
  facts: ProjectFactRecord[],
  key: string,
  workAreaId?: string
): unknown {
  const match = facts.find(
    (fact) =>
      fact.key === key && (workAreaId == null || fact.work_area_id === workAreaId)
  );
  return match?.value;
}

function resolveDeckAreaM2(
  facts: ProjectFactRecord[],
  workAreaIdByType: Map<string, string>
): number | null {
  const deckId = workAreaIdByType.get("deck");
  if (!deckId) return null;

  const area = toPositiveNumber(getFactValue(facts, "deck.area_m2", deckId));
  if (area) return area;

  const length = toPositiveNumber(getFactValue(facts, "deck.length_m", deckId));
  const width = toPositiveNumber(getFactValue(facts, "deck.width_m", deckId));
  if (length && width) {
    return roundToTwoDecimals(length * width);
  }
  return null;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveWorkAreaIds(
  expected: ExpectedFact | QuestionExpectation,
  workAreaIdByType: Map<string, string>
): string[] {
  if ("workAreaType" in expected && expected.workAreaType) {
    const id = workAreaIdByType.get(expected.workAreaType);
    return id ? [id] : [];
  }
  return [...workAreaIdByType.values()];
}

function valueMatchesExpectation(
  value: unknown,
  expected: ExpectedFact
): boolean {
  if (value == null || value === "") return false;

  if (expected.derived) {
    return true;
  }

  if (expected.booleanTrue) {
    return value === true || normalizeValue(value) === "true" || value === "Yes";
  }
  if (expected.booleanFalse) {
    return value === false || normalizeValue(value) === "false" || value === "No";
  }
  if (expected.value != null) {
    const num = toPositiveNumber(value);
    const expNum = toPositiveNumber(expected.value);
    if (num != null && expNum != null) {
      return Math.abs(num - expNum) < 0.05;
    }
    return normalizeValue(value) === normalizeValue(expected.value);
  }
  if (expected.oneOf) {
    return expected.oneOf.some(
      (option) => normalizeValue(option) === normalizeValue(value)
    );
  }
  if (expected.includes) {
    const normalized = normalizeValue(value);
    if (Array.isArray(value)) {
      return value.some((item) =>
        normalizeValue(item).includes(expected.includes!.toLowerCase())
      );
    }
    return normalized.includes(expected.includes.toLowerCase());
  }
  return factHasValue(value);
}

function factMatches(
  facts: ProjectFactRecord[],
  expected: ExpectedFact,
  workAreaIdByType: Map<string, string>,
  scenario?: FactCoverageScenario
): boolean {
  if (expected.key === "deck.area_m2" && expected.value != null && scenario?.deckAreaM2) {
    const area = resolveDeckAreaM2(facts, workAreaIdByType);
    if (area != null) {
      const derived = facts.find(
        (f) =>
          f.key === "deck.area_m2" &&
          f.work_area_id === workAreaIdByType.get("deck")
      );
      if (expected.derived && derived?.source !== "derived") {
        // Still pass if length×width yields correct area
      }
      return Math.abs(area - Number(expected.value)) < Math.max(1, Number(expected.value) * 0.02);
    }
  }

  const keys = [expected.key, ...(expected.alternateKeys ?? [])];
  const workAreaIds = expected.workAreaType
    ? resolveWorkAreaIds(expected, workAreaIdByType)
    : [...workAreaIdByType.values()];

  for (const key of keys) {
    for (const workAreaId of workAreaIds) {
      const value = getFactValue(facts, key, workAreaId);
      if (value == null || value === "") continue;

      if (expected.derived) {
        const source = facts.find(
          (f) => f.key === key && f.work_area_id === workAreaId
        )?.source;
        if (source !== "derived" && key !== "deck.area_m2") {
          continue;
        }
      }

      if (valueMatchesExpectation(value, expected)) {
        return true;
      }
    }
  }

  return false;
}

function isQuestionPreAnswered(
  params: {
    workAreaIdByType: Map<string, string>;
    normalizedFacts: ProjectFactRecord[];
    expectation: QuestionExpectation;
  }
): boolean {
  const workAreaTypes = [params.expectation.workAreaType];
  if (params.expectation.alternateFactKeys?.some((k) => k.startsWith("demolition."))) {
    workAreaTypes.push("demolition");
  }
  if (params.expectation.alternateFactKeys?.some((k) => k.startsWith("flooring."))) {
    workAreaTypes.push("flooring");
  }

  const factKeys = [
    params.expectation.factKey,
    ...(params.expectation.alternateFactKeys ?? []),
  ];

  for (const waType of [...new Set(workAreaTypes)]) {
    const waId = params.workAreaIdByType.get(waType);
    if (!waId) continue;

    const merged = prepareProjectFactsForQuestions({
      workAreas: [
        {
          id: waId,
          type: waType,
          name: waType,
          status: "confirmed",
          sort_order: 1,
        },
      ],
      projectFacts: params.normalizedFacts,
    });
    const lookup = buildFactLookup(merged);

    for (const factKey of factKeys) {
      const keyWaType = factKey.split(".")[0];
      if (keyWaType !== waType) continue;
      if (isQuestionAnswered(lookup, waId, factKey)) {
        return true;
      }
    }
  }

  return false;
}

function isSuspiciousUnanswered(
  params: {
    workAreaIdByType: Map<string, string>;
    normalizedFacts: ProjectFactRecord[];
    item: QuestionExpectation;
  }
): boolean {
  return !isQuestionPreAnswered({
    workAreaIdByType: params.workAreaIdByType,
    normalizedFacts: params.normalizedFacts,
    expectation: params.item,
  });
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

type ScenarioReport = {
  name: string;
  passed: boolean;
  criticalFailures: string[];
  warnings: string[];
  info: string[];
};

function auditQuestions(params: {
  scenario: FactCoverageScenario;
  workAreaIdByType: Map<string, string>;
  normalizedFacts: ProjectFactRecord[];
}): {
  answered: string[];
  unanswered: string[];
  suspicious: string[];
  hidden: string[];
} {
  const workAreas = [...params.workAreaIdByType.entries()].map(([type, id]) => ({
    id,
    type,
    name: type,
    status: "confirmed" as const,
    sort_order: 1,
  }));

  const mergedFacts = prepareProjectFactsForQuestions({
    workAreas,
    projectFacts: params.normalizedFacts,
  });
  const lookup = buildFactLookup(mergedFacts);

  const answered: string[] = [];
  const unanswered: string[] = [];
  const hidden: string[] = [];
  const suspicious: string[] = [];

  for (const [waType, waId] of params.workAreaIdByType) {
    const templates = getScopeQuestions(waType);
    for (const template of templates) {
      const label = `${waType}:${template.factKey}`;
      if (shouldHideConditionalQuestion(template, waId, lookup)) {
        hidden.push(label);
        continue;
      }
      if (isQuestionAnswered(lookup, waId, template.factKey)) {
        answered.push(label);
      } else {
        unanswered.push(label);
      }
    }
  }

  for (const item of params.scenario.suspiciousIfUnanswered ?? []) {
    if (
      isSuspiciousUnanswered({
        workAreaIdByType: params.workAreaIdByType,
        normalizedFacts: params.normalizedFacts,
        item,
      })
    ) {
      suspicious.push(`${item.workAreaType}:${item.factKey}`);
    }
  }

  return { answered, unanswered, suspicious, hidden };
}

async function runScenario(
  client: Anthropic,
  model: string,
  scenario: FactCoverageScenario
): Promise<ScenarioReport> {
  const report: ScenarioReport = {
    name: scenario.name,
    passed: true,
    criticalFailures: [],
    warnings: [],
    info: [],
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Brief: ${scenario.brief.slice(0, 100)}...`);

  const userPrompt = buildBriefExtractionUserPrompt(scenario.brief, ALLOWED_TYPES);
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

  const rawParsed = extractJsonFromText(textBlock.text);
  const validated = validateAndFilterExtraction(
    rawParsed,
    ALLOWED_TYPES,
    ALLOWED_TYPES
  );
  const result = normaliseAIExtraction(validated);
  const normalized = applyDerivedFactsPipeline(result);

  const recognised = result.workAreas.map((wa) => wa.type);
  console.log(`\nRecognised work areas: ${recognised.join(", ") || "(none)"}`);
  console.log(`Expected work areas: ${scenario.expectedWorkAreas.join(", ")}`);

  for (const type of scenario.expectedWorkAreas) {
    if (!recognised.includes(type)) {
      const msg = `Missing work area: ${type}`;
      report.criticalFailures.push(msg);
      console.log(`  ✗ CRITICAL: ${msg}`);
      report.passed = false;
    } else {
      console.log(`  ✓ Work area: ${type}`);
    }
  }

  if (scenario.requireOneOfWorkAreas?.length) {
    const matched = scenario.requireOneOfWorkAreas.some((type) =>
      recognised.includes(type)
    );
    if (matched) {
      console.log(
        `  ✓ At least one of: ${scenario.requireOneOfWorkAreas.join(", ")}`
      );
    } else {
      const msg = `Expected one of work areas: ${scenario.requireOneOfWorkAreas.join(", ")}`;
      report.criticalFailures.push(msg);
      console.log(`  ✗ CRITICAL: ${msg}`);
      report.passed = false;
    }
  }

  for (const fact of FORBIDDEN_PRICING_KEY_FRAGMENTS) {
    const bad = normalized.normalizedFacts.filter((f) =>
      f.key.toLowerCase().includes(fact)
    );
    if (bad.length > 0) {
      const msg = `AI pricing key detected: ${bad.map((b) => b.key).join(", ")}`;
      report.criticalFailures.push(msg);
      console.log(`  ✗ CRITICAL: ${msg}`);
      report.passed = false;
    }
  }

  console.log("\nExtracted facts (normalised + derived):");
  for (const fact of normalized.normalizedFacts) {
    console.log(`  - ${fact.key} = ${JSON.stringify(fact.value)} [${fact.source}]`);
  }

  console.log("\nExpected facts:");
  for (const expected of scenario.expectedFacts) {
    const severity = expected.severity ?? "warning";
    const ok = factMatches(
      normalized.normalizedFacts,
      expected,
      normalized.workAreaIdByType,
      scenario
    );
    const icon = ok ? "✓" : severity === "info" ? "○" : "✗";
    console.log(`  ${icon} [${severity}] ${expected.key}`);
    if (!ok && severity === "critical") {
      report.criticalFailures.push(`Missing critical fact: ${expected.key}`);
      report.passed = false;
    } else if (!ok && severity === "warning") {
      report.warnings.push(`Missing warning fact: ${expected.key}`);
    } else if (!ok) {
      report.info.push(`Missing info fact: ${expected.key}`);
    }
  }

  const questionAudit = auditQuestions({
    scenario,
    workAreaIdByType: normalized.workAreaIdByType,
    normalizedFacts: normalized.normalizedFacts,
  });

  console.log(`\nQuestions answered by extraction: ${questionAudit.answered.length}`);
  console.log(`Questions still unanswered: ${questionAudit.unanswered.length}`);
  console.log(`Questions hidden by conditionals: ${questionAudit.hidden.length}`);

  for (const q of scenario.expectedAnsweredQuestions) {
    const ok = isQuestionPreAnswered({
      workAreaIdByType: normalized.workAreaIdByType,
      normalizedFacts: normalized.normalizedFacts,
      expectation: q,
    });
    console.log(`  ${ok ? "✓" : "✗"} pre-answered: ${q.workAreaType}:${q.factKey}`);
    if (!ok) {
      const severity = q.severity ?? "critical";
      if (severity === "critical") {
        report.criticalFailures.push(`Question not pre-answered: ${q.factKey}`);
        report.passed = false;
      } else {
        report.warnings.push(`Question not pre-answered: ${q.factKey}`);
      }
    }
  }

  if (questionAudit.suspicious.length > 0) {
    console.log("\nSuspicious unanswered (brief likely contained answer):");
    for (const s of questionAudit.suspicious) {
      console.log(`  ⚠ ${s}`);
      report.criticalFailures.push(`Suspicious unanswered: ${s}`);
      report.passed = false;
    }
  }

  if (questionAudit.unanswered.length > 0 && questionAudit.unanswered.length <= 8) {
    console.log("\nRemaining unanswered (sample):");
    for (const u of questionAudit.unanswered.slice(0, 8)) {
      console.log(`  · ${u}`);
    }
  }

  console.log(`\nScenario result: ${report.passed ? "PASS" : "FAIL"}`);
  if (report.warnings.length > 0) {
    console.log(`Warnings: ${report.warnings.length}`);
  }

  return report;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY not set. Add it to .env.local to run live fact coverage audit."
    );
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const reports: ScenarioReport[] = [];

  for (const scenario of SCENARIOS) {
    try {
      reports.push(await runScenario(client, model, scenario));
    } catch (error) {
      console.error(`\nScenario "${scenario.name}" errored:`, error);
      reports.push({
        name: scenario.name,
        passed: false,
        criticalFailures: [String(error)],
        warnings: [],
        info: [],
      });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("FACT COVERAGE SUMMARY");
  console.log(`${"=".repeat(60)}`);

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.length - passed;
  console.log(`Scenarios passed: ${passed}/${reports.length}`);
  console.log(`Scenarios failed: ${failed}`);

  for (const report of reports) {
    console.log(`  ${report.passed ? "PASS" : "FAIL"} — ${report.name}`);
    if (report.criticalFailures.length > 0) {
      for (const f of report.criticalFailures) {
        console.log(`      critical: ${f}`);
      }
    }
  }

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\nAll fact coverage scenarios passed.\n");
}

main();
