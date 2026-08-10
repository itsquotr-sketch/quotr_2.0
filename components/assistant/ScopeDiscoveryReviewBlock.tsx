"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisProgressBanner } from "@/components/assistant/AnalysisProgressBanner";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { ScopeDiscoveryDismissDialog } from "@/components/assistant/ScopeDiscoveryDismissDialog";
import { ScopeDiscoveryEditDialog } from "@/components/assistant/ScopeDiscoveryEditDialog";
import { ScopeDiscoverySuggestionCard } from "@/components/assistant/ScopeDiscoverySuggestionCard";
import { createLatestWriteGuard } from "@/lib/assistant/answer-persistence";
import {
  acceptScopeSuggestionAction,
  applyScopeImpactRecommendationAction,
  batchConfirmScopeItemsAction,
  getScopeDiscoveryResultsAction,
  keepScopeImpactRecommendationAction,
  modifyScopeSuggestionAction,
  rejectScopeSuggestionAction,
  runScopeDiscoveryAction,
} from "@/lib/scope-discovery/actions";
import type {
  SafeResultsRead,
  SafeSuggestionView,
} from "@/lib/scope-discovery/application/types";
import type { BatchScopeItemState } from "@/lib/scope-discovery/application/batch-confirm-scope";
import { buildScopeChangeRecommendations } from "@/lib/scope-discovery/scope-impact";
import type {
  ScopeChangeRecommendation,
  ScopeSignalFactRef,
} from "@/lib/scope-discovery/scope-impact";
import {
  SCOPE_DISCOVERY_UI_COPY,
  analysisProgressLabel,
  defaultBatchSelection,
  evaluateScopeReviewCompletion,
  groupSuggestionsByWorkAreaSections,
  isScopeItemBatchEligible,
  routeClarificationToScopeDetails,
  type DismissReasonCode,
} from "@/lib/scope-discovery/ui";
import {
  ScopeImpactRecommendationsPanel,
  type ScopeImpactRecommendationRowStatus,
} from "@/components/assistant/ScopeImpactRecommendationsPanel";
import { ScopeReviewCollapsedSummary, ScopeReviewConfirmedSummaryLists } from "@/components/assistant/StageCollapsedSummaries";
import {
  AddManualScopeItemForm,
  ManualScopeItemRow,
} from "@/components/assistant/AddManualScopeItemForm";
import type { ScopeReview } from "@/lib/assistant/types";
import {
  composeCurrentWorkAreaScopeState,
  includedSummaryRows,
} from "@/lib/assistant/current-work-area-scope-state";
import {
  decideManualScopeItemAction,
  listManualScopeItemsForProject,
} from "@/lib/work-areas/scope-items/actions";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";
import { cn } from "@/lib/utils";

type ScopeDiscoveryReviewBlockProps = {
  projectId: string;
  enabled: boolean;
  initialResults?: SafeResultsRead | null;
  workAreaLabels?: ReadonlyMap<string, string> | Record<string, string>;
  /** Authoritative Facts for scope-impact recommendations (labels already safe). */
  scopeReview?: ScopeReview | null;
  /** Notify parent when completion changes (Quality gating). */
  onCompletionChange?: (complete: boolean) => void;
  /** Soft warning before estimate when high-priority recommendations remain. */
  onUnresolvedRecommendationsChange?: (count: number) => void;
  /** Live unified scope counts for Quick Estimate / stepper. */
  onScopeStateChange?: (counts: {
    readonly includedCount: number;
    readonly needsDetailCount: number;
    readonly pendingDetailTitles: readonly string[];
  }) => void;
  /** Progressive disclosure — prefer expanded when this stage is active. */
  preferredExpanded?: boolean;
  /** Stronger elevation when this is the active incomplete stage. */
  isActiveStage?: boolean;
  /** Open/scroll to Scope Details for pending confirmation items. */
  onReviewScopeDetails?: () => void;
};

type PendingSuggestionAction = {
  suggestionId: string;
  kind: "accept" | "modify" | "reject";
};

type LocalBatchState = Record<string, BatchScopeItemState>;

