/**
 * Stage 3.1B.7G / 7F-R6-R4 — Quick Estimate presentation view-model (no commercial math).
 *
 * Formats display strings from authoritative estimate / readiness inputs.
 * Desktop rail, mobile compact summary, and future sheets share this shape.
 *
 * R6-R4: attention copy and CTAs must agree — never promise "Review in Scope Details"
 * without a question target.
 */

export type QuickEstimateStatusKind = "ready" | "attention" | "pending" | "stale";

/** Attention classification — presentation only (7F-R6-R4). */
export type QuickEstimateAttentionKind =
  | "QUESTION"
  | "SCOPE"
  | "PRICING_REQUIRED"
  | "ASSUMPTION"
  | "NON_ACTIONABLE_INFORMATION";

export type QuickEstimateAttentionItem = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly attentionKind: QuickEstimateAttentionKind;
  readonly workAreaName?: string;
  readonly workAreaId?: string;
  readonly factKey?: string;
  readonly questionId?: string;
  /** Stage / section id for Review navigation when practical. */
  readonly reviewTarget?:
    | "questions"
    | "scopeReview"
    | "constraints"
    | "estimateReview"
    | "quality";
};

export type QuickEstimateStatusPresentation = {
  readonly kind: QuickEstimateStatusKind;
  /** Concise one-line status, e.g. "Ready for pricing" / "2 items need attention". */
  readonly statusLabel: string;
  /** Count of attention items when kind === "attention" — equals attentionItems.length. */
  readonly attentionCount: number;
  /** Exact named items behind the attention count (single authoritative list). */
  readonly attentionItems: readonly QuickEstimateAttentionItem[];
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

export const SCOPE_DETAILS_REVIEW_COPY = "Review in Scope Details";

export function attentionPromisesScopeDetailsReview(
  item: Pick<QuickEstimateAttentionItem, "detail">
): boolean {
  return item.detail === SCOPE_DETAILS_REVIEW_COPY;
}

/** Invariant: Scope Details Review copy requires questionId + reviewTarget. */
export function attentionHasValidScopeDetailsReviewTarget(
  item: Pick<
    QuickEstimateAttentionItem,
    "detail" | "questionId" | "reviewTarget"
  >
): boolean {
  if (!attentionPromisesScopeDetailsReview(item)) return true;
  return Boolean(item.questionId && item.reviewTarget);
}

/** Whether EstimatePanel should render the Review CTA. */
export function attentionShowsReviewButton(
  item: Pick<
    QuickEstimateAttentionItem,
    "reviewTarget" | "questionId" | "workAreaId" | "detail"
  >
): boolean {
  if (!item.reviewTarget) return false;
  if (attentionPromisesScopeDetailsReview(item)) {
    return Boolean(item.questionId);
  }
  if (item.reviewTarget === "questions") {
    return Boolean(item.questionId);
  }
  if (item.reviewTarget === "estimateReview") {
    return Boolean(item.questionId || item.workAreaId);
  }
  return (
    item.reviewTarget === "scopeReview" ||
    item.reviewTarget === "constraints" ||
    item.reviewTarget === "quality"
  );
}

/**
 * Build one authoritative attention-item list from readiness inputs.
 * Count must equal items.length — no phantom category inflation.
 */
export function buildQuickEstimateAttentionItems(params: {
  readonly missingLabels?: readonly string[];
  readonly missingByWorkArea?: readonly {
    readonly workAreaName: string;
    readonly label: string;
    readonly workAreaId?: string;
    readonly factKey?: string;
    readonly questionId?: string;
    /**
     * True only with a mapped Scope Details question id.
     * Defaults to Boolean(questionId). Explicit true without questionId is ignored.
     */
    readonly actionable?: boolean;
    /** Prefer estimateReview when Scope Details editors live there. */
    readonly reviewTarget?: QuickEstimateAttentionItem["reviewTarget"];
    readonly attentionKind?: QuickEstimateAttentionKind;
    readonly detailOverride?: string;
  }[];
  readonly clarificationLabels?: readonly string[];
  readonly pendingProposalCount?: number;
  readonly unresolvedScopeImpactLabels?: readonly string[];
}): readonly QuickEstimateAttentionItem[] {
  const items: QuickEstimateAttentionItem[] = [];

  for (const [index, entry] of (params.missingByWorkArea ?? []).entries()) {
    const trimmed = entry.label.trim();
    if (!trimmed) continue;
    const hasQuestionTarget = Boolean(entry.questionId);
    // R6-R4: never actionable for Scope Details without a concrete question id.
    const actionable = hasQuestionTarget && entry.actionable !== false;
    const reviewTarget = actionable
      ? (entry.reviewTarget ??
        (entry.workAreaId ? "estimateReview" : "questions"))
      : undefined;
    const attentionKind: QuickEstimateAttentionKind = actionable
      ? "QUESTION"
      : (entry.attentionKind ?? "NON_ACTIONABLE_INFORMATION");
    items.push({
      id: `missing-wa:${entry.workAreaId ?? index}:${trimmed}`,
      label: trimmed,
      detail: actionable
        ? SCOPE_DETAILS_REVIEW_COPY
        : (entry.detailOverride ??
          (attentionKind === "ASSUMPTION" ||
          attentionKind === "PRICING_REQUIRED"
            ? "Allowance / confirmation required"
            : "More information required")),
      attentionKind,
      workAreaName: entry.workAreaName || undefined,
      workAreaId: entry.workAreaId,
      factKey: entry.factKey,
      questionId: actionable ? entry.questionId : undefined,
      reviewTarget,
    });
  }

  if ((params.missingByWorkArea ?? []).length === 0) {
    for (const [index, label] of (params.missingLabels ?? []).entries()) {
      const trimmed = label.trim();
      if (!trimmed) continue;
      // Labels alone cannot promise Scope Details Review (no question id).
      items.push({
        id: `missing:${index}:${trimmed}`,
        label: trimmed,
        detail: "More information required",
        attentionKind: "NON_ACTIONABLE_INFORMATION",
      });
    }
  }

  for (const [index, label] of (params.clarificationLabels ?? []).entries()) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    items.push({
      id: `clarification:${index}:${trimmed}`,
      label: trimmed,
      detail: "Open clarification",
      attentionKind: "SCOPE",
      reviewTarget: "scopeReview",
    });
  }

  const pending = params.pendingProposalCount ?? 0;
  if (pending > 0) {
    items.push({
      id: `pending-proposals:${pending}`,
      label:
        pending === 1
          ? "Scope item to review"
          : `${pending} scope items to review`,
      detail: "Awaiting confirmation",
      attentionKind: "SCOPE",
      reviewTarget: "scopeReview",
    });
  }

  for (const [index, label] of (
    params.unresolvedScopeImpactLabels ?? []
  ).entries()) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    items.push({
      id: `scope-impact:${index}:${trimmed}`,
      label: trimmed,
      detail: "Suggested scope change",
      attentionKind: "SCOPE",
      reviewTarget: "scopeReview",
    });
  }

  return items;
}

