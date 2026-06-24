"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  extractFromSiteNotes,
  NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
  NOTE_ANALYSIS_PARSE_USER_MESSAGE,
} from "@/lib/ai/extract-notes";
import { AIExtractionError } from "@/lib/ai/schema";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import { markEstimateStale } from "@/lib/estimate/stale";
import { getProjectNoteTypeLabel, isInternalProjectNote } from "@/lib/project-notes/types";
import {
  mapExtractionToProposalItems,
  mapNoteProposalRow,
} from "@/lib/project-notes/proposals/mappers";
import type {
  NoteProposal,
  NoteProposalActionState,
} from "@/lib/project-notes/proposals/types";
import { STATIC_CONSTRAINT_SEEDS } from "@/lib/assistant/mock-seed";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { normalizeCanonicalFactKey } from "@/lib/scopes/fact-keys";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";
import { createClient } from "@/lib/supabase/server";

const CATALOGUE_TYPES = SCOPE_CATALOGUE.map((item) => item.type);
const CATALOGUE_BY_TYPE = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item])
);

const analyseSchema = z.object({
  projectId: z.string().uuid(),
  noteIds: z.array(z.string().uuid()).optional(),
});

const applySchema = z.object({
  projectId: z.string().uuid(),
  proposalId: z.string().uuid(),
  selectedWorkAreaProposalIds: z.array(z.string().uuid()),
  selectedFactProposalIds: z.array(z.string().uuid()),
  selectedConstraintProposalIds: z.array(z.string().uuid()),
});

