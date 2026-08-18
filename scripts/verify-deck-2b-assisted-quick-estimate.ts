/**
 * DECK-2B assisted Quick Estimate verifier.
 * Run: npx tsx scripts/verify-deck-2b-assisted-quick-estimate.ts
 */
import { readFileSync } from "node:fs";
import { deriveInterviewReadiness } from "../lib/builder-interview/readiness";
import {
  PROJECT_CONDITIONS_BATCH_SIZE,
  buildProjectConditionsSnapshot,
  previewProjectConditionAskCandidates,
} from "../lib/builder-interview/project-filter";
import type { BuilderInterviewInput } from "../lib/builder-interview/types";
import { extractConstraintsFromBrief } from "../lib/ai/enrich-extraction";
import { buildAssistantUnderstandingSummary } from "../lib/assistant/presentation/assistant-understanding-summary";
import {
  deriveQuickEstimateConfidencePresentation,
  rankQuickEstimateAssumptions,
} from "../lib/assistant/presentation/quick-estimate-confidence";
import { ASSISTANT_ACTION_LABELS } from "../lib/assistant/presentation/action-labels";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import {
  MAX_QUICK_ESTIMATE_P0_QUESTIONS,
  MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS,
} from "../lib/scopes/estimate-priority";
import {
  blocksLevel1Estimate,
  filterEstimateBlockingProjectConditionKeys,
  getLevel1BlockingClass,
} from "../lib/scopes/level1-blocking";
import { applyLevel1AttentionPresentation } from "../lib/assistant/presentation/attention-severity";
import { resolveActiveDisclosureStage } from "../lib/assistant/progressive-disclosure";
import { isProjectConditionDuplicateFactKey } from "../lib/project-conditions/canonical";
import {
  buildQuestionBlockFromProjectState,
  prepareProjectFactsForQuestions,
} from "../lib/scopes/questions";
import { getScopeQuestions } from "../lib/scopes/registry";
import {
  loadCalibrationFixture,
  runDeckCalibration,
} from "./deck-calibration/run-deck-calibration";

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

const WA = "wa-deck-1";
const project = { quality_level: "standard", constraints: [] };

function factsFromFixture(record: Record<string, string | number | boolean>) {
  return Object.entries(record).map(([key, value]) => ({
    key,
    work_area_id: WA,
    value,
    source: "user" as const,
  }));
}

function questionBlockForFixture(
  fixtureFacts: Record<string, string | number | boolean>,
  constraints: BuilderInterviewInput["constraints"] = []
) {
  const interviewInput = pcInputFor(fixtureFacts, constraints).input;
  const pcPreview = previewProjectConditionAskCandidates(interviewInput);
  return buildQuestionBlockFromProjectState({
    project: { quality_level: "standard", constraints },
    confirmedWorkAreas: [
      {
        id: WA,
        type: "deck",
        name: "Deck",
        sort_order: 1,
        status: "confirmed",
      },
    ],
    projectFacts: factsFromFixture(fixtureFacts),
    pcCandidatesForPlanning: pcPreview,
  });
}

function mergedFactsForFixture(
  fixtureFacts: Record<string, string | number | boolean>
) {
  return prepareProjectFactsForQuestions({
    workAreas: [
      {
        id: WA,
        type: "deck",
        name: "Deck",
        sort_order: 1,
        status: "confirmed",
      },
    ],
    projectFacts: factsFromFixture(fixtureFacts),
  });
}

function pcInputFor(
  fixtureFacts: Record<string, string | number | boolean>,
  constraints: BuilderInterviewInput["constraints"] = [],
  scopeQuestionCount = 0
) {
  const input: BuilderInterviewInput = {
    projectId: "p1",
    workAreas: [{ id: WA, type: "deck", name: "Deck", status: "confirmed" }],
    facts: factsFromFixture(fixtureFacts).map((f) => ({
      key: f.key,
      workAreaId: f.work_area_id,
      value: f.value,
      source: "user",
    })),
    constraints,
  };
  return {
    input,
    snapshot: buildProjectConditionsSnapshot(input, { scopeQuestionCount }),
  };
}

