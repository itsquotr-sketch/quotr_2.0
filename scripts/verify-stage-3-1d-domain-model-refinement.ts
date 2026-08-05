/**
 * Stage 3.1D — Domain model refinement verification.
 *
 * Pure ownership / pipeline / namespace regressions. No live Supabase.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DOMAIN_ENTITY_CONTRACTS,
  RESERVED_CONSTRAINT_KEYS,
  canWriteKeyToConstraints,
  canWriteKeyToFacts,
  factSourcePrecedence,
  getDomainEntityContract,
  isReservedConstraintKey,
  looksLikeScopedFactKey,
  shouldWriteDerivedFact,
} from "../lib/scopes/domain-ownership";
import {
  assertFactConstraintNamespace,
  findQuestionAnswersNeedingFactHeal,
  mergeQuestionBaselineWithFacts,
  questionAnswerSatisfiesFactReadiness,
  resolveFactValueForEstimate,
} from "../lib/scopes/scope-value-resolution";
import {
  buildMissingRequiredQuestionsForWorkAreas,
  isTemplateFactMissing,
  questionAnswerSatisfiesMissingFact,
} from "../lib/scopes/questions";
import { buildFactLookup } from "../lib/scopes/fact-values";
import { getScopeQuestions } from "../lib/scopes/registry";

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

function main(): void {
  console.log("=== Stage 3.1D Domain Model Refinement Verification ===\n");

  // --- Ownership contracts ---
  check(
    "Domain contracts cover Fact, Question, Constraint, Derived",
    Boolean(getDomainEntityContract("fact")) &&
      Boolean(getDomainEntityContract("question")) &&
      Boolean(getDomainEntityContract("constraint")) &&
      Boolean(getDomainEntityContract("derived_fact"))
  );

  check(
    "Every contract has owner, SoT, lifecycle, freeze, consumers",
    DOMAIN_ENTITY_CONTRACTS.every(
      (entity) =>
        entity.owner.length > 0 &&
        entity.sourceOfTruth.length > 0 &&
        entity.lifecycle.length > 0 &&
        entity.freezePoint.length > 0 &&
        entity.downstreamConsumers.length > 0
    )
  );

  const factContract = getDomainEntityContract("fact");
  check(
    "Fact SoT is project_facts",
    Boolean(factContract?.sourceOfTruth.includes("project_facts"))
  );

  const questionContract = getDomainEntityContract("question");
  check(
    "Question is capture journal, not estimating authority",
    Boolean(
      questionContract?.sourceOfTruth.toLowerCase().includes("not estimating")
    )
  );

  // --- Namespace separation ---
  check(
    "Reserved constraint keys include site_access",
    isReservedConstraintKey("site_access")
  );
  check(
    "deck.area_m2 looks like scoped fact key",
    looksLikeScopedFactKey("deck.area_m2")
  );
  check(
    "Cannot write site_access to facts",
    canWriteKeyToFacts("site_access") === false
  );
  check(
    "Can write deck.area_m2 to facts",
    canWriteKeyToFacts("deck.area_m2") === true
  );
  check(
    "Cannot write deck.area_m2 to constraints",
    canWriteKeyToConstraints("deck.area_m2") === false
  );
  check(
    "Can write site_access to constraints",
    canWriteKeyToConstraints("site_access") === true
  );

  check(
    "assertFactConstraintNamespace rejects constraint key on facts",
    assertFactConstraintNamespace({ target: "fact", key: "site_access" }).ok ===
      false
  );
  check(
    "assertFactConstraintNamespace rejects fact key on constraints",
    assertFactConstraintNamespace({
      target: "constraint",
      key: "deck.area_m2",
    }).ok === false
  );
  check(
    "assertFactConstraintNamespace allows deck fact",
    assertFactConstraintNamespace({ target: "fact", key: "deck.area_m2" }).ok ===
      true
  );

  check(
    "All reserved constraint keys are flat (no dots)",
    RESERVED_CONSTRAINT_KEYS.every((key) => !key.includes("."))
  );

  // --- Derived write guards ---
  check("Derived must not overwrite user", shouldWriteDerivedFact("user") === false);
  check("Derived may overwrite derived", shouldWriteDerivedFact("derived") === true);
  check("Derived may overwrite ai_extracted", shouldWriteDerivedFact("ai_extracted") === true);
  check("Derived may write when absent", shouldWriteDerivedFact(null) === true);

  check("User source outranks derived", factSourcePrecedence("user") > factSourcePrecedence("derived"));

  // --- Estimate resolution: facts only ---
  const estimateResolution = resolveFactValueForEstimate({
    facts: [
      {
        key: "deck.area_m2",
        work_area_id: "wa-1",
        value: 24,
        source: "user",
      },
    ],
    workAreaId: "wa-1",
    key: "deck.area_m2",
  });
  check(
    "Estimate resolves from fact",
    estimateResolution.resolvedFrom === "fact" &&
      estimateResolution.value === 24
  );

  const missingResolution = resolveFactValueForEstimate({
    facts: [],
    workAreaId: "wa-1",
    key: "deck.area_m2",
  });
  check(
    "Estimate does not invent values from questions",
    missingResolution.resolvedFrom === "none"
  );

  check(
    "questionAnswerSatisfiesFactReadiness is always false",
    questionAnswerSatisfiesFactReadiness() === false
  );
  check(
    "questionAnswerSatisfiesMissingFact is always false",
    questionAnswerSatisfiesMissingFact() === false
  );

  // --- Display merge: facts win over question baseline ---
  const merged = mergeQuestionBaselineWithFacts({
    workAreaId: "wa-1",
    facts: [
      {
        key: "deck.material",
        work_area_id: "wa-1",
        value: "hardwood",
        source: "user",
      },
    ],
    questionAnswers: [
      {
        workAreaId: "wa-1",
        key: "deck.material",
        answerValue: "pine",
      },
      {
        workAreaId: "wa-1",
        key: "deck.has_stairs",
        answerValue: true,
      },
    ],
  });
  check(
    "Display merge: fact wins over question for same key",
    merged.get("wa-1:deck.material")?.value === "hardwood"
  );
  check(
    "Display merge: question baseline used when fact absent",
    merged.get("wa-1:deck.has_stairs")?.value === true
  );

  // --- Heal detection ---
  const needingHeal = findQuestionAnswersNeedingFactHeal({
    questionAnswers: [
      { workAreaId: "wa-1", key: "deck.length_m", answerValue: 6 },
      { workAreaId: "wa-1", key: "deck.width_m", answerValue: 4 },
      { workAreaId: "wa-1", key: "site_access", answerValue: "Easy" },
    ],
    facts: [
      {
        key: "deck.length_m",
        work_area_id: "wa-1",
        value: 6,
        source: "user",
      },
    ],
  });
  check(
    "Heal finds question-only width fact",
    needingHeal.length === 1 && needingHeal[0]?.key === "deck.width_m"
  );
  check(
    "Heal ignores reserved constraint keys on questions",
    !needingHeal.some((item) => item.key === "site_access")
  );

  // --- Missing builder ignores question-only answers ---
  const deckTemplates = getScopeQuestions("deck");
  const lengthTemplate = deckTemplates.find((q) => q.factKey === "deck.length_m");
  const workArea = {
    id: "wa-deck-1",
    type: "deck",
    name: "Deck",
    sort_order: 1,
    status: "confirmed",
  };
  const project = { quality_level: "standard" as const };

  check("Deck length template exists", Boolean(lengthTemplate));

  if (lengthTemplate) {
    const missingWithQuestionOnly = isTemplateFactMissing({
      template: lengthTemplate,
      workArea,
      lookup: buildFactLookup([]),
      qualityLevel: project.quality_level,
      confirmedTypes: new Set(["deck"]),
      project,
    });
    check(
      "Fact missing when no project_facts (question-only irrelevant)",
      missingWithQuestionOnly === true
    );

    const built = buildMissingRequiredQuestionsForWorkAreas({
      project,
      confirmedWorkAreas: [workArea],
      projectFacts: [],
      existingQuestions: [
        {
          workAreaId: workArea.id,
          key: "deck.length_m",
          answerValue: 8,
          blockStatus: "submitted",
        },
      ],
      includeOptional: false,
    });

    check(
      "Missing builder still emits length when fact absent despite answered question",
      built.some((q) => q.key === "deck.length_m" || q.key === lengthTemplate.key)
    );
  }

  // --- Static scans: write paths use shared persistence ---
  const actionsPath = join("lib", "assistant", "actions.ts");
  const factActionsPath = join("lib", "assistant", "fact-actions.ts");
  const constraintActionsPath = join("lib", "assistant", "constraint-actions.ts");
  const missingPath = join("lib", "assistant", "missing-questions.ts");
  const proposalsPath = join("lib", "project-notes", "proposals", "actions.ts");
  const persistDerivedPath = join("lib", "assistant", "persist-derived-facts.ts");
  const ownershipDoc = join(
    "docs",
    "architecture",
    "STAGE_3_1D_DOMAIN_MODEL_REFINED.md"
  );
  const schemaDoc = join(
    "docs",
    "architecture",
    "STAGE_3_1D_DEFERRED_SCHEMA_PROPOSALS.md"
  );

  check("actions.ts exists", existsSync(actionsPath));
  check("fact-actions.ts exists", existsSync(factActionsPath));
  check("constraint-actions.ts exists", existsSync(constraintActionsPath));

  if (existsSync(actionsPath)) {
    const src = read(actionsPath);
    check(
      "saveQuestionBlockAnswers uses commitUserAnswerToScope",
      src.includes("commitUserAnswerToScope")
    );
    check(
      "saveConstraints uses upsertProjectConstraintRecord",
      src.includes("upsertProjectConstraintRecord")
    );
  }

  if (existsSync(factActionsPath)) {
    const src = read(factActionsPath);
    check(
      "updateProjectFact uses commitUserFactEdit",
      src.includes("commitUserFactEdit")
    );
  }

  if (existsSync(constraintActionsPath)) {
    const src = read(constraintActionsPath);
    check(
      "updateProjectConstraint uses upsertProjectConstraintRecord",
      src.includes("upsertProjectConstraintRecord")
    );
  }

  if (existsSync(missingPath)) {
    const src = read(missingPath);
    check(
      "ensureMissingDetails heals question→fact drift",
      src.includes("healQuestionAnswersIntoFacts")
    );
  }

  if (existsSync(proposalsPath)) {
    const src = read(proposalsPath);
    check(
      "Note proposal apply uses upsertScopedFact",
      src.includes("upsertScopedFact")
    );
    check(
      "Note proposal apply uses upsertProjectConstraintRecord",
      src.includes("upsertProjectConstraintRecord")
    );
  }

  if (existsSync(persistDerivedPath)) {
    const src = read(persistDerivedPath);
    check(
      "Derived persist uses shouldWriteDerivedFact",
      src.includes("shouldWriteDerivedFact")
    );
  }

  check("Refined domain model doc exists", existsSync(ownershipDoc));
  check("Deferred schema proposals doc exists", existsSync(schemaDoc));

  if (existsSync(ownershipDoc)) {
    const doc = read(ownershipDoc);
    check(
      "Refined doc states Fact is estimating SoT",
      /project_facts/i.test(doc) && /source of truth/i.test(doc)
    );
    check(
      "Refined doc documents freeze points",
      /freeze/i.test(doc)
    );
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
