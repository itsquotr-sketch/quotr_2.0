/**
 * Stage 3.2.1 — Deterministic Builder Interview candidate engine (pure).
 *
 * Same input → same ordered output. No DB, AI, server, or persistence.
 */

import { classifyAssumptions } from "@/lib/builder-interview/assumptions";
import {
  assertWriteTargetNamespace,
  evidenceSuppressesAsk,
  evaluateProposedUserAnswer,
  resolveTargetEvidence,
} from "@/lib/builder-interview/authority";
import {
  evaluateLocalOverride,
  evaluateTriggers,
  readParentFactBoolean,
  type TriggerContext,
} from "@/lib/builder-interview/domain-rules/triggers";
import { rankCandidates } from "@/lib/builder-interview/ranking";
import { deriveInterviewReadiness } from "@/lib/builder-interview/readiness";
import { INTERVIEW_QUESTION_REGISTRY } from "@/lib/builder-interview/registry";
import { isProjectTopicKnown } from "@/lib/builder-interview/suppression";
import {
  INTERVIEW_REGISTRY_VERSION,
  type BuilderInterviewInput,
  type BuilderInterviewResult,
  type InterviewCandidate,
  type InterviewWorkAreaInput,
  type RegistryQuestionDef,
  type SuppressedCandidate,
} from "@/lib/builder-interview/types";
import { getRegistryQuestion } from "@/lib/builder-interview/registry";

const RECOMPUTE_NOTE =
  "Caller-controlled recompute (D15): initial load, batch save, relevant WA/scope/constraint change, presentation/stage boundary — not per keystroke.";

function confirmedWorkAreas(
  input: BuilderInterviewInput
): InterviewWorkAreaInput[] {
  return input.workAreas
    .filter((w) => w.status === "confirmed")
    .slice()
    .sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.id.localeCompare(b.id);
    });
}

function pushSuppressed(
  list: SuppressedCandidate[],
  params: Omit<SuppressedCandidate, "evidenceState"> & {
    evidenceState?: SuppressedCandidate["evidenceState"];
  }
): void {
  list.push({
    evidenceState: params.evidenceState ?? "SUPPRESSED",
    questionKey: params.questionKey,
    workAreaId: params.workAreaId,
    semanticTopic: params.semanticTopic,
    askPolicy: params.askPolicy,
    suppressionReason: params.suppressionReason,
    suppressionCode: params.suppressionCode,
  });
}

function parentLookupFactory(input: BuilderInterviewInput) {
  return (parentQuestionKey: string): "true" | "false" | "unknown" => {
    const parent = getRegistryQuestion(parentQuestionKey);
    if (!parent) return "unknown";
    if (parent.writeTarget === "FACT") {
      // Prefer any confirmed WA of parent type
      const wa = input.workAreas.find(
        (w) =>
          w.status === "confirmed" &&
          (!parent.workAreaType || w.type === parent.workAreaType)
      );
      return readParentFactBoolean({
        input,
        factKey: parent.targetKey,
        workAreaId: wa?.id ?? null,
      });
    }
    if (parent.writeTarget === "CONSTRAINT") {
      const row = input.constraints.find((c) => c.key === parent.targetKey);
      if (!row) return "unknown";
      return readParentFactBoolean({
        input: {
          ...input,
          facts: [
            {
              key: parent.targetKey,
              workAreaId: null,
              value: row.value,
              source: row.source,
            },
          ],
        },
        factKey: parent.targetKey,
        workAreaId: null,
      });
    }
    return "unknown";
  };
}

function expandDefsForWorkAreas(
  def: RegistryQuestionDef,
  confirmed: readonly InterviewWorkAreaInput[]
): Array<{ def: RegistryQuestionDef; workArea?: InterviewWorkAreaInput }> {
  if (def.scope === "PROJECT") {
    return [{ def }];
  }
  const type = def.workAreaType;
  if (!type) return [];
  return confirmed
    .filter((w) => w.type === type)
    .map((workArea) => ({ def, workArea }));
}

