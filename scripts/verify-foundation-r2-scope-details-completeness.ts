/**
 * FOUNDATION-R2 — Scope Details completeness + question quality.
 *
 * Run: npx tsx scripts/verify-foundation-r2-scope-details-completeness.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isProjectConditionDuplicateFactKey } from "../lib/project-conditions/canonical";
import {
  shouldHideConditionalQuestion,
  isQuestionAnswered,
} from "../lib/scopes/conditional-rules";
import { buildFactLookup, type ProjectFactRecord } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import {
  getWorkAreaCapabilityBand,
} from "../lib/work-areas/support-contract";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import { getCombinedLabourAccessFactor } from "../lib/estimate/adjustments";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { ScopeQuestionTemplate } from "../lib/scopes/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function keys(type: string): string[] {
  return getScopeQuestions(type).map((q) => q.factKey);
}

function has(type: string, key: string): boolean {
  return keys(type).includes(key);
}

function lookup(
  workAreaId: string,
  facts: Array<{ key: string; value: unknown }>
): Map<string, ProjectFactRecord> {
  const records: ProjectFactRecord[] = facts.map((f) => ({
    key: f.key,
    work_area_id: workAreaId,
    value: f.value,
    source: "user",
  }));
  return buildFactLookup(records);
}

function hidden(
  template: ScopeQuestionTemplate,
  workAreaId: string,
  facts: Array<{ key: string; value: unknown }>,
  types?: Set<string>
): boolean {
  return shouldHideConditionalQuestion(
    template,
    workAreaId,
    lookup(workAreaId, facts),
    types
  );
}

function template(type: string, factKey: string): ScopeQuestionTemplate | undefined {
  return getScopeQuestions(type).find((q) => q.factKey === factKey);
}

function estimateCtx(
  type: string,
  constraints: EstimateContext["constraints"],
  facts: EstimateFact[]
): { context: EstimateContext; workArea: EstimateWorkArea } {
  const workArea: EstimateWorkArea = {
    id: `${type}-1`,
    type,
    name: type,
    sort_order: 0,
  };
  return {
    workArea,
    context: {
      project: { id: "p", qualityLevel: "standard" },
      confirmedWorkAreas: [
        { id: workArea.id, type, name: type, sort_order: 0 },
      ],
      facts,
      constraints,
      organisationSettings: null,
      materialWastageSettings: null,
      rates: [],
    },
  };
}

function main(): void {
  console.log("=== FOUNDATION-R2 Scope Details completeness ===\n");

  const productTypes = SCOPE_CATALOGUE.map((c) => c.type);

  console.log("GENERAL");
  check(
    "no project-condition duplicates in Scope Details",
    productTypes.every((type) =>
      getScopeQuestions(type).every((q) => !isProjectConditionDuplicateFactKey(q.factKey))
    )
  );
  check(
    "question keys unique within each WA",
    productTypes.every((type) => {
      const list = keys(type);
      return new Set(list).size === list.length;
    })
  );
  check(
    "template factKey matches key",
    productTypes.every((type) =>
      getScopeQuestions(type).every((q) => q.factKey === q.key)
    )
  );
  check(
    "required questions are measurement or core scope",
    productTypes.every((type) =>
      getScopeQuestions(type)
        .filter((q) => q.required)
        .every(
          (q) =>
            q.category === "measurement" ||
            q.category === "scope" ||
            q.category === "finish"
        )
    )
  );
  check(
    "questions have priorities",
    productTypes.every((type) =>
      getScopeQuestions(type).every((q) => typeof q.priority === "number")
    )
  );
  const deckArea = template("deck", "deck.area_m2");
  check(
    "known L×W suppresses deck area ask",
    Boolean(deckArea) &&
      hidden(deckArea!, "deck-1", [
        { key: "deck.length_m", value: 5.2 },
        { key: "deck.width_m", value: 3.1 },
      ])
  );
  check(
    "user-confirmed Facts are not overwritten by AI in ingest drop list",
    readFileSync("lib/scopes/domain-ownership.ts", "utf8").includes(
      "FACT_SOURCE_PRECEDENCE"
    )
  );

  console.log("\nDECK");
  check(
    "deck geometry coverage",
    ["deck.length_m", "deck.width_m", "deck.area_m2", "deck.height_m"].every((k) =>
      has("deck", k)
    )
  );
  check(
    "deck demolition/substructure coverage",
    [
      "deck.existing_deck_removal",
      "deck.substructure_included",
      "deck.substructure_condition",
    ].every((k) => has("deck", k))
  );
  check(
    "decking/spec coverage",
    has("deck", "deck.board_material") && has("deck", "deck.board_width_mm")
  );
  const bal = template("deck", "deck.balustrade_required");
  check(
    "balustrade gated by height ≤ 1m",
    Boolean(bal) &&
      hidden(bal!, "deck-1", [{ key: "deck.height_m", value: 0.8 }])
  );
  const faceLm = template("deck", "deck.vertical_face_board_length_lm");
  check(
    "face-board length gated until fascia = Yes",
    Boolean(faceLm) &&
      hidden(faceLm!, "deck-1", [
        { key: "deck.vertical_face_boards_required", value: false },
      ])
  );
  check(
    "deck has no access/carry clones",
    !has("deck", "deck.access") &&
      !keys("deck").some((k) => k.includes("carry") || k.includes("parking"))
  );
  check(
    "deck.access_type remains local stairs language",
    (template("deck", "deck.access_type")?.questionText ?? "").toLowerCase().includes("step")
  );

  console.log("\nBATHROOM");
  check(
    "bathroom geometry",
    has("bathroom", "bathroom.area_m2")
  );
  check(
    "bathroom demolition + waterproofing + tiling + fixtures",
    [
      "bathroom.demolition_required",
      "bathroom.waterproofing_included",
      "bathroom.waterproofing_extent",
      "bathroom.tiling_included",
      "bathroom.fixtures_included",
    ].every((k) => has("bathroom", k))
  );
  const wpIncluded = template("bathroom", "bathroom.waterproofing_included");
  const wpExtent = template("bathroom", "bathroom.waterproofing_extent");
  check(
    "waterproofing question is required Yes/No/Not sure",
    wpIncluded?.required === true &&
      (wpIncluded?.questionText ?? "").toLowerCase().includes("required") &&
      (wpIncluded?.options ?? []).includes("Yes") &&
      (wpIncluded?.options ?? []).includes("No") &&
      (wpIncluded?.options ?? []).includes("Not sure")
  );
  check(
    "waterproofing extent gated until waterproofing = Yes",
    Boolean(wpExtent) &&
      hidden(wpExtent!, "bath-1", [
        { key: "bathroom.waterproofing_included", value: false },
      ]) &&
      !hidden(wpExtent!, "bath-1", [
        { key: "bathroom.waterproofing_included", value: true },
      ])
  );
  check(
    "explicit waterproofing No is an answered Fact",
    isQuestionAnswered(
      lookup("bath-1", [{ key: "bathroom.waterproofing_included", value: false }]),
      "bath-1",
      "bathroom.waterproofing_included"
    )
  );
  check(
    "waterproofing Not sure remains unanswered",
    !isQuestionAnswered(
      lookup("bath-1", [{ key: "bathroom.waterproofing_included", value: "Not sure" }]),
      "bath-1",
      "bathroom.waterproofing_included",
      ["Yes", "No", "Not sure"]
    )
  );
  check(
    "bathroom services scope present",
    has("bathroom", "bathroom.plumbing_changes") &&
      has("bathroom", "bathroom.electrical_changes")
  );
  check(
    "no bathroom project-logistics clone",
    !has("bathroom", "bathroom.access") &&
      !keys("bathroom").some((k) => /carry|floor_level|occupied|working_hours/.test(k))
  );

  console.log("\nRETAINING");
  check(
    "retaining length/height/system",
    ["retaining_wall.length_m", "retaining_wall.height_m", "retaining_wall.material"].every(
      (k) => has("retaining_wall", k)
    )
  );
  check(
    "retaining posts/sleepers + drainage/backfill",
    has("retaining_wall", "retaining_wall.post_spacing_m") &&
      has("retaining_wall", "retaining_wall.drainage_required") &&
      has("retaining_wall", "retaining_wall.backfill_included")
  );
  check(
    "retaining excavation/disposal",
    has("retaining_wall", "retaining_wall.excavation_required") &&
      has("retaining_wall", "retaining_wall.disposal_included")
  );
  const spoil = template("retaining_wall", "retaining_wall.disposal_included");
  check(
    "disposal gated until excavation = Yes",
    Boolean(spoil) &&
      hidden(spoil!, "rw-1", [
        { key: "retaining_wall.excavation_required", value: false },
      ])
  );
  check(
    "no retaining cart/access clone",
    !has("retaining_wall", "retaining_wall.access") &&
      !has("retaining_wall", "retaining_wall.carting_distance_m")
  );

  console.log("\nFENCE");
  check(
    "fence length/height/system + posts/palings",
    [
      "fence.length_m",
      "fence.height_m",
      "fence.material",
      "fence.post_spacing_m",
      "fence.paling_or_panel_type",
    ].every((k) => has("fence", k))
  );
  check("fence gate parent exists", has("fence", "fence.gate_included"));
  const gateCount = template("fence", "fence.gate_count");
  const gateWidth = template("fence", "fence.gate_width_m");
  check(
    "gate count gated until gate = Yes",
    Boolean(gateCount) &&
      hidden(gateCount!, "f-1", [{ key: "fence.gate_included", value: false }])
  );
  check(
    "gate width gated until gate = Yes",
    Boolean(gateWidth) &&
      hidden(gateWidth!, "f-1", [{ key: "fence.gate_included", value: false }])
  );
  check(
    "fence slope/services remain local",
    has("fence", "fence.slope_condition") && has("fence", "fence.services_risk")
  );

  console.log("\nPERGOLA");
  check(
    "pergola geometry + height",
    ["pergola.area_m2", "pergola.length_m", "pergola.width_m", "pergola.height_m"].every(
      (k) => has("pergola", k)
    )
  );
  check(
    "pergola structure/roof/foundations",
    has("pergola", "pergola.attached") &&
      has("pergola", "pergola.roofing_included") &&
      has("pergola", "pergola.footings_required")
  );
  check("no pergola project logistics", !has("pergola", "pergola.access"));

  console.log("\nKITCHEN");
  check(
    "kitchen layout/cabinet/benchtop/island",
    [
      "kitchen.area_m2",
      "kitchen.cabinetry_included",
      "kitchen.benchtop_included",
      "kitchen.benchtop_material",
      "kitchen.island_included",
      "kitchen.island_length_m",
      "kitchen.cabinetry_lm",
    ].every((k) => has("kitchen", k))
  );
  const benchMat = template("kitchen", "kitchen.benchtop_material");
  const islandLen = template("kitchen", "kitchen.island_length_m");
  check(
    "benchtop material gated until benchtop = Yes",
    Boolean(benchMat) &&
      hidden(benchMat!, "k-1", [{ key: "kitchen.benchtop_included", value: false }])
  );
  check(
    "island length gated until island = Yes",
    Boolean(islandLen) &&
      hidden(islandLen!, "k-1", [{ key: "kitchen.island_included", value: false }])
  );
  check(
    "kitchen demolition + services + finishes",
    has("kitchen", "kitchen.demolition_required") &&
      has("kitchen", "kitchen.plumbing_changes") &&
      has("kitchen", "kitchen.finish_level")
  );
  check(
    "no kitchen project logistics",
    !has("kitchen", "kitchen.access") &&
      !keys("kitchen").some((k) => /floor_level|occupied|working_hours|carry/.test(k))
  );

  console.log("\nDEMOLITION");
  check(
    "physical demolition scope",
    has("demolition", "demolition.scope_items") && has("demolition", "demolition.area_m2")
  );
  const wallLen = template("demolition", "demolition.wall_length_m");
  check(
    "wall length hidden until walls in scope",
    Boolean(wallLen) &&
      hidden(wallLen!, "d-1", [
        { key: "demolition.scope_items", value: ["Flooring"] },
      ])
  );
  check(
    "no demolition project conditions",
    !has("demolition", "demolition.access") &&
      !has("demolition", "demolition.carting_distance_m") &&
      !has("demolition", "demolition.floor_level") &&
      !has("demolition", "demolition.services_isolated") &&
      !has("demolition", "demolition.hazardous_materials_risk")
  );

  const demoFacts: EstimateFact[] = [
    {
      key: "demolition.area_m2",
      work_area_id: "demolition-1",
      value: 25,
      source: "user",
    },
    {
      key: "demolition.scope_items",
      work_area_id: "demolition-1",
      value: ["General strip-out"],
      source: "user",
    },
    {
      key: "demolition.carting_distance_m",
      work_area_id: "demolition-1",
      value: 30,
      source: "user",
    },
  ];
  const { context: demoCtx, workArea: demoWa } = estimateCtx(
    "demolition",
    [{ key: "site_access", label: "Access", value: "Difficult" }],
    demoFacts
  );
  const demo = calculateDemolition(demoCtx, demoWa);
  const demoLabour = demo.lineItems.find((i) => i.label === "Demolition/strip-out labour");
  check(
    "DC-01 remains (Difficult labour 9.63h once)",
    Math.abs((demoLabour?.labourHours ?? 0) - 9.63) < 0.02
  );

  console.log("\nSTAIRS");
  check(
    "stair geometry + handrail/balustrade",
    [
      "external_stairs.risers_count",
      "external_stairs.width_m",
      "external_stairs.handrail_included",
      "external_stairs.balustrade_included",
    ].every((k) => has("external_stairs", k))
  );
  const { context: stairCtx, workArea: stairWa } = estimateCtx(
    "external_stairs",
    [{ key: "site_access", label: "Access", value: "Difficult" }],
    [
      {
        key: "external_stairs.risers_count",
        work_area_id: "external_stairs-1",
        value: 8,
        source: "user",
      },
      {
        key: "external_stairs.width_m",
        work_area_id: "external_stairs-1",
        value: 0.9,
        source: "user",
      },
      {
        key: "external_stairs.material",
        work_area_id: "external_stairs-1",
        value: "Treated timber",
        source: "user",
      },
      {
        key: "external_stairs.ground_condition",
        work_area_id: "external_stairs-1",
        value: "Sloping",
        source: "user",
      },
    ]
  );
  const stairs = calculateExternalStairs(stairCtx, stairWa);
  const stairLabour = stairs.lineItems.find((i) => /labour/i.test(i.label));
  check(
    "DC-02 remains (15.18h, not × WA 1.1)",
    Math.abs((stairLabour?.labourHours ?? 0) - 15.18) < 0.05
  );

  console.log("\nCOMMERCIAL COMPONENTS");
  check(
    "internal walls length/height/framing/lining",
    [
      "internal_walls.length_lm",
      "internal_walls.height_m",
      "internal_walls.framing_type",
      "internal_walls.wall_lining_type",
      "internal_walls.fire_or_acoustic",
    ].every((k) => has("internal_walls", k))
  );
  check(
    "ceilings area/system/working height",
    has("ceilings", "ceilings.area_m2") &&
      has("ceilings", "ceilings.ceiling_type") &&
      has("ceilings", "ceilings.access")
  );
  check(
    "doors count/type/supply",
    has("doors", "doors.count") && has("doors", "doors.door_type") && has("doors", "doors.supply_scope")
  );
  check(
    "flooring area/type/removal",
    has("flooring", "flooring.area_m2") &&
      has("flooring", "flooring.type") &&
      has("flooring", "flooring.existing_flooring_removal")
  );
  check(
    "painting location/coats",
    has("painting", "painting.location") && has("painting", "painting.coats_required")
  );
  check(
    "plastering area/level",
    has("plastering", "plastering.area_m2") && has("plastering", "plastering.level")
  );
  check(
    "component WAs have no site-access/carry clones",
    ["internal_walls", "doors", "flooring", "painting", "plastering"].every(
      (type) =>
        !keys(type).some(
          (k) =>
            k.endsWith(".access") ||
            k.includes("carry") ||
            k.includes("floor_level") ||
            k.includes("occupied") ||
            k.includes("working_hours")
        )
    )
  );
  check(
    "ceilings.access remains working-height, not site logistics",
    (template("ceilings", "ceilings.access")?.questionText ?? "")
      .toLowerCase()
      .includes("working height")
  );

  console.log("\nREADINESS / BOUNDARIES");
  check(
    "requirement emission is Deck surface only",
    readFileSync("lib/estimate/calculators/deck.ts", "utf8").includes(
      "maybeBuildDeckSurfaceRequirement"
    ) &&
      !readFileSync("lib/estimate/calculators/bathroom.ts", "utf8").includes(
        "requirements:"
      )
  );
  const eKeys = [
    "kitchen.island_included",
    "kitchen.island_length_m",
    "kitchen.cabinetry_lm",
    "kitchen.benchtop_material",
    "retaining_wall.post_spacing_m",
    "pergola.height_m",
    "internal_walls.fire_or_acoustic",
    "fence.post_spacing_m",
    "fence.paling_or_panel_type",
    "fence.gate_width_m",
    "bathroom.waterproofing_extent",
  ];
  const calculatorSources = [
    "lib/estimate/calculators/kitchen.ts",
    "lib/estimate/calculators/retaining-wall.ts",
    "lib/estimate/calculators/pergola.ts",
    "lib/estimate/calculators/fitout.ts",
    "lib/estimate/calculators/fence.ts",
    "lib/estimate/calculators/bathroom.ts",
  ].map((f) => readFileSync(f, "utf8"));
  check(
    "E-class keys are not consumed by current calculators",
    eKeys.every((key) => !calculatorSources.some((src) => src.includes(`"${key}"`)))
  );
  const pack = readFileSync("scripts/verify-validation-pack.ts", "utf8");
  check(
    "validation pack asserts project carry not WA carting Facts",
    pack.includes("expectedProjectConditions") &&
      pack.includes('forbiddenFacts: [{ key: "demolition.carting_distance_m" }]') &&
      pack.includes('forbiddenFacts: [{ key: "retaining_wall.carting_distance_m" }]') &&
      !pack.includes(
        '{ key: "demolition.carting_distance_m", workAreaType: "demolition", value: 45 }'
      )
  );
  const migrations = existsSync(join("supabase", "migrations"))
    ? readdirSync(join("supabase", "migrations"))
    : [];
  check(
    "no FOUNDATION-R2 migration",
    !migrations.some((f) => /r2|scope.details.completeness/i.test(f))
  );
  check("deck remains trial-supported", getWorkAreaCapabilityBand("deck") === "trial_supported");
  check(
    "bathroom remains trial-supported",
    getWorkAreaCapabilityBand("bathroom") === "trial_supported"
  );
  check(
    "kitchen remains developing",
    getWorkAreaCapabilityBand("kitchen") === "developing"
  );
  check(
    "commercial_fitout is not a product catalogue WA",
    !SCOPE_CATALOGUE.some((c) => c.type === "commercial_fitout")
  );
  check(
    "Deck/Fence/Pergola still estimate",
    calculateDeck(
      estimateCtx(
        "deck",
        [{ key: "site_access", label: "A", value: "Difficult" }],
        [
          { key: "deck.area_m2", work_area_id: "deck-1", value: 16, source: "user" },
          { key: "deck.length_m", work_area_id: "deck-1", value: 4, source: "user" },
          { key: "deck.width_m", work_area_id: "deck-1", value: 4, source: "user" },
        ]
      ).context,
      estimateCtx("deck", [], []).workArea
    ).lineItems.length > 0 &&
      calculateFence(
        estimateCtx(
          "fence",
          [{ key: "site_access", label: "A", value: "Easy" }],
          [
            { key: "fence.length_m", work_area_id: "fence-1", value: 20, source: "user" },
            { key: "fence.height_m", work_area_id: "fence-1", value: 1.8, source: "user" },
          ]
        ).context,
        estimateCtx("fence", [], []).workArea
      ).lineItems.length > 0 &&
      calculatePergola(
        estimateCtx(
          "pergola",
          [{ key: "site_access", label: "A", value: "Easy" }],
          [
            { key: "pergola.area_m2", work_area_id: "pergola-1", value: 12, source: "user" },
          ]
        ).context,
        estimateCtx("pergola", [], []).workArea
      ).lineItems.length > 0
  );
  check(
    "Bathroom combined access still 1.15 once",
    Math.abs(
      getCombinedLabourAccessFactor({
        constraints: [
          { key: "site_access", label: "Access", value: "Difficult" },
          { key: "material_carry_distance", label: "Carry", value: "10–30m" },
        ],
        workAreaAccess: "Restricted",
      }) - 1.15
    ) < 1e-9
  );
  check(
    "no Stage 3.2.3 interview UI",
    !readFileSync("components/assistant/AssistantShell.tsx", "utf8").includes(
      "Work Area Conditions"
    )
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
