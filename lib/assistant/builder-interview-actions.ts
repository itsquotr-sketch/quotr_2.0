"use server";

/**
 * Stage 3.2.2 — Batch save for Project Conditions (project/site CONSTRAINT writes).
 *
 * No migration. No service role. Client must not supply orgId.
 * Assumptions are NOT persisted as user Constraints in 3.2.2 (deferred to 3.2.4).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  buildLiveProjectConditionsSnapshot,
} from "@/lib/assistant/builder-interview-live";
import { getRegistryQuestion } from "@/lib/builder-interview/registry";
import {
  evaluateProposedUserAnswer,
  isMeaningfulKnownValue,
  resolveConstraintEvidence,
} from "@/lib/builder-interview/authority";
import { isReservedConstraintKey } from "@/lib/scopes/domain-ownership";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";
import { upsertProjectConstraintRecord } from "@/lib/assistant/scope-persistence";
import { completeAssistantMutation } from "@/lib/assistant/complete-assistant-mutation";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import type { AssistantMutationResult, ConstraintRow } from "@/lib/assistant/types";
import type {
  InterviewCandidate,
  InterviewReadiness,
} from "@/lib/builder-interview/types";

function toSafeAssistantError(fallback: string): string {
  return fallback;
}
const answerKindSchema = z.enum([
  "answer",
  "not_sure",
  "assume",
  "skip",
]);

const answerItemSchema = z.object({
  questionKey: z.string().min(1),
  kind: answerKindSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Required when replacing an existing explicit user value (D13). */
  confirmReplace: z.boolean().optional(),
});

export type BuilderInterviewAnswerItem = z.infer<typeof answerItemSchema>;

export type BuilderInterviewItemResult =
  | {
      questionKey: string;
      status: "saved" | "unchanged" | "skipped" | "not_sure" | "assumption_deferred";
    }
  | {
      questionKey: string;
      status: "conflict";
      existingDisplayValue: string;
      proposedDisplayValue: string;
    }
  | {
      questionKey: string;
      status: "error";
      message: string;
    };