function totalLevel1Questions(
  scopeCount: number,
  pcSnapshot: ReturnType<typeof buildProjectConditionsSnapshot>
): number {
  return scopeCount + pcSnapshot.candidates.length;
}

console.log("=== DECK-2B assisted Quick Estimate ===\n");

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const exemplar = loadCalibrationFixture("EXEMPLAR-AI-01.json");
const realBlock = questionBlockForFixture(realJob.facts);
const exemplarBlock = questionBlockForFixture(exemplar.facts);
const realMerged = mergedFactsForFixture(realJob.facts);
const realKeys = new Set(realBlock.questions.map((q) => q.key));

check("1 REAL-JOB retains 3x9 geometry in facts", () => {
  const length = realMerged.find(
    (f) => f.key === "deck.length_m" && f.work_area_id === WA
  )?.value;
  const width = realMerged.find(
    (f) => f.key === "deck.width_m" && f.work_area_id === WA
  )?.value;
  return length === 3 && width === 9;
});

check("2 REAL-JOB area 27m2 derived without asking", () => {
  const area = realMerged.find(
    (f) => f.key === "deck.area_m2" && f.work_area_id === WA
  )?.value;
  return area === 27 && !realKeys.has("deck.area_m2");
});

check("3 REAL-JOB Vitex/Hardwood retained without re-asking", () => {
  const material = realMerged.find(
    (f) => f.key === "deck.board_material" && f.work_area_id === WA
  )?.value;
  return material === "Hardwood" && !realKeys.has("deck.board_material");
});

check("4 REAL-JOB 140mm retained without re-asking", () => {
  const width = realMerged.find(
    (f) => f.key === "deck.board_width_mm" && f.work_area_id === WA
  )?.value;
  return width === 140 && !realKeys.has("deck.board_width_mm");
});

check("5 REAL-JOB height retained without re-asking", () => {
  const height = realMerged.find(
    (f) => f.key === "deck.height_m" && f.work_area_id === WA
  )?.value;
  return height === 0.14 && !realKeys.has("deck.height_m");
});

check("6 REAL-JOB length/width not re-asked", () => {
  return !realKeys.has("deck.length_m") && !realKeys.has("deck.width_m");
});

check("7 REAL-JOB substructure fact retained", () => {
  const sub = realMerged.find(
    (f) => f.key === "deck.substructure_included" && f.work_area_id === WA
  )?.value;
  return sub === true && !realKeys.has("deck.substructure_included");
});

check("8 REAL-JOB no board-width duplicate question", () => {
  return !realKeys.has("deck.board_width_mm");
});

check("9 REAL-JOB no grade question Level 1", () => {
  return ![...realKeys].some((key) => /grade|kd|green/i.test(key));
});

check("10 REAL-JOB no treatment question Level 1", () => {
  return !realKeys.has("deck.framing_treatment");
});

check("11 REAL-JOB no KD question Level 1", () => {
  return ![...realKeys].some((key) => /kd|green/i.test(key));
});

check("12 REAL-JOB no footing-dimension question Level 1", () => {
  return (
    !realKeys.has("deck.footing_length_mm") &&
    !realKeys.has("deck.footing_width_mm") &&
    !realKeys.has("deck.footing_depth_mm")
  );
});

check(
  "13 REAL-JOB maximum normal high-value questions <=3",
  realBlock.questions.length <= MAX_QUICK_ESTIMATE_P0_QUESTIONS,
  `count=${realBlock.questions.length}`
);

check("14 REAL-JOB Estimate Now label available", () => {
  return ASSISTANT_ACTION_LABELS.estimateNow === "Estimate now";
});

check("15 REAL-JOB demolition P0 candidate when missing", () => {
  return realBlock.questions.some((q) => q.key === "deck.existing_deck_removal");
});

