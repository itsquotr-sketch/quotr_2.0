"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  applyNoteProposal,
  dismissNoteProposal,
} from "@/lib/project-notes/proposals/actions";
import {
  formatProposalSource,
  formatProposalValue,
} from "@/lib/project-notes/proposals/format";
import {
  isProposalItemSelectedByDefault,
  type NoteProposal,
  type ProposedConstraint,
  type ProposedFact,
  type ProposedWorkArea,
} from "@/lib/project-notes/proposals/types";
import { cn } from "@/lib/utils";

type NoteProposalReviewPanelProps = {
  projectId: string;
  proposal: NoteProposal;
};

function ProposalItemRow({
  id,
  title,
  reason,
  confidence,
  conflict,
  currentLabel,
  proposedLabel,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  conflict: boolean;
  currentLabel?: string;
  proposedLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        conflict && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={id} className="text-sm font-medium">
              {title}
            </Label>
            {conflict ? (
              <Badge variant="outline" className="text-[10px] text-amber-700">
                Conflicts with current answer
              </Badge>
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              {Math.round(confidence * 100)}% confidence
            </span>
          </div>
          {currentLabel ? (
            <p className="text-xs text-muted-foreground">
              Current: {currentLabel}
            </p>
          ) : null}
          <p className="text-sm">
            Proposed: <span className="font-medium">{proposedLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground">{reason}</p>
          {conflict ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Applying this will replace the current value and mark the estimate
              as outdated.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NoteProposalReviewPanel({
  projectId,
  proposal,
}: NoteProposalReviewPanelProps) {
  const router = useRouter();
  const [selectedWorkAreas, setSelectedWorkAreas] = useState<Set<string>>(
    () =>
      new Set(
        proposal.proposedWorkAreas
          .filter((item) => isProposalItemSelectedByDefault(item))
          .map((item) => item.id)
      )
  );
  const [selectedFacts, setSelectedFacts] = useState<Set<string>>(
    () =>
      new Set(
        proposal.proposedFacts
          .filter((item) => isProposalItemSelectedByDefault(item))
          .map((item) => item.id)
      )
  );
  const [selectedConstraints, setSelectedConstraints] = useState<Set<string>>(
    () =>
      new Set(
        proposal.proposedConstraints
          .filter((item) => isProposalItemSelectedByDefault(item))
          .map((item) => item.id)
      )
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nonConflictFacts = useMemo(
    () => proposal.proposedFacts.filter((item) => !item.conflict),
    [proposal.proposedFacts]
  );
  const conflictFacts = useMemo(
    () => proposal.proposedFacts.filter((item) => item.conflict),
    [proposal.proposedFacts]
  );
  const nonConflictConstraints = useMemo(
    () => proposal.proposedConstraints.filter((item) => !item.conflict),
    [proposal.proposedConstraints]
  );
  const conflictConstraints = useMemo(
    () => proposal.proposedConstraints.filter((item) => item.conflict),
    [proposal.proposedConstraints]
  );
  const conflictCount = conflictFacts.length + conflictConstraints.length;

  async function handleApply() {
    setError(null);
    setSuccessMessage(null);
    setIsApplying(true);

    const result = await applyNoteProposal({
      projectId,
      proposalId: proposal.id,
      selectedWorkAreaProposalIds: [...selectedWorkAreas],
      selectedFactProposalIds: [...selectedFacts],
      selectedConstraintProposalIds: [...selectedConstraints],
    });

    setIsApplying(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSuccessMessage(
      result.staleMessage ?? "Selected updates were applied."
    );
    router.refresh();
  }

  async function handleDismiss() {
    setError(null);
    setSuccessMessage(null);
    setIsDismissing(true);

    const result = await dismissNoteProposal({ projectId, proposalId: proposal.id });

    setIsDismissing(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  function toggleInSet(
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
    checked: boolean
  ) {
    setter((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function renderWorkArea(item: ProposedWorkArea) {
    const actionLabel =
      item.action === "restore" ? "Restore work area" : "Add work area";
    return (
      <ProposalItemRow
        key={item.id}
        id={`wa-${item.id}`}
        title={`${actionLabel}: ${item.label}`}
        reason={item.reason}
        confidence={item.confidence}
        conflict={false}
        proposedLabel={item.label}
        checked={selectedWorkAreas.has(item.id)}
        onCheckedChange={(checked) =>
          toggleInSet(setSelectedWorkAreas, item.id, checked)
        }
      />
    );
  }

  function renderFact(item: ProposedFact, inConflictSection = false) {
    const current =
      item.existingValue !== undefined
        ? `${formatProposalValue(item.existingValue, item.unit)}${
            item.existingSource
              ? ` — ${formatProposalSource(item.existingSource)}`
              : ""
          }`
        : undefined;

    return (
      <ProposalItemRow
        key={`${inConflictSection ? "conflict-" : ""}fact-${item.id}`}
        id={`fact-${item.id}`}
        title={item.label}
        reason={item.reason}
        confidence={item.confidence}
        conflict={item.conflict}
        currentLabel={current}
        proposedLabel={`${formatProposalValue(item.proposedValue, item.unit)} — from site note`}
        checked={selectedFacts.has(item.id)}
        onCheckedChange={(checked) =>
          toggleInSet(setSelectedFacts, item.id, checked)
        }
      />
    );
  }

  function renderConstraint(item: ProposedConstraint, inConflictSection = false) {
    const current =
      item.existingValue !== undefined
        ? formatProposalValue(item.existingValue)
        : undefined;

    return (
      <ProposalItemRow
        key={`${inConflictSection ? "conflict-" : ""}constraint-${item.id}`}
        id={`constraint-${item.id}`}
        title={item.label}
        reason={item.reason}
        confidence={item.confidence}
        conflict={item.conflict}
        currentLabel={current}
        proposedLabel={`${formatProposalValue(item.proposedValue)} — from site note`}
        checked={selectedConstraints.has(item.id)}
        onCheckedChange={(checked) =>
          toggleInSet(setSelectedConstraints, item.id, checked)
        }
      />
    );
  }

  return (
    <CollapsibleStageCard
      title="Quotr found possible updates from your site notes"
      subtitle="Review the suggestions and choose what to apply. These changes will not update your estimate automatically."
      statusLabel="Review"
      statusVariant="review"
      defaultExpanded
      canCollapse={false}
    >
      <div className="space-y-5">
        {proposal.summary ? (
          <p className="text-sm text-muted-foreground">{proposal.summary}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{proposal.proposedWorkAreas.length} work area updates</span>
          <span>·</span>
          <span>{proposal.proposedFacts.length} fact updates</span>
          <span>·</span>
          <span>{proposal.proposedConstraints.length} constraint updates</span>
          {conflictCount > 0 ? (
            <>
              <span>·</span>
              <span className="text-amber-700">{conflictCount} conflicts</span>
            </>
          ) : null}
        </div>

        {proposal.proposedWorkAreas.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">New work areas</h3>
            <div className="space-y-2">
              {proposal.proposedWorkAreas.map(renderWorkArea)}
            </div>
          </section>
        ) : null}

        {nonConflictFacts.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Fact updates</h3>
            <div className="space-y-2">
              {nonConflictFacts.map((item) => renderFact(item))}
            </div>
          </section>
        ) : null}

        {nonConflictConstraints.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Site constraint updates</h3>
            <div className="space-y-2">
              {nonConflictConstraints.map((item) => renderConstraint(item))}
            </div>
          </section>
        ) : null}

        {conflictCount > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Conflicts — review carefully
            </h3>
            <p className="text-xs text-muted-foreground">
              These proposals differ from current answers. They are unchecked by
              default.
            </p>
            <div className="space-y-2">
              {conflictFacts.map((item) => renderFact(item, true))}
              {conflictConstraints.map((item) =>
                renderConstraint(item, true)
              )}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="text-sm text-muted-foreground" role="status">
            {successMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            onClick={handleApply}
            disabled={isApplying || isDismissing}
          >
            {isApplying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Applying…
              </>
            ) : (
              "Apply selected updates"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            disabled={isApplying || isDismissing}
          >
            {isDismissing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Dismissing…
              </>
            ) : (
              "Dismiss proposal"
            )}
          </Button>
        </div>
      </div>
    </CollapsibleStageCard>
  );
}