function evaluateOne(params: {
  def: RegistryQuestionDef;
  workArea?: InterviewWorkAreaInput;
  input: BuilderInterviewInput;
  confirmed: readonly InterviewWorkAreaInput[];
  confirmedTypes: ReadonlySet<string>;
  parentLookup: (k: string) => "true" | "false" | "unknown";
  suppressed: SuppressedCandidate[];
}): InterviewCandidate | null {
  const { def, workArea, input, confirmed, confirmedTypes, parentLookup, suppressed } =
    params;

  const namespace = assertWriteTargetNamespace({
    writeTarget: def.writeTarget,
    targetKey: def.targetKey,
  });
  if (!namespace.ok) {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: namespace.error,
      suppressionCode: "NAMESPACE_INVALID",
    });
    return null;
  }

  // Policy surfaces that never ASK
  if (def.askPolicy === "DEFER") {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: `DEFER to ${def.ownedBy ?? "another surface"}`,
      suppressionCode: "POLICY_DEFER",
    });
    return null;
  }
  if (def.askPolicy === "FLAG") {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: `FLAG to ${def.ownedBy ?? "Scope Review"}`,
      suppressionCode: "POLICY_FLAG",
    });
    return null;
  }
  if (def.askPolicy === "ASSUME") {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: "ASSUME policy — not presented as ASK",
      suppressionCode: "POLICY_ASSUME",
    });
    return null;
  }
  if (def.askPolicy === "BENCHMARK") {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: "BENCHMARK policy — not presented as ASK",
      suppressionCode: "POLICY_BENCHMARK",
    });
    return null;
  }

  // WA absence / exclusion
  if (def.scope === "WORK_AREA") {
    if (!workArea) {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: "No matching confirmed work area",
        suppressionCode: "WORK_AREA_ABSENT",
      });
      return null;
    }
    if (workArea.status === "excluded") {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: "Work area excluded",
        suppressionCode: "WORK_AREA_EXCLUDED",
      });
      return null;
    }
  }

  // Scope item exclusion
  const excludedTypes = new Set(input.excludedScopeItemTypes ?? []);
  if (excludedTypes.has(def.targetKey)) {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: `Scope item type excluded: ${def.targetKey}`,
      suppressionCode: "SCOPE_ITEM_EXCLUDED",
    });
    return null;
  }
  if (input.scopeItems?.length) {
    const related = input.scopeItems.filter(
      (s) =>
        s.type === def.targetKey ||
        (workArea && s.workAreaId === workArea.id && !s.included)
    );
    if (related.some((s) => s.type === def.targetKey && !s.included)) {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea?.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: "Related scope item not included",
        suppressionCode: "SCOPE_ITEM_EXCLUDED",
      });
      return null;
    }
  }

  const triggerCtx: TriggerContext = {
    input,
    confirmedWorkAreas: confirmed,
    confirmedTypes,
    workArea,
  };
  const trigger = evaluateTriggers(def.triggerRuleIds, triggerCtx);
  if (!trigger.ok) {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: trigger.reason,
      suppressionCode: "TRIGGER_FALSE",
    });
    return null;
  }

  // Conditional parent
  if (def.dependsOnQuestionKey) {
    const parentState = parentLookup(def.dependsOnQuestionKey);
    if (parentState === "false") {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea?.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: `Parent ${def.dependsOnQuestionKey} false`,
        suppressionCode: "CONDITIONAL_PARENT",
      });
      return null;
    }
    if (parentState === "unknown") {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea?.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: `Parent ${def.dependsOnQuestionKey} unknown — child omitted`,
        suppressionCode: "CONDITIONAL_PARENT",
      });
      return null;
    }
  }

  const evidence = resolveTargetEvidence({
    writeTarget: def.writeTarget,
    targetKey: def.targetKey,
    workAreaId: workArea?.id ?? null,
    facts: input.facts,
    constraints: input.constraints,
  });

  // Target already known (including lower-authority evidence) → suppress ASK
  if (evidenceSuppressesAsk(evidence.state)) {
    pushSuppressed(suppressed, {
      questionKey: def.questionKey,
      workAreaId: workArea?.id,
      semanticTopic: def.semanticTopic,
      askPolicy: def.askPolicy,
      suppressionReason: `Target ${def.targetKey} already known (${evidence.state}/${evidence.source ?? "none"})`,
      suppressionCode: "TARGET_KNOWN",
      evidenceState: evidence.state,
    });
    return null;
  }

  // Project-wide topic suppresses WA clones
  if (
    def.scope === "WORK_AREA" &&
    isProjectTopicKnown(input, def.semanticTopic)
  ) {
    if (def.requiresLocalOverride && workArea) {
      const override = evaluateLocalOverride({
        semanticTopic: def.semanticTopic,
        workArea,
        input,
      });
      if (!override.allow) {
        pushSuppressed(suppressed, {
          questionKey: def.questionKey,
          workAreaId: workArea.id,
          semanticTopic: def.semanticTopic,
          askPolicy: def.askPolicy,
          suppressionReason: `Project topic ${def.semanticTopic} known; ${override.reason}`,
          suppressionCode: "PROJECT_TOPIC_SUPPRESSED",
        });
        return null;
      }
      // override allowed — continue to emit
    } else {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea?.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: `Project-wide topic ${def.semanticTopic} already known`,
        suppressionCode: "PROJECT_TOPIC_SUPPRESSED",
      });
      return null;
    }
  } else if (def.requiresLocalOverride && workArea) {
    // Requires override but project topic not known — still require override for clones
    // so we don't fan out 7× access asks when project unanswered.
    // Product rule (D8/Fitout): project logistics asked once; WA clones only with override.
    const override = evaluateLocalOverride({
      semanticTopic: def.semanticTopic,
      workArea,
      input,
    });
    if (!override.allow) {
      pushSuppressed(suppressed, {
        questionKey: def.questionKey,
        workAreaId: workArea.id,
        semanticTopic: def.semanticTopic,
        askPolicy: def.askPolicy,
        suppressionReason: `WA clone requires explicit override; ${override.reason}`,
        suppressionCode: "OVERRIDE_NOT_MET",
      });
      return null;
    }
  }

  let proposedWriteRequiresConflictConfirm = false;
  let evidenceState = evidence.state;
  const proposed = input.proposedAnswers?.[def.questionKey];
  if (proposed !== undefined) {
    const conflict = evaluateProposedUserAnswer({
      existing: evidence,
      proposedValue: proposed,
    });
    evidenceState = conflict.evidenceState;
    proposedWriteRequiresConflictConfirm = conflict.requiresConflictConfirm;
  }

  const ruleId = `${def.triggerRuleIds.join("+")}|${def.questionKey}`;

  const candidate: InterviewCandidate = {
    questionKey: def.questionKey,
    version: def.version,
    domain: def.domain,
    scope: def.scope,
    workAreaId: workArea?.id,
    workAreaType: workArea?.type ?? def.workAreaType,
    writeTarget: def.writeTarget,
    targetKey: def.targetKey,
    semanticTopic: def.semanticTopic,
    question: def.question,
    inputType: def.inputType,
    options: def.options,
    priority: def.priority,
    askPolicy: def.askPolicy,
    reasonForAsking: def.reasonForAsking,
    impact: def.impact,
    answerability: def.answerability,
    evidenceState,
    proposedWriteRequiresConflictConfirm,
    triggerRuleId: ruleId,
    provenance: {
      registryVersion: INTERVIEW_REGISTRY_VERSION,
      ruleId,
    },
  };

  return candidate;
}