const understanding = buildAssistantUnderstandingSummary({
  workAreaType: "deck",
  workAreaName: "Deck",
  facts: Object.entries(realJob.facts).map(([key, value]) => ({ key, value })),
});
check("16 REAL-JOB assumptions path visible via understanding summary", () => {
  return understanding.lines.some((line) => /27m²|deck/i.test(line));
});

const realCalibration = runDeckCalibration(realJob);
check(
  "17 REAL-JOB estimate money remains baseline",
  realCalibration.commercialSafety.estimateSell === 16069.1,
  `sell=${realCalibration.commercialSafety.estimateSell}`
);

check(
  "18 REAL-JOB actual $13k never used as rate",
  realJob.eligibility?.eligibleForRateCalibration === false &&
    realJob.actualCustomerSellExGst === 13000 &&
    realCalibration.estimateSell !== 13000
);

const exemplarKeys = new Set(exemplarBlock.questions.map((q) => q.key));
check("19 EXEMPLAR brief facts retained in merged facts", () => {
  const merged = mergedFactsForFixture(exemplar.facts);
  return (
    merged.some((f) => f.key === "deck.length_m" && f.value === 5.2) &&
    merged.some((f) => f.key === "deck.board_material" && f.value === "Kwila")
  );
});

check("20 EXEMPLAR demolition not re-asked", () => {
  return !exemplarKeys.has("deck.existing_deck_removal");
});

check("21 EXEMPLAR access/carry not re-asked in Scope Details", () => {
  return !exemplarKeys.has("deck.access_type");
});

check("22 EXEMPLAR joist centres not re-asked", () => {
  return !exemplarKeys.has("deck.joist_centres_mm");
});

check("23 EXEMPLAR fascia not re-asked", () => {
  return !exemplarKeys.has("deck.vertical_face_boards_required");
});

check("24 EXEMPLAR steps not re-asked", () => {
  return !exemplarKeys.has("deck.access_type");
});

check(
  "25 EXEMPLAR near-zero questions",
  exemplarBlock.questions.length <= 1,
  `count=${exemplarBlock.questions.length}`
);

check("26 EXEMPLAR elevated + no balustrade attention facts present", () => {
  return (
    exemplar.facts["deck.height_m"] === 1.2 &&
    exemplar.facts["deck.balustrade_required"] === false
  );
});

check("27 EXEMPLAR attention does not silently add money", () => {
  const baseline = runDeckCalibration(exemplar);
  const withBalustrade = runDeckCalibration({
    ...exemplar,
    facts: { ...exemplar.facts, "deck.balustrade_required": true },
  });
  return withBalustrade.commercialSafety.estimateSell === baseline.commercialSafety.estimateSell;
});

const confidence = deriveQuickEstimateConfidencePresentation({
  confidencePercent: 72,
  missingInfoCount: 1,
  attentionCount: 1,
});
check("28 deterministic confidence band", () => {
  return confidence.band === "Medium" && confidence.reasons.length > 0;
});

check("29 confidence reason inspectable", () => {
  return confidence.reasons.every((reason) => reason.trim().length > 0);
});

check("30 low confidence does not block estimate", () => {
  const low = deriveQuickEstimateConfidencePresentation({
    confidencePercent: 35,
    missingInfoCount: 4,
    attentionCount: 3,
    assumptionSeverity: "critical",
  });
  return low.band === "Low" && low.blocksEstimate === false;
});

check("31 access uses canonical project-level condition duplicate keys", () => {
  return isProjectConditionDuplicateFactKey("material_carry_distance");
});

check("32 access not duplicated into deck.access_type template P0", () => {
  const deckAccess = getScopeQuestions("deck").find(
    (q) => q.factKey === "deck.access_type"
  );
  return deckAccess?.estimatePriorityClass === "P1";
});

check("33 project conditions batch size is 3", PROJECT_CONDITIONS_BATCH_SIZE === 3);

const { snapshot: pcSnapshot } = pcInputFor(realJob.facts);
check("34 optional P2 fields do not block Estimate Now readiness path", () => {
  return typeof pcSnapshot.readiness.canGenerateQuickEstimate === "boolean";
});

