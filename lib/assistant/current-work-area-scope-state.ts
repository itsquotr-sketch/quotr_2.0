/**
 * Stage 3.1B.7F-R3 — Current Work Area scope state (composed read model).
 *
 * Pure presentation/application composition over existing authorities:
 * discovery suggestions/decisions + manual work_area_scope_items + Facts.
 * Does not invent Facts, decisions, or commercial values.
 */

import type { ScopeReview } from "@/lib/assistant/types";
import type { ScopeItemSummaryLists } from "@/lib/assistant/stage-completion-summaries";
import { routeClarificationToScopeDetails } from "@/lib/scope-discovery/ui/clarification-routing";
import {
  explicitScopeDecisionFromFacts,
  type ScopeSignalFactRef,
} from "@/lib/scope-discovery/scope-impact";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";

export type ScopeItemOrigin = "system" | "user";
export type ScopeDecisionState = "INCLUDED" | "NOT_REQUIRED";
export type ScopeDetailState = "COMPLETE" | "NEEDS_DETAIL";
export type ScopePricingSupport = "supported" | "pricing_required" | "unknown";

export type CurrentScopeItem = {
  readonly id: string;
  readonly workAreaId: string | null;
  readonly origin: ScopeItemOrigin;
  readonly title: string;
  readonly description: string | null;
  readonly canonicalType: string | null;
  readonly decisionState: ScopeDecisionState;
  readonly detailState: ScopeDetailState;
  readonly detailReason: string | null;
  readonly requiredFactKeys: readonly string[];
  readonly pricingSupport: ScopePricingSupport;
  readonly addedByYou: boolean;
  /** Discovery suggestion id when origin=system. */
  readonly suggestionId: string | null;
  /** Manual row id when origin=user. */
  readonly manualItemId: string | null;
};

export type CurrentWorkAreaScopeState = {
  readonly items: readonly CurrentScopeItem[];
  readonly includedCount: number;
  readonly notRequiredCount: number;
  readonly needsDetailCount: number;
  readonly summaryLists: ScopeItemSummaryLists;
};

export type DiscoverySuggestionInput = {
  readonly suggestionId: string;
  readonly proposedTitle: string;
  readonly proposedDescription?: string | null;
  readonly decisionState: string;
  readonly latestReasonCode?: string | null;
  readonly proposalClass?: string;
  readonly suggestionKind?: string;
  readonly rationaleCode?: string | null;
  readonly relatedWorkAreaId?: string | null;
  readonly proposedWorkAreaType?: string | null;
  readonly supersededBySuggestionId?: string | null;
  readonly staleReason?: string | null;
  /** Extra required Fact keys when multiple details map to one item. */
  readonly requiredDetailFactKeys?: readonly string[];
};

function isScopeEligibleClass(cls: string): boolean {
  return (
    cls === "SCOPE_ITEM" || cls === "CLARIFICATION" || cls === "EXCLUSION"
  );
}

function relevantWorkAreas(
  scopeReview: ScopeReview,
  workAreaId: string | null
) {
  const areas =
    workAreaId != null
      ? scopeReview.workAreas.filter((wa) => wa.workAreaId === workAreaId)
      : scopeReview.workAreas;
  return areas.length > 0 ? areas : scopeReview.workAreas;
}

function isFactKnown(
  scopeReview: ScopeReview | null | undefined,
  factKey: string,
  workAreaId: string | null
): boolean {
  if (!scopeReview) return false;
  for (const wa of relevantWorkAreas(scopeReview, workAreaId)) {
    const fact = wa.facts.find((f) => f.key === factKey);
    if (fact && String(fact.value ?? "").trim() !== "") {
      return true;
    }
  }
  return false;
}

/**
 * Whether a mapped detail Fact is satisfied for completion.
 * Known Facts always satisfy. Optional active questions do not block.
 */
function isDetailFactSatisfied(
  scopeReview: ScopeReview | null | undefined,
  factKey: string,
  workAreaId: string | null
): boolean {
  if (isFactKnown(scopeReview, factKey, workAreaId)) return true;
  if (!scopeReview) return false;
  for (const wa of relevantWorkAreas(scopeReview, workAreaId)) {
    const question = wa.activeQuestions.find((q) => q.key === factKey);
    if (question && !question.required) {
      return true;
    }
  }
  return false;
}

/**
 * Fact keys that still need confirmation for a discovery-pending item.
 * Unmapped pending items return [] — detailState becomes COMPLETE (7F-R5)
 * so stale reason codes cannot invent Quick Estimate clarifications.
 */