const dismissSchema = z.object({
  projectId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

function revalidateProjectPath(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

async function loadAllowedWorkAreaTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<string[]> {
  const { data: orgWorkAreas, error } = await supabase
    .from("organisation_work_areas")
    .select("work_area_type")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (error) throw new Error(error.message);

  const catalogueSet = new Set(CATALOGUE_TYPES);
  const enabled = (orgWorkAreas ?? [])
    .map((row) => row.work_area_type)
    .filter((type) => catalogueSet.has(type));

  if (enabled.length > 0) return enabled;

  return SCOPE_CATALOGUE.filter((item) => item.defaultEnabled).map(
    (item) => item.type
  );
}

export async function getPendingNoteProposal(
  projectId: string
): Promise<NoteProposal | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;

  const { data } = await context.supabase
    .from("note_proposals")
    .select(
      "id, project_id, note_ids, summary, status, proposed_work_areas, proposed_facts, proposed_constraints, created_at, reviewed_at"
    )
    .eq("project_id", projectId)
    .eq("org_id", context.orgId)
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapNoteProposalRow(data) : null;
}

export async function analyseProjectNotes(
  input: z.infer<typeof analyseSchema>
): Promise<NoteProposalActionState> {
  const parsed = analyseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid analyse request." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { projectId, noteIds } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, stage, brief_text, quality_level")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  if (!isStageAtOrBeyond(project.stage, "confirm_work_areas")) {
    return {
      error: "Use Analyse job during project capture. Note analysis is for later stages.",
    };
  }

  const { data: existingPending } = await supabase
    .from("note_proposals")
    .select("id")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .eq("status", "pending_review")
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    return {
      error: "Review or dismiss the current proposal before analysing again.",
    };
  }

  let notesQuery = supabase
    .from("project_notes")
    .select("id, content, note_type, source, captured_at, analysis_status")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (noteIds?.length) {
    notesQuery = notesQuery.in("id", noteIds);
  } else {
    notesQuery = notesQuery.eq("analysis_status", "pending");
  }

  const { data: noteRows, error: notesError } = await notesQuery.order(
    "captured_at",
    { ascending: true }
  );

  if (notesError) {
    return { error: notesError.message };
  }

  const analysableNotes = (noteRows ?? []).filter(
    (note) => !isInternalProjectNote(note.note_type)
  );

  if (!analysableNotes.length) {
    return { error: "No new site notes to analyse." };
  }

  const [
    { data: workAreas },
    { data: projectFacts },
    { data: constraints },
  ] = await Promise.all([
    supabase
      .from("work_areas")
      .select("id, type, name, status")
      .eq("project_id", projectId)
      .order("sort_order"),
    supabase
      .from("project_facts")
      .select("work_area_id, key, label, value, source")
      .eq("project_id", projectId),
    supabase
      .from("constraints")
      .select("key, label, value")
      .eq("project_id", projectId),
  ]);

  const confirmedWorkAreas = (workAreas ?? []).filter(
    (wa) => wa.status === "confirmed"
  );

  const workAreaNameById = new Map(
    (workAreas ?? []).map((wa) => [wa.id, wa.name])
  );
  const workAreaTypeById = new Map(
    (workAreas ?? []).map((wa) => [wa.id, wa.type])
  );

  const workAreaIdByType = new Map<string, string>();
  for (const wa of workAreas ?? []) {
    if (wa.status === "confirmed" && !workAreaIdByType.has(wa.type)) {
      workAreaIdByType.set(wa.type, wa.id);
    }
  }

  let allowedTypes: string[];
  try {
    allowedTypes = await loadAllowedWorkAreaTypes(supabase, orgId);
  } catch {
    return { error: "We couldn't analyse your notes. Please try again." };
  }

  let extraction;
  try {
    extraction = await extractFromSiteNotes({
      projectId,
      context: {
        briefText: project.brief_text,
        confirmedWorkAreas,
        allWorkAreas: workAreas ?? [],
        facts: (projectFacts ?? []).map((fact) => ({
          key: fact.key,
          label: fact.label,
          value: fact.value,
          source: fact.source,
          workAreaType: fact.work_area_id
            ? workAreaTypeById.get(fact.work_area_id) ?? null
            : null,
          workAreaName: fact.work_area_id
            ? workAreaNameById.get(fact.work_area_id) ?? null
            : null,
        })),
        constraints: constraints ?? [],
        notes: analysableNotes.map((note) => ({
          id: note.id,
          noteTypeLabel: getProjectNoteTypeLabel(note.note_type),
          sourceLabel: note.source,
          content: note.content,
          capturedAt: note.captured_at,
        })),
        allowedTypes,
      },
      catalogueTypes: CATALOGUE_TYPES,
    });
  } catch (error) {
    if (error instanceof AIExtractionError) {
      const friendlyCodes = new Set([
        "NOTE_ANALYSIS_PARSE",
        "NOTE_ANALYSIS_SCHEMA",
        "NOTE_ANALYSIS_PARSE_RETRY",
        "NOTE_ANALYSIS_SETUP",
        "NOTE_ANALYSIS_NO_UPDATES",
      ]);
      if (error.code && friendlyCodes.has(error.code)) {
        return { error: error.message };
      }
      if (
        error.message.includes("JSON") ||
        error.message.includes("schema validation")
      ) {
        return { error: NOTE_ANALYSIS_PARSE_USER_MESSAGE };
      }
      return { error: error.message };
    }
    console.error("[analyseProjectNotes]", {
      projectId,
      noteCount: analysableNotes.length,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { error: "We couldn't analyse your notes. Please try again." };
  }

  const proposalItems = mapExtractionToProposalItems({
    extraction,
    catalogueByType: CATALOGUE_BY_TYPE,
    workAreas: workAreas ?? [],
    facts: projectFacts ?? [],
    constraints: constraints ?? [],
    workAreaIdByType,
    workAreaNameByType: new Map(
      (workAreas ?? []).map((wa) => [wa.type, wa.name])
    ),
  });

  if (
    proposalItems.proposedWorkAreas.length === 0 &&
    proposalItems.proposedFacts.length === 0 &&
    proposalItems.proposedConstraints.length === 0
  ) {
    return {
      error: NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
    };
  }

  const analysedNoteIds = analysableNotes.map((note) => note.id);

  const { data: inserted, error: insertError } = await supabase
    .from("note_proposals")
    .insert({
      org_id: orgId,
      project_id: projectId,
      note_ids: analysedNoteIds,
      proposed_work_areas: proposalItems.proposedWorkAreas,
      proposed_facts: proposalItems.proposedFacts,
      proposed_constraints: proposalItems.proposedConstraints,
      summary: extraction.summary || null,
      status: "pending_review",
      created_by: user.id,
    })
    .select(
      "id, project_id, note_ids, summary, status, proposed_work_areas, proposed_facts, proposed_constraints, created_at, reviewed_at"
    )
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Failed to save proposal." };
  }

  await supabase
    .from("project_notes")
    .update({ analysis_status: "analysed" })
    .in("id", analysedNoteIds)
    .eq("project_id", projectId)
    .eq("org_id", orgId);

  revalidateProjectPath(projectId);
  return {
    success: true,
    proposalId: inserted.id,
    proposal: mapNoteProposalRow(inserted),
  };
}

async function applyWorkAreaProposal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string,
  proposal: { type: string; action: string; existingWorkAreaId?: string | null }
): Promise<boolean> {
  const catalogueItem = CATALOGUE_BY_TYPE.get(proposal.type);
  if (!catalogueItem) return false;

  if (proposal.action === "restore" && proposal.existingWorkAreaId) {
    const { error } = await supabase
      .from("work_areas")
      .update({
        status: "confirmed",
        name: catalogueItem.label,
        summary: catalogueItem.description,
      })
      .eq("id", proposal.existingWorkAreaId)
      .eq("project_id", projectId);
    return !error;
  }

  if (proposal.action === "add") {
    const { data: existingAreas } = await supabase
      .from("work_areas")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("type", proposal.type);

    const confirmed = (existingAreas ?? []).find(
      (area) => area.status === "confirmed"
    );
    if (confirmed) return false;

    const restorable = (existingAreas ?? []).find(
      (area) => area.status === "excluded" || area.status === "suggested"
    );

    if (restorable) {
      const { error } = await supabase
        .from("work_areas")
        .update({
          status: "confirmed",
          name: catalogueItem.label,
          summary: catalogueItem.description,
        })
        .eq("id", restorable.id)
        .eq("project_id", projectId);
      return !error;
    }

    const { data: allAreas } = await supabase
      .from("work_areas")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (allAreas?.[0]?.sort_order ?? 0) + 1;

    const { error } = await supabase.from("work_areas").insert({
      org_id: orgId,
      project_id: projectId,
      type: proposal.type,
      name: catalogueItem.label,
      status: "confirmed",
      ai_confidence: null,
      summary: catalogueItem.description,
      sort_order: nextSortOrder,
    });

    return !error;
  }

  return false;
}