/**
 * Build concise project-status for the Quick Estimate rail.
 * Does not compute confidence or money — only labels from exact items.
 */
export function buildQuickEstimateStatusPresentation(params: {
  readonly hasEstimate: boolean;
  readonly isStale?: boolean;
  readonly canGenerateEstimate?: boolean;
  /** Prefer exact items; when provided, attentionCount === attentionItems.length. */
  readonly attentionItems?: readonly QuickEstimateAttentionItem[];
  /** @deprecated Prefer attentionItems — kept for callers that only have counts. */
  readonly missingCount?: number;
  readonly outstandingClarificationCount?: number;
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

  const attentionItems = params.attentionItems
    ? [...params.attentionItems]
    : buildQuickEstimateAttentionItems({
        missingLabels: (params.missingCount ?? 0) > 0
          ? Array.from({ length: params.missingCount ?? 0 }, () => "Unanswered detail")
          : [],
        clarificationLabels:
          (params.outstandingClarificationCount ?? 0) > 0
            ? Array.from(
                { length: params.outstandingClarificationCount ?? 0 },
                () => "Open clarification"
              )
            : [],
        pendingProposalCount: params.pendingProposalCount,
        unresolvedScopeImpactLabels:
          (params.unresolvedScopeImpactCount ?? 0) > 0
            ? Array.from(
                { length: params.unresolvedScopeImpactCount ?? 0 },
                () => "Suggested scope change"
              )
            : [],
      });

  const attentionCount = attentionItems.length;

  if (params.isStale) {
    return {
      kind: "stale",
      statusLabel: "Needs recalculation",
      attentionCount,
      attentionItems,
      blockerLabels: blockers,
    };
  }

  if (params.hasEstimate && attentionCount === 0) {
    return {
      kind: "ready",
      statusLabel: "Ready for pricing",
      attentionCount: 0,
      attentionItems: [],
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
      attentionItems,
      blockerLabels: blockers,
    };
  }

  if (params.canGenerateEstimate) {
    return {
      kind: "pending",
      statusLabel: "Ready to generate",
      attentionCount,
      attentionItems,
      blockerLabels: blockers,
    };
  }

  return {
    kind: "pending",
    statusLabel: params.readinessLabel?.trim() || "Waiting for inputs",
    attentionCount,
    attentionItems,
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
