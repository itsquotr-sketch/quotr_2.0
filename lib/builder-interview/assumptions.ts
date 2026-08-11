/**
 * Stage 3.2.1 — Assumption relevance / invalidation classification (pure).
 */

import {
  evidenceSuppressesAsk,
  isMeaningfulKnownValue,
  resolveTargetEvidence,
} from "@/lib/builder-interview/authority";
import { isProjectTopicKnown } from "@/lib/builder-interview/suppression";
import { getRegistryQuestion } from "@/lib/builder-interview/registry";
import { readParentFactBoolean } from "@/lib/builder-interview/domain-rules/triggers";
import type {
  AssumptionStatus,
  BuilderInterviewInput,
  ClassifiedAssumption,
  InterviewAssumptionInput,
} from "@/lib/builder-interview/types";

export function classifyAssumption(
  assumption: InterviewAssumptionInput,
  input: BuilderInterviewInput
): ClassifiedAssumption {
  const def = getRegistryQuestion(assumption.questionKey);

  // WA removed / excluded
  if (assumption.workAreaId) {
    const wa = input.workAreas.find((w) => w.id === assumption.workAreaId);
    if (!wa) {
      return {
        questionKey: assumption.questionKey,
        status: "WORK_AREA_REMOVED",
        reason: "Assumption work area no longer present",
      };
    }
    if (wa.status === "excluded") {
      return {
        questionKey: assumption.questionKey,
        status: "WORK_AREA_REMOVED",
        reason: "Assumption work area is excluded",
      };
    }
  }

  // Scope exclusion for DEF entries that declare scope ownership
  if (def?.ownedBy === "SCOPE_REVIEW" || def?.semanticTopic === "scope.existence") {
    const excluded = new Set(input.excludedScopeItemTypes ?? []);
    if (def.targetKey && excluded.has(def.targetKey)) {
      return {
        questionKey: assumption.questionKey,
        status: "SCOPE_EXCLUDED",
        reason: "Related scope item excluded",
      };
    }
  }

  // Conditional parent false
  if (def?.dependsOnQuestionKey) {
    const parentDef = getRegistryQuestion(def.dependsOnQuestionKey);
    if (parentDef?.writeTarget === "FACT") {
      const parentState = readParentFactBoolean({
        input,
        factKey: parentDef.targetKey,
        workAreaId: assumption.workAreaId ?? null,
      });
      if (parentState === "false") {
        return {
          questionKey: assumption.questionKey,
          status: "CONDITIONAL_PARENT_FALSE",
          reason: `Parent ${def.dependsOnQuestionKey} is false`,
        };
      }
    }
  }

  // Project-wide suppresses local WA assumption on same topic
  const topic = assumption.semanticTopic ?? def?.semanticTopic;
  if (
    topic &&
    assumption.workAreaId &&
    isProjectTopicKnown(input, topic)
  ) {
    return {
      questionKey: assumption.questionKey,
      status: "PROJECT_SUPPRESSED",
      reason: `Project-wide topic ${topic} now known`,
    };
  }

  // Trigger no longer applies — WA type missing for WA-scoped registry entry
  if (def?.scope === "WORK_AREA" && def.workAreaType) {
    const stillPresent = input.workAreas.some(
      (w) => w.type === def.workAreaType && w.status === "confirmed"
    );
    if (!stillPresent) {
      return {
        questionKey: assumption.questionKey,
        status: "TRIGGER_NO_LONGER_APPLIES",
        reason: `No confirmed ${def.workAreaType} work area`,
      };
    }
  }

  // Superseded by more authoritative evidence on target
  const targetKey = assumption.targetKey ?? def?.targetKey;
  const writeTarget = assumption.writeTarget ?? def?.writeTarget;
  if (targetKey && writeTarget && (writeTarget === "FACT" || writeTarget === "CONSTRAINT")) {
    const evidence = resolveTargetEvidence({
      writeTarget,
      targetKey,
      workAreaId: assumption.workAreaId ?? null,
      facts: input.facts,
      constraints: input.constraints,
    });
    if (
      evidence.state === "KNOWN" &&
      isMeaningfulKnownValue(evidence.value) &&
      evidence.source === "user"
    ) {
      return {
        questionKey: assumption.questionKey,
        status: "SUPERSEDED",
        reason: "User-authoritative evidence now present on target",
      };
    }
    if (evidenceSuppressesAsk(evidence.state) && evidence.source !== "assumption") {
      // ai/default/system/derived with meaningful value supersedes assumption for readiness
      if (evidence.state === "KNOWN" || evidence.state === "LOWER_AUTHORITY_EVIDENCE" || evidence.state === "DERIVED") {
        if (evidence.source && evidence.source !== "assumption") {
          return {
            questionKey: assumption.questionKey,
            status: "SUPERSEDED",
            reason: `Target now has ${evidence.source} evidence`,
          };
        }
      }
    }
  }

  return {
    questionKey: assumption.questionKey,
    status: "CURRENT",
    reason: "Assumption remains applicable",
  };
}

export function classifyAssumptions(
  input: BuilderInterviewInput
): ClassifiedAssumption[] {
  return (input.existingAssumptions ?? []).map((a) =>
    classifyAssumption(a, input)
  );
}

export function isCurrentAssumption(status: AssumptionStatus): boolean {
  return status === "CURRENT";
}
