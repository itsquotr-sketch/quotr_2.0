"use server";

import { z } from "zod";
import { regenerateStaticEstimate } from "@/lib/assistant/actions";
import { commitUserFactEdit } from "@/lib/assistant/scope-persistence";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import {
  planDeckProductivityApply,
  type DeckProductivityChoice,
} from "@/lib/estimate/deck-productivity-apply";
import { DECK_PRODUCTIVITY_SCOPE_REVIEW } from "@/lib/estimate/deck-productivity-scope";
import { assertOrgOwnsActiveProjectWithStage } from "@/lib/security/org-ownership";
import { permissionDeniedError } from "@/lib/team/permission-server";

const decisionSchema = z.object({
  factKey: z.string().min(1),
  jobFactKey: z.string().min(1),
  expectedToken: z.string().min(1),
  itemKey: z.string().min(1),
  choice: z.enum(["calibration", "benchmark", "job"]),
  jobHours: z.number().positive().optional(),
});

const applySchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
  estimateId: z.string().uuid().optional(),
  decisions: z.array(decisionSchema).min(1).max(4),
});

type PriorFact = {
  readonly key: string;
  readonly id: string | null;
  readonly value: unknown;
  readonly source: string | null;
};

function choiceOf(row: z.infer<typeof decisionSchema>): DeckProductivityChoice {
  if (row.choice === "job") return { kind: "job", hours: row.jobHours ?? 0 };
  if (row.choice === "benchmark") return { kind: "benchmark" };
  return { kind: "calibration" };
}

/**
 * Save every held line for this job, then regenerate once.
 * A failed line restores the earlier writes. Organisation rates are not updated.
 */
export async function applyDeckProductivityDecisions(
  input: z.infer<typeof applySchema>
): Promise<AssistantActionState> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose one option for every held line before updating the estimate." };
  }

  const context = await getAuthOrgContext();
  if (!context) return { error: "Not authenticated." };
  const { supabase, orgId, user } = context;
  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return denied;

  const projectId = parsed.data.projectId;
  const workAreaId = parsed.data.workAreaId;
  const owned = await assertOrgOwnsActiveProjectWithStage(context, projectId);
  if ("error" in owned) return { error: owned.error };

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, is_stale")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (estimateError || !estimate) {
    return {
      error:
        "This estimate or the company calibration changed. Review the lines again before applying a choice. The organisation rate was not changed.",
    };
  }

  const { data: lines, error: lineError } = await supabase
    .from("estimate_line_items")
    .select("notes, item_key")
    .eq("estimate_id", estimate.id)
    .eq("org_id", orgId);
  if (lineError) {
    return { error: "The productivity review could not be checked. Try again." };
  }

  const { data: rates, error: rateError } = await supabase
    .from("rates")
    .select("item_key, cost_rate, active, rate_type")
    .eq("org_id", orgId)
    .eq("rate_type", "productivity")
    .eq("active", true);
  if (rateError) {
    return { error: "The productivity review could not be checked. Try again." };
  }

  const plan = planDeckProductivityApply({
    estimateStale:
      Boolean(estimate.is_stale) ||
      (parsed.data.estimateId != null && parsed.data.estimateId !== estimate.id),
    decisions: parsed.data.decisions.map((row) => {
      const notes = (lines ?? []).find(
        (line) =>
          line.item_key === row.itemKey &&
          typeof line.notes === "string" &&
          line.notes.includes(DECK_PRODUCTIVITY_SCOPE_REVIEW) &&
          line.notes.includes(`value=${row.expectedToken}`)
      );
      const rate = (rates ?? []).find((item) => item.item_key === row.itemKey);
      const hours = rate?.cost_rate == null ? null : Number(rate.cost_rate);
      return {
        id: row.factKey,
        factKey: row.factKey,
        jobFactKey: row.jobFactKey,
        expectedToken: row.expectedToken,
        itemKey: row.itemKey,
        choice: choiceOf(row),
        lineHeld: Boolean(notes),
        currentHours: hours != null && Number.isFinite(hours) ? hours : null,
      };
    }),
  });
  if (!plan.ok) return { error: plan.message };

  const priors: PriorFact[] = [];
  for (const write of plan.writes) {
    const { data: existing } = await supabase
      .from("project_facts")
      .select("id, value, source")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .eq("work_area_id", workAreaId)
      .eq("key", write.key)
      .maybeSingle();
    priors.push({
      key: write.key,
      id: existing?.id ?? null,
      value: existing?.value ?? null,
      source: existing?.source ?? null,
    });
  }

  async function restore(): Promise<void> {
    for (const prior of priors) {
      if (!prior.id) {
        await supabase
          .from("project_facts")
          .delete()
          .eq("project_id", projectId)
          .eq("org_id", orgId)
          .eq("work_area_id", workAreaId)
          .eq("key", prior.key);
        continue;
      }
      await supabase
        .from("project_facts")
        .update({ value: prior.value, source: prior.source })
        .eq("id", prior.id)
        .eq("org_id", orgId);
    }
  }

  for (const write of plan.writes) {
    const saved = await commitUserFactEdit(supabase, {
      orgId,
      projectId: parsed.data.projectId,
      workAreaId,
      key: write.key,
      label: write.label,
      value: write.value,
      valueType: "text",
    });
    if (!saved.ok) {
      await restore();
      return { error: saved.error || "The productivity choice was not saved." };
    }
  }

  const regenerated = await regenerateStaticEstimate(projectId);
  if (regenerated.error && !regenerated.estimateGeneration) {
    await restore();
    return { error: regenerated.error };
  }
  return regenerated;
}