export async function applyNoteProposal(
  input: z.infer<typeof applySchema>
): Promise<NoteProposalActionState & { staleMessage?: string }> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid apply request." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const {
    projectId,
    proposalId,
    selectedWorkAreaProposalIds,
    selectedFactProposalIds,
    selectedConstraintProposalIds,
  } = parsed.data;

  const totalSelected =
    selectedWorkAreaProposalIds.length +
    selectedFactProposalIds.length +
    selectedConstraintProposalIds.length;

  if (totalSelected === 0) {
    return { error: "Select at least one update to apply, or dismiss the proposal." };
  }

  const { data: proposalRow, error: proposalError } = await supabase
    .from("note_proposals")
    .select(
      "id, project_id, note_ids, summary, status, proposed_work_areas, proposed_facts, proposed_constraints, created_at, reviewed_at"
    )
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (proposalError || !proposalRow) {
    return { error: "Proposal not found." };
  }

  if (proposalRow.status !== "pending_review") {
    return { error: "This proposal has already been reviewed." };
  }

  const proposal = mapNoteProposalRow(proposalRow);

  const { data: project } = await supabase
    .from("projects")
    .select("stage, quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  let changesApplied = 0;

  const selectedWorkAreas = proposal.proposedWorkAreas.filter((item) =>
    selectedWorkAreaProposalIds.includes(item.id)
  );

  for (const workAreaProposal of selectedWorkAreas) {
    const applied = await applyWorkAreaProposal(
      supabase,
      orgId,
      projectId,
      workAreaProposal
    );
    if (applied) changesApplied += 1;
  }

  const { data: workAreasAfter } = await supabase
    .from("work_areas")
    .select("id, type, status")
    .eq("project_id", projectId);

  const workAreaIdByType = new Map<string, string>();
  for (const wa of workAreasAfter ?? []) {
    if (wa.status === "confirmed") {
      workAreaIdByType.set(wa.type, wa.id);
    }
  }

  const selectedFacts = proposal.proposedFacts.filter((item) =>
    selectedFactProposalIds.includes(item.id)
  );

  for (const factProposal of selectedFacts) {
    let workAreaId = factProposal.workAreaId ?? null;
    if (!workAreaId && factProposal.workAreaType) {
      workAreaId = workAreaIdByType.get(factProposal.workAreaType) ?? null;
    }
    if (factProposal.workAreaType && !workAreaId) continue;

    const canonicalKey = normalizeCanonicalFactKey(
      factProposal.key,
      factProposal.workAreaType ?? null
    );

    let factQuery = supabase
      .from("project_facts")
      .select("id, source")
      .eq("project_id", projectId)
      .eq("key", canonicalKey);

    if (workAreaId) {
      factQuery = factQuery.eq("work_area_id", workAreaId);
    } else {
      factQuery = factQuery.is("work_area_id", null);
    }

    const { data: existingFact } = await factQuery.maybeSingle();

    const factPayload = {
      label: factProposal.label,
      value: factProposal.proposedValue,
      unit: factProposal.unit ?? null,
      source: "user" as const,
      confidence: 1,
    };

    if (existingFact) {
      const { error } = await supabase
        .from("project_facts")
        .update(factPayload)
        .eq("id", existingFact.id)
        .eq("project_id", projectId);
      if (!error) changesApplied += 1;
    } else {
      const { error } = await supabase.from("project_facts").insert({
        org_id: orgId,
        project_id: projectId,
        work_area_id: workAreaId,
        key: canonicalKey,
        ...factPayload,
      });
      if (!error) changesApplied += 1;
    }

    if (workAreaId) {
      const { data: matchingQuestions } = await supabase
        .from("questions")
        .select("id, input_type")
        .eq("project_id", projectId)
        .eq("work_area_id", workAreaId)
        .eq("key", canonicalKey);

      for (const question of matchingQuestions ?? []) {
        const storedValue = normalizeAnswerForStorage(
          factProposal.proposedValue as string | number | boolean,
          question.input_type as "number" | "select" | "boolean" | "text"
        );

        await supabase
          .from("questions")
          .update({
            answer_value: storedValue,
            answer_source: "user",
          })
          .eq("id", question.id)
          .eq("project_id", projectId);
      }
    }
  }

  const constraintSeedByKey = new Map(
    STATIC_CONSTRAINT_SEEDS.map((seed) => [seed.key, seed])
  );

  const selectedConstraints = proposal.proposedConstraints.filter((item) =>
    selectedConstraintProposalIds.includes(item.id)
  );

  for (const constraintProposal of selectedConstraints) {
    const seed = constraintSeedByKey.get(constraintProposal.key);
    const inputType = seed?.input_type ?? "select";
    const storedValue = normalizeAnswerForStorage(
      constraintProposal.proposedValue as string | number | boolean,
      inputType
    );

    const { data: existing } = await supabase
      .from("constraints")
      .select("id")
      .eq("project_id", projectId)
      .eq("key", constraintProposal.key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("constraints")
        .update({
          label: constraintProposal.label,
          value: storedValue,
          source: "user",
        })
        .eq("id", existing.id)
        .eq("project_id", projectId);
      if (!error) changesApplied += 1;
    } else {
      const { error } = await supabase.from("constraints").insert({
        org_id: orgId,
        project_id: projectId,
        key: constraintProposal.key,
        label: constraintProposal.label,
        value: storedValue,
        source: "user",
      });
      if (!error) changesApplied += 1;
    }
  }

  const totalProposed =
    proposal.proposedWorkAreas.length +
    proposal.proposedFacts.length +
    proposal.proposedConstraints.length;

  const allSelected =
    selectedWorkAreaProposalIds.length === proposal.proposedWorkAreas.length &&
    selectedFactProposalIds.length === proposal.proposedFacts.length &&
    selectedConstraintProposalIds.length ===
      proposal.proposedConstraints.length;

  const status = allSelected && totalSelected === totalProposed
    ? "accepted"
    : "partially_accepted";

  await supabase
    .from("note_proposals")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("org_id", orgId);

  if (changesApplied > 0) {
    const { data: workAreasForDerived } = await supabase
      .from("work_areas")
      .select("id, type, status")
      .eq("project_id", projectId);

    const { data: factsForDerived } = await supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId);

    await persistDerivedFactsForProject(
      supabase,
      orgId,
      projectId,
      workAreasForDerived ?? [],
      factsForDerived ?? []
    );

    await ensureMissingDetailsQuestionBlock(
      supabase,
      orgId,
      projectId,
      {
        stage: project.stage,
        qualityLevel: project.quality_level,
      }
    );

    const { data: estimate } = await supabase
      .from("estimates")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    if (estimate) {
      await markEstimateStale(projectId);
    }
  }

  revalidateProjectPath(projectId);

  return {
    success: true,
    staleMessage:
      changesApplied > 0
        ? "Updates applied. Your estimate is now outdated — regenerate to update pricing."
        : undefined,
  };
}

export async function dismissNoteProposal(
  input: z.infer<typeof dismissSchema>
): Promise<NoteProposalActionState> {
  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid dismiss request." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { projectId, proposalId } = parsed.data;

  const { data: updated, error } = await supabase
    .from("note_proposals")
    .update({
      status: "dismissed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!updated) {
    return { error: "Proposal not found or already reviewed." };
  }

  revalidateProjectPath(projectId);
  return { success: true };
}