export type SaveBuilderInterviewProjectAnswersResult = {
  error?: string;
  success?: boolean;
  items: BuilderInterviewItemResult[];
  savedCount: number;
  failedCount: number;
  conflictCount: number;
  constraints: ConstraintRow[];
  candidates: InterviewCandidate[];
  remainingCount: number;
  readiness: InterviewReadiness;
  complete: boolean;
  assistantMutation?: AssistantMutationResult;
  recoveryRefresh?: boolean;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function revalidateProjectPaths(projectId: string): void {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/dashboard");
}

/**
 * Batch-save Project Conditions answers into the constraints table.
 * Recomputes project-scope candidates once after the batch.
 */
export async function saveBuilderInterviewProjectAnswers(input: {
  projectId: string;
  answers: BuilderInterviewAnswerItem[];
}): Promise<SaveBuilderInterviewProjectAnswersResult> {
  const emptyFail = (
    error: string
  ): SaveBuilderInterviewProjectAnswersResult => ({
    error,
    items: [],
    savedCount: 0,
    failedCount: 0,
    conflictCount: 0,
    constraints: [],
    candidates: [],
    remainingCount: 0,
    readiness: {
      state: "NEEDS_IMPORTANT_INFORMATION",
      reasons: [error],
      blockingCandidateKeys: [],
      assumptionCandidateKeys: [],
      openP0Keys: [],
      openP1Keys: [],
      canGenerateQuickEstimate: false,
      softBlockQuickEstimate: true,
    },
    complete: false,
  });

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      answers: z.array(answerItemSchema).max(12),
    })
    .safeParse(input);

  if (!parsed.success) {
    return emptyFail("Invalid answers.");
  }

  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return emptyFail(toSafeAssistantError(auth.error));
  }

  const owned = await assertOrgOwnsActiveProject(auth, parsed.data.projectId);
  if ("error" in owned) {
    return emptyFail(toSafeAssistantError(owned.error));
  }

  const { supabase, orgId } = auth;
  const projectId = parsed.data.projectId;
  const items: BuilderInterviewItemResult[] = [];
  let savedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;

  for (const answer of parsed.data.answers) {
    const def = getRegistryQuestion(answer.questionKey);
    if (!def) {
      items.push({
        questionKey: answer.questionKey,
        status: "error",
        message: "Unknown question.",
      });
      failedCount += 1;
      continue;
    }

    if (def.scope !== "PROJECT" || def.writeTarget !== "CONSTRAINT") {
      items.push({
        questionKey: answer.questionKey,
        status: "error",
        message: "This question is not available yet.",
      });
      failedCount += 1;
      continue;
    }

    if (!isReservedConstraintKey(def.targetKey)) {
      items.push({
        questionKey: answer.questionKey,
        status: "error",
        message: "Invalid condition key.",
      });
      failedCount += 1;
      continue;
    }

    if (answer.kind === "skip") {
      items.push({ questionKey: answer.questionKey, status: "skipped" });
      continue;
    }

    if (answer.kind === "not_sure") {
      // Explicit unknown — do not fabricate a value (D5 / 3.2.2).
      items.push({ questionKey: answer.questionKey, status: "not_sure" });
      continue;
    }

    if (answer.kind === "assume") {
      // Durable assumption writes deferred to 3.2.4 — do not fake as user Constraint.
      items.push({
        questionKey: answer.questionKey,
        status: "assumption_deferred",
      });
      continue;
    }

    // kind === answer
    if (answer.value === undefined || !isMeaningfulKnownValue(answer.value)) {
      items.push({
        questionKey: answer.questionKey,
        status: "error",
        message: "Please provide an answer.",
      });
      failedCount += 1;
      continue;
    }

    const inputType =
      def.inputType === "multi_select" ? "text" : def.inputType;
    const storedValue = normalizeAnswerForStorage(
      answer.value as string | number | boolean | string[],
      inputType
    );

    const { data: existing } = await supabase
      .from("constraints")
      .select("id, key, label, value, source")
      .eq("project_id", projectId)
      .eq("key", def.targetKey)
      .maybeSingle();

    const evidence = resolveConstraintEvidence(
      existing
        ? [
            {
              key: existing.key,
              value: existing.value,
              source: existing.source,
            },
          ]
        : [],
      def.targetKey
    );

    const conflict = evaluateProposedUserAnswer({
      existing: evidence,
      proposedValue: storedValue,
    });

    if (conflict.requiresConflictConfirm && !answer.confirmReplace) {
      items.push({
        questionKey: answer.questionKey,
        status: "conflict",
        existingDisplayValue: displayValue(evidence.value),
        proposedDisplayValue: displayValue(storedValue),
      });
      conflictCount += 1;
      continue;
    }

    if (
      evidence.state === "KNOWN" &&
      evidence.source === "user" &&
      !conflict.requiresConflictConfirm
    ) {
      // Identical user value
      items.push({ questionKey: answer.questionKey, status: "unchanged" });
      continue;
    }

    const write = await upsertProjectConstraintRecord(supabase, {
      orgId,
      projectId,
      key: def.targetKey,
      label: def.question,
      value: storedValue,
      source: "user",
    });

    if (!write.ok) {
      items.push({
        questionKey: answer.questionKey,
        status: "error",
        message: "Could not save this answer.",
      });
      failedCount += 1;
      continue;
    }

    items.push({ questionKey: answer.questionKey, status: "saved" });
    savedCount += 1;
  }

  // Reload constraints + facts for one recompute
  const [{ data: constraintRows }, { data: factRows }, { data: workAreas }, { data: project }] =
    await Promise.all([
      supabase
        .from("constraints")
        .select("id, key, label, value, source, created_at")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true }),
      supabase
        .from("project_facts")
        .select("key, work_area_id, value, source")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
      supabase
        .from("work_areas")
        .select("id, type, name, status, sort_order")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("projects")
        .select("quality_level, stage")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
    ]);

  const constraints: ConstraintRow[] = (constraintRows ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    value:
      typeof row.value === "string" ||
      typeof row.value === "number" ||
      typeof row.value === "boolean"
        ? row.value
        : String(row.value ?? ""),
    source: row.source ?? null,
  }));

  const snapshot = buildLiveProjectConditionsSnapshot({
    projectId,
    qualityLevel: project?.quality_level ?? null,
    workAreas: (workAreas ?? []).map((wa) => ({
      id: wa.id,
      type: wa.type,
      name: wa.name,
      status: wa.status as "suggested" | "confirmed" | "excluded",
    })),
    facts: (factRows ?? []).map((f) => ({
      key: f.key,
      workAreaId: f.work_area_id,
      value: f.value,
      source: f.source ?? null,
    })),
    constraints,
  });

  if (savedCount > 0) {
    await markEstimateStaleWithContext(auth, projectId);
    revalidateProjectPaths(projectId);
  }

  if (
    snapshot.readiness.canGenerateQuickEstimate &&
    project?.stage === "constraints"
  ) {
    await supabase
      .from("projects")
      .update({ stage: "ready_to_estimate" })
      .eq("id", projectId)
      .eq("org_id", orgId);
    revalidateProjectPaths(projectId);
  }

  const allOk =
    failedCount === 0 &&
    conflictCount === 0 &&
    items.every(
      (i) =>
        i.status === "saved" ||
        i.status === "unchanged" ||
        i.status === "skipped" ||
        i.status === "not_sure" ||
        i.status === "assumption_deferred"
    );

  const mutationState = await completeAssistantMutation(auth, projectId);

  return {
    success: allOk,
    error:
      failedCount > 0
        ? "Some answers could not be saved."
        : conflictCount > 0
          ? "Confirm changes before saving."
          : undefined,
    items,
    savedCount,
    failedCount,
    conflictCount,
    constraints,
    candidates: [...snapshot.candidates],
    remainingCount: snapshot.remainingCount,
    readiness: snapshot.readiness,
    complete: snapshot.complete,
    assistantMutation: mutationState.assistantMutation,
    recoveryRefresh: mutationState.recoveryRefresh,
  };
}