export function resolvePendingDetailFactKeys(params: {
  readonly rationaleCode?: string | null;
  readonly suggestionKind?: string;
  readonly proposalClass?: string;
  readonly title?: string | null;
  readonly latestReasonCode?: string | null;
  readonly requiredDetailFactKeys?: readonly string[];
}): readonly string[] {
  const reason = String(params.latestReasonCode ?? "");
  if (!reason.includes("pending") && !reason.includes("routed")) {
    return [];
  }
  const keys = new Set<string>();
  for (const key of params.requiredDetailFactKeys ?? []) {
    if (key.trim()) keys.add(key.trim());
  }
  const route = routeClarificationToScopeDetails({
    rationaleCode: params.rationaleCode,
    suggestionKind: String(params.suggestionKind ?? ""),
    proposalClass: params.proposalClass,
    title: params.title,
  });
  if (route.mapped && route.factKey) {
    keys.add(route.factKey);
  }
  return [...keys];
}

function detailStateForDiscoveryItem(params: {
  readonly suggestion: DiscoverySuggestionInput;
  readonly scopeReview: ScopeReview | null | undefined;
}): {
  readonly detailState: ScopeDetailState;
  readonly detailReason: string | null;
  readonly requiredFactKeys: readonly string[];
} {
  const reason = String(params.suggestion.latestReasonCode ?? "");
  const looksPending =
    reason.includes("pending") || reason.includes("routed");
  if (!looksPending) {
    return { detailState: "COMPLETE", detailReason: null, requiredFactKeys: [] };
  }

  const factKeys = resolvePendingDetailFactKeys({
    rationaleCode: params.suggestion.rationaleCode,
    suggestionKind: params.suggestion.suggestionKind,
    proposalClass: params.suggestion.proposalClass,
    title: params.suggestion.proposedTitle,
    latestReasonCode: params.suggestion.latestReasonCode,
    requiredDetailFactKeys: params.suggestion.requiredDetailFactKeys,
  });

  if (factKeys.length === 0) {
    // Unmapped pending reason with no Fact route — do not keep a sticky
    // NEEDS_DETAIL badge that invents false Quick Estimate clarifications.
    // Mapped items still clear via Fact satisfaction below.
    return {
      detailState: "COMPLETE",
      detailReason: null,
      requiredFactKeys: [],
    };
  }

  const unresolved = factKeys.filter(
    (key) =>
      !isDetailFactSatisfied(
        params.scopeReview,
        key,
        params.suggestion.relatedWorkAreaId ?? null
      )
  );

  if (unresolved.length === 0) {
    return { detailState: "COMPLETE", detailReason: null, requiredFactKeys: factKeys };
  }

  return {
    detailState: "NEEDS_DETAIL",
    detailReason: "Included — detail still needs confirmation",
    requiredFactKeys: factKeys,
  };
}

function decisionFromDiscovery(state: string): ScopeDecisionState | null {
  const upper = String(state).toUpperCase();
  if (upper === "ACCEPTED" || upper === "MODIFIED") return "INCLUDED";
  if (upper === "REJECTED") return "NOT_REQUIRED";
  // Pending-detail items may still be PROPOSED with included_pending reason —
  // treat discovery pending codes as included for display buckets.
  return null;
}

function isUserConfirmedDiscoveryState(state: string): boolean {
  const upper = String(state).toUpperCase();
  return (
    upper === "ACCEPTED" || upper === "MODIFIED" || upper === "REJECTED"
  );
}

function factsFromScopeReview(
  scopeReview: ScopeReview | null | undefined
): ScopeSignalFactRef[] {
  if (!scopeReview) return [];
  const out: ScopeSignalFactRef[] = [];
  for (const wa of scopeReview.workAreas) {
    for (const fact of wa.facts) {
      out.push({
        key: fact.key,
        value: fact.value,
        work_area_id: wa.workAreaId,
      });
    }
  }
  return out;
}

/**
 * Compose current scope state from discovery + manual rows + Facts.
 */
