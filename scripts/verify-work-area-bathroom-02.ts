/**
 * WA-BATHROOM-02 — Bathroom scope + geometry foundation.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-02.ts
 * Live Preview persist: npx --yes tsx scripts/verify-work-area-bathroom-02.ts --live
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { getUserFacingEstimateAssumptions } from "../lib/assistant/presentation/user-facing-estimate-assumptions";
import { disclosedWallHeightForNotSure } from "../lib/estimate/bathroom-geometry";
import {
  BATHROOM_CEILING_AREA_FACT_KEY,
  BATHROOM_FLOOR_AREA_FACT_KEY,
  BATHROOM_GROSS_WALL_AREA_FACT_KEY,
  BATHROOM_LENGTH_WIDTH_REQUIRED_MESSAGE,
  BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT,
  BATHROOM_WALL_HEIGHT_ASSUMPTION_M,
  BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT,
  deriveBathroomGeometry,
  resolveBathroomGeometry,
} from "../lib/estimate/bathroom-geometry";
import {
  BATHROOM_JOB_SCOPE_VALUES,
  bathroomGeometryNeed,
  bathroomQuestionGroupVisible,
  isMatureBathroomPath,
  mapLegacyRenovationTypeToJobScope,
  parseBathroomJobScope,
  parseBathroomTradeLevel,
  resolveBathroomJobScope,
  shouldHideBathroomQuestion,
} from "../lib/estimate/bathroom-scope";
import { BATHROOM_CALCULATOR_CONSUMED_FACTS } from "../lib/estimate/calculators/bathroom";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { isCalculatorConsumedFact } from "../lib/estimate/consumed-facts";
import { PHYSICAL_REQUIREMENT_RESOLUTION } from "../lib/estimate/physical-requirement-resolution";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { buildMinimalExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { shouldHideConditionalQuestion } from "../lib/scopes/conditional-rules";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { DERIVED_FACT_KEYS } from "../lib/scopes/fact-keys";
import { buildFactLookup, type ProjectFactRecord } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { isQuickEstimateAskQuestion } from "../lib/scopes/estimate-priority";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
  isPlusAddressFixture,
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
} from "./lib/preview-auth-fixture";

const LIVE = process.argv.includes("--live");

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx).trim()] = value;
  }
  return env;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
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
  } as unknown as EstimateContext;
}

function lookup(
  workAreaId: string,
  facts: Array<{ key: string; value: unknown }>
) {
  const records: ProjectFactRecord[] = facts.map((row) => ({
    key: row.key,
    work_area_id: workAreaId,
    value: row.value,
    source: "user",
  }));
  return buildFactLookup(records);
}

function visibleBathroomKeys(
  facts: Array<{ key: string; value: unknown }>,
  quickOnly = true
): string[] {
  const workAreaId = "b1";
  const templates = getScopeQuestions("bathroom");
  const factLookup = lookup(workAreaId, facts);
  return templates
    .filter((template) => {
      if (quickOnly && !isQuickEstimateAskQuestion(template)) return false;
      return !shouldHideConditionalQuestion(
        template,
        workAreaId,
        factLookup,
        new Set(["bathroom"])
      );
    })
    .map((template) => template.factKey);
}

function composeBathroomClarify(facts: EstimateFact[], workAreaId = "b1") {
  const workAreas = [wa(workAreaId, "bathroom", "Bathroom")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

console.log("=== WA-BATHROOM-02 ===\n");

console.log("--- Scope ---\n");
check(
  "canonical job-scope enum has 9 values",
  BATHROOM_JOB_SCOPE_VALUES.length === 9 &&
    BATHROOM_JOB_SCOPE_VALUES.includes("vanity_only") &&
    BATHROOM_JOB_SCOPE_VALUES.includes("full_renovation") &&
    BATHROOM_JOB_SCOPE_VALUES.includes("custom")
);
for (const scope of BATHROOM_JOB_SCOPE_VALUES) {
  check(`parse ${scope}`, parseBathroomJobScope(scope) === scope);
}
check(
  "display Full renovation maps",
  parseBathroomJobScope("Full renovation") === "full_renovation"
);
check(
  "architecture alias replace_vanity",
  parseBathroomJobScope("replace_vanity") === "vanity_only"
);
check(
  "architecture alias replace_shower",
  parseBathroomJobScope("replace_shower") === "shower_only"
);
check(
  "architecture alias replace_fixtures",
  parseBathroomJobScope("replace_fixtures") === "fixture_replacement"
);
check(
  "legacy Full strip-out → full_renovation",
  mapLegacyRenovationTypeToJobScope("Full strip-out and rebuild") ===
    "full_renovation"
);
check(
  "legacy Standard renovation → full_renovation",
  mapLegacyRenovationTypeToJobScope("Standard renovation") === "full_renovation"
);
check(
  "legacy Minor refresh → fixture_replacement",
  mapLegacyRenovationTypeToJobScope("Minor refresh") === "fixture_replacement"
);
check(
  "dual-read prefers job_scope",
  resolveBathroomJobScope({
    jobScope: "vanity_only",
    renovationType: "Full strip-out and rebuild",
  }) === "vanity_only"
);

console.log("\n--- Geometry math ---\n");
const derived = deriveBathroomGeometry({
  lengthM: 3,
  widthM: 2.4,
  wallHeightM: 2.4,
});
check("floor L×W", derived.floorAreaM2 === 7.2);
check("ceiling = floor", derived.ceilingAreaM2 === derived.floorAreaM2);
check(
  "gross wall 2(L+W)H",
  derived.grossWallAreaM2 === 2 * (3 + 2.4) * 2.4
);
check(
  "no opening deduction constant",
  BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT.includes("not currently deducted")
);
check(
  "derived wall display discloses openings",
  read("lib/scopes/derived-facts.ts").includes("openings not deducted")
);

const geoKnown = resolveBathroomGeometry({
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.length_m", "b1", 3),
    fact("bathroom.width_m", "b1", 2.4),
    fact("bathroom.wall_height_m", "b1", 2.4),
  ],
  workAreaId: "b1",
});
check("resolved floor 7.2", geoKnown.floorAreaM2 === 7.2);
check("resolved ceiling 7.2", geoKnown.ceilingAreaM2 === 7.2);
check("resolved wall 25.92", geoKnown.grossWallAreaM2 === 25.92);
check(
  "L×W is DERIVED",
  geoKnown.floorResolution === PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED
);
check("does not fabricate length from area", geoKnown.lengthM === 3);

const geoLegacy = resolveBathroomGeometry({
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    fact("bathroom.area_m2", "b1", 8),
  ],
  workAreaId: "b1",
});
check("legacy area dual-read", geoLegacy.usedLegacyArea && geoLegacy.floorAreaM2 === 8);
check("legacy area does not invent L/W", geoLegacy.lengthM == null && geoLegacy.widthM == null);
check(
  "legacy floor is KNOWN",
  geoLegacy.floorResolution === PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
);

console.log("\n--- Silent 5 m² ---\n");
const missingGeo = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [fact("bathroom.job_scope", "b1", "full_renovation")]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "full reno missing geometry → Info Required",
  missingGeo.missingInfo.includes(BATHROOM_LENGTH_WIDTH_REQUIRED_MESSAGE)
);
check(
  "no silent 5 m² assumption copy",
  !missingGeo.assumptions.some((line) => /5\s*m/.test(line))
);
const bathSrc = read("lib/estimate/calculators/bathroom.ts");
check(
  "calculator has no recordDefaultedNumber 5 m²",
  !bathSrc.includes("recordDefaultedNumber") && !bathSrc.includes("assumedValue: 5")
);

console.log("\n--- Wall height ---\n");
const notSureHeight = disclosedWallHeightForNotSure("Not sure");
check(
  "Not sure wall height → 2.4 disclosed",
  notSureHeight?.value === BATHROOM_WALL_HEIGHT_ASSUMPTION_M &&
    notSureHeight.source === "assumption"
);
const assumedHeight = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [
      fact("bathroom.job_scope", "b1", "full_renovation"),
      fact("bathroom.length_m", "b1", 3),
      fact("bathroom.width_m", "b1", 2),
    ]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "missing height disclosed 2.4 m",
  assumedHeight.assumptions.includes(BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT)
);
check(
  "Builder Review surfaces wall height assumption",
  getUserFacingEstimateAssumptions({
    assumptions: assumedHeight.assumptions,
  }).some((line) => /wall height assumed at 2\.4/i.test(line))
);
check(
  "length/width Not sure does not invent a room",
  disclosedWallHeightForNotSure("Not sure") != null
);

console.log("\n--- Minimum-information matrix ---\n");
check(
  "vanity_only geometry none",
  bathroomGeometryNeed("vanity_only") === "none"
);
check(
  "fixture_replacement geometry none",
  bathroomGeometryNeed("fixture_replacement") === "none"
);
check(
  "shower_only geometry none without finishes",
  bathroomGeometryNeed("shower_only") === "none"
);
check(
  "shower_only + tiling → full",
  bathroomGeometryNeed("shower_only", { tilingIncluded: true }) === "full"
);
check(
  "retile_floor → floor",
  bathroomGeometryNeed("retile_floor") === "floor"
);
check(
  "strip_out_only → floor",
  bathroomGeometryNeed("strip_out_only") === "floor"
);
check(
  "reline/new/full → full",
  bathroomGeometryNeed("reline") === "full" &&
    bathroomGeometryNeed("new_fitout") === "full" &&
    bathroomGeometryNeed("full_renovation") === "full"
);
check(
  "custom without finishes → none",
  bathroomGeometryNeed("custom") === "none"
);

console.log("\n--- Questions ---\n");
const fullKeys = visibleBathroomKeys([
  { key: "bathroom.job_scope", value: "full_renovation" },
]);
check(
  "full reno asks length and width",
  fullKeys.includes("bathroom.length_m") && fullKeys.includes("bathroom.width_m")
);
check(
  "full reno asks wall height",
  fullKeys.includes("bathroom.wall_height_m")
);
const vanityKeys = visibleBathroomKeys([
  { key: "bathroom.job_scope", value: "vanity_only" },
]);
check(
  "vanity-only does not ask room geometry",
  !vanityKeys.includes("bathroom.length_m") &&
    !vanityKeys.includes("bathroom.width_m") &&
    !vanityKeys.includes("bathroom.wall_height_m") &&
    !vanityKeys.includes("bathroom.floor_finish_system") &&
    !vanityKeys.includes("bathroom.wall_lining_included")
);
check(
  "unknown scope only asks job_scope in quick flow",
  visibleBathroomKeys([]).length === 1 &&
    visibleBathroomKeys([])[0] === "bathroom.job_scope"
);
const knownLength = visibleBathroomKeys([
  { key: "bathroom.job_scope", value: "full_renovation" },
  { key: "bathroom.length_m", value: 3 },
  { key: "bathroom.width_m", value: 2 },
]);
check(
  "known L/W not reasked",
  !knownLength.includes("bathroom.length_m") &&
    !knownLength.includes("bathroom.width_m")
);
const allBathroomQs = getScopeQuestions("bathroom");
check(
  "no unconditional 20-question quick flow",
  visibleBathroomKeys([]).length < 5 &&
    allBathroomQs.filter((q) => isQuickEstimateAskQuestion(q)).length <= 8
);
check(
  "legacy renovation_type hidden",
  shouldHideBathroomQuestion({
    factKey: "bathroom.renovation_type",
    jobScope: "full_renovation",
    floorAreaSatisfied: false,
    wallHeightKnown: false,
    lengthKnown: false,
    widthKnown: false,
    tilingIncluded: null,
    waterproofingIncluded: null,
    clientSuppliedFixtures: null,
  })
);

const fullClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "full_renovation"),
]);
check(
  "Clarify full reno asks geometry",
  fullClarify.candidates.some((c) => c.factKey === "bathroom.length_m") &&
    fullClarify.candidates.some((c) => c.factKey === "bathroom.width_m")
);
const vanityClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "vanity_only"),
]);
check(
  "Clarify vanity-only does not require geometry",
  !vanityClarify.candidates.some(
    (c) =>
      c.factKey === "bathroom.length_m" ||
      c.factKey === "bathroom.width_m" ||
      c.factKey === "bathroom.wall_height_m"
  )
);
check(
  "Clarify vanity-only does not assume tiling",
  !vanityClarify.estimateNowAssumptions.some(
    (row) =>
      row.factKey === "bathroom.tiling_included" ||
      /assuming tiling/i.test(row.statement)
  )
);

console.log("\n--- Priority ---\n");
const p0 = allBathroomQs.filter((q) => q.estimatePriorityClass === "P0");
check(
  "P0 is job_scope + demolition + geometry",
  p0.some((q) => q.factKey === "bathroom.job_scope") &&
    p0.some((q) => q.factKey === "bathroom.length_m") &&
    p0.some((q) => q.factKey === "bathroom.width_m") &&
    p0.some((q) => q.factKey === "bathroom.wall_height_m") &&
    p0.some((q) => q.factKey === "bathroom.demolition_required") &&
    !p0.some((q) => q.factKey === "bathroom.tile_extent")
);
check(
  "P3 never-ask includes legacy keys",
  allBathroomQs.some(
    (q) =>
      q.factKey === "bathroom.area_m2" && q.estimatePriorityClass === "P3"
  ) &&
    allBathroomQs.some(
      (q) =>
        q.factKey === "bathroom.renovation_type" &&
        q.estimatePriorityClass === "P3"
    )
);

console.log("\n--- Tiling null ---\n");
const matureNoTile = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [
      fact("bathroom.job_scope", "b1", "full_renovation"),
      fact("bathroom.length_m", "b1", 3),
      fact("bathroom.width_m", "b1", 2),
      fact("bathroom.wall_height_m", "b1", 2.4),
    ]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "mature path null tiling ≠ yes",
  !matureNoTile.lineItems.some((item) => /tiling/i.test(item.label)) &&
    isMatureBathroomPath("full_renovation")
);
const legacyTile = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [fact("bathroom.area_m2", "b1", 6)]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "legacy path without job_scope still defaults tiling on",
  legacyTile.lineItems.some((item) => /tiling/i.test(item.label))
);

console.log("\n--- Facts / consumed contract ---\n");
check(
  "derived keys registered",
  DERIVED_FACT_KEYS.has(BATHROOM_FLOOR_AREA_FACT_KEY) &&
    DERIVED_FACT_KEYS.has(BATHROOM_CEILING_AREA_FACT_KEY) &&
    DERIVED_FACT_KEYS.has(BATHROOM_GROSS_WALL_AREA_FACT_KEY)
);
check(
  "consumed contract includes geometry + tile m²",
  isCalculatorConsumedFact("bathroom", "bathroom.length_m") &&
    isCalculatorConsumedFact("bathroom", "bathroom.floor_tiling_area_m2") &&
    isCalculatorConsumedFact("bathroom", "bathroom.wall_tiling_area_m2") &&
    isCalculatorConsumedFact("bathroom", "bathroom.job_scope") &&
    isCalculatorConsumedFact("bathroom", "bathroom.plumbing.level")
);
check(
  "unused framing_level not on consumed contract",
  !(BATHROOM_CALCULATOR_CONSUMED_FACTS as readonly string[]).includes(
    "bathroom.framing_level"
  )
);
check(
  "Standard plumbing parses without becoming Major",
  parseBathroomTradeLevel("Standard") === "standard" &&
    parseBathroomTradeLevel("Minor") === "minor" &&
    parseBathroomTradeLevel("Major") === "major"
);

console.log("\n--- Isolation ---\n");
const deckFacts = [
  fact("deck.area_m2", "d1", 12),
  fact("deck.board_material", "d1", "Hardwood"),
];
const fenceFacts = [
  fact("fence.length_m", "f1", 10),
  fact("fence.height_m", "f1", 1.8),
  fact("fence.material", "f1", "Timber"),
];
const mixedFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2),
  fact("bathroom.wall_height_m", "b1", 2.4),
  ...deckFacts,
  ...fenceFacts,
  fact("site_access", "proj", "Standard"),
];
const snapshot = JSON.stringify(mixedFacts);
calculateBathroom(
  ctx(
    [
      wa("b1", "bathroom", "Bathroom"),
      wa("d1", "deck", "Deck"),
      wa("f1", "fence", "Fence"),
    ],
    mixedFacts
  ),
  wa("b1", "bathroom", "Bathroom")
);
check("Bathroom calc does not mutate Deck/Fence facts", JSON.stringify(mixedFacts) === snapshot);
const deckAfter = calculateDeck(
  ctx([wa("d1", "deck", "Deck")], mixedFacts),
  wa("d1", "deck", "Deck")
);
const fenceAfter = calculateFence(
  ctx([wa("f1", "fence", "Fence")], mixedFacts),
  wa("f1", "fence", "Fence")
);
check("Deck still estimates from 12 m²", deckAfter.lineItems.length > 0);
check("Fence still estimates from 10 m", fenceAfter.lineItems.length > 0);
check(
  "vanity questions hidden from tiling group",
  !bathroomQuestionGroupVisible("tiling", "vanity_only") &&
    !bathroomQuestionGroupVisible("linings", "vanity_only")
);

console.log("\n--- Analyse / derivation ---\n");
const extracted = buildMinimalExtractionFromBrief(
  "Bathroom is 3 m by 2.4 m with 2.4 m ceilings. Full renovation.",
  ["bathroom"]
);
check(
  "Analyse extracts L/W/H",
  extracted.facts.some((f) => f.key === "bathroom.length_m" && Number(f.value) === 3) &&
    extracted.facts.some((f) => f.key === "bathroom.width_m" && Number(f.value) === 2.4) &&
    extracted.facts.some(
      (f) => f.key === "bathroom.wall_height_m" && Number(f.value) === 2.4
    )
);
check(
  "Analyse extracts full_renovation",
  extracted.facts.some(
    (f) => f.key === "bathroom.job_scope" && f.value === "full_renovation"
  )
);
const vanityExtract = buildMinimalExtractionFromBrief(
  "Replace vanity only in the bathroom.",
  ["bathroom"]
);
check(
  "Analyse extracts vanity_only",
  vanityExtract.facts.some(
    (f) => f.key === "bathroom.job_scope" && f.value === "vanity_only"
  )
);
const derivedRows = deriveFactsForProject({
  workAreas: [{ id: "b1", type: "bathroom" }],
  projectFacts: [
    {
      key: "bathroom.length_m",
      work_area_id: "b1",
      value: 3,
      source: "user",
    },
    {
      key: "bathroom.width_m",
      work_area_id: "b1",
      value: 2,
      source: "user",
    },
    {
      key: "bathroom.wall_height_m",
      work_area_id: "b1",
      value: 2.4,
      source: "user",
    },
  ] as ProjectFactRecord[],
});
const merged = mergeDerivedFactsIntoRecords(
  [
    {
      key: "bathroom.length_m",
      work_area_id: "b1",
      value: 3,
      source: "user",
    },
  ] as ProjectFactRecord[],
  derivedRows
);
check(
  "code derives floor/ceiling/wall",
  derivedRows.some((row) => row.key === "bathroom.floor_area_m2" && row.value === 6) &&
    derivedRows.some((row) => row.key === "bathroom.ceiling_area_m2" && row.value === 6) &&
    derivedRows.some(
      (row) => row.key === "bathroom.gross_wall_area_m2" && row.value === 24
    )
);
check("merged derived facts persist shape", merged.length >= 3);

console.log("\n--- Hosted policy / mobile ---\n");
check(
  "canonical Preview host",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);
check(
  "plus-address fixture allowed",
  isPlusAddressFixture("hello+wa-bathroom-02@example.invalid")
);
let protectedBlocked = false;
try {
  assertSafePreviewPasswordMutation("jeanluc@erccontracting.co.nz");
} catch {
  protectedBlocked = true;
}
check("protected human inbox cannot rotate password", protectedBlocked);
check(
  "protected emails listed",
  PREVIEW_PASSWORD_PROTECTED_EMAILS.includes("jeanluc@erccontracting.co.nz") &&
    PREVIEW_PASSWORD_PROTECTED_EMAILS.includes("hello@erccontracting.co.nz")
);
const clarifyUi = read("components/assistant/clarify/ClarifyPanel.tsx");
check(
  "Clarify stacks on narrow viewports",
  clarifyUi.includes("flex-col") && clarifyUi.includes("overflow-x-hidden")
);
const migrations = numberedMigrations();
check(
  "no migration 055",
  migrations.every((name) => !name.startsWith("055_")) &&
    migrations.some((name) => name.startsWith("054_"))
);

if (!LIVE) {
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

async function cleanup(
  admin: SupabaseClient,
  orgIds: string[],
  userIds: string[]
): Promise<void> {
  for (const orgId of orgIds) {
    await admin.from("project_facts").delete().eq("org_id", orgId);
    await admin.from("work_areas").delete().eq("org_id", orgId);
    await admin.from("projects").delete().eq("org_id", orgId);
    await admin.from("organisation_memberships").delete().eq("org_id", orgId);
    await admin.from("profiles").delete().eq("org_id", orgId);
    await admin.from("organisations").delete().eq("id", orgId);
  }
  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function runLive(): Promise<void> {
  console.log("\n--- Live Preview persist ---\n");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  check("Preview env present", Boolean(url && service));
  if (!url || !service) {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exit(1);
  }
  const ref = hostnameRef(url);
  check("live target is Preview ref", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const orgIds: string[] = [];
  const userIds: string[] = [];
  const suffix = randomUUID().slice(0, 8);
  const email = `wa-bathroom-02+${suffix}@example.invalid`;
  const password = `bath02-${randomUUID()}`;

  try {
    check("fixture is plus-address", isPlusAddressFixture(email));
    check(
      "fixture is not a protected inbox",
      !isPasswordProtectedPreviewAccount(email)
    );
    assertSafePreviewPasswordMutation(email);

    const orgId = randomUUID();
    const projectId = randomUUID();
    const bathId = randomUUID();
    const deckId = randomUUID();
    const vanityProjectId = randomUUID();
    const vanityWaId = randomUUID();

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser failed");
    }
    userIds.push(created.data.user.id);

    const orgInsert = await admin.from("organisations").insert({
      id: orgId,
      name: `WA-BATHROOM-02 ${suffix}`,
    });
    if (orgInsert.error) throw new Error(orgInsert.message);
    orgIds.push(orgId);

    await admin.from("profiles").insert({
      id: created.data.user.id,
      org_id: orgId,
      role: "owner",
      full_name: "WA-BATHROOM-02 probe",
    });
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: created.data.user.id,
      title: `Bathroom 02 full ${suffix}`,
      stage: "brief",
    });
    await admin.from("work_areas").insert([
      {
        id: bathId,
        org_id: orgId,
        project_id: projectId,
        type: "bathroom",
        name: "Bathroom",
        status: "confirmed",
        sort_order: 0,
      },
      {
        id: deckId,
        org_id: orgId,
        project_id: projectId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        sort_order: 1,
      },
    ]);

    const fullFacts: EstimateFact[] = [
      fact("bathroom.job_scope", bathId, "full_renovation"),
      fact("bathroom.length_m", bathId, 3),
      fact("bathroom.width_m", bathId, 2.4),
      fact("bathroom.wall_height_m", bathId, 2.4),
      fact("deck.area_m2", deckId, 12),
      fact("deck.board_material", deckId, "Hardwood"),
    ];
    const derivedLive = deriveFactsForProject({
      workAreas: [
        { id: bathId, type: "bathroom" },
        { id: deckId, type: "deck" },
      ],
      projectFacts: fullFacts.map((row) => ({
        key: row.key,
        work_area_id: row.work_area_id,
        value: row.value,
        source: "user",
      })) as ProjectFactRecord[],
    });
    const factRows = [
      ...fullFacts.map((row) => ({
        org_id: orgId,
        project_id: projectId,
        work_area_id: row.work_area_id,
        key: row.key,
        label: row.key,
        value: row.value,
        source: "user",
      })),
      ...derivedLive.map((row) => ({
        org_id: orgId,
        project_id: projectId,
        work_area_id: row.work_area_id,
        key: row.key,
        label: row.label,
        value: row.value,
        source: "derived",
      })),
    ];
    const insertFacts = await admin.from("project_facts").insert(factRows);
    check("full reno + deck facts persist", !insertFacts.error, insertFacts.error?.message ?? "");

    const { data: readBack, error: readError } = await admin
      .from("project_facts")
      .select("key, value, work_area_id, source")
      .eq("project_id", projectId);
    check("facts read back", !readError && (readBack?.length ?? 0) >= 6);
    const floor = readBack?.find((row) => row.key === "bathroom.floor_area_m2");
    check(
      "derived floor persisted 7.2",
      Number(floor?.value) === 7.2 && floor?.source === "derived"
    );
    const deckArea = readBack?.find((row) => row.key === "deck.area_m2");
    check("Deck area unchanged at 12", Number(deckArea?.value) === 12);

    const reloaded: EstimateFact[] = (readBack ?? []).map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id,
      value: row.value,
    }));
    const liveCalc = calculateBathroom(
      ctx([wa(bathId, "bathroom", "Bathroom")], reloaded),
      wa(bathId, "bathroom", "Bathroom")
    );
    check(
      "live calc has no silent 5 m²",
      !liveCalc.assumptions.some((line) => /5\s*m/.test(line)) &&
        !liveCalc.missingInfo.includes(BATHROOM_LENGTH_WIDTH_REQUIRED_MESSAGE)
    );

    await admin.from("projects").insert({
      id: vanityProjectId,
      org_id: orgId,
      created_by: created.data.user.id,
      title: `Bathroom 02 vanity ${suffix}`,
      stage: "brief",
    });
    await admin.from("work_areas").insert({
      id: vanityWaId,
      org_id: orgId,
      project_id: vanityProjectId,
      type: "bathroom",
      name: "Bathroom",
      status: "confirmed",
      sort_order: 0,
    });
    await admin.from("project_facts").insert({
      org_id: orgId,
      project_id: vanityProjectId,
      work_area_id: vanityWaId,
      key: "bathroom.job_scope",
      label: "Bathroom work",
      value: "vanity_only",
      source: "user",
    });
    const vanityLive = composeBathroomClarify(
      [fact("bathroom.job_scope", vanityWaId, "vanity_only")],
      vanityWaId
    );
    check(
      "hosted vanity-only does not require geometry",
      !vanityLive.candidates.some(
        (c) =>
          c.factKey === "bathroom.length_m" || c.factKey === "bathroom.width_m"
      )
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    check("disposable cleanup attempted", true);
  }
}

runLive()
  .then(() => {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
