export type ProposedWorkAreaAction = "add" | "restore" | "no_change";

export type ProposedWorkArea = {
  id: string;
  type: string;
  label: string;
  confidence: number;
  reason: string;
  existingWorkAreaId?: string | null;
  action: ProposedWorkAreaAction;
  sourceNoteId?: string | null;
};

export type ProposedFactAction = "add" | "update" | "no_change";

export type ProposedFact = {
  id: string;
  workAreaType?: string | null;
  workAreaId?: string | null;
  key: string;
  label: string;
  proposedValue: unknown;
  unit?: string | null;
  confidence: number;
  reason: string;
  existingValue?: unknown;
  existingSource?: string | null;
  action: ProposedFactAction;
  conflict: boolean;
  sourceNoteId?: string | null;
};

export type ProposedConstraintAction = "add" | "update" | "no_change";

export type ProposedConstraint = {
  id: string;
  key: string;
  label: string;
  proposedValue: unknown;
  existingValue?: unknown;
  confidence: number;
  reason: string;
  action: ProposedConstraintAction;
  conflict: boolean;
  sourceNoteId?: string | null;
};

export type NoteProposalStatus =
  | "pending_review"
  | "accepted"
  | "partially_accepted"
  | "dismissed";

export type NoteProposal = {
  id: string;
  projectId: string;
  noteIds: string[];
  summary: string | null;
  status: NoteProposalStatus;
  proposedWorkAreas: ProposedWorkArea[];
  proposedFacts: ProposedFact[];
  proposedConstraints: ProposedConstraint[];
  createdAt: string;
  reviewedAt: string | null;
};

export type NoteProposalActionState =
  | { success: true; proposalId?: string; proposal?: NoteProposal }
  | { error: string };

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function isProposalItemSelectedByDefault(item: {
  action: string;
  conflict?: boolean;
  confidence: number;
}): boolean {
  if (item.action === "no_change") return false;
  if (item.conflict) return false;
  if (item.confidence < LOW_CONFIDENCE_THRESHOLD) return false;
  return (
    item.action === "add" ||
    item.action === "restore" ||
    item.action === "update"
  );
}