type CollapsibleGroupProps = {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

function SuggestionGroup({
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  if (count === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="text-sm font-medium">
          {title}{" "}
          <span className="font-normal text-muted-foreground">({count})</span>
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground", !open && "-rotate-90")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="space-y-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function factsFromScopeReview(
  scopeReview: ScopeReview | null | undefined
): ScopeSignalFactRef[] {
  if (!scopeReview) return [];
  return scopeReview.workAreas.flatMap((wa) =>
    wa.facts.map((f) => ({
      key: f.key,
      value: f.value,
      work_area_id: wa.workAreaId,
    }))
  );
}

function clearLocalBatchState(): LocalBatchState {
  // Do not pre-seed checklist overrides. Undecided items derive from
  // defaultBatchSelection(suggestion, facts) so explicit Fact polarity
  // stays live without a setState-in-effect reseed.
  return {};
}

function ChecklistRow({
  suggestion,
  included,
  disabled,
  editing,
  onToggle,
  onRouteClarification,
}: {
  suggestion: SafeSuggestionView;
  included: boolean;
  disabled: boolean;
  editing: boolean;
  onToggle: (included: boolean) => void;
  onRouteClarification?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isClarification = suggestion.proposalClass === "CLARIFICATION";
  const route = isClarification
    ? routeClarificationToScopeDetails({
        rationaleCode: suggestion.rationaleCode,
        suggestionKind: suggestion.suggestionKind,
        proposalClass: suggestion.proposalClass,
        title: suggestion.proposedTitle,
      })
    : null;
  const routed = !included && suggestion.latestReasonCode
    ? String(suggestion.latestReasonCode).includes("routed")
    : false;

  return (
    <div className="border-b border-border/40 py-2.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <input
          id={`scope-item-${suggestion.suggestionId}`}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--brand-orange)]"
          checked={included}
          disabled={disabled}
          aria-label={suggestion.proposedTitle}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`scope-item-${suggestion.suggestionId}`}
            className="block text-sm font-medium leading-snug"
          >
            {suggestion.proposedTitle}
          </label>
          {isClarification && route?.kind === "SCOPE_DETAIL" ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {SCOPE_DISCOVERY_UI_COPY.detailRequired}
            </p>
          ) : null}
          {routed ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {SCOPE_DISCOVERY_UI_COPY.reviewInScopeDetails}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <button
              type="button"
              className="text-[11px] text-muted-foreground/90 underline-offset-2 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide why" : "Why suggested"}
            </button>
            {editing && isClarification && onRouteClarification ? (
              <button
                type="button"
                className="text-[11px] text-muted-foreground/90 underline-offset-2 hover:underline"
                disabled={disabled}
                onClick={onRouteClarification}
              >
                {SCOPE_DISCOVERY_UI_COPY.reviewInScopeDetails}
              </button>
            ) : null}
          </div>
          {expanded ? (
            <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              <p>{suggestion.whySuggested}</p>
              {suggestion.evidence.summaries.length > 0 ? (
                <ul className="list-disc pl-4">
                  {suggestion.evidence.summaries.slice(0, 4).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildInitialManualBatch(
  items: readonly ManualScopeItemView[]
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const item of items) {
    next[item.id] = item.state === "INCLUDED";
  }
  return next;
}

export function ScopeDiscoveryReviewBlock({
  projectId,
  enabled,
  initialResults = null,
  workAreaLabels = {},
  scopeReview = null,
  onCompletionChange,
  onUnresolvedRecommendationsChange,
  onScopeStateChange,
  preferredExpanded,
  isActiveStage = false,
  onReviewScopeDetails,
}: ScopeDiscoveryReviewBlockProps) {
  const router = useRouter();
  const resultsGuard = useRef(createLatestWriteGuard());
  const analysingLock = useRef(false);
  const autoRunStarted = useRef(false);
  const [results, setResults] = useState<SafeResultsRead | null>(
    initialResults
  );
  const [manualItems, setManualItems] = useState<ManualScopeItemView[]>([]);
  const [localManualBatch, setLocalManualBatch] = useState<
    Record<string, boolean>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [progressElapsedMs, setProgressElapsedMs] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] =
    useState<PendingSuggestionAction | null>(null);
  const [editTarget, setEditTarget] = useState<SafeSuggestionView | null>(null);
  const [dismissTarget, setDismissTarget] =
    useState<SafeSuggestionView | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [localBatch, setLocalBatch] = useState<LocalBatchState>(() =>
    clearLocalBatchState()
  );
  const [impactRowStatus, setImpactRowStatus] = useState<
    Map<string, ScopeImpactRecommendationRowStatus>
  >(() => new Map());
  const [impactRowError, setImpactRowError] = useState<Map<string, string>>(
    () => new Map()
  );
  const [impactActionId, setImpactActionId] = useState<string | null>(null);

  const signalFacts = useMemo(
    () => factsFromScopeReview(scopeReview),
    [scopeReview]
  );

  const refreshResults = useCallback(async () => {
    if (!enabled) return;
    const token = resultsGuard.current.next();
    setIsLoadingResults(true);
    try {
      const outcome = await getScopeDiscoveryResultsAction({ projectId });
      if (!resultsGuard.current.isCurrent(token)) return;
      if (!outcome.ok) {
        setLoadError(outcome.message);
        return;
      }
      setResults(outcome);
      setLoadError(null);
      if (!isEditingScope) {
        setLocalBatch(clearLocalBatchState());
      }
    } catch {
      if (!resultsGuard.current.isCurrent(token)) return;
      setLoadError("Scope review results could not be loaded.");
    } finally {
      if (resultsGuard.current.isCurrent(token)) {
        setIsLoadingResults(false);
      }
    }
  }, [enabled, projectId, isEditingScope]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void listManualScopeItemsForProject(projectId).then((outcome) => {
      if (cancelled || !outcome.ok) return;
      const items = [...outcome.items];
      setManualItems(items);
      if (!isEditingScope) {
        setLocalManualBatch(buildInitialManualBatch(items));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, isEditingScope, scopeReview]);

  useEffect(() => {
    if (!isAnalysing) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setProgressElapsedMs(Date.now() - started);
    }, 400);
    return () => window.clearInterval(timer);
  }, [isAnalysing]);

  const handleAnalyse = useCallback(
    async (forceNewRun: boolean) => {
      if (!enabled || analysingLock.current || pendingSuggestion || isSavingBatch)
        return;
      analysingLock.current = true;
      setProgressElapsedMs(0);
      setIsAnalysing(true);
      setAnalyseError(null);
      setStatusMessage(null);

      try {
        const outcome = await runScopeDiscoveryAction({
          projectId,
          forceNewRun,
        });
        if (!outcome.ok) {
          setAnalyseError(outcome.message);
          return;
        }
        setStatusMessage(
          outcome.reused
            ? "Previous scope review results were reused."
            : outcome.message
        );
        await refreshResults();
        // Results are already refreshed client-side — avoid full Assistant remount.
      } catch {
        setAnalyseError("Scope analysis could not be completed. Try again.");
      } finally {
        analysingLock.current = false;
        setIsAnalysing(false);
      }
    },
    [
      enabled,
      pendingSuggestion,
      isSavingBatch,
      projectId,
      refreshResults,
    ]
  );

  // Auto-start analysis when Work Areas were confirmed and no run exists yet.
  useEffect(() => {
    if (!enabled) return;
    if (results?.runId) return;
    if (autoRunStarted.current || analysingLock.current) return;
    autoRunStarted.current = true;
    void handleAnalyse(false);
  }, [enabled, results?.runId, handleAnalyse]);

  const suggestions = useMemo(
    () => results?.allSuggestions ?? [],
    [results?.allSuggestions]
  );
  const batchEligible = useMemo(
    () => suggestions.filter(isScopeItemBatchEligible),
    [suggestions]
  );
  const workAreaSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) =>
          s.proposalClass === "HIGH_LEVEL_WORK_AREA" &&
          s.decisionState === "PROPOSED"
      ),
    [suggestions]
  );
  const conflictSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) =>
          s.proposalClass === "WARNING" && s.decisionState === "PROPOSED"
      ),
    [suggestions]
  );

  const completion = evaluateScopeReviewCompletion(suggestions, {
    hasRun: Boolean(results?.runId),
    batchPending: isSavingBatch,
  });

  useEffect(() => {
    onCompletionChange?.(completion.complete);
  }, [completion.complete, onCompletionChange]);

  const dismissedScopeImpactIds = results?.dismissedScopeImpactIds;
  const scopeImpactRunId = results?.runId;

  const scopeImpactRecommendations = useMemo(() => {
    if (!scopeReview || !scopeImpactRunId) return [] as ScopeChangeRecommendation[];
    const facts = scopeReview.workAreas.flatMap((wa) =>
      wa.facts.map((f) => ({
        key: f.key,
        value: f.rawValue ?? f.value,
        work_area_id: wa.workAreaId,
      }))
    );
    const workAreas = scopeReview.workAreas.map((wa) => ({
      id: wa.workAreaId,
      type: wa.workAreaType,
      name: wa.workAreaName,
    }));
    const scopeItemStates = batchEligible.map((s) => ({
      suggestionId: s.suggestionId,
      proposedWorkAreaType: s.proposedWorkAreaType,
      proposedTitle: s.proposedTitle,
      decisionState: s.decisionState,
      relatedWorkAreaId: s.relatedWorkAreaId,
    }));
    const dismissed = new Set(dismissedScopeImpactIds ?? []);
    return buildScopeChangeRecommendations({
      facts,
      workAreas,
      scopeItemStates,
      dismissedIds: dismissed,
    });
  }, [scopeReview, scopeImpactRunId, dismissedScopeImpactIds, batchEligible]);

  useEffect(() => {
    onUnresolvedRecommendationsChange?.(scopeImpactRecommendations.length);
  }, [scopeImpactRecommendations.length, onUnresolvedRecommendationsChange]);

  const showChecklistEditor = !completion.complete || isEditingScope;

  const sourceRevision = results?.sourceRevision ?? `project:${projectId}`;
  const hasRun = Boolean(results?.runId);
  const isStale = Boolean(results?.stale);
  const providerPartialFailure = Boolean(results?.providerPartialFailure);

  const workAreaSections = groupSuggestionsByWorkAreaSections(
    batchEligible,
    workAreaLabels
  );

  const runDecision = async (
    suggestionId: string,
    kind: PendingSuggestionAction["kind"],
    fn: () => Promise<{
      ok: boolean;
      message: string;
      createdWorkAreaId?: string | null;
    }>
  ) => {
    if (pendingSuggestion || isAnalysing || isSavingBatch) return;
    setPendingSuggestion({ suggestionId, kind });
    setStatusMessage(null);
    try {
      const outcome = await fn();
      if (!outcome.ok) {
        if (kind === "modify") setEditError(outcome.message);
        else if (kind === "reject") setDismissError(outcome.message);
        else setStatusMessage(outcome.message);
        return;
      }
      setEditTarget(null);
      setDismissTarget(null);
      setEditError(null);
      setDismissError(null);
      setStatusMessage(
        kind === "reject"
          ? "Marked as not required."
          : outcome.createdWorkAreaId
            ? "Work area added from scope review."
            : "Scope item included."
      );
      await refreshResults();
      if (outcome.createdWorkAreaId) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      const message = "That action could not be completed. Try again.";
      if (kind === "modify") setEditError(message);
      else if (kind === "reject") setDismissError(message);
      else setStatusMessage(message);
    } finally {
      setPendingSuggestion(null);
    }
  };

  const handleAccept = (suggestion: SafeSuggestionView) => {
    void runDecision(suggestion.suggestionId, "accept", async () => {
      const outcome = await acceptScopeSuggestionAction({
        suggestionId: suggestion.suggestionId,
        projectId,
        sourceRevision,
      });
      return {
        ok: outcome.ok,
        message: outcome.message,
        createdWorkAreaId: outcome.ok ? outcome.createdWorkAreaId : null,
      };
    });
  };

  const handleModify = async (input: {
    modifiedTitle: string;
    modifiedDescription: string | null;
    modifiedWorkAreaType: string;
  }) => {
    if (!editTarget) return;
    setEditError(null);
    await runDecision(editTarget.suggestionId, "modify", async () => {
      const outcome = await modifyScopeSuggestionAction({
        suggestionId: editTarget.suggestionId,
        projectId,
        sourceRevision,
        modifiedTitle: input.modifiedTitle,
        modifiedDescription: input.modifiedDescription,
        modifiedWorkAreaType: input.modifiedWorkAreaType,
      });
      return {
        ok: outcome.ok,
        message: outcome.message,
        createdWorkAreaId: outcome.ok ? outcome.createdWorkAreaId : null,
      };
    });
  };

  const handleDismiss = async (input: {
    reasonCode: DismissReasonCode | null;
    userNote: string | null;
  }) => {
    if (!dismissTarget) return;
    setDismissError(null);
    await runDecision(dismissTarget.suggestionId, "reject", async () => {
      const outcome = await rejectScopeSuggestionAction({
        suggestionId: dismissTarget.suggestionId,
        projectId,
        sourceRevision,
        reasonCode: input.reasonCode,
        userNote: input.userNote,
      });
      return {
        ok: outcome.ok,
        message: outcome.message,
        createdWorkAreaId: null,
      };
    });
  };

  const handleConfirmScope = async () => {
    if (isSavingBatch || isAnalysing) return;
    const hasDiscoveryBatch = Boolean(results?.runId) && batchEligible.length > 0;
    const hasManualChanges = manualItems.some((item) => {
      const local =
        localManualBatch[item.id] ?? item.state === "INCLUDED";
      const persisted = item.state === "INCLUDED";
      return local !== persisted;
    });
    if (!hasDiscoveryBatch && !hasManualChanges && manualItems.length === 0) {
      // Nothing to persist — still allow closing edit mode when unchanged.
      if (isEditingScope) {
        setIsEditingScope(false);
        setStatusMessage(SCOPE_DISCOVERY_UI_COPY.scopeConfirmed);
      }
      return;
    }

    setIsSavingBatch(true);
    setBatchError(null);
    setStatusMessage(SCOPE_DISCOVERY_UI_COPY.savingScope);

    let discoveryOk = true;
    let discoveryMessage: string | null = null;
    let manualsFailed = 0;
    let manualsSaved = 0;

    try {
      if (hasDiscoveryBatch && results?.runId) {
        const items = batchEligible.map((s) => ({
          suggestionId: s.suggestionId,
          intendedState: (localBatch[s.suggestionId] ??
            defaultBatchSelection(s, signalFacts)) as BatchScopeItemState,
        }));
        const outcome = await batchConfirmScopeItemsAction({
          projectId,
          runId: results.runId,
          sourceRevision,
          items,
        });
        if (!outcome.ok) {
          discoveryOk = false;
          discoveryMessage = outcome.message;
        }
      }

      for (const item of manualItems) {
        const localIncluded =
          localManualBatch[item.id] ?? item.state === "INCLUDED";
        const persistedIncluded = item.state === "INCLUDED";
        if (localIncluded === persistedIncluded) continue;
        const result = await decideManualScopeItemAction({
          projectId,
          scopeItemId: item.id,
          intendedState: localIncluded ? "INCLUDED" : "NOT_REQUIRED",
        });
        if (result.ok) {
          manualsSaved += 1;
          setManualItems((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, state: result.state } : row
            )
          );
        } else {
          manualsFailed += 1;
        }
      }

      if (!discoveryOk && manualsSaved === 0) {
        setBatchError(
          discoveryMessage ?? "Scope could not be confirmed. Try again."
        );
        setStatusMessage(null);
        return;
      }

      if (!discoveryOk || manualsFailed > 0) {
        const parts: string[] = [];
        if (!discoveryOk) {
          parts.push(
            discoveryMessage ?? "System scope decisions could not be saved."
          );
        }
        if (manualsFailed > 0) {
          parts.push(
            `${manualsFailed} manual scope decision${manualsFailed === 1 ? "" : "s"} failed.`
          );
        }
        setBatchError(parts.join(" "));
        setStatusMessage(null);
        if (discoveryOk) {
          await refreshResults();
        }
        return;
      }

      setIsEditingScope(false);
      setStatusMessage(SCOPE_DISCOVERY_UI_COPY.scopeConfirmed);
      await refreshResults();
      // Batch confirm does not create Work Areas / Facts — skip full remount.
      // Manual decisions may affect QE counts — light refresh is enough via state.
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setBatchError("Scope could not be confirmed. Try again.");
      setStatusMessage(null);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const setItemIncluded = (suggestionId: string, included: boolean) => {
    setLocalBatch((prev) => ({
      ...prev,
      [suggestionId]: included ? "INCLUDED" : "NOT_REQUIRED",
    }));
  };

  const setManualIncluded = (itemId: string, included: boolean) => {
    setLocalManualBatch((prev) => ({
      ...prev,
      [itemId]: included,
    }));
  };

  const routeClarification = (suggestionId: string) => {
    setLocalBatch((prev) => ({
      ...prev,
      [suggestionId]: "UNRESOLVED_CLARIFICATION",
    }));
  };

  const setImpactStatus = (
    id: string,
    status: ScopeImpactRecommendationRowStatus
  ) => {
    setImpactRowStatus((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  };

  const setImpactError = (id: string, message: string | null) => {
    setImpactRowError((prev) => {
      const next = new Map(prev);
      if (message) next.set(id, message);
      else next.delete(id);
      return next;
    });
  };

  const handleApplyScopeImpact = async (rec: ScopeChangeRecommendation) => {
    if (
      !results?.runId ||
      !rec.suggestionId ||
      impactActionId ||
      isAnalysing ||
      isSavingBatch ||
      pendingSuggestion
    ) {
      return;
    }
    setImpactActionId(rec.id);
    setImpactError(rec.id, null);
    setImpactStatus(rec.id, "applying");
    setStatusMessage(null);
    try {
      const outcome = await applyScopeImpactRecommendationAction({
        projectId,
        runId: results.runId,
        sourceRevision,
        suggestionId: rec.suggestionId,
        recommendationId: rec.id,
        intendedState: rec.suggestedState,
      });
      if (!outcome.ok) {
        setImpactStatus(rec.id, "failed");
        setImpactError(rec.id, outcome.message);
        return;
      }
      setImpactStatus(rec.id, "applied");
      setStatusMessage(outcome.message);
      await refreshResults();
    } catch {
      setImpactStatus(rec.id, "failed");
      setImpactError(rec.id, "That scope change could not be applied. Try again.");
    } finally {
      setImpactActionId(null);
    }
  };

  const handleKeepScopeImpact = async (rec: ScopeChangeRecommendation) => {
    if (
      !results?.runId ||
      !rec.suggestionId ||
      impactActionId ||
      isAnalysing ||
      isSavingBatch ||
      pendingSuggestion
    ) {
      return;
    }
    setImpactActionId(rec.id);
    setImpactError(rec.id, null);
    setImpactStatus(rec.id, "keeping");
    setStatusMessage(null);
    try {
      const outcome = await keepScopeImpactRecommendationAction({
        projectId,
        runId: results.runId,
        sourceRevision,
        suggestionId: rec.suggestionId,
        recommendationId: rec.id,
        intendedState: rec.previousState === "NOT_REQUIRED" ? "NOT_REQUIRED" : "INCLUDED",
      });
      if (!outcome.ok) {
        setImpactStatus(rec.id, "failed");
        setImpactError(rec.id, outcome.message);
        return;
      }
      setImpactStatus(rec.id, "kept");
      setStatusMessage(outcome.message);
      await refreshResults();
    } catch {
      setImpactStatus(rec.id, "failed");
      setImpactError(rec.id, "Could not keep current scope. Try again.");
    } finally {
      setImpactActionId(null);
    }
  };

  const currentScopeState = useMemo(
    () =>
      composeCurrentWorkAreaScopeState({
        suggestions: batchEligible,
        manualItems,
        scopeReview,
      }),
    [batchEligible, manualItems, scopeReview]
  );
  const mergedScopeLists = currentScopeState.summaryLists;
  const includedProvenanceRows = includedSummaryRows(currentScopeState);

  useEffect(() => {
    onScopeStateChange?.({
      includedCount: currentScopeState.includedCount,
      needsDetailCount: currentScopeState.needsDetailCount,
      pendingDetailTitles: currentScopeState.summaryLists.pendingScopeDetails.map(
        (p) => p.title
      ),
    });
  }, [
    currentScopeState.includedCount,
    currentScopeState.needsDetailCount,
    currentScopeState.summaryLists.pendingScopeDetails,
    onScopeStateChange,
  ]);

  if (!enabled) return null;

  const discoveryIncludedCount = batchEligible.filter(
    (s) =>
      (localBatch[s.suggestionId] ??
        defaultBatchSelection(s, signalFacts)) === "INCLUDED"
  ).length;
  const manualIncludedLocal = manualItems.filter(
    (item) => localManualBatch[item.id] ?? item.state === "INCLUDED"
  ).length;
  const includedCount = discoveryIncludedCount + manualIncludedLocal;
  const excludedCount =
    batchEligible.length +
    manualItems.length -
    includedCount;

  const summaryBits: string[] = [];
  if (!hasRun) summaryBits.push("Preparing");
  else if (scopeImpactRecommendations.length > 0) {
    summaryBits.push("Review needed");
    summaryBits.push(
      `${scopeImpactRecommendations.length} scope change${
        scopeImpactRecommendations.length === 1 ? "" : "s"
      }`
    );
  } else if (completion.complete && !isEditingScope) {
    summaryBits.push("Confirmed");
    if (completion.optionalOpen)
      summaryBits.push(`${completion.optionalOpen} optional open`);
  } else {
    summaryBits.push(`${includedCount} included`);
    if (excludedCount) summaryBits.push(`${excludedCount} not required`);
  }

  const showAnalyseAgain =
    isStale ||
    (hasRun && Boolean(analyseError)) ||
    (!hasRun && Boolean(analyseError));

  const showManualAnalyse =
    !hasRun && !isAnalysing && Boolean(analyseError || loadError);

  const cardStatusLabel =
    isAnalysing || (!hasRun && !analyseError)
      ? "Analysing"
      : isStale
        ? "Out of date"
        : scopeImpactRecommendations.length > 0
          ? "Review needed"
          : completion.complete && !isEditingScope
            ? "Complete"
            : hasRun
              ? "Review"
              : "Ready";

  const cardStatusVariant =
    isAnalysing || (!hasRun && !analyseError)
      ? "current"
      : isStale
        ? "stale"
        : scopeImpactRecommendations.length > 0
          ? "review"
          : completion.complete && !isEditingScope
            ? "complete"
            : "review";

  const disclosureExpanded =
    preferredExpanded !== undefined
      ? preferredExpanded ||
        isAnalysing ||
        isEditingScope ||
        Boolean(isStale) ||
        (!hasRun && !analyseError)
      : true;

  return (
    <>
      <CollapsibleStageCard
        title={SCOPE_DISCOVERY_UI_COPY.cardTitle}
        subtitle={SCOPE_DISCOVERY_UI_COPY.cardSubtitle}
        statusLabel={cardStatusLabel}
        statusVariant={cardStatusVariant}
        preferredExpanded={disclosureExpanded}
        canCollapse={hasRun && !isAnalysing && !isEditingScope}
        forceExpanded={isEditingScope || Boolean(isStale)}
        isActive={isActiveStage}
        summaryContent={
          completion.complete && !isEditingScope ? (
            <ScopeReviewCollapsedSummary lists={mergedScopeLists} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {summaryBits.join(" · ")}
            </p>
          )
        }
        actionLabel={
          completion.complete && !isEditingScope ? "View" : undefined
        }
      >
        <div className="space-y-4" aria-live="polite">
          {isStale ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              role="status"
            >
              <p>{SCOPE_DISCOVERY_UI_COPY.staleNotice}</p>
              <Button
                type="button"
                size="sm"
                className="mt-2 min-h-10"
                disabled={isAnalysing || pendingSuggestion != null || isSavingBatch}
                onClick={() => void handleAnalyse(true)}
              >
                {SCOPE_DISCOVERY_UI_COPY.analyseAgainButton}
              </Button>
            </div>
          ) : null}

          {providerPartialFailure ? (
            <p
              className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              {SCOPE_DISCOVERY_UI_COPY.providerPartialFailure}
            </p>
          ) : null}

          {analyseError ? (
            <p className="text-sm text-destructive" role="alert">
              {analyseError}
            </p>
          ) : null}
          {loadError ? (
            <p className="text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : null}
          {batchError ? (
            <p className="text-sm text-destructive" role="alert">
              {batchError}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMessage}
            </p>
          ) : null}

          {(isAnalysing || (!hasRun && !analyseError)) && !showManualAnalyse ? (
            <AnalysisProgressBanner
              label={
                isAnalysing
                  ? analysisProgressLabel(progressElapsedMs)
                  : SCOPE_DISCOVERY_UI_COPY.preparingAnalysis
              }
            />
          ) : null}

          {showManualAnalyse ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {SCOPE_DISCOVERY_UI_COPY.emptyPurpose}
              </p>
              <Button
                type="button"
                className="min-h-10 w-full sm:w-auto"
                disabled={isLoadingResults || isAnalysing}
                onClick={() => void handleAnalyse(false)}
              >
                {SCOPE_DISCOVERY_UI_COPY.analyseButton}
              </Button>
            </div>
          ) : null}

          {hasRun && !isAnalysing ? (
            <div className="space-y-4">
              <ScopeImpactRecommendationsPanel
                recommendations={scopeImpactRecommendations}
                rowStatus={impactRowStatus}
                rowError={impactRowError}
                busy={
                  impactActionId != null ||
                  isSavingBatch ||
                  pendingSuggestion != null ||
                  isAnalysing
                }
                onApply={(rec) => void handleApplyScopeImpact(rec)}
                onKeep={(rec) => void handleKeepScopeImpact(rec)}
              />

              {showChecklistEditor ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {SCOPE_DISCOVERY_UI_COPY.batchIntro}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {includedCount} selected · {excludedCount} not required
                    {completion.clarificationOpen
                      ? ` · clarifications pending save`
                      : ""}
                  </p>

                  {workAreaSections.map((section) => {
                    const items = [
                      ...section.grouped.important,
                      ...section.grouped.worthChecking,
                      ...section.grouped.clarifications,
                      ...section.grouped.other,
                      ...section.grouped.added,
                      ...section.grouped.dismissed,
                    ].filter(isScopeItemBatchEligible);
                    const manualForSection = section.workAreaId
                      ? manualItems.filter(
                          (item) => item.workAreaId === section.workAreaId
                        )
                      : [];
                    if (items.length === 0 && manualForSection.length === 0 && !section.workAreaId)
                      return null;
                    if (items.length === 0 && !section.workAreaId) return null;
                    const selected = items.filter(
                      (s) =>
                        (localBatch[s.suggestionId] ??
                          defaultBatchSelection(s, signalFacts)) === "INCLUDED"
                    ).length;
                    const manualIncluded = manualForSection.filter(
                      (item) =>
                        localManualBatch[item.id] ?? item.state === "INCLUDED"
                    ).length;
                    return (
                      <section
                        key={section.workAreaId ?? "project-wide"}
                        className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold">
                            {section.workAreaLabel}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {selected + manualIncluded} of{" "}
                            {items.length + manualForSection.length} included
                          </p>
                        </div>
                        <div className="space-y-0 divide-y-0">
                          {items.map((suggestion) => {
                            const state =
                              localBatch[suggestion.suggestionId] ??
                              defaultBatchSelection(suggestion, signalFacts);
                            return (
                              <div key={suggestion.suggestionId}>
                                <ChecklistRow
                                  suggestion={suggestion}
                                  included={state === "INCLUDED"}
                                  disabled={isSavingBatch}
                                  editing={showChecklistEditor}
                                  onToggle={(inc) =>
                                    setItemIncluded(
                                      suggestion.suggestionId,
                                      inc
                                    )
                                  }
                                  onRouteClarification={() =>
                                    routeClarification(suggestion.suggestionId)
                                  }
                                />
                                {state === "UNRESOLVED_CLARIFICATION" ? (
                                  <p className="px-3 pb-2 text-xs text-muted-foreground">
                                    Will be answered in Scope Details.
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                          {section.workAreaId
                            ? manualItems
                                .filter(
                                  (item) =>
                                    item.workAreaId === section.workAreaId
                                )
                                .map((item) => (
                                  <ManualScopeItemRow
                                    key={item.id}
                                    projectId={projectId}
                                    item={item}
                                    disabled={isSavingBatch}
                                    localIncluded={
                                      localManualBatch[item.id] ??
                                      item.state === "INCLUDED"
                                    }
                                    onLocalToggle={(inc) =>
                                      setManualIncluded(item.id, inc)
                                    }
                                  />
                                ))
                            : null}
                          {section.workAreaId ? (
                            <AddManualScopeItemForm
                              projectId={projectId}
                              workAreaId={section.workAreaId}
                              workAreaName={section.workAreaLabel}
                              disabled={isSavingBatch || isAnalysing}
                              onAdded={(item) => {
                                setManualItems((prev) => [...prev, item]);
                                setLocalManualBatch((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }));
                              }}
                            />
                          ) : null}
                        </div>
                      </section>
                    );
                  })}

                  {(() => {
                    const covered = new Set(
                      workAreaSections
                        .map((s) => s.workAreaId)
                        .filter(Boolean) as string[]
                    );
                    const labelEntries =
                      workAreaLabels instanceof Map
                        ? [...workAreaLabels.entries()]
                        : Object.entries(workAreaLabels);
                    return labelEntries
                      .filter(([id]) => id && !covered.has(id))
                      .map(([workAreaId, workAreaLabel]) => (
                        <section
                          key={workAreaId}
                          className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3"
                        >
                          <h3 className="text-sm font-semibold">
                            {workAreaLabel}
                          </h3>
                          <div>
                            {manualItems
                              .filter((item) => item.workAreaId === workAreaId)
                              .map((item) => (
                                <ManualScopeItemRow
                                  key={item.id}
                                  projectId={projectId}
                                  item={item}
                                  disabled={isSavingBatch}
                                  localIncluded={
                                    localManualBatch[item.id] ??
                                    item.state === "INCLUDED"
                                  }
                                  onLocalToggle={(inc) =>
                                    setManualIncluded(item.id, inc)
                                  }
                                />
                              ))}
                            <AddManualScopeItemForm
                              projectId={projectId}
                              workAreaId={workAreaId}
                              workAreaName={workAreaLabel}
                              disabled={isSavingBatch || isAnalysing}
                              onAdded={(item) => {
                                setManualItems((prev) => [...prev, item]);
                                setLocalManualBatch((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }));
                              }}
                            />
                          </div>
                        </section>
                      ));
                  })()}

                  <Button
                    type="button"
                    className="min-h-10 w-full sm:w-auto"
                    disabled={
                      isSavingBatch ||
                      (batchEligible.length === 0 && manualItems.length === 0)
                    }
                    onClick={() => void handleConfirmScope()}
                  >
                    {isSavingBatch ? (
                      <>
                        <Loader2
                          className="mr-2 size-4 animate-spin"
                          aria-hidden
                        />
                        {SCOPE_DISCOVERY_UI_COPY.savingScope}
                      </>
                    ) : (
                      SCOPE_DISCOVERY_UI_COPY.confirmScopeButton
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                    <p className="font-medium">
                      {SCOPE_DISCOVERY_UI_COPY.scopeConfirmed}
                    </p>
                    <ScopeReviewConfirmedSummaryLists
                      lists={mergedScopeLists}
                      includedRows={includedProvenanceRows}
                      onReviewScopeDetails={onReviewScopeDetails}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        onClick={() => {
                          setIsEditingScope(true);
                          setLocalBatch(clearLocalBatchState());
                          setLocalManualBatch(
                            buildInitialManualBatch(manualItems)
                          );
                        }}
                      >
                        {SCOPE_DISCOVERY_UI_COPY.editScopeButton}
                      </Button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Use Edit scope to include, exclude, or add scope items.
                    </p>
                  </div>
                </>
              )}

              {workAreaSuggestions.length > 0 ? (
                <SuggestionGroup
                  title="Additional work areas"
                  count={workAreaSuggestions.length}
                  defaultOpen
                >
                  {workAreaSuggestions.map((suggestion) => (
                    <ScopeDiscoverySuggestionCard
                      key={suggestion.suggestionId}
                      suggestion={suggestion}
                      defaultExpanded={false}
                      disabled={
                        isAnalysing ||
                        pendingSuggestion != null ||
                        isSavingBatch
                      }
                      pendingAction={
                        pendingSuggestion?.suggestionId ===
                        suggestion.suggestionId
                          ? pendingSuggestion.kind
                          : null
                      }
                      onAccept={() => handleAccept(suggestion)}
                      onEdit={() => {
                        setEditError(null);
                        setEditTarget(suggestion);
                      }}
                      onDismiss={() => {
                        setDismissError(null);
                        setDismissTarget(suggestion);
                      }}
                      onScrollToWorkArea={(workAreaId) => {
                        document
                          .querySelector(
                            `[data-work-area-id="${workAreaId}"]`
                          )
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }}
                    />
                  ))}
                </SuggestionGroup>
              ) : null}

              {conflictSuggestions.length > 0 ? (
                <SuggestionGroup
                  title={SCOPE_DISCOVERY_UI_COPY.groupConflicts}
                  count={conflictSuggestions.length}
                  defaultOpen
                >
                  {conflictSuggestions.map((suggestion) => (
                    <ScopeDiscoverySuggestionCard
                      key={suggestion.suggestionId}
                      suggestion={suggestion}
                      defaultExpanded
                      disabled={
                        isAnalysing ||
                        pendingSuggestion != null ||
                        isSavingBatch
                      }
                      pendingAction={
                        pendingSuggestion?.suggestionId ===
                        suggestion.suggestionId
                          ? pendingSuggestion.kind
                          : null
                      }
                      onAccept={() => handleAccept(suggestion)}
                      onEdit={() => {
                        setEditError(null);
                        setEditTarget(suggestion);
                      }}
                      onDismiss={() => {
                        setDismissError(null);
                        setDismissTarget(suggestion);
                      }}
                      onScrollToWorkArea={() => undefined}
                    />
                  ))}
                </SuggestionGroup>
              ) : null}

              {showAnalyseAgain && !isStale ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    disabled={pendingSuggestion != null || isSavingBatch}
                    onClick={() => void handleAnalyse(true)}
                  >
                    {SCOPE_DISCOVERY_UI_COPY.analyseAgainButton}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsibleStageCard>

      <ScopeDiscoveryEditDialog
        open={editTarget != null}
        suggestion={editTarget}
        isSaving={pendingSuggestion?.kind === "modify"}
        error={editError}
        onOpenChange={(open) => {
          if (!open && pendingSuggestion?.kind !== "modify") {
            setEditTarget(null);
            setEditError(null);
          }
        }}
        onSubmit={handleModify}
      />

      <ScopeDiscoveryDismissDialog
        open={dismissTarget != null}
        suggestion={dismissTarget}
        isSaving={pendingSuggestion?.kind === "reject"}
        error={dismissError}
        onOpenChange={(open) => {
          if (!open && pendingSuggestion?.kind !== "reject") {
            setDismissTarget(null);
            setDismissError(null);
          }
        }}
        onSubmit={handleDismiss}
      />
    </>
  );
}