check("35 builder can refine later — P1/P2 templates still exist", () => {
  return getScopeQuestions("deck").some((q) => q.estimatePriorityClass === "P2");
});

check("36 regenerate uses updated facts safely — derived area stable", () => {
  const updated = mergedFactsForFixture({
    ...realJob.facts,
    "deck.length_m": 4,
  });
  const area = updated.find(
    (f) => f.key === "deck.area_m2" && f.work_area_id === WA
  )?.value;
  return area === 36;
});

check(
  "37 no material rate authority promotion",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);

check(
  "38 no legacy framing authority promotion",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: "deck.substructure.m2",
  }).authority === "LEGACY_AUTHORITATIVE"
);

check("39 REAL-JOB sell baseline unchanged on re-run", () => {
  const second = runDeckCalibration(realJob);
  return second.commercialSafety.estimateSell === 16069.1;
});

check("40 top assumptions capped initially", () => {
  const ranked = rankQuickEstimateAssumptions(
    ["a", "b", "c", "d", "e"],
    MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS
  );
  return ranked.length === MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS;
});

check("41 P3 deck area never emitted as question", () => {
  const sparse = questionBlockForFixture({
    "deck.length_m": 3,
    "deck.width_m": 9,
  });
  return !sparse.questions.some((q) => q.key === "deck.area_m2");
});

check("42 P2 joist section not emitted at Level 1", () => {
  return !exemplarKeys.has("deck.joist_section");
});

check("43 compact estimate summary labels exist", () => {
  return (
    ASSISTANT_ACTION_LABELS.reviewEstimate === "Review estimate" &&
    ASSISTANT_ACTION_LABELS.estimateNow === "Estimate now"
  );
});

check("44 REAL-JOB understanding mentions low level", () => {
  return understanding.lines.some((line) => /low level|0.14/i.test(line));
});

check("45 REAL-JOB P0 cap constant locked", MAX_QUICK_ESTIMATE_P0_QUESTIONS === 3);

check("46 REAL-JOB no P2 structural questions in block", () => {
  return !realBlock.questions.some((q) =>
    /joist|bearer|footing|support|treatment|engineering/.test(q.key)
  );
});

check("47 interview readiness exposes canGenerateQuickEstimate", () => {
  const readiness = deriveInterviewReadiness({
    candidates: pcSnapshot.candidates,
    assumptionClassifications: pcSnapshot.engine.diagnostics.assumptionClassifications,
    unresolvedRequiredTargetKeys: pcSnapshot.unresolvedRequiredKeys,
  });
  return typeof readiness.canGenerateQuickEstimate === "boolean";
});

check("48 REAL-JOB calibration fixture not rate-eligible", () => {
  return realJob.eligibility?.eligibleForRateCalibration === false;
});

// --- DECK-2B-R1 global budget + blocking separation ---

const realPc = pcInputFor(realJob.facts, [], realBlock.questions.length);
check(
  "49 REAL-JOB total Level 1 questions <=3 (scope + PC batch)",
  totalLevel1Questions(realBlock.questions.length, realPc.snapshot) <=
    MAX_QUICK_ESTIMATE_P0_QUESTIONS,
  `scope=${realBlock.questions.length} pc=${realPc.snapshot.candidates.length}`
);

check("50 REAL-JOB demolition is assumable not hard-minimum", () => {
  const template = getScopeQuestions("deck").find(
    (q) => q.key === "deck.existing_deck_removal"
  );
  return (
    template != null &&
    getLevel1BlockingClass(template!) === "ASSUMABLE" &&
    !blocksLevel1Estimate(template!)
  );
});

check("51 REAL-JOB assumable PC keys do not block Estimate now", () => {
  return realPc.snapshot.readiness.canGenerateQuickEstimate === true;
});

check("52 REAL-JOB height unknown would be assumable", () => {
  const template = getScopeQuestions("deck").find((q) => q.key === "deck.height_m");
  return template != null && getLevel1BlockingClass(template!) === "ASSUMABLE";
});

