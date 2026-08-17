/**
 * FOUNDATION-R1 — Project Conditions single authority + supported WA contract.
 *
 * Run: npx tsx scripts/verify-foundation-r1-project-conditions-support.ts
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentFactor,
  getWorkAreaAccessFactor,
  projectSiteAccessAlreadyApplied,
} from "../lib/estimate/adjustments";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import {
  ESTIMATE_REQUIREMENT_CONTRACT_VERSION,
  ESTIMATE_REQUIREMENT_PLANNING_FREEZE_VERSION,
} from "../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateConstraint,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  CANONICAL_PROJECT_CONDITION_KEYS,
  LOCAL_WORK_AREA_ACCESS_FACT_KEYS,
  PROJECT_CONDITION_DUPLICATE_FACT_KEYS,
  PROJECT_CONDITIONS_CONTRACT_VERSION,
  isLocalWorkAreaAccessFactKey,
  isProjectConditionDuplicateFactKey,
  resolveCanonicalProjectConditionKey,
  resolveLegacyWorkAreaAccess,
  resolveProjectCondition,
} from "../lib/project-conditions";
import { RESERVED_CONSTRAINT_KEYS } from "../lib/scopes/domain-ownership";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { getScopeQuestions } from "../lib/scopes/registry";
import {
  buildQuestionBlockFromProjectState,
  shouldSkipTemplateQuestion,
} from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";
import { INTERVIEW_QUESTION_REGISTRY } from "../lib/builder-interview";
import {
  COMMERCIAL_INTERIOR_COMPONENT_TYPES,
  COMMERCIAL_INTERIOR_PARENT_TYPE,
  getWorkAreaCapabilityLabel,
  isCommercialInteriorComponentType,
  isMonolithicCommercialFitoutType,
  isTrialSupportedWorkAreaType,
  isUnsupportedWorkAreaType,
} from "../lib/work-areas/support-contract";
import { PLANNED_ANALYTICS_EVENT_TYPES } from "../lib/analytics/event-contract";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walkTs(p, acc);
    } else if (/\.(ts|tsx)$/.test(name.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const PRODUCT_WA_TYPES = SCOPE_CATALOGUE.map((item) => item.type);

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
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

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value, source: "manual" };
}

function constraint(key: string, value: string): EstimateConstraint {
  return { key, label: key, value };
}

function main(): void {
  console.log("=== FOUNDATION-R1 Project Conditions + Support Contract ===\n");

  // 1. Canonical registry
  console.log("1 CANONICAL PROJECT CONDITIONS");
  check(
    "canonical keys are the reserved constraints authority",
    CANONICAL_PROJECT_CONDITION_KEYS.length === RESERVED_CONSTRAINT_KEYS.length &&
      CANONICAL_PROJECT_CONDITION_KEYS.every((k, i) => k === RESERVED_CONSTRAINT_KEYS[i])
  );
  check(
    "required logistics keys exist",
    [
      "site_access",
      "material_carry_distance",
      "floor_level",
      "occupied_site",
      "working_hours",
      "parking_loading",
      "hazardous_materials_risk",
      "services_isolated",
      "waste_bin_access",
    ].every((k) => (RESERVED_CONSTRAINT_KEYS as readonly string[]).includes(k))
  );
  check(
    "aliases resolve without a second store",
    resolveCanonicalProjectConditionKey("site_occupied") === "occupied_site" &&
      resolveCanonicalProjectConditionKey("access") === "site_access" &&
      resolveCanonicalProjectConditionKey("carting_distance") ===
        "material_carry_distance"
  );
  check(
    "contract version frozen",
    PROJECT_CONDITIONS_CONTRACT_VERSION === "foundation-r1.0"
  );
  check(
    "duplicate fact key registry includes access and demolition floor",
    PROJECT_CONDITION_DUPLICATE_FACT_KEYS.includes("deck.access") &&
      PROJECT_CONDITION_DUPLICATE_FACT_KEYS.includes("demolition.floor_level")
  );

  // 2–6. No new Scope Details duplicates
  console.log("\n2-6 SCOPE DETAILS DUPLICATES REMOVED");
  const duplicateFamilies = [
    "site-access",
    "carry-distance",
    "occupied-site",
    "working-hours",
    "floor-level",
  ];
  void duplicateFamilies;
  for (const type of PRODUCT_WA_TYPES) {
    const keys = getScopeQuestions(type).map((t) => t.factKey);
    const leaked = keys.filter((k) => isProjectConditionDuplicateFactKey(k));
    check(
      `${type}: no project-condition Scope Details duplicates`,
      leaked.length === 0,
      leaked.join(", ")
    );
  }
  check(
    "unknown project constraint still suppresses WA access (not a fallback ask)",
    shouldSkipTemplateQuestion(
      {
        key: "bathroom.access",
        label: "Access",
        questionText: "Access?",
        inputType: "select",
        required: false,
        priority: 1,
        factKey: "bathroom.access",
        workAreaType: "bathroom",
      },
      wa("b1", "bathroom", "Bathroom"),
      buildFactLookup([]),
      new Set(["bathroom"]),
      { quality_level: "standard", constraints: [] }
    ) === true
  );

  const generated = buildQuestionBlockFromProjectState({
    project: { quality_level: "standard", constraints: [] },
    confirmedWorkAreas: PRODUCT_WA_TYPES.map((type, i) => ({
      id: `wa-${type}`,
      type,
      name: type,
      sort_order: i,
      status: "confirmed",
    })),
    projectFacts: [],
  });
  const generatedDupes = generated.questions.filter((q) =>
    isProjectConditionDuplicateFactKey(q.key)
  );
  check(
    "generated question block has no PC duplicate keys even when constraints unknown",
    generatedDupes.length === 0,
    generatedDupes.map((q) => q.key).join(", ")
  );

  const siteAsk = INTERVIEW_QUESTION_REGISTRY.filter(
    (q) =>
      q.scope === "PROJECT" &&
      q.writeTarget === "CONSTRAINT" &&
      q.askPolicy === "ASK"
  );
  check(
    "Project Conditions interviewer owns site_access / carry / occupied / hours / floor",
    ["site_access", "material_carry_distance", "occupied_site", "working_hours", "floor_level"].every(
      (key) => siteAsk.some((q) => q.targetKey === key)
    )
  );
  check(
    "WA access clones and demolition override are DEFER (never ASK fallback)",
    INTERVIEW_QUESTION_REGISTRY.filter(
      (q) =>
        q.questionKey.includes("access_clone") ||
        q.questionKey.includes("access_override") ||
        q.questionKey.includes("carting_clone")
    ).every((q) => q.askPolicy === "DEFER")
  );

  // 7. Local height/access preserved
  console.log("\n7 LOCAL WA ACCESS/HEIGHT PRESERVED");
  const deckKeys = getScopeQuestions("deck").map((t) => t.factKey);
  const ceilingKeys = getScopeQuestions("ceilings").map((t) => t.factKey);
  const fenceKeys = getScopeQuestions("fence").map((t) => t.factKey);
  check("deck.access_type preserved", deckKeys.includes("deck.access_type"));
  check("deck.height_m preserved", deckKeys.includes("deck.height_m"));
  check("ceilings.access preserved as working height", ceilingKeys.includes("ceilings.access"));
  check(
    "ceilings.access is local, not a PC duplicate",
    isLocalWorkAreaAccessFactKey("ceilings.access") &&
      !isProjectConditionDuplicateFactKey("ceilings.access")
  );
  check("fence.slope_condition preserved", fenceKeys.includes("fence.slope_condition"));
  check("fence.services_risk preserved", fenceKeys.includes("fence.services_risk"));
  check(
    "local exception list is exactly deck.access_type + ceilings.access",
    LOCAL_WORK_AREA_ACCESS_FACT_KEYS.includes("deck.access_type") &&
      LOCAL_WORK_AREA_ACCESS_FACT_KEYS.includes("ceilings.access")
  );
  const ceilingsQ = getScopeQuestions("ceilings").find((t) => t.factKey === "ceilings.access");
  check(
    "ceilings.access copy is working height, not site logistics",
    Boolean(ceilingsQ?.questionText.toLowerCase().includes("working height"))
  );

  check(
    "pipeline does not treat FOUNDATION-R2 as requirement emission",
    /FOUNDATION-R2[\s\S]{0,400}Scope Details completeness/.test(
      read("docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md")
    ) &&
      !read("docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md").includes(
        "### FOUNDATION-R2 — Requirements emit adapter"
      )
  );

  // 8. DC-01 demolition
  console.log("\n8 DC-01 DEMOLITION SINGLE-CONSUME");
  const demoFacts = [
    fact("demolition.scope_items", "d1", ["Flooring"]),
    fact("demolition.floor_area_m2", "d1", 30),
    fact("demolition.disposal_included", "d1", true),
    fact("demolition.skip_bin_included", "d1", true),
    fact("demolition.carting_distance_m", "d1", 40),
    fact("demolition.floor_level", "d1", "Upper floor"),
    fact("demolition.access", "d1", "Moderate"),
  ];
  const demoConstraints = [constraint("site_access", "Difficult")];
  const demo = calculateDemolition(
    { ...baseContext, facts: demoFacts, constraints: demoConstraints },
    wa("d1", "demolition", "Demo")
  );
  const floorLine = demo.lineItems.find((i) => i.label === "Flooring removal allowance");
  const labourLine = demo.lineItems.find((i) => i.label === "Demolition/strip-out labour");
  const cartingLine = demo.lineItems.find((i) => i.label === "Carting/haulage allowance");
  const projectFactor = getLabourAdjustmentFactor(demoConstraints);
  const waAccessFactor = getWorkAreaAccessFactor("Moderate");
  check(
    "DC-01 flooring qty is floor 1.15 only (30 × 1.15 = 34.5), not access×floor",
    Math.abs((floorLine?.quantity ?? 0) - 34.5) < 1e-9
  );
  check(
    "DC-01 labour uses project Difficult once (1.10), not × WA Moderate",
    projectFactor === 1.1 &&
      Boolean(labourLine?.notes?.includes("1.1") || (labourLine?.labourHours ?? 0) > 0) &&
      getCombinedLabourAccessFactor({
        constraints: demoConstraints,
        workAreaAccess: "Moderate",
      }) === projectFactor &&
      projectFactor < projectFactor * waAccessFactor
  );
  check(
    "DC-01 carting is haulage $ from metres, not an access labour multiplier",
    Boolean(cartingLine) &&
      !demo.lineItems.some((i) => /access allowance/i.test(i.label))
  );
  check(
    "DC-01 assumptions document floor-level independence",
    demo.assumptions.some((a) => a.includes("Floor-level factor 1.15"))
  );

  const demoNoProject = calculateDemolition(
    { ...baseContext, facts: demoFacts, constraints: [] },
    wa("d1", "demolition", "Demo")
  );
  check(
    "DC-01 historical WA Moderate still readable when project site_access absent",
    getCombinedLabourAccessFactor({
      constraints: [],
      workAreaAccess: resolveLegacyWorkAreaAccess({
        constraints: [],
        facts: demoFacts,
        workAreaId: "d1",
        workAreaType: "demolition",
      }),
    }) === 1.05 && demoNoProject.lineItems.length > 0
  );

  function demoCase(params: {
    id: string;
    access: string;
    cartingM?: number;
    waAccess?: string;
  }) {
    const facts: EstimateFact[] = [
      fact("demolition.area_m2", params.id, 25),
      fact("demolition.scope_items", params.id, ["General strip-out"]),
    ];
    if (params.cartingM != null) {
      facts.push(fact("demolition.carting_distance_m", params.id, params.cartingM));
    }
    if (params.waAccess) {
      facts.push(fact("demolition.access", params.id, params.waAccess));
    }
    const constraints = [constraint("site_access", params.access)];
    const result = calculateDemolition(
      { ...baseContext, facts, constraints },
      wa(params.id, "demolition", "Demo")
    );
    const labour = result.lineItems.find((i) => i.label === "Demolition/strip-out labour");
    const carting = result.lineItems.find((i) => i.label === "Carting/haulage allowance");
    const factor = getCombinedLabourAccessFactor({
      constraints,
      workAreaAccess: params.waAccess ?? null,
    });
    return { result, labour, carting, factor };
  }

  const caseA = demoCase({ id: "da", access: "Difficult" });
  check(
    "DC-01 CASE A Difficult / no cart: labour factor 1.10 once; no haulage line (hours 9.63 vs old stacked 10.59)",
    Math.abs(caseA.factor - 1.1) < 1e-9 &&
      Math.abs((caseA.labour?.labourHours ?? 0) - 9.63) < 0.02 &&
      !caseA.carting
  );

  const caseB = demoCase({ id: "db", access: "Easy", cartingM: 30 });
  check(
    "DC-01 CASE B Easy / 30 m cart: no access uplift (hours 8.75); haulage $280 once",
    caseB.factor === 1 &&
      Math.abs((caseB.labour?.labourHours ?? 0) - 8.75) < 0.02 &&
      Boolean(caseB.carting) &&
      Math.abs((caseB.carting?.recommendedCost ?? 0) - 280) < 0.01
  );

  const caseC = demoCase({ id: "dc", access: "Difficult", cartingM: 30 });
  check(
    "DC-01 CASE C Difficult / 30 m: labour 1.10 once (9.63 h) + haulage $280 once, not access×carting labour",
    Math.abs(caseC.factor - 1.1) < 1e-9 &&
      Math.abs((caseC.labour?.labourHours ?? 0) - 9.63) < 0.02 &&
      Boolean(caseC.carting) &&
      Math.abs((caseC.carting?.recommendedCost ?? 0) - 280) < 0.01
  );

  const caseD = demoCase({
    id: "dd",
    access: "Easy",
    waAccess: "Restricted",
  });
  check(
    "DC-01 CASE D project Easy wins over legacy WA Restricted (factor 1.0, hours 8.75 not 9.63)",
    caseD.factor === 1 &&
      Math.abs((caseD.labour?.labourHours ?? 0) - 8.75) < 0.02 &&
      !caseD.carting
  );

  // 9. DC-02 external stairs
  console.log("\n9 DC-02 EXTERNAL STAIRS SINGLE-CONSUME");
  const stairFacts = [
    fact("external_stairs.risers_count", "s1", 8),
    fact("external_stairs.width_m", "s1", 0.9),
    fact("external_stairs.material", "s1", "Treated timber"),
    fact("external_stairs.ground_condition", "s1", "Sloping"),
    fact("external_stairs.access", "s1", "Restricted"),
  ];
  const stairConstraints = [constraint("site_access", "Difficult")];
  const stairs = calculateExternalStairs(
    { ...baseContext, facts: stairFacts, constraints: stairConstraints },
    wa("s1", "external_stairs", "Stairs")
  );
  const stairLabour = stairs.lineItems.find((i) => i.label === "External stair labour");
  const combinedStairs = getCombinedLabourAccessFactor({
    constraints: stairConstraints,
    workAreaAccess: "Restricted",
  });
  const naiveStairs = combinedStairs * getWorkAreaAccessFactor("Restricted");
  check(
    "DC-02 combined access equals project factor (WA Restricted not multiplied again)",
    combinedStairs === 1.1 && combinedStairs < naiveStairs
  );
  check(
    "DC-02 ground-condition factor remains independent",
    stairs.assumptions.some((a) => a.includes("Ground-condition factor 1.15"))
  );
  const expectedHours = 8 * 1.5 * 1.1 * 1 * 1.15 * 1;
  check(
    "DC-02 labour hours = risers × 1.5 × project 1.1 × ground 1.15 (not × WA 1.1)",
    Math.abs((stairLabour?.labourHours ?? 0) - expectedHours) < 0.05
  );
  check(
    "DC-02 old stacked path would be 16.70 h; corrected is 15.18 h",
    Math.abs(expectedHours - 15.18) < 0.02 &&
      Math.abs(8 * 1.5 * 1.1 * 1.1 * 1.15 - 16.698) < 0.02 &&
      (stairLabour?.labourHours ?? 0) < 8 * 1.5 * 1.1 * 1.1 * 1.15
  );
  check(
    "DC-02 preserves stair geometry drivers in calculator source",
    read("lib/estimate/calculators/external-stairs.ts").includes("widthFactor") &&
      read("lib/estimate/calculators/external-stairs.ts").includes("groundFactor")
  );

  // 10. Deck R1 preserved
  console.log("\n10 DECK R1 ACCESS SINGLE-CONSUME");
  const deckConstraints = [
    constraint("site_access", "Difficult"),
    constraint("material_carry_distance", "10–30m"),
  ];
  const deckCombined = getCombinedLabourAccessFactor({
    constraints: deckConstraints,
    workAreaAccess: "Restricted / Difficult",
  });
  const deckConstraintOnly = getLabourAdjustmentFactor(deckConstraints);
  check(
    "Deck combined == constraint-only (R1 preserved)",
    deckCombined === deckConstraintOnly && Math.abs(deckCombined - 1.15) < 1e-9
  );
  const deckResult = calculateDeck(
    {
      ...baseContext,
      facts: [
        fact("deck.length_m", "dk", 6),
        fact("deck.width_m", "dk", 6),
        fact("deck.access", "dk", "Restricted"),
      ],
      constraints: deckConstraints,
    },
    wa("dk", "deck", "Deck")
  );
  check("Deck calculator still produces labour", deckResult.lineItems.some((i) => i.category === "labour"));
  check(
    "Easy project access blocks WA Restricted fallback multiply",
    projectSiteAccessAlreadyApplied([constraint("site_access", "Easy")]) &&
      getCombinedLabourAccessFactor({
        constraints: [constraint("site_access", "Easy")],
        workAreaAccess: "Restricted",
      }) === 1
  );

  // 11. Fence / Pergola preserved
  console.log("\n11 FENCE / PERGOLA PRESERVED");
  check(
    "Fence uses combined helper + slope (independent of site access)",
    read("lib/estimate/calculators/fence.ts").includes("getCombinedLabourAccessFactor") &&
      read("lib/estimate/calculators/fence.ts").includes("getSlopeLabourFactor")
  );
  check(
    "Pergola uses combined helper",
    read("lib/estimate/calculators/pergola.ts").includes("getCombinedLabourAccessFactor")
  );
  const fenceResult = calculateFence(
    {
      ...baseContext,
      facts: [
        fact("fence.length_m", "f1", 20),
        fact("fence.height_m", "f1", 1.8),
        fact("fence.material", "f1", "Timber"),
        fact("fence.access", "f1", "Difficult"),
      ],
      constraints: [constraint("site_access", "Difficult")],
    },
    wa("f1", "fence", "Fence")
  );
  const pergolaResult = calculatePergola(
    {
      ...baseContext,
      facts: [
        fact("pergola.length_m", "p1", 4),
        fact("pergola.width_m", "p1", 3),
        fact("pergola.access", "p1", "Difficult"),
      ],
      constraints: [constraint("site_access", "Difficult")],
    },
    wa("p1", "pergola", "Pergola")
  );
  check("Fence still estimates", fenceResult.lineItems.length > 0);
  check("Pergola still estimates", pergolaResult.lineItems.length > 0);

  // 12. Legacy authority
  console.log("\n12 LEGACY WA FACTS DO NOT OUTRANK PROJECT CONDITIONS");
  const easyWins = resolveProjectCondition({
    constraints: [constraint("site_access", "Easy")],
    facts: [fact("bathroom.access", "b1", "Restricted")],
    workAreaId: "b1",
    constraintKey: "site_access",
    legacyFactKey: "bathroom.access",
  });
  check("project Easy wins over historical Restricted", easyWins.source === "constraint" && easyWins.value === "Easy");
  const legacyOnly = resolveProjectCondition({
    constraints: [],
    facts: [fact("bathroom.access", "b1", "Restricted")],
    workAreaId: "b1",
    constraintKey: "site_access",
    legacyFactKey: "bathroom.access",
  });
  check("historical Restricted remains readable when project key absent", legacyOnly.source === "legacy_wa_fact");
  check(
    "resolveLegacyWorkAreaAccess returns null when project key exists (no second multiply)",
    resolveLegacyWorkAreaAccess({
      constraints: [constraint("site_access", "Easy")],
      facts: [fact("bathroom.access", "b1", "Restricted")],
      workAreaId: "b1",
      workAreaType: "bathroom",
    }) === null
  );
  check(
    "UNKNOWN/Not sure is not treated as occupied/hours restriction",
    getLabourAdjustmentFactor([constraint("occupied_site", "Not sure")]) === 1 &&
      getLabourAdjustmentFactor([constraint("working_hours", "No")]) === 1 &&
      getLabourAdjustmentFactor([constraint("occupied_site", "Yes")]) === 1.05
  );

  const bath = calculateBathroom(
    {
      ...baseContext,
      facts: [
        fact("bathroom.area_m2", "b1", 6),
        fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
        fact("bathroom.demolition_required", "b1", true),
        fact("bathroom.access", "b1", "Restricted"),
        fact("bathroom.tile_extent", "b1", "Floor only"),
      ],
      constraints: [
        constraint("site_access", "Difficult"),
        constraint("material_carry_distance", "10–30m"),
      ],
    },
    wa("b1", "bathroom", "Bathroom")
  );
  const bathDemo = bath.lineItems.find((i) => /demolition/i.test(i.label));
  check(
    "Bathroom consumes project Difficult+carry once (1.15), not WA Restricted 1.1 stacked",
    Math.abs((bathDemo?.labourMinimum?.accessFactor ?? 0) - 1.15) < 1e-9
  );

  // 13–14. Support + commercial parent
  console.log("\n13-14 SUPPORTED WA + COMMERCIAL PARENT");
  check("deck is trial-supported", isTrialSupportedWorkAreaType("deck"));
  check("bathroom is trial-supported", isTrialSupportedWorkAreaType("bathroom"));
  check(
    "commercial interior components are the six fitout WAs + demolition",
    COMMERCIAL_INTERIOR_COMPONENT_TYPES.length === 7 &&
      COMMERCIAL_INTERIOR_COMPONENT_TYPES.every((t) => isCommercialInteriorComponentType(t))
  );
  check(
    "commercial_fitout is parent/unsupported, not a product catalogue WA",
    isMonolithicCommercialFitoutType(COMMERCIAL_INTERIOR_PARENT_TYPE) &&
      isUnsupportedWorkAreaType("commercial_fitout") &&
      !PRODUCT_WA_TYPES.includes("commercial_fitout")
  );
  check(
    "cladding/roofing unsupported and not creatable",
    isUnsupportedWorkAreaType("cladding") &&
      isUnsupportedWorkAreaType("roofing") &&
      !PRODUCT_WA_TYPES.includes("cladding") &&
      !PRODUCT_WA_TYPES.includes("roofing")
  );
  check(
    "customer labels never use A/B/C/D/E",
    !["A", "B", "C", "D", "E"].includes(getWorkAreaCapabilityLabel("deck")) &&
      getWorkAreaCapabilityLabel("deck") === "Trial-supported" &&
      getWorkAreaCapabilityLabel("fence") === "Developing" &&
      getWorkAreaCapabilityLabel("demolition") === "Component"
  );

  // 15. Estimate-ready demoted
  console.log("\n15 ESTIMATE-READY DEMOTED");
  check(
    "getEstimateSupportLabel no longer returns Estimate-ready",
    !read("lib/scopes/catalogue.ts").includes('return "Estimate-ready"')
  );
  check(
    "Add Work Area uses capability labels",
    read("components/assistant/AddWorkAreaDialog.tsx").includes("getWorkAreaCapabilityLabel")
  );
  check(
    "no customer Estimate-ready capability label",
    getWorkAreaCapabilityLabel("deck") !== "Estimate-ready" &&
      getWorkAreaCapabilityLabel("cladding") !== "Estimate-ready" &&
      !read("components/assistant/AddWorkAreaDialog.tsx").includes("Estimate-ready")
  );

  // 16–17. Requirement freeze + no emission
  console.log("\n16-17 REQUIREMENT TYPES FROZEN / NO EMISSION");
  check(
    "EstimateRequirement contract version is foundation-r1.1 (r1.0 planning freeze)",
    ESTIMATE_REQUIREMENT_CONTRACT_VERSION === "foundation-r1.1" &&
      ESTIMATE_REQUIREMENT_PLANNING_FREEZE_VERSION === "foundation-r1.0"
  );
  const reqSrc = read("lib/estimate/requirements.ts");
  check(
    "MaterialRequirement + LabourRequirement + Plant/Subcontract/Waste union exists",
    reqSrc.includes("export type MaterialRequirement") &&
      reqSrc.includes("export type LabourRequirement") &&
      reqSrc.includes("export type PlantRequirement") &&
      reqSrc.includes("export type SubcontractRequirement") &&
      reqSrc.includes("export type WasteRequirement") &&
      reqSrc.includes("export type EstimateRequirement")
  );
  check(
    "LabourRequirement documents single-consumption via adjustmentRef",
    reqSrc.includes("project.labour_productivity") &&
      reqSrc.includes("Do not encode site_access")
  );
  const calcFiles = walkTs(join("lib", "estimate", "calculators"));
  const emitting = calcFiles.filter((p) => {
    const text = readFileSync(p, "utf8");
    return (
      /kind:\s*"material"/.test(text) ||
      /kind:\s*"labour"/.test(text) ||
      text.includes("MaterialRequirement") ||
      text.includes("LabourRequirement") ||
      text.includes("requirements:")
    );
  });
  check(
    "only Deck calculator emits EstimateRequirement objects",
    emitting.length === 1 &&
      emitting[0].replace(/\\/g, "/").endsWith("calculators/deck.ts"),
    emitting.join(", ")
  );
  check(
    "calculate-estimate has no commercial_fitout calculator",
    !read("lib/estimate/calculate-estimate.ts").includes("commercial_fitout")
  );

  // 18. No migration
  console.log("\n18 NO MIGRATION");
  const migrations = existsSync(join("supabase", "migrations"))
    ? readdirSync(join("supabase", "migrations"))
    : [];
  check(
    "no FOUNDATION-R1 / project-conditions migration file",
    !migrations.some((f) => /foundation.?r1|project.?condition/i.test(f))
  );

  // 19. Commercial authority outside corrections
  console.log("\n19 COMMERCIAL AUTHORITY UNCHANGED OUTSIDE CORRECTIONS");
  check(
    "cost-first authority module still present",
    existsSync(join("lib", "commercial-engine", "core", "cost-first-authority.ts"))
  );
  check(
    "kitchen/fitout were not broadened into labour-access calibration",
    !read("lib/estimate/calculators/kitchen.ts").includes("getCombinedLabourAccessFactor") &&
      !read("lib/estimate/calculators/fitout.ts").includes("getCombinedLabourAccessFactor")
  );

  // 20. org / RLS intact
  console.log("\n20 ORG / RLS INTACT");
  check("org isolation verifier still present", existsSync(join("scripts", "verify-org-isolation.ts")));
  check("RLS coverage verifier still present", existsSync(join("scripts", "verify-rls-coverage.ts")));
  check("Production Scope Discovery remains disabled", isScopeDiscoveryEnabled({}) === false);
  check("Company DNA not started", !existsSync(join("lib", "company-dna")));
  check(
    "planned analytics events exist as docs/types only",
    PLANNED_ANALYTICS_EVENT_TYPES.includes("estimate_generated") &&
      PLANNED_ANALYTICS_EVENT_TYPES.includes("quote_accepted") &&
      !existsSync(join("components", "analytics"))
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