export function composeCurrentWorkAreaScopeState(params: {
  readonly suggestions: readonly DiscoverySuggestionInput[];
  readonly manualItems?: readonly ManualScopeItemView[];
  readonly scopeReview?: ScopeReview | null;
}): CurrentWorkAreaScopeState {
  const items: CurrentScopeItem[] = [];
  const seenTitlesByWa = new Set<string>();
  const facts = factsFromScopeReview(params.scopeReview);

  for (const s of params.suggestions) {
    const cls = String(s.proposalClass ?? "");
    if (!isScopeEligibleClass(cls)) continue;
    if (s.supersededBySuggestionId) continue;

    const reason = String(s.latestReasonCode ?? "");
    const looksPending =
      reason.includes("pending") || reason.includes("routed");
    let decision = decisionFromDiscovery(s.decisionState);
    if (looksPending) {
      // Routed / pending-detail clarifications may persist as REJECTED with a
      // pending reason code — still treat as included for Scope Details bucket.
      decision = "INCLUDED";
    }

    const confirmed = isUserConfirmedDiscoveryState(s.decisionState);
    const factDecision = explicitScopeDecisionFromFacts({
      proposedWorkAreaType: s.proposedWorkAreaType,
      relatedWorkAreaId: s.relatedWorkAreaId,
      facts,
    });

    // Explicit Fact polarity seeds defaults for undecided suggestions.
    // Confirmed ACCEPT/REJECT/MODIFIED remain user-authoritative.
    if (!confirmed && factDecision) {
      decision = factDecision;
    } else if (!decision && factDecision) {
      decision = factDecision;
    }

    if (!decision) continue;

    const detail =
      decision === "INCLUDED"
        ? detailStateForDiscoveryItem({
            suggestion: s,
            scopeReview: params.scopeReview,
          })
        : {
            detailState: "COMPLETE" as const,
            detailReason: null,
            requiredFactKeys: [] as const,
          };

    const waId = s.relatedWorkAreaId ?? null;
    const dedupeKey = `${waId ?? "*"}:${s.proposedTitle.trim().toLowerCase()}`;
    seenTitlesByWa.add(dedupeKey);

    items.push({
      id: `system:${s.suggestionId}`,
      workAreaId: waId,
      origin: "system",
      title: s.proposedTitle,
      description: s.proposedDescription ?? null,
      canonicalType: s.proposedWorkAreaType ?? null,
      decisionState: decision,
      detailState: detail.detailState,
      detailReason: detail.detailReason,
      requiredFactKeys: detail.requiredFactKeys,
      pricingSupport: "unknown",
      addedByYou: false,
      suggestionId: s.suggestionId,
      manualItemId: null,
    });
  }

  const manuals = [...(params.manualItems ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  for (const m of manuals) {
    const dedupeKey = `${m.workAreaId}:${m.title.trim().toLowerCase()}`;
    // Prefer keeping user provenance when titles collide — still show manual.
    if (seenTitlesByWa.has(dedupeKey)) {
      // Skip duplicate display title under same WA when system already listed.
      // User data remains in DB; summary shows system row.
      continue;
    }
    seenTitlesByWa.add(dedupeKey);
    items.push({
      id: `user:${m.id}`,
      workAreaId: m.workAreaId,
      origin: "user",
      title: m.title,
      description: m.description,
      canonicalType: m.scopeItemType,
      decisionState: m.state,
      detailState: "COMPLETE",
      detailReason: null,
      requiredFactKeys: [],
      pricingSupport: "pricing_required",
      addedByYou: true,
      suggestionId: null,
      manualItemId: m.id,
    });
  }

  const included = items.filter((i) => i.decisionState === "INCLUDED");
  const notRequired = items.filter((i) => i.decisionState === "NOT_REQUIRED");
  const needsDetail = included.filter((i) => i.detailState === "NEEDS_DETAIL");

  const includedTitles = included
    .filter((i) => i.detailState === "COMPLETE")
    .map((i) => i.title);
  const pendingScopeDetails = needsDetail.map((i) => ({
    title: i.title,
    reason: i.detailReason ?? "Included — detail still needs confirmation",
  }));

  return {
    items,
    includedCount: included.length,
    notRequiredCount: notRequired.length,
    needsDetailCount: needsDetail.length,
    summaryLists: {
      included: includedTitles,
      notRequired: notRequired.map((i) => i.title),
      pendingScopeDetails,
      needsDetail: pendingScopeDetails.map((p) => p.title),
    },
  };
}

/** Display helpers for confirmed summary with provenance metadata. */
export function includedSummaryRows(
  state: CurrentWorkAreaScopeState
): readonly {
  readonly title: string;
  readonly secondary: string | null;
}[] {
  return state.items
    .filter(
      (i) =>
        i.decisionState === "INCLUDED" && i.detailState === "COMPLETE"
    )
    .map((i) => ({
      title: i.title,
      secondary: i.addedByYou
        ? i.pricingSupport === "pricing_required"
          ? "Added by you · Pricing required"
          : "Added by you"
        : null,
    }));
}
