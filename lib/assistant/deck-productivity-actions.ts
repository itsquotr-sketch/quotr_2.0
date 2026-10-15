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

const priorSchema = z.object({
  key: z.string().min(1),
  id: z.string().min(1).nullable(),
  value: z.unknown(),
  source: z.string().nullable(),
});

const restoreSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
  wasStale: z.boolean(),
  priors: z.array(priorSchema).max(16),
});

export type ProductivityFactPrior = z.infer<typeof priorSchema>;

type PriorFact = ProductivityFactPrior;

function choiceOf(row: z.infer<typeof decisionSchema>): DeckProductivityChoice {
  if (row.choice === "job") return { kind: "job", hours: row.jobHours ?? 0 };
  if (row.choice === "benchmark") return { kind: "benchmark" };
  return { kind: "calibration" };
}

async function ownedProject(
  projectId: string
): Promise<
  | { error: string }
  | {
      supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"];
      orgId: string;
      userId: string;
    }
> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Not authenticated." };
  const { supabase, orgId, user } = context;
  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return { error: denied.error ?? "You cannot edit this project." };
  const owned = await assertOrgOwnsActiveProjectWithStage(context, projectId);
  if ("error" in owned) return { error: owned.error };
  return { supabase, orgId, userId: user.id };
}

async function writePriorsBack(input: {
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"];
  orgId: string;
  projectId: string;
  workAreaId: string;
  priors: readonly PriorFact[];
  wasStale: boolean;
}): Promise<void> {
  for (const prior of input.priors) {
    if (!prior.id) {
      await input.supabase
        .from("project_facts")
        .delete()
        .eq("project_id", input.projectId)
        .eq("org_id", input.orgId)
        .eq("work_area_id", input.workAreaId)
        .eq("key", prior.key);
      continue;
    }
    await input.supabase
      .from("project_facts")
      .update({ value: prior.value, source: prior.source })
      .eq("id", prior.id)
      .eq("org_id", input.orgId);
  }
  await input.supabase
    .from("estimates")
    .update({ is_stale: input.wasStale })
    .eq("project_id", input.projectId)
    .eq("org_id", input.orgId);
}

/**
 * Save every held line for this job. Does not regenerate and does not
 * change organisation rates. The current estimate is marked stale so it
 * is not treated as the updated result before regeneration.
 */
export async function saveDeckProductivityDecisions(
  input: z.infer<typeof applySchema>
): Promise<
  | { error: string }
  | { ok: true; priors: ProductivityFactPrior[]; wasStale: boolean }
> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose one option for every held line before updating the estimate." };
  }
  const owned = await ownedProject(parsed.data.projectId);
  if ("error" in owned) return owned;
  const { supabase, orgId } = owned;
  const projectId = parsed.data.projectId;
  const workAreaId = parsed.data.workAreaId;

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
    .select("notes")
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
          typeof line.notes === "string" &&
          line.notes.includes(DECK_PRODUCTIVITY_SCOPE_REVIEW) &&
          line.notes.includes(`fact=${row.factKey}`) &&
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

  const priors: ProductivityFactPrior[] = [];
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

  for (const write of plan.writes) {
    const saved = await commitUserFactEdit(supabase, {
      orgId,
      projectId,
      workAreaId,
      key: write.key,
      label: write.label,
      value: write.value,
      valueType: "text",
    });
    if (!saved.ok) {
      await writePriorsBack({
        supabase,
        orgId,
        projectId,
        workAreaId,
        priors,
        wasStale: Boolean(estimate.is_stale),
      });
      return { error: saved.error || "The productivity choice was not saved." };
    }
  }

  const { error: staleError } = await supabase
    .from("estimates")
    .update({ is_stale: true })
    .eq("id", estimate.id)
    .eq("org_id", orgId);
  if (staleError) {
    await writePriorsBack({
      supabase,
      orgId,
      projectId,
      workAreaId,
      priors,
      wasStale: Boolean(estimate.is_stale),
    });
    return { error: "The productivity choice was not saved." };
  }

  return { ok: true, priors, wasStale: Boolean(estimate.is_stale) };
}

/** Put the job facts and stale flag back. Organisation rates are not changed. */
export async function restoreDeckProductivityDecisions(
  input: z.infer<typeof restoreSchema>
): Promise<{ error?: string }> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { error: "The productivity choice was not saved." };
  const owned = await ownedProject(parsed.data.projectId);
  if ("error" in owned) return owned;
  await writePriorsBack({
    supabase: owned.supabase,
    orgId: owned.orgId,
    projectId: parsed.data.projectId,
    workAreaId: parsed.data.workAreaId,
    priors: parsed.data.priors,
    wasStale: parsed.data.wasStale,
  });
  return {};
}

/**
 * Save every held line for this job, then regenerate once.
 * A failed line or regeneration restores the earlier writes.
 * Organisation rates are not updated.
 */
export async function applyDeckProductivityDecisions(
  input: z.infer<typeof applySchema>
): Promise<AssistantActionState> {
  const saved = await saveDeckProductivityDecisions(input);
  if ("error" in saved) return { error: saved.error };
  const regenerated = await regenerateStaticEstimate(input.projectId);
  if (regenerated.error && !regenerated.estimateGeneration) {
    await restoreDeckProductivityDecisions({
      projectId: input.projectId,
      workAreaId: input.workAreaId,
      priors: saved.priors,
      wasStale: saved.wasStale,
    });
    return { error: regenerated.error };
  }
  return regenerated;
}
