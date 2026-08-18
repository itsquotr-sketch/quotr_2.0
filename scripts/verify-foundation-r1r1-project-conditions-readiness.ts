/**
 * FOUNDATION-R1-R1 — Project Conditions availability + estimate-readiness.
 *
 * Run: npx tsx scripts/verify-foundation-r1r1-project-conditions-readiness.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildProjectConditionsSnapshot } from "../lib/builder-interview/project-filter";
import type { BuilderInterviewInput } from "../lib/builder-interview/types";
import { INTERVIEW_QUESTION_REGISTRY } from "../lib/builder-interview/registry";
import {
  evaluateApplicableProjectConditions,
  getUnresolvedRequiredProjectConditionKeys,
  PROJECT_CONDITIONS_ESTIMATE_BLOCK_MESSAGE,
} from "../lib/project-conditions/applicability";
import { isProjectConditionDuplicateFactKey } from "../lib/project-conditions/canonical";
import { getScopeQuestions } from "../lib/scopes/registry";
import { calculateDemolition } from "../lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "../lib/estimate/calculators/external-stairs";
import { getCombinedLabourAccessFactor } from "../lib/estimate/adjustments";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculatePergola } from "../lib/estimate/calculators/pergola";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(
  id: string,
  type: string,
  name: string
): BuilderInterviewInput["workAreas"][number] {
  return { id, type, name, status: "confirmed", sortOrder: 0 };
}

function inputFor(
  type: string,
  constraints: BuilderInterviewInput["constraints"] = [],
  facts: BuilderInterviewInput["facts"] = []
): BuilderInterviewInput {
  return {
    project: { id: `proj-${type}`, qualityLevel: "standard" },
    workAreas: [wa(`${type}-1`, type, type)],
    facts,
    constraints,
  };
}

function keysOf(input: BuilderInterviewInput): string[] {
  return buildProjectConditionsSnapshot(input).candidates.map((c) => c.targetKey);
}

function commercialInterior(): BuilderInterviewInput {
  const types = [
    "demolition",
    "internal_walls",
    "ceilings",
    "doors",
    "flooring",
    "painting",
    "plastering",
  ];
  return {
    project: { id: "proj-fitout", qualityLevel: "standard" },
    workAreas: types.map((type, i) => ({
      id: `${type}-1`,
      type,
      name: type,
      status: "confirmed" as const,
      sortOrder: i,
    })),
    facts: [],
    constraints: [],
  };
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
  console.log("=== FOUNDATION-R1-R1 Project Conditions readiness ===\n");

  const types = [
    "deck",
    "bathroom",
    "demolition",
    "external_stairs",
    "fence",
    "retaining_wall",
    "kitchen",
    "pergola",
  ] as const;

  console.log("1-8 BLANK SITE — applicable questions exist");
  for (const type of types) {
    const snap = buildProjectConditionsSnapshot(inputFor(type));
    const ask = new Set(snap.candidates.map((c) => c.targetKey));
    check(
      `${type}: Project Conditions produce questions`,
      snap.shouldShowStage && snap.candidates.length > 0 && ask.has("site_access")
    );
    if (type === "deck") {
      check(
        `${type}: Level 1 Generate permitted (assumable PC)`,
        snap.readiness.canGenerateQuickEstimate === true
      );
    } else {
      check(
        `${type}: Generate blocked until required resolved`,
        snap.readiness.canGenerateQuickEstimate === false &&
          snap.unresolvedRequiredKeys.includes("site_access")
      );
    }
  }

  console.log("\n1b NON-DECK blocking retained");
  check(
    "bathroom blank: Generate still blocked until required resolved",
    buildProjectConditionsSnapshot(inputFor("bathroom")).readiness
      .canGenerateQuickEstimate === false
  );

  console.log("\n9 COMMERCIAL COMPONENTS — project logistics once");
  const fitout = commercialInterior();
  const fitoutSnap = buildProjectConditionsSnapshot(fitout);
  const accessAsks = fitoutSnap.engine.candidates.filter(
    (c) => c.questionKey === "interview.site.site_access"
  );
  check(
    "commercial interior: site_access asked once",
    accessAsks.length === 1
  );
  check(
    "commercial interior: no WA access clones ASK",
    !fitoutSnap.engine.candidates.some((c) =>
      c.questionKey.includes("access_clone")
    )
  );
  check(
    "commercial interior: Generate blocked while required open",
    fitoutSnap.readiness.canGenerateQuickEstimate === false
  );

  console.log("\n10-12 KNOWN SUPPRESS / UNKNOWN ASK / IRRELEVANT OMIT");
  const deckKnown = inputFor("deck", [
    { key: "site_access", value: "Difficult", source: "ai_extracted" },
    { key: "material_carry_distance", value: "10–30m", source: "ai_extracted" },
  ]);
  const deckKnownKeys = keysOf(deckKnown);
  check(
    "known site_access / carry not re-asked",
    !deckKnownKeys.includes("site_access") &&
      !deckKnownKeys.includes("material_carry_distance")
  );
  check(
    "known conditions still show the Project Conditions stage",
    buildProjectConditionsSnapshot(deckKnown).shouldShowStage === true
  );
  const fenceBlank = keysOf(inputFor("fence"));
  check(
    "fence does not ask interior floor_level",
    !fenceBlank.includes("floor_level")
  );
  check(
    "fence does not ask services_isolated",
    !fenceBlank.includes("services_isolated")
  );
  const demoBlankSnap = buildProjectConditionsSnapshot(inputFor("demolition"));
  check(
    "demolition asks services + hazmat + waste",
    demoBlankSnap.unresolvedRequiredKeys.includes("services_isolated") &&
      demoBlankSnap.unresolvedRequiredKeys.includes("hazardous_materials_risk") &&
      demoBlankSnap.unresolvedRequiredKeys.includes("waste_bin_access")
  );
  const unknownDeck = keysOf(inputFor("deck"));
  check(
    "unknown applicable deck asks site_access + carry",
    unknownDeck.includes("site_access") &&
      unknownDeck.includes("material_carry_distance")
  );

  console.log("\n13-16 REQUIRED / SKIP / RESOLVED");
  const deckResolved = inputFor(
    "deck",
    [
      { key: "site_access", value: "Difficult", source: "user" },
      { key: "material_carry_distance", value: "10–30m", source: "user" },
    ],
    []
  );
  const deckResolvedSnap = buildProjectConditionsSnapshot(deckResolved);
  check(
    "resolved required deck (no waste fact) permits Estimate",
    deckResolvedSnap.readiness.canGenerateQuickEstimate === true &&
      deckResolvedSnap.unresolvedRequiredKeys.length === 0
  );

  const deckRemoval = inputFor(
    "deck",
    [
      { key: "site_access", value: "Difficult", source: "user" },
      { key: "material_carry_distance", value: "10–30m", source: "user" },
    ],
    [
      {
        key: "deck.existing_deck_removal",
        workAreaId: "deck-1",
        value: true,
        source: "user",
      },
    ]
  );
  const removalSnap = buildProjectConditionsSnapshot(deckRemoval);
  check(
    "existing deck removal makes waste_bin required — Level 1 assumable for deck",
    removalSnap.unresolvedRequiredKeys.includes("waste_bin_access") &&
      removalSnap.readiness.canGenerateQuickEstimate === true
  );

  check(
    "Skip does not resolve required site_access",
    getUnresolvedRequiredProjectConditionKeys(inputFor("deck")).includes(
      "site_access"
    )
  );

  const notSureCarry: BuilderInterviewInput = inputFor("deck", [
    { key: "site_access", value: "Difficult", source: "user" },
    { key: "material_carry_distance", value: "Not sure", source: "user" },
  ]);
  check(
    "Not sure does not resolve required carry",
    getUnresolvedRequiredProjectConditionKeys(notSureCarry).includes(
      "material_carry_distance"
    )
  );

  console.log("\n17-18 ASSUMPTION / SUMMARY");
  const assumeSrc = read("lib/assistant/builder-interview-actions.ts");
  check(
    "assume is not persisted as a user Constraint",
    assumeSrc.includes('status: "assumption_deferred"') &&
      assumeSrc.includes("do not fake as user Constraint")
  );
  check(
    "all-known applicable still shows stage (Deck brief style)",
    deckResolvedSnap.shouldShowStage === true
  );

  console.log("\n19-20 NO WA DUPLICATES / NO 3.2.3");
  const productTypes = [
    "deck",
    "bathroom",
    "kitchen",
    "fence",
    "pergola",
    "retaining_wall",
    "external_stairs",
    "demolition",
    "internal_walls",
    "ceilings",
    "doors",
    "flooring",
    "painting",
    "plastering",
  ];
  check(
    "no WA project-condition questions reintroduced",
    productTypes.every((type) =>
      getScopeQuestions(type).every(
        (q) => !isProjectConditionDuplicateFactKey(q.factKey)
      )
    )
  );
  check(
    "WA access clones remain DEFER",
    INTERVIEW_QUESTION_REGISTRY.filter((q) =>
      q.questionKey.includes("access_clone")
    ).every((q) => q.askPolicy === "DEFER")
  );

  console.log("\n21-24 COMMERCIAL SINGLE-CONSUME");
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
  const demoCart = demo.lineItems.find((i) => i.label === "Carting/haulage allowance");
  check(
    "DC-01 Difficult + 30m: labour 1.10 once + haulage once",
    Math.abs((demoLabour?.labourHours ?? 0) - 9.63) < 0.02 && Boolean(demoCart)
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
  const stairLabour = stairs.lineItems.find((i) =>
    /labour/i.test(i.label)
  );
  check(
    "DC-02 project access once × ground (15.18h, not × WA 1.1)",
    Math.abs((stairLabour?.labourHours ?? 0) - 15.18) < 0.05
  );

  const bathFactor = getCombinedLabourAccessFactor({
    constraints: [
      { key: "site_access", label: "Access", value: "Difficult" },
      { key: "material_carry_distance", label: "Carry", value: "10–30m" },
    ],
    workAreaAccess: "Restricted",
  });
  check(
    "Bathroom combined 1.15 once (not WA Restricted stacked)",
    Math.abs(bathFactor - 1.15) < 1e-9
  );
  check(
    "Deck/Fence/Pergola calculators still estimate",
    calculateDeck(
      estimateCtx("deck", [{ key: "site_access", label: "A", value: "Difficult" }], [
        { key: "deck.area_m2", work_area_id: "deck-1", value: 16, source: "user" },
        { key: "deck.length_m", work_area_id: "deck-1", value: 4, source: "user" },
        { key: "deck.width_m", work_area_id: "deck-1", value: 4, source: "user" },
      ]).context,
      estimateCtx("deck", [], []).workArea
    ).lineItems.length > 0 &&
      calculateFence(
        estimateCtx("fence", [{ key: "site_access", label: "A", value: "Easy" }], [
          { key: "fence.length_m", work_area_id: "fence-1", value: 20, source: "user" },
          { key: "fence.height_m", work_area_id: "fence-1", value: 1.8, source: "user" },
        ]).context,
        estimateCtx("fence", [], []).workArea
      ).lineItems.length > 0 &&
      calculatePergola(
        estimateCtx("pergola", [{ key: "site_access", label: "A", value: "Easy" }], [
          { key: "pergola.area_m2", work_area_id: "pergola-1", value: 12, source: "user" },
          { key: "pergola.length_m", work_area_id: "pergola-1", value: 4, source: "user" },
          { key: "pergola.width_m", work_area_id: "pergola-1", value: 3, source: "user" },
        ]).context,
        estimateCtx("pergola", [], []).workArea
      ).lineItems.length > 0
  );

  console.log("\n14 / 25-27 SERVER GATE / BOUNDARIES");
  const actions = read("lib/assistant/actions.ts");
  const shell = read("components/assistant/AssistantShell.tsx");
  check(
    "server generate refuses unresolved required Project Conditions",
    actions.includes("projectConditionsIncomplete") &&
      actions.includes("buildLiveProjectConditionsSnapshot") &&
      actions.includes("canGenerateQuickEstimate")
  );
  check(
    "UI Generate gated on canGenerateQuickEstimate",
    shell.includes("projectConditionsReadyToGenerate") &&
      shell.includes("canGenerateQuickEstimate")
  );
  check(
    "empty saveConstraints([]) no longer auto-unlocks before required resolved",
    shell.includes("only unlock Generate when required Project Conditions")
  );
  check(
    "block message is customer-safe",
    PROJECT_CONDITIONS_ESTIMATE_BLOCK_MESSAGE.includes(
      "remaining project information"
    )
  );

  const migrations = existsSync(join("supabase", "migrations"))
    ? readdirSync(join("supabase", "migrations"))
    : [];
  check(
    "no FOUNDATION-R1-R1 migration",
    !migrations.some((f) => /r1r1|project.conditions.readiness/i.test(f))
  );
  check(
    "requirement emission is Deck surface + labour shadow only",
    read("lib/estimate/calculators/deck.ts").includes(
      "maybeBuildDeckSurfaceRequirement"
    ) &&
      read("lib/estimate/calculators/deck.ts").includes(
        "buildDeckLabourRequirement"
      ) &&
      !read("lib/estimate/calculators/demolition.ts").includes("requirements:")
  );
  check(
    "no Stage 3.2.3 interview UI",
    !shell.includes("Work Area Conditions") &&
      !read("docs/plans/POST_TRIAL_MASTER_DEVELOPMENT_PIPELINE.md").includes(
        "### FOUNDATION-R2 — Requirements emit adapter"
      )
  );

  const applicableDeck = evaluateApplicableProjectConditions(inputFor("deck"));
  check(
    "applicability is deterministic (deck always has access+carry)",
    applicableDeck.some((a) => a.key === "site_access" && a.readiness === "required") &&
      applicableDeck.some(
        (a) => a.key === "material_carry_distance" && a.readiness === "required"
      )
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