/**
 * Build deterministic Builder Interview candidates + readiness diagnostics.
 */
export function buildBuilderInterviewCandidates(
  input: BuilderInterviewInput
): BuilderInterviewResult {
  const confirmed = confirmedWorkAreas(input);
  const confirmedTypes = new Set(confirmed.map((w) => w.type));
  const parentLookup = parentLookupFactory(input);
  const suppressed: SuppressedCandidate[] = [];
  const rawCandidates: InterviewCandidate[] = [];

  const registryOrderByKey = new Map(
    INTERVIEW_QUESTION_REGISTRY.map((q) => [q.questionKey, q.registryOrder])
  );

  for (const def of INTERVIEW_QUESTION_REGISTRY) {
    const expansions = expandDefsForWorkAreas(def, confirmed);
    if (def.scope === "WORK_AREA" && expansions.length === 0) {
      // Record absence once per def
      if (def.askPolicy === "ASK") {
        pushSuppressed(suppressed, {
          questionKey: def.questionKey,
          semanticTopic: def.semanticTopic,
          askPolicy: def.askPolicy,
          suppressionReason: `No confirmed work area of type ${def.workAreaType}`,
          suppressionCode: "WORK_AREA_ABSENT",
        });
      } else if (def.askPolicy === "DEFER" || def.askPolicy === "FLAG") {
        pushSuppressed(suppressed, {
          questionKey: def.questionKey,
          semanticTopic: def.semanticTopic,
          askPolicy: def.askPolicy,
          suppressionReason: `${def.askPolicy} — no matching WA (still not ASK)`,
          suppressionCode:
            def.askPolicy === "DEFER" ? "POLICY_DEFER" : "POLICY_FLAG",
        });
      }
      continue;
    }

    for (const { def: d, workArea } of expansions) {
      const candidate = evaluateOne({
        def: d,
        workArea,
        input,
        confirmed,
        confirmedTypes,
        parentLookup,
        suppressed,
      });
      if (candidate) rawCandidates.push(candidate);
    }
  }

  const candidates = rankCandidates(rawCandidates, registryOrderByKey);
  const assumptionClassifications = classifyAssumptions(input);
  const readiness = deriveInterviewReadiness({
    candidates,
    assumptionClassifications,
  });

  // Stable suppressed order for determinism
  suppressed.sort((a, b) => {
    const k = a.questionKey.localeCompare(b.questionKey);
    if (k !== 0) return k;
    return (a.workAreaId ?? "").localeCompare(b.workAreaId ?? "");
  });

  return {
    candidates,
    suppressed,
    readiness,
    diagnostics: {
      registryVersion: INTERVIEW_REGISTRY_VERSION,
      candidateCount: candidates.length,
      suppressedCount: suppressed.length,
      confirmedWorkAreaCount: confirmed.length,
      assumptionClassifications,
      recomputeNote: RECOMPUTE_NOTE,
    },
  };
}
