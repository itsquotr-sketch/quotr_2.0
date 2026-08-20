/**
 * Stage 3.1B.7G / 7F-R6-R4 / R4.1 — Quick Estimate presentation view-model.
 *
 * Formats display strings from authoritative estimate / readiness inputs.
 * Desktop rail, mobile compact summary, and future sheets share this shape.
 *
 * R6-R4: never promise "Review in Scope Details" without a question target.
 * R6-R4.1: scope-level items without questions route to Scope Review with Review.
 */

export type QuickEstimateStatusKind = "ready" | "attention" | "pending" | "stale";

/** Attention classification — presentation only (7F-R6-R4 / R4.1). */
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
  /** Discovery suggestion / scope row identity for Scope Review focus. */
  readonly suggestionId?: string;
  readonly scopeItemId?: string;
  /** Stage / section id for Review navigation when practical. */
  readonly reviewTarget?:
    | "questions"
    | "scopeReview"
    | "constraints"
    | "projectConditions"
    | "estimateReview"
    | "quality";
  /** DECK-2B-R2 — presentation severity only. */
  readonly productSeverity?:
    | "assumption"
    | "check"
    | "attention"
    | "blocker";
};

export type QuickEstimateStatusPresentation = {
  readonly kind: QuickEstimateStatusKind;
  /** Concise one-line status, e.g. "Ready for pricing" / "2 details could improve this estimate". */
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
export const SCOPE_REVIEW_COPY = "Review scope";

export function attentionPromisesScopeDetailsReview(
  item: Pick<QuickEstimateAttentionItem, "detail">
): boolean {
  return item.detail === SCOPE_DETAILS_REVIEW_COPY;
}

export function attentionPromisesScopeReview(
  item: Pick<QuickEstimateAttentionItem, "detail" | "reviewTarget">
): boolean {
  return (
    item.reviewTarget === "scopeReview" ||
    item.detail === SCOPE_REVIEW_COPY ||
    item.detail === "Confirm in Scope Review"
  );
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

/** Invariant: Scope Review copy requires a Scope Review target. */
export function attentionHasValidScopeReviewTarget(
  item: Pick<
    QuickEstimateAttentionItem,
    "detail" | "reviewTarget" | "suggestionId" | "workAreaId" | "scopeItemId"
  >
): boolean {
  if (!attentionPromisesScopeReview(item)) return true;
  if (item.reviewTarget !== "scopeReview") return false;
  return Boolean(item.suggestionId || item.scopeItemId || item.workAreaId);
}

/** Whether EstimatePanel should render the Review CTA. */
export function attentionShowsReviewButton(
  item: Pick<
    QuickEstimateAttentionItem,
    | "reviewTarget"
    | "questionId"
    | "workAreaId"
    | "detail"
    | "suggestionId"
    | "scopeItemId"
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
  if (item.reviewTarget === "scopeReview") {
    // Scope-level Review does not require a question.
    return true;
  }
  return (
    item.reviewTarget === "constraints" ||
    item.reviewTarget === "quality" ||
    item.reviewTarget === "projectConditions"
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
    readonly suggestionId?: string;
    readonly scopeItemId?: string;
    /**
     * True only with a mapped Scope Details question id for QUESTION kind.
     * SCOPE kind may be actionable via scopeReview without questionId.
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
  /** Undecided scope rows — Scope Review (7F-R6-R4.1). */
  readonly scopeReviewAttention?: readonly {
    readonly label: string;
    readonly workAreaName?: string;
    readonly workAreaId?: string | null;
    readonly suggestionId: string;
  }[];
  /** Stage 3.2.2 — Project Conditions unresolved ASK candidates (presentation). */
  readonly projectConditionsAttention?: readonly {
    readonly label: string;
    readonly questionKey: string;
    readonly factKey?: string;
  }[];
}): readonly QuickEstimateAttentionItem[] {
  const items: QuickEstimateAttentionItem[] = [];
  const seenScopeKeys = new Set<string>();

  for (const [index, entry] of (
    params.projectConditionsAttention ?? []
  ).entries()) {
    const trimmed = entry.label.trim();
    if (!trimmed) continue;
    items.push({
      id: `project-conditions-${entry.questionKey}-${index}`,
      label: trimmed,
      detail: "Review Project Conditions",
      attentionKind: "QUESTION",
      factKey: entry.factKey ?? entry.questionKey,
      questionId: entry.questionKey,
      reviewTarget: "projectConditions",
    });
  }

  for (const [index, entry] of (params.missingByWorkArea ?? []).entries()) {
    const trimmed = entry.label.trim();
    if (!trimmed) continue;
    const kind = entry.attentionKind;
    const isScopeKind = kind === "SCOPE";
    const hasQuestionTarget = Boolean(entry.questionId);
    // QUESTION: require question id. SCOPE: actionable via Scope Review target.
    const actionable = isScopeKind
      ? entry.actionable !== false &&
        (entry.reviewTarget === "scopeReview" ||
          Boolean(entry.suggestionId || entry.workAreaId))
      : hasQuestionTarget && entry.actionable !== false;
    const reviewTarget = actionable
      ? (entry.reviewTarget ??
        (isScopeKind
          ? "scopeReview"
          : entry.workAreaId
            ? "estimateReview"
            : "questions"))
      : undefined;
    const attentionKind: QuickEstimateAttentionKind = actionable
      ? isScopeKind
        ? "SCOPE"
        : "QUESTION"
      : (kind ?? "NON_ACTIONABLE_INFORMATION");
    const detail = actionable
      ? attentionKind === "SCOPE"
        ? (entry.detailOverride ?? SCOPE_REVIEW_COPY)
        : SCOPE_DETAILS_REVIEW_COPY
      : (entry.detailOverride ??
        (attentionKind === "ASSUMPTION" ||
        attentionKind === "PRICING_REQUIRED"
          ? "Allowance / confirmation required"
          : "More information required"));
    if (attentionKind === "SCOPE" && entry.suggestionId) {
      seenScopeKeys.add(entry.suggestionId);
    }
    items.push({
      id: `missing-wa:${entry.workAreaId ?? index}:${trimmed}`,
      label: trimmed,
      detail,
      attentionKind,
      workAreaName: entry.workAreaName || undefined,
      workAreaId: entry.workAreaId,
      factKey: entry.factKey,
      questionId:
        attentionKind === "QUESTION" ? entry.questionId : undefined,
      suggestionId: entry.suggestionId,
      scopeItemId: entry.scopeItemId ?? entry.suggestionId,
      reviewTarget,
    });
  }

  for (const [index, entry] of (params.scopeReviewAttention ?? []).entries()) {
    const trimmed = entry.label.trim();
    if (!trimmed) continue;
    if (entry.suggestionId && seenScopeKeys.has(entry.suggestionId)) continue;
    if (
      items.some(
        (i) =>
          i.label.toLowerCase() === trimmed.toLowerCase() &&
          i.attentionKind === "SCOPE"
      )
    ) {
      continue;
    }
    items.push({
      id: `scope-review:${entry.suggestionId || index}:${trimmed}`,
      label: trimmed,
      detail: SCOPE_REVIEW_COPY,
      attentionKind: "SCOPE",
      workAreaName: entry.workAreaName || undefined,
      workAreaId: entry.workAreaId ?? undefined,
      suggestionId: entry.suggestionId,
      scopeItemId: entry.suggestionId,
      reviewTarget: "scopeReview",
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

/** Builder-facing attention semantics — presentation only (FOUNDATION-EXPANSION-0). */
export type AttentionSemanticBucket =
  | "ACTIONABLE_REFINEMENT"
  | "CHECK"
  | "ASSUMPTION"
  | "PRICING_REQUIRED"
  | "BLOCKER"
  | "INFORMATIONAL";

type AttentionItemForStatus = QuickEstimateAttentionItem & {
  readonly productSeverity?:
    | "assumption"
    | "check"
    | "attention"
    | "blocker";
};

export function classifyAttentionSemanticBucket(
  item: AttentionItemForStatus
): AttentionSemanticBucket {
  if (item.attentionKind === "NON_ACTIONABLE_INFORMATION") {
    return "INFORMATIONAL";
  }
  if (item.attentionKind === "PRICING_REQUIRED") {
    return "PRICING_REQUIRED";
  }
  if (
    item.attentionKind === "ASSUMPTION" ||
    item.productSeverity === "assumption"
  ) {
    return "ASSUMPTION";
  }
  if (item.productSeverity === "check") {
    return "CHECK";
  }
  if (!item.reviewTarget) {
    return "INFORMATIONAL";
  }
  if (item.attentionKind === "QUESTION") {
    return "ACTIONABLE_REFINEMENT";
  }
  if (item.attentionKind === "SCOPE") {
    return "CHECK";
  }
  return "ACTIONABLE_REFINEMENT";
}

function semanticStatusLabel(counts: {
  readonly actionableRefinement: number;
  readonly checks: number;
  readonly assumptions: number;
  readonly pricingRequired: number;
}): { readonly kind: QuickEstimateStatusKind; readonly label: string } {
  if (counts.actionableRefinement > 0) {
    return {
      kind: "attention",
      label:
        counts.actionableRefinement === 1
          ? "1 detail could improve this estimate"
          : `${counts.actionableRefinement} details could improve this estimate`,
    };
  }
  if (counts.checks > 0) {
    return {
      kind: "attention",
      label:
        counts.checks === 1
          ? "1 check remaining"
          : `${counts.checks} checks remaining`,
    };
  }
  if (counts.pricingRequired > 0) {
    return {
      kind: "attention",
      label:
        counts.pricingRequired === 1
          ? "1 item needs pricing"
          : `${counts.pricingRequired} items need pricing`,
    };
  }
  if (counts.assumptions > 0) {
    return {
      kind: "ready",
      label:
        counts.assumptions === 1
          ? "1 assumption used"
          : `${counts.assumptions} assumptions used`,
    };
  }
  return { kind: "ready", label: "Ready for pricing" };
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
  readonly attentionItems?: readonly AttentionItemForStatus[];
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

  const displayAttentionItems = attentionItems.filter(
    (item) => classifyAttentionSemanticBucket(item) !== "INFORMATIONAL"
  );

  const semanticCounts = displayAttentionItems.reduce(
    (acc, item) => {
      const bucket = classifyAttentionSemanticBucket(item);
      if (bucket === "ACTIONABLE_REFINEMENT") acc.actionableRefinement += 1;
      if (bucket === "CHECK") acc.checks += 1;
      if (bucket === "ASSUMPTION") acc.assumptions += 1;
      if (bucket === "PRICING_REQUIRED") acc.pricingRequired += 1;
      return acc;
    },
    {
      actionableRefinement: 0,
      checks: 0,
      assumptions: 0,
      pricingRequired: 0,
    }
  );

  const attentionCount = displayAttentionItems.length;

  if (params.isStale) {
    return {
      kind: "stale",
      statusLabel: "Needs recalculation",
      attentionCount,
      attentionItems: displayAttentionItems,
      blockerLabels: blockers,
    };
  }

  if (params.hasEstimate) {
    const semantic = semanticStatusLabel(semanticCounts);
    return {
      kind: semantic.kind,
      statusLabel: semantic.label,
      attentionCount:
        semantic.kind === "attention"
          ? semanticCounts.actionableRefinement +
            semanticCounts.checks +
            semanticCounts.pricingRequired
          : semanticCounts.assumptions,
      attentionItems: displayAttentionItems,
      blockerLabels: blockers,
    };
  }

  if (params.canGenerateEstimate) {
    return {
      kind: "pending",
      statusLabel: "Ready to generate",
      attentionCount,
      attentionItems: displayAttentionItems,
      blockerLabels: blockers,
    };
  }

  return {
    kind: "pending",
    statusLabel: params.readinessLabel?.trim() || "Waiting for inputs",
    attentionCount,
    attentionItems: displayAttentionItems,
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