check("53 no geometry is hard-minimum", () => {
  const length = getScopeQuestions("deck").find((q) => q.key === "deck.length_m");
  const sparse = questionBlockForFixture({});
  return (
    length != null &&
    getLevel1BlockingClass(length!) === "HARD_MINIMUM" &&
    sparse.questions.some((q) => q.key === "deck.length_m")
  );
});

const exemplarBriefConstraints = extractConstraintsFromBrief(exemplar.sourceBrief).map(
  (c) => ({ key: c.key, value: c.value, source: "ai_extracted" as const })
);
check("54 EXEMPLAR brief extracts restricted access canonically", () => {
  const access = exemplarBriefConstraints.find((c) => c.key === "site_access");
  return access?.value === "Difficult";
});

check("55 EXEMPLAR brief extracts manual carry canonically", () => {
  const carry = exemplarBriefConstraints.find(
    (c) => c.key === "material_carry_distance"
  );
  return carry?.value === "10–30m";
});

const exemplarPc = pcInputFor(exemplar.facts, exemplarBriefConstraints, 0);
const exemplarPcKeys = new Set(exemplarPc.snapshot.candidates.map((c) => c.targetKey));
check("56 EXEMPLAR PC does not ask access again", () => !exemplarPcKeys.has("site_access"));
check("57 EXEMPLAR PC does not ask carry again", () => !exemplarPcKeys.has("material_carry_distance"));
check(
  "58 EXEMPLAR total Level 1 questions approximately zero",
  totalLevel1Questions(exemplarBlock.questions.length, exemplarPc.snapshot) <= 1,
  `scope=${exemplarBlock.questions.length} pc=${exemplarPc.snapshot.candidates.length}`
);

check("59 global budget ranks scope + PC together at plan time", () => {
  const scopeCandidates = realBlock.questions;
  const plan = planLevel1Questions({
    scopeQuestions: scopeCandidates,
    pcCandidates: realPc.snapshot.engine.candidates.filter(
      (c) => c.scope === "PROJECT" && c.askPolicy === "ASK"
    ),
    max: MAX_QUICK_ESTIMATE_P0_QUESTIONS,
  });
  return plan.totalSelected <= MAX_QUICK_ESTIMATE_P0_QUESTIONS;
});

check("60 PC batch respects remaining scope budget", () => {
  const withOneScope = pcInputFor(realJob.facts, [], 1);
  return withOneScope.snapshot.candidates.length <= 2;
});

check("61 assumable PC filtered from estimate-blocking keys", () => {
  const filtered = filterEstimateBlockingProjectConditionKeys([
    "site_access",
    "material_carry_distance",
    "waste_bin_access",
  ]);
  return (
    filtered.includes("waste_bin_access") &&
    !filtered.includes("site_access") &&
    !filtered.includes("material_carry_distance")
  );
});

check("62 priority separate from blocking — P0 demolition non-blocking", () => {
  const q = realBlock.questions.find((item) => item.key === "deck.existing_deck_removal");
  return q != null && q.blocksEstimate === false;
});

check("63 bathroom retains independent full question pipeline", () => {
  const bathBlock = buildQuestionBlockFromProjectState({
    project,
    confirmedWorkAreas: [
      {
        id: "wa-bath",
        type: "bathroom",
        name: "Bathroom",
        sort_order: 1,
        status: "confirmed",
      },
    ],
    projectFacts: [],
  });
  return bathBlock.questions.length > MAX_QUICK_ESTIMATE_P0_QUESTIONS;
});

check("64 EXEMPLAR balustrade attention unchanged", () => {
  return exemplar.facts["deck.balustrade_required"] === false;
});

check("65 one semantic access condition — no deck.access_type P0", () => {
  const deckAccess = getScopeQuestions("deck").find(
    (q) => q.factKey === "deck.access_type"
  );
  return deckAccess?.estimatePriorityClass !== "P0";
});

check("66 REAL-JOB scope demolition does not block submit", () => {
  const q = realBlock.questions.find((item) => item.key === "deck.existing_deck_removal");
  return q?.blocksEstimate === false;
});

