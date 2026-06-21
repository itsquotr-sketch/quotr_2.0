import { randomUUID } from "crypto";
import type { NoteProposalExtractionOutput } from "@/lib/ai/note-proposal-schema";
import { factDedupeKey } from "@/lib/ai/mappers";
import type {
  NoteProposal,
  NoteProposalStatus,
  ProposedConstraint,
  ProposedFact,
  ProposedWorkArea,
} from "@/lib/project-notes/proposals/types";
import type { ScopeCatalogueItem } from "@/lib/scopes/catalogue";

type ExistingWorkArea = {
  id: string;
  type: string;
  name: string;
  status: string;
};

type ExistingFact = {
  work_area_id: string | null;
  key: string;
  label: string;
  value: unknown;
  source: string;
};

type ExistingConstraint = {
  key: string;
  label: string;
  value: unknown;
};

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function findExistingFact(
  facts: ExistingFact[],
  workAreas: ExistingWorkArea[],
  key: string,
  workAreaId: string | null,
  workAreaType: string | null
): ExistingFact | undefined {
  if (workAreaId) {
    const dedupeKey = factDedupeKey(workAreaId, key);
    return facts.find(
      (row) => factDedupeKey(row.work_area_id, row.key) === dedupeKey
    );
  }

  if (workAreaType) {
    return facts.find((row) => {
      if (row.key !== key || !row.work_area_id) return false;
      const workArea = workAreas.find((wa) => wa.id === row.work_area_id);
      return workArea?.type === workAreaType;
    });
  }

  return facts.find((row) => row.key === key && row.work_area_id === null);
}

function resolveWorkAreaAction(
  type: string,
  workAreas: ExistingWorkArea[],
  aiAction?: string
): Pick<ProposedWorkArea, "action" | "existingWorkAreaId"> {
  const confirmed = workAreas.find(
    (wa) => wa.type === type && wa.status === "confirmed"
  );
  if (confirmed) {
    return { action: "no_change", existingWorkAreaId: confirmed.id };
  }

  const excluded = workAreas.find(
    (wa) => wa.type === type && wa.status === "excluded"
  );
  if (excluded) {
    return {
      action: aiAction === "no_change" ? "no_change" : "restore",
      existingWorkAreaId: excluded.id,
    };
  }

  const suggested = workAreas.find((wa) => wa.type === type);
  if (suggested && suggested.status !== "confirmed") {
    return {
      action: aiAction === "no_change" ? "no_change" : "add",
      existingWorkAreaId: suggested.id,
    };
  }

  return { action: aiAction === "no_change" ? "no_change" : "add", existingWorkAreaId: null };
}

export function mapExtractionToProposalItems(params: {
  extraction: NoteProposalExtractionOutput;
  catalogueByType: Map<string, ScopeCatalogueItem>;
  workAreas: ExistingWorkArea[];
  facts: ExistingFact[];
  constraints: ExistingConstraint[];
  workAreaIdByType: Map<string, string>;
  workAreaNameByType: Map<string, string>;
}): {
  proposedWorkAreas: ProposedWorkArea[];
  proposedFacts: ProposedFact[];
  proposedConstraints: ProposedConstraint[];
} {
  const proposedWorkAreas: ProposedWorkArea[] = [];

  for (const wa of params.extraction.workAreas) {
    const resolved = resolveWorkAreaAction(
      wa.type,
      params.workAreas,
      wa.action
    );
    if (resolved.action === "no_change") continue;

    proposedWorkAreas.push({
      id: randomUUID(),
      type: wa.type,
      label: params.catalogueByType.get(wa.type)?.label ?? wa.type,
      confidence: wa.confidence,
      reason: wa.rationale?.trim() || "Suggested from site notes.",
      existingWorkAreaId: resolved.existingWorkAreaId,
      action: resolved.action,
    });
  }

  const proposedFacts: ProposedFact[] = [];

  for (const fact of params.extraction.facts) {
    const workAreaId =
      fact.work_area_type != null
        ? params.workAreaIdByType.get(fact.work_area_type) ?? null
        : null;

    if (fact.work_area_type && !workAreaId) {
      // Work area may be added in the same proposal batch.
    }

    const existing = findExistingFact(
      params.facts,
      params.workAreas,
      fact.key,
      workAreaId,
      fact.work_area_type
    );

    let action: ProposedFact["action"] = fact.action ?? "add";
    if (existing) {
      if (valuesEqual(existing.value, fact.value)) {
        continue;
      }
      action = "update";
    } else {
      action = "add";
    }

    const conflict =
      existing !== undefined && !valuesEqual(existing.value, fact.value);

    proposedFacts.push({
      id: randomUUID(),
      workAreaType: fact.work_area_type,
      workAreaId,
      key: fact.key,
      label: fact.label,
      proposedValue: fact.value,
      unit: fact.unit ?? null,
      confidence: fact.confidence,
      reason: fact.rationale?.trim() || "Suggested from site notes.",
      existingValue: existing?.value,
      existingSource: existing?.source ?? null,
      action,
      conflict,
    });
  }

  const proposedConstraints: ProposedConstraint[] = [];

  for (const constraint of params.extraction.constraints) {
    const existing = params.constraints.find((row) => row.key === constraint.key);
    let action: ProposedConstraint["action"] = constraint.action ?? "add";

    if (existing) {
      if (valuesEqual(existing.value, constraint.value)) {
        continue;
      }
      action = "update";
    } else {
      action = "add";
    }

    proposedConstraints.push({
      id: randomUUID(),
      key: constraint.key,
      label: constraint.label,
      proposedValue: constraint.value,
      existingValue: existing?.value,
      confidence: constraint.confidence,
      reason: constraint.rationale?.trim() || "Suggested from site notes.",
      action,
      conflict: Boolean(existing),
    });
  }

  return { proposedWorkAreas, proposedFacts, proposedConstraints };
}

export function mapNoteProposalRow(row: {
  id: string;
  project_id: string;
  note_ids: string[];
  summary: string | null;
  status: string;
  proposed_work_areas: unknown;
  proposed_facts: unknown;
  proposed_constraints: unknown;
  created_at: string;
  reviewed_at: string | null;
}): NoteProposal {
  return {
    id: row.id,
    projectId: row.project_id,
    noteIds: row.note_ids ?? [],
    summary: row.summary,
    status: row.status as NoteProposalStatus,
    proposedWorkAreas: (row.proposed_work_areas ?? []) as ProposedWorkArea[],
    proposedFacts: (row.proposed_facts ?? []) as ProposedFact[],
    proposedConstraints: (row.proposed_constraints ?? []) as ProposedConstraint[],
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}
