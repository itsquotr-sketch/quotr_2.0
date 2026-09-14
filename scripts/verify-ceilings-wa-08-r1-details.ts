/**
 * CEILINGS WA-08-R1 — nested-fact Details resolution + question copy.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r1-details.ts
 *
 * Preview only. No physical/commercial changes. No Production.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { detailsSectionForCandidate } from "../lib/assistant/clarify/details-groups";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  identityFromCaptureRow,
  questionSemanticKey,
} from "../lib/assistant/question-identity";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  extractCeilingPortionsFromBrief,
} from "../lib/estimate/ceilings-brief";
import {
  ceilingNestedFactCurrentValue,
  ceilingPortionFieldCurrentValue,
  listCeilingsClarifyCandidates,
} from "../lib/estimate/ceilings-clarify";
import {
  CEILINGS_INFORMATION_CONTRACT,
  ceilingsFactIsRelevant,
} from "../lib/estimate/ceilings-information-contract";
import {
  CEILING_GENERIC_QUESTION,
  ceilingQuestionCopy,
  isGenericCeilingQuestion,
  missingCeilingQuestionCopyKeys,
} from "../lib/estimate/ceilings-question-copy";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import type { EstimateFact } from "../lib/estimate/types";

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

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";
const BRIEF =
  "Lounge ceiling is 4m x 3m with existing framing and 13mm Standard GIB.";
const BEFORE_QUESTION_COUNT = 8;
const BEFORE_FIRST_THREE = [
  "ceilings.portion.sheet_length_mm",
  "ceilings.portion.sheet_width_mm",
  "ceilings.portion.layers",
] as const;

const WA = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  status: "confirmed" as const,
};

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function clarify(
  facts: EstimateFact[],
  workAreas = [WA],
  briefText = BRIEF
) {
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText,
  });
  return composeClarifyView({
    stage: "quality",
    briefText,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function ceilingCandidates(view: ReturnType<typeof composeClarifyView>) {
  return view.candidates.filter(
    (row) =>
      row.workAreaType === "ceilings" ||
      (row.factKey ?? "").startsWith("ceilings.portion.") ||
      (row.factKey ?? "").startsWith("ceilings.bulkhead.")
  );
}

function groupedQuestions(view: ReturnType<typeof composeClarifyView>) {
  const out: {
    section: string;
    nestedLabel: string | null;
    factKey: string;
    question: string;
  }[] = [];
  for (const group of view.groups) {
    for (const section of group.sections) {
      for (const candidate of section.candidates) {
        out.push({
          section: section.id,
          nestedLabel: section.nestedItemLabel,
          factKey: candidate.factKey ?? "",
          question: candidate.question,
        });
      }
    }
  }
  return out;
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

console.log("=== CEILINGS WA-08-R1 Details nested resolution + copy ===\n");

const missingCopy = missingCeilingQuestionCopyKeys();
check(
  "copy registry covers every information-contract key",
  missingCopy.length === 0,
  missingCopy.join(", ")
);

const extracted = extractCeilingPortionsFromBrief(BRIEF);
const lounge = extracted[0]!;
check(
  "fixture extracts Lounge 4x3 existing Standard 13mm",
  extracted.length === 1 &&
    lounge.label === "Lounge" &&
    lounge.geometry.length_m === 4 &&
    lounge.geometry.width_m === 3 &&
    lounge.structure.family === "existing_framing" &&
    lounge.lining.plasterboard_product === "standard" &&
    lounge.lining.thickness_mm === 13
);

const fixtureFacts = writePortions(
  extracted.map((row) => ({ ...row, id: P1 }))
);
const fixtureView = clarify(fixtureFacts);
const fixtureQs = ceilingCandidates(fixtureView);
const fixtureKeys = fixtureQs.map((row) => row.factKey);

check(
  "A 4m length stored → no length question",
  !fixtureKeys.includes("ceilings.portion.length_m")
);
check(
  "B 3m width stored → no width question",
  !fixtureKeys.includes("ceilings.portion.width_m")
);
check(
  "C existing framing stored → no structure question",
  !fixtureKeys.includes("ceilings.portion.structure_family")
);
check(
  "D Standard product stored → no product question",
  !fixtureKeys.includes("ceilings.portion.plasterboard_product")
);
check(
  "E 13mm stored → no thickness question",
  !fixtureKeys.includes("ceilings.portion.thickness_mm")
);
check(
  "fixture does not re-ask lining family or job scope",
  !fixtureKeys.includes("ceilings.portion.lining_family") &&
    !fixtureKeys.includes("ceilings.portion.job_scope")
);

const missingLength = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
missingLength.structure.family = "timber_direct_fix";
missingLength.structure.job_scope = "new_ceiling";
missingLength.lining.family = "plasterboard";
missingLength.lining.plasterboard_product = "standard";
missingLength.lining.thickness_mm = 13;
missingLength.geometry.width_m = 3;
missingLength.has_bulkheads = false;
missingLength.finish.insulation_included = false;
missingLength.finish.painting_included = false;
missingLength.finish.stopping_included = false;
const missingLengthView = clarify(writePortions([missingLength]));
const lengthQ = ceilingCandidates(missingLengthView).find(
  (row) => row.factKey === "ceilings.portion.length_m"
);
check(
  "F missing length produces Ceiling length?",
  lengthQ?.question === "Ceiling length?" && lengthQ.inputType === "number"
);

const missingWidth = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
missingWidth.structure.family = "timber_direct_fix";
missingWidth.structure.job_scope = "new_ceiling";
missingWidth.lining.family = "plasterboard";
missingWidth.lining.plasterboard_product = "standard";
missingWidth.lining.thickness_mm = 13;
missingWidth.geometry.length_m = 4;
missingWidth.has_bulkheads = false;
missingWidth.finish.insulation_included = false;
missingWidth.finish.painting_included = false;
missingWidth.finish.stopping_included = false;
const missingWidthView = clarify(writePortions([missingWidth]));
check(
  "G missing width produces Ceiling width?",
  ceilingCandidates(missingWidthView).some(
    (row) =>
      row.factKey === "ceilings.portion.width_m" &&
      row.question === "Ceiling width?"
  )
);

const missingThickness = createEmptyCeilingPortion({
  id: P1,
  label: "Lounge",
});
missingThickness.structure.family = "existing_framing";
missingThickness.structure.job_scope = "reline_existing_suitable_framing";
missingThickness.lining.family = "plasterboard";
missingThickness.lining.plasterboard_product = "standard";
missingThickness.geometry.area_m2 = 12;
missingThickness.has_bulkheads = false;
missingThickness.finish.insulation_included = false;
missingThickness.finish.painting_included = false;
missingThickness.finish.stopping_included = false;
const missingThicknessView = clarify(writePortions([missingThickness]));
const thicknessQ = ceilingCandidates(missingThicknessView).find(
  (row) => row.factKey === "ceilings.portion.thickness_mm"
);
check(
  "H missing thickness produces Plasterboard thickness?",
  thicknessQ?.question === "Plasterboard thickness?" &&
    Boolean(thicknessQ.options?.length)
);

check(
  "I no Ceiling Details question uses generic fallback",
  fixtureQs.every((row) => !isGenericCeilingQuestion(row.question)) &&
    !lengthQ!.question.includes(CEILING_GENERIC_QUESTION) &&
    ceilingQuestionCopy("ceilings.portion.sheet_length_mm") === "Sheet length?"
);

const grouped = groupedQuestions(fixtureView);
check(
  "J Portion name not visually duplicated in Portion-scoped group",
  grouped.every(
    (row) =>
      !row.question.startsWith("Lounge:") &&
      (row.nestedLabel == null ||
        row.nestedLabel === "Lounge" ||
        !row.question.startsWith(`${row.nestedLabel}:`))
  ) && grouped.some((row) => row.nestedLabel === "Lounge")
);

const knownBh = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
knownBh.structure.family = "existing_framing";
knownBh.structure.job_scope = "reline_existing_suitable_framing";
knownBh.lining.family = "plasterboard";
knownBh.lining.plasterboard_product = "standard";
knownBh.lining.thickness_mm = 13;
knownBh.geometry.length_m = 4;
knownBh.geometry.width_m = 3;
knownBh.has_bulkheads = true;
knownBh.finish.insulation_included = false;
knownBh.finish.painting_included = false;
knownBh.finish.stopping_included = false;
const filledBh = createEmptyCeilingBulkhead({ id: BH1, label: "Bulkhead 1" });
filledBh.length_m = 4;
filledBh.depth_m = 0.4;
filledBh.height_m = 0.5;
filledBh.framing_type = "timber";
filledBh.lining_type = "standard";
filledBh.thickness_mm = 13;
knownBh.bulkheads = [filledBh];
knownBh.active_bulkhead_id = BH1;
const knownBhView = clarify(writePortions([knownBh]));
const knownBhKeys = ceilingCandidates(knownBhView).map((row) => row.factKey);
check(
  "K known Bulkhead dimensions are not re-asked",
  !knownBhKeys.includes("ceilings.bulkhead.length_m") &&
    !knownBhKeys.includes("ceilings.bulkhead.depth_m") &&
    !knownBhKeys.includes("ceilings.bulkhead.height_m") &&
    !knownBhKeys.includes("ceilings.bulkhead.framing_type") &&
    !knownBhKeys.includes("ceilings.bulkhead.lining_type")
);

const missingDepth = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
missingDepth.structure.family = "existing_framing";
missingDepth.structure.job_scope = "reline_existing_suitable_framing";
missingDepth.lining.family = "plasterboard";
missingDepth.lining.plasterboard_product = "standard";
missingDepth.lining.thickness_mm = 13;
missingDepth.geometry.area_m2 = 12;
missingDepth.has_bulkheads = true;
missingDepth.finish.insulation_included = false;
missingDepth.finish.painting_included = false;
missingDepth.finish.stopping_included = false;
const emptyBh = createEmptyCeilingBulkhead({ id: BH1 });
emptyBh.length_m = 4;
missingDepth.bulkheads = [emptyBh];
missingDepth.active_bulkhead_id = BH1;
const missingDepthView = clarify(writePortions([missingDepth]));
const depthQ = ceilingCandidates(missingDepthView).find(
  (row) => row.factKey === "ceilings.bulkhead.depth_m"
);
check(
  "L missing Bulkhead depth → Bulkhead depth?",
  depthQ?.question === "Bulkhead depth?" &&
    depthQ.inputType === "number" &&
    depthQ.componentId === BH1
);

const structureMissing = createEmptyCeilingPortion({
  id: P1,
  label: "Lounge",
});
structureMissing.structure.job_scope = "reline_existing_suitable_framing";
structureMissing.lining.family = "plasterboard";
structureMissing.geometry.area_m2 = 12;
structureMissing.has_bulkheads = false;
const structureView = clarify(writePortions([structureMissing]));
const structureQ = ceilingCandidates(structureView).find(
  (row) => row.factKey === "ceilings.portion.structure_family"
);
const productQ = ceilingCandidates(structureView).find(
  (row) => row.factKey === "ceilings.portion.plasterboard_product"
);
check(
  "M controlled-choice questions use options rather than generic text",
  Boolean(structureQ?.options?.length) &&
    structureQ?.inputType === "select" &&
    Boolean(productQ?.options?.length) &&
    Boolean(thicknessQ?.options?.length) &&
    fixtureQs.find((row) => row.factKey === "ceilings.portion.layers")
      ?.inputType === "number" &&
    fixtureQs.find((row) => row.factKey === "ceilings.portion.sheet_length_mm")
      ?.inputType === "number"
);

const sheetQ = fixtureQs.find(
  (row) => row.factKey === "ceilings.portion.sheet_length_mm"
);
check(
  "N assumption action appears only where contract permits",
  sheetQ?.assumable === true &&
    sheetQ.askClass === "ASSUME_IF_SKIPPED" &&
    lengthQ?.assumable === false &&
    lengthQ.askClass === "HARD_MINIMUM" &&
    fixtureQs.find((row) => row.factKey === "ceilings.portion.insulation_included")
      ?.assumable === false
);

check(
  "O one incomplete actual fact still blocks Ready",
  !missingLengthView.enoughToEstimate &&
    missingLengthView.blocksEstimate &&
    Boolean(lengthQ)
);

const detailsWrite = applyCeilingsFactWrite({
  facts: writePortions([
    (() => {
      const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
      row.structure.family = "existing_framing";
      row.structure.job_scope = "reline_existing_suitable_framing";
      row.lining.family = "plasterboard";
      row.lining.plasterboard_product = "standard";
      row.lining.thickness_mm = 13;
      return row;
    })(),
  ]),
  workAreaId: "c1",
  key: "ceilings.portion.length_m",
  value: 4,
  nestedItemId: P1,
});
const afterLength = applyCeilingsFactWrite({
  facts: detailsWrite,
  workAreaId: "c1",
  key: "ceilings.portion.width_m",
  value: 3,
  nestedItemId: P1,
});
const afterWriteView = clarify(afterLength);
check(
  "P nested write from Details/Refine/AI path satisfies Details",
  !ceilingCandidates(afterWriteView).some(
    (row) =>
      row.factKey === "ceilings.portion.length_m" ||
      row.factKey === "ceilings.portion.width_m"
  ) &&
    ceilingNestedFactCurrentValue({
      facts: afterLength,
      workAreaId: "c1",
      factKey: "ceilings.portion.length_m",
      nestedItemId: P1,
    }) === 4
);

const enrich = enrichExtractionFromBrief({
  briefText: BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
});
const aiPortions = resolveCeilingsPortions({
  facts: writePortions(
    extractCeilingPortionsFromBrief(BRIEF).map((row) => ({ ...row, id: P1 }))
  ),
  workAreaId: "c1",
});
check(
  "P AI extraction nested facts also satisfy Details",
  enrich.extraction.workAreas.some((row) => row.type === "ceilings") &&
    aiPortions.portions[0]?.geometry.length_m === 4 &&
    !fixtureKeys.includes("ceilings.portion.length_m")
);

const sheetSection = detailsSectionForCandidate(
  fixtureQs.find((row) => row.factKey === "ceilings.portion.sheet_length_mm")!
);
const layersSection = detailsSectionForCandidate(
  fixtureQs.find((row) => row.factKey === "ceilings.portion.layers")!
);
check(
  "sheet length/width sit in Materials, not Dimensions",
  sheetSection === "materials" && layersSection === "materials"
);

const afterQuestions = fixtureQs.map((row) => `${row.factKey}=${row.question}`);
check(
  `AFTER fixture question count is ${fixtureQs.length} (BEFORE was ${BEFORE_QUESTION_COUNT})`,
  fixtureQs.length === BEFORE_QUESTION_COUNT,
  afterQuestions.join(" | ")
);
check(
  "BEFORE first-three keys were sheet length/width/layers",
  BEFORE_FIRST_THREE[0] === "ceilings.portion.sheet_length_mm" &&
    BEFORE_FIRST_THREE[1] === "ceilings.portion.sheet_width_mm" &&
    BEFORE_FIRST_THREE[2] === "ceilings.portion.layers"
);

check(
  "fixture remaining questions have dedicated copy",
  fixtureQs.some(
    (row) =>
      row.factKey === "ceilings.portion.sheet_length_mm" &&
      row.question === "Sheet length?"
  ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.sheet_width_mm" &&
        row.question === "Sheet width?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.layers" &&
        row.question === "How many layers?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.bulkheads_present" &&
        row.question === "Any bulkheads?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.insulation_included" &&
        row.question === "Include insulation?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.painting_included" &&
        row.question === "Include painting?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.stopping_included" &&
        row.question === "Include stopping?"
    ) &&
    fixtureQs.some(
      (row) =>
        row.factKey === "ceilings.portion.height_m" &&
        row.question === "Ceiling height?"
    )
);

const timberArea = createEmptyCeilingPortion({ id: P1, label: "Hall" });
timberArea.structure.family = "timber_direct_fix";
timberArea.structure.job_scope = "new_ceiling";
timberArea.lining.family = "plasterboard";
timberArea.geometry.area_m2 = 12;
check(
  "length+width required does not also ask area",
  !ceilingsFactIsRelevant("ceilings.portion.area_m2", {
    facts: writePortions([timberArea]),
    workAreaId: "c1",
    nestedItemId: P1,
  }) &&
    ceilingsFactIsRelevant("ceilings.portion.length_m", {
      facts: writePortions([timberArea]),
      workAreaId: "c1",
      nestedItemId: P1,
    })
);

const derivedArea = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
derivedArea.geometry.length_m = 4;
derivedArea.geometry.width_m = 3;
derivedArea.geometry.area_m2 = null;
check(
  "derived area from nested LxW satisfies Details without a shadow fact",
  ceilingPortionFieldCurrentValue(derivedArea, "ceilings.portion.area_m2") ===
    12
);

const identity = identityFromCaptureRow({
  workAreaId: "c1",
  workAreaType: "ceilings",
  factKey: "ceilings.portion.sheet_length_mm",
  nestedItemId: P1,
});
check(
  "semantic identity is workArea + factKey + nestedItemId",
  questionSemanticKey(identity).includes(P1) &&
    questionSemanticKey(identity).includes("ceilings.portion.sheet_length_mm")
);

const clarifySrc = read("lib/estimate/ceilings-clarify.ts");
const composeSrc = read("lib/assistant/clarify/compose.ts");
const panelSrc = read("components/assistant/clarify/ClarifyPanel.tsx");
check(
  "question copy is not prefixed with Portion name",
  !clarifySrc.includes("` ${displayName}:") &&
    !clarifySrc.includes("${displayName}: ${question}") &&
    !clarifySrc.includes("safeFactQuestion(params.factKey")
);
check(
  "compose nested resolver reads ceilings.portions, not scalar rows",
  composeSrc.includes("ceilingNestedFactCurrentValue") &&
    composeSrc.includes("isCeilingsNestedFactKey")
);
check(
  "Clarify question keeps label for accessibility without visual prefix",
  panelSrc.includes("aria-label={candidate.label}")
);
check(
  "no generic fallback in active contract copy",
  CEILINGS_INFORMATION_CONTRACT.every((row) => {
    const copy = ceilingQuestionCopy(row.factKey);
    return Boolean(copy) && !isGenericCeilingQuestion(copy ?? "");
  })
);

const plan = composeJobPlan({
  workAreas: [WA],
  facts: fixtureFacts,
  qualityLevel: "standard",
  briefText: BRIEF,
});
const refine = composeRefineView({
  workAreas: [WA],
  facts: fixtureFacts,
  constraints: [],
  briefText: BRIEF,
  qualityLevel: "standard",
  jobPlan: {
    cards: plan.cards.map((card) => ({
      workAreaId: card.workAreaId,
      workAreaType: card.workAreaType,
      name: card.name,
      notConfirmed: card.notConfirmed,
    })),
  },
});
const refineRows = [...refine.highValue, ...refine.advanced];
check(
  "Refine remains the editor of known nested facts, not a second interview",
  refineRows.some(
    (row) =>
      row.factKey === "ceilings.portion.structure_family" &&
      row.currentValue === "existing_framing"
  ) &&
    !refineRows.some(
      (row) => row.factKey === "ceilings.portion.insulation_included"
    )
);

check(
  "listCeilingsClarifyCandidates first unresolved keys match human-QA first 3",
  listCeilingsClarifyCandidates({
    facts: fixtureFacts,
    workAreaId: "c1",
    workAreaName: "Ceilings",
    briefText: BRIEF,
  })
    .slice(0, 3)
    .map((row) => row.factKey)
    .join(",") === BEFORE_FIRST_THREE.join(",")
);

console.log("\n=== Fixture Details questions AFTER ===");
for (const row of grouped) {
  console.log(`  ${row.nestedLabel} · ${row.section}: ${row.question} (${row.factKey})`);
}

console.log("\n=== Prior Ceiling + Details regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-07r1.ts",
  "scripts/verify-details-question-coverage-r1.ts",
  "scripts/verify-details-grouped-complete-capture-r1.ts",
  "scripts/verify-clarify-initial-capture-r1.ts",
  "scripts/verify-clarify-refine-ownership-r1.ts",
  "scripts/verify-work-area-internal-walls-08.ts",
  "scripts/verify-work-area-bathroom-07.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