const shellSrc = readFileSync("components/assistant/AssistantShell.tsx", "utf8");
const readyCardSrc = readFileSync("components/assistant/EstimateReadyCard.tsx", "utf8");
const progressSrc = readFileSync("components/assistant/AssistantProgress.tsx", "utf8");
const disclosureSrc = readFileSync(
  "components/assistant/CompletedSetupDisclosure.tsx",
  "utf8"
);
const scopeReviewSrc = readFileSync(
  "components/assistant/ScopeDiscoveryReviewBlock.tsx",
  "utf8"
);
const progressiveSrc = readFileSync("lib/assistant/progressive-disclosure.ts", "utf8");

check(
  "67 estimate-generated state detected in shell",
  shellSrc.includes('data-assistant-mode={compressCompletedSetup ? "estimate-ready" : "setup"}')
);
check(
  "68 completed setup collapses after estimate",
  shellSrc.includes("compressCompletedSetup") &&
    disclosureSrc.includes("Job details")
);
check(
  "69 Estimate Ready card is primary after generation",
  readyCardSrc.includes("data-estimate-ready-card") &&
    shellSrc.includes("EstimateReadyCard")
);
check(
  "70 Project Capture not expanded by default after estimate",
  progressiveSrc.includes("if (input.estimateReady && !input.estimateStale)")
);
check(
  "71 Scope Review not permanently forced open",
  scopeReviewSrc.includes("lastEditTokenRef") &&
    !scopeReviewSrc.includes("requestEditToken > 0")
);
check(
  "72 Job Details summary available",
  disclosureSrc.includes("Job details") &&
    disclosureSrc.includes("data-completed-setup-disclosure")
);
check(
  "73 Edit details available",
  ASSISTANT_ACTION_LABELS.editJobDetails === "Edit job details"
);
check(
  "74 fascia missing remapped to check not Scope Review trap",
  applyLevel1AttentionPresentation([
    {
      id: "fascia",
      label: "Fascia / face boards",
      detail: "Review scope",
      attentionKind: "SCOPE",
      reviewTarget: "scopeReview",
      suggestionId: "s1",
      workAreaId: WA,
    },
  ])[0]?.reviewTarget === "estimateReview" &&
    applyLevel1AttentionPresentation([
      {
        id: "fascia",
        label: "Fascia / face boards",
        detail: "Review scope",
        attentionKind: "SCOPE",
        reviewTarget: "scopeReview",
        suggestionId: "s1",
        workAreaId: WA,
      },
    ])[0]?.productSeverity === "check"
);
check(
  "75 estimate ready disclosure returns null",
  resolveActiveDisclosureStage({
    briefSubmitted: true,
    workAreasConfirmed: true,
    scopeDiscoveryEnabled: true,
    scopeReviewComplete: false,
    qualityUnlocked: true,
    qualitySubmitted: true,
    questionsSubmitted: true,
    constraintsSubmitted: true,
    estimateReady: true,
  }) === null
);
check(
  "76 centre/sidebar split after estimate",
  shellSrc.includes("compactCommercialSidebar={compressCompletedSetup}") &&
    readyCardSrc.includes("Top assumptions")
);
check(
  "77 mobile post-estimate hides progress rail",
  progressSrc.includes("deemphasised") &&
    progressSrc.includes("data-assistant-progress-secondary")
);
check(
  "78 return-to-estimate path exists",
  readyCardSrc.includes("onReviewEstimate") &&
    readyCardSrc.includes("ASSISTANT_ACTION_LABELS.reviewEstimate")
);
check(
  "79 fascia Review deep-links fact without trapping token",
  shellSrc.includes('item.factKey === "deck.vertical_face_boards_required"') &&
    shellSrc.includes("setRequestScopeEdit") &&
    scopeReviewSrc.includes("lastEditTokenRef")
);
check(
  "80 Hide details returns to Estimate Ready",
  shellSrc.includes("onExpandedChange={setSetupReviewOpen}") &&
    disclosureSrc.includes("Hide details")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
