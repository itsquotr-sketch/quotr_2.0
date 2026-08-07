/**
 * Stage 3.1B.7G — Quick Estimate presentation view-model (no commercial math).
 *
 * Formats display strings from authoritative estimate / readiness inputs.
 * Desktop rail, mobile compact summary, and future sheets share this shape.
 */

export type QuickEstimateStatusKind = "ready" | "attention" | "pending" | "stale";

export type QuickEstimateStatusPresentation = {
  readonly kind: QuickEstimateStatusKind;
  /** Concise one-line status, e.g. "Ready for pricing" / "2 items need attention". */
  readonly statusLabel: string;
  /** Count of attention items when kind === "attention". */
  readonly attentionCount: number;
  /** True blockers that must stay visible outside collapsed sections. */
  readonly blockerLabels: readonly string[];
};

export type QuickEstimateMobileSummary = {
  readonly primaryLine: string;
  readonly secondaryActionLabel: string;
  readonly hasEstimate: boolean;
};

export type QuickEstimateScopeSummaryLines = {
  readonly collapsed: string;
  readonly workAreas: string;
  readonly includedScope: string;
  readonly clarifications: string;
  readonly unanswered: string;
};

/**
 * Build concise project-status for the Quick Estimate rail.
 * Does not compute confidence or money — only labels from counts.
 */
export function buildQuickEstimateStatusPresentation(params: {
  readonly hasEstimate: boolean;
  readonly isStale?: boolean;
  readonly canGenerateEstimate?: boolean;
  readonly missingCount: number;
  readonly outstandingClarificationCount: number;
  readonly pendingProposalCount?: number;
  readonly unresolvedScopeImpactCount?: number;
  readonly assumptionCritical?: boolean;
  readonly readinessLabel?: string | null;
}): QuickEstimateStatusPresentation {
  const blockers: string[] = [];
  if (params.isStale) {
    blockers.push("This estimate is outdated — recalculate before pricing.");
  }
  if (params.assumptionCritical) {
    blockers.push("Assumed dimensions affect this estimate — confirm before pricing.");
  }

  const attentionParts: string[] = [];
  if (params.missingCount > 0) {
    attentionParts.push(
      `${params.missingCount} unanswered detail${params.missingCount === 1 ? "" : "s"}`
    );
  }
  if (params.outstandingClarificationCount > 0) {
    attentionParts.push(
      `${params.outstandingClarificationCount} open clarification${params.outstandingClarificationCount === 1 ? "" : "s"}`
    );
  }
  if ((params.pendingProposalCount ?? 0) > 0) {
    attentionParts.push(
      `${params.pendingProposalCount} item${params.pendingProposalCount === 1 ? "" : "s"} to review`
    );
  }
  if ((params.unresolvedScopeImpactCount ?? 0) > 0) {
    attentionParts.push(
      `${params.unresolvedScopeImpactCount} suggested scope change${params.unresolvedScopeImpactCount === 1 ? "" : "s"} open`
    );
  }

  const attentionCount = attentionParts.length;

  if (params.isStale) {
    return {
      kind: "stale",
      statusLabel: "Needs recalculation",
      attentionCount,
      blockerLabels: blockers,
    };
  }

  if (params.hasEstimate && attentionCount === 0) {
    return {
      kind: "ready",
      statusLabel: "Ready for pricing",
      attentionCount: 0,
      blockerLabels: blockers,
    };
  }

  if (params.hasEstimate && attentionCount > 0) {
    return {
      kind: "attention",
      statusLabel:
        attentionCount === 1
          ? "1 item needs attention"
          : `${attentionCount} items need attention`,
      attentionCount,
      blockerLabels: blockers,
    };
  }

  if (params.canGenerateEstimate) {
    return {
      kind: "pending",
      statusLabel: "Ready to generate",
      attentionCount,
      blockerLabels: blockers,
    };
  }

  return {
    kind: "pending",
    statusLabel: params.readinessLabel?.trim() || "Waiting for inputs",
    attentionCount,
    blockerLabels: blockers,
  };
}

/**
 * Compact mobile / future bottom-sheet trigger copy.
 * Uses pre-formatted currency and confidence from the panel (no formatting math).
 */
export function buildQuickEstimateMobileSummary(params: {
  readonly hasEstimate: boolean;
  readonly sellDisplay: string | null;
  readonly confidencePercent: number | null;
  readonly statusLabel: string;
  readonly canGenerateEstimate?: boolean;
}): QuickEstimateMobileSummary {
  if (params.hasEstimate && params.sellDisplay) {
    const confidencePart =
      params.confidencePercent != null
        ? ` · ${params.confidencePercent}% confidence`
        : "";
    return {
      primaryLine: `${params.sellDisplay}${confidencePart}`,
      secondaryActionLabel: "View estimate",
      hasEstimate: true,
    };
  }
  if (params.canGenerateEstimate) {
    return {
      primaryLine: "Ready to generate",
      secondaryActionLabel: "View estimate",
      hasEstimate: false,
    };
  }
  return {
    primaryLine: params.statusLabel,
    secondaryActionLabel: "View estimate",
    hasEstimate: false,
  };
}

export function buildQuickEstimateScopeSummaryLines(params: {
  readonly estimatedWorkAreas: string;
  readonly includedScopeItems: string;
  readonly outstandingClarifications: string;
  readonly unansweredRequiredDetails: string;
  readonly workAreaCount: number;
  readonly includedScopeItemCountLabel: string;
}): QuickEstimateScopeSummaryLines {
  return {
    collapsed: `${params.workAreaCount} Work Area${params.workAreaCount === 1 ? "" : "s"} · ${params.includedScopeItemCountLabel}`,
    workAreas: params.estimatedWorkAreas,
    includedScope: params.includedScopeItems,
    clarifications: params.outstandingClarifications,
    unanswered: params.unansweredRequiredDetails,
  };
}

/** CSS sticky applies from this Tailwind breakpoint upward (1024px). */
export const QUICK_ESTIMATE_STICKY_BREAKPOINT = "lg" as const;

/** Shared sticky offset class — clears app chrome without overlapping nav. */
export const QUICK_ESTIMATE_STICKY_CLASS =
  "lg:sticky lg:top-6 lg:self-start" as const;
