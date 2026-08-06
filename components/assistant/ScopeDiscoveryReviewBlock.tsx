"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { ScopeDiscoveryDismissDialog } from "@/components/assistant/ScopeDiscoveryDismissDialog";
import { ScopeDiscoveryEditDialog } from "@/components/assistant/ScopeDiscoveryEditDialog";
import { ScopeDiscoverySuggestionCard } from "@/components/assistant/ScopeDiscoverySuggestionCard";
import { createLatestWriteGuard } from "@/lib/assistant/answer-persistence";
import {
  acceptScopeSuggestionAction,
  getScopeDiscoveryResultsAction,
  modifyScopeSuggestionAction,
  rejectScopeSuggestionAction,
  runScopeDiscoveryAction,
} from "@/lib/scope-discovery/actions";
import type {
  SafeResultsRead,
  SafeSuggestionView,
} from "@/lib/scope-discovery/application/types";
import {
  SCOPE_DISCOVERY_UI_COPY,
  analysisProgressLabel,
  allSuggestionsDecided,
  groupSuggestionsByWorkAreaSections,
  groupSuggestionsForUi,
  summariseGroupCounts,
  type DismissReasonCode,
  type ScopeDiscoveryGroupedSuggestions,
  type WorkAreaSuggestionSection,
} from "@/lib/scope-discovery/ui";
import { cn } from "@/lib/utils";

type ScopeDiscoveryReviewBlockProps = {
  projectId: string;
  /** When false, render nothing (server is authority). */
  enabled: boolean;
  /** Server-loaded results — avoids client auto-provider calls; read-only. */
  initialResults?: SafeResultsRead | null;
  /** Confirmed work area id → display name for hierarchy. */
  workAreaLabels?: ReadonlyMap<string, string> | Record<string, string>;
};

type PendingSuggestionAction = {
  suggestionId: string;
  kind: "accept" | "modify" | "reject";
};

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

export function ScopeDiscoveryReviewBlock({
  projectId,
  enabled,
  initialResults = null,
  workAreaLabels = {},
}: ScopeDiscoveryReviewBlockProps) {
  const router = useRouter();
  const resultsGuard = useRef(createLatestWriteGuard());
  const analysingLock = useRef(false);
  const [results, setResults] = useState<SafeResultsRead | null>(
    initialResults
  );
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
  const [showDismissed, setShowDismissed] = useState(false);

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
    } catch {
      if (!resultsGuard.current.isCurrent(token)) return;
      setLoadError("Scope review results could not be loaded.");
    } finally {
      if (resultsGuard.current.isCurrent(token)) {
        setIsLoadingResults(false);
      }
    }
  }, [enabled, projectId]);

  useEffect(() => {
    if (!isAnalysing) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setProgressElapsedMs(Date.now() - started);
    }, 400);
    return () => window.clearInterval(timer);
  }, [isAnalysing]);

  const handleAnalyse = async (forceNewRun: boolean) => {
    if (!enabled || analysingLock.current || pendingSuggestion) return;
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
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setAnalyseError("Scope analysis could not be completed. Try again.");
    } finally {
      analysingLock.current = false;
      setIsAnalysing(false);
    }
  };

  const sourceRevision = results?.sourceRevision ?? `project:${projectId}`;

  const runDecision = async (
    suggestionId: string,
    kind: PendingSuggestionAction["kind"],
    fn: () => Promise<{
      ok: boolean;
      message: string;
      createdWorkAreaId?: string | null;
    }>
  ) => {
    if (pendingSuggestion || isAnalysing) return;
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
      startTransition(() => {
        router.refresh();
      });
      if (
        (kind === "accept" || kind === "modify") &&
        outcome.createdWorkAreaId
      ) {
        window.requestAnimationFrame(() => {
          document
            .querySelector(`[data-work-area-id="${outcome.createdWorkAreaId}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  if (!enabled) return null;

  const suggestions = results?.allSuggestions ?? [];
  const grouped = groupSuggestionsForUi(suggestions);
  const counts = summariseGroupCounts(grouped);
  const workAreaSections = groupSuggestionsByWorkAreaSections(
    suggestions,
    workAreaLabels
  );
  const useWorkAreaHierarchy =
    workAreaSections.length > 1 ||
    (workAreaSections.length === 1 && workAreaSections[0]?.workAreaId != null);
  const hasRun = Boolean(results?.runId);
  const decidedComplete = allSuggestionsDecided(suggestions);
  const isStale = Boolean(results?.stale);
  const providerPartialFailure = Boolean(results?.providerPartialFailure);

  const summaryBits: string[] = [];
  if (!hasRun) summaryBits.push("Not analysed");
  else {
    if (counts.important) summaryBits.push(`${counts.important} important`);
    if (counts.worthChecking)
      summaryBits.push(`${counts.worthChecking} worth checking`);
    if (counts.clarifications)
      summaryBits.push(`${counts.clarifications} clarifications`);
    if (counts.other) summaryBits.push(`${counts.other} other`);
    if (counts.conflicts) summaryBits.push(`${counts.conflicts} conflicts`);
    if (counts.dismissed) summaryBits.push(`${counts.dismissed} dismissed`);
    if (summaryBits.length === 0) summaryBits.push("No open suggestions");
  }

  const renderCards = (
    list: readonly SafeSuggestionView[],
    defaultExpanded: boolean
  ) =>
    list.map((suggestion) => (
      <ScopeDiscoverySuggestionCard
        key={suggestion.suggestionId}
        suggestion={suggestion}
        defaultExpanded={defaultExpanded && list.length <= 3}
        disabled={isAnalysing || pendingSuggestion != null}
        pendingAction={
          pendingSuggestion?.suggestionId === suggestion.suggestionId
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
            .querySelector(`[data-work-area-id="${workAreaId}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />
    ));

  const renderGroupedBuckets = (
    sectionGrouped: ScopeDiscoveryGroupedSuggestions,
    opts: { showDismissed: boolean; defaultImportantOpen: boolean }
  ) => (
    <>
      <SuggestionGroup
        title={SCOPE_DISCOVERY_UI_COPY.groupImportant}
        count={sectionGrouped.important.length}
        defaultOpen={opts.defaultImportantOpen}
      >
        {renderCards(sectionGrouped.important, true)}
      </SuggestionGroup>

      <SuggestionGroup
        title={SCOPE_DISCOVERY_UI_COPY.groupWorthChecking}
        count={sectionGrouped.worthChecking.length}
        defaultOpen={sectionGrouped.important.length === 0}
      >
        {renderCards(sectionGrouped.worthChecking, false)}
      </SuggestionGroup>

      <SuggestionGroup
        title={SCOPE_DISCOVERY_UI_COPY.groupClarifications}
        count={sectionGrouped.clarifications.length}
        defaultOpen
      >
        {renderCards(sectionGrouped.clarifications, true)}
      </SuggestionGroup>

      <SuggestionGroup
        title={SCOPE_DISCOVERY_UI_COPY.groupOther}
        count={sectionGrouped.other.length}
        defaultOpen={false}
      >
        {renderCards(sectionGrouped.other, false)}
      </SuggestionGroup>

      <SuggestionGroup
        title={SCOPE_DISCOVERY_UI_COPY.groupConflicts}
        count={sectionGrouped.conflicts.length}
        defaultOpen
      >
        {renderCards(sectionGrouped.conflicts, true)}
      </SuggestionGroup>

      {sectionGrouped.added.length > 0 ? (
        <SuggestionGroup
          title="Included"
          count={sectionGrouped.added.length}
          defaultOpen={false}
        >
          {renderCards(sectionGrouped.added, false)}
        </SuggestionGroup>
      ) : null}

      {opts.showDismissed && sectionGrouped.dismissed.length > 0 ? (
        <SuggestionGroup
          title={SCOPE_DISCOVERY_UI_COPY.groupExcluded}
          count={sectionGrouped.dismissed.length}
          defaultOpen={false}
        >
          {renderCards(sectionGrouped.dismissed, false)}
        </SuggestionGroup>
      ) : null}
    </>
  );

  const renderWorkAreaSection = (section: WorkAreaSuggestionSection) => {
    const complete =
      section.openCount === 0 &&
      (section.decidedCount > 0 ||
        section.grouped.inactive.length > 0 ||
        section.grouped.added.length + section.grouped.dismissed.length > 0);
    return (
      <section
        key={section.workAreaId ?? "project-wide"}
        className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3"
        data-scope-review-work-area={section.workAreaId ?? "project-wide"}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {section.workAreaLabel}
          </h3>
          <p className="text-xs text-muted-foreground">
            {complete
              ? "Complete"
              : section.openCount > 0
                ? `${section.openCount} to review`
                : "No open items"}
          </p>
        </div>
        {renderGroupedBuckets(section.grouped, {
          showDismissed: true,
          defaultImportantOpen: true,
        })}
      </section>
    );
  };

  return (
    <>
      <CollapsibleStageCard
        title={SCOPE_DISCOVERY_UI_COPY.cardTitle}
        subtitle={SCOPE_DISCOVERY_UI_COPY.cardSubtitle}
        statusLabel={
          isAnalysing
            ? "Analysing"
            : isStale
              ? "Out of date"
              : hasRun
                ? counts.openTotal > 0
                  ? "Review"
                  : "Complete"
                : "Ready"
        }
        statusVariant={
          isAnalysing
            ? "current"
            : isStale
              ? "stale"
              : hasRun
                ? counts.openTotal > 0
                  ? "review"
                  : "complete"
                : "current"
        }
        defaultExpanded
        canCollapse={hasRun && !isAnalysing}
        summaryContent={summaryBits.join(" · ")}
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
                disabled={isAnalysing || pendingSuggestion != null}
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

          {statusMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMessage}
            </p>
          ) : null}

          {isAnalysing ? (
            <div
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm"
              role="status"
              aria-live="assertive"
            >
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              <span>{analysisProgressLabel(progressElapsedMs)}</span>
            </div>
          ) : null}

          {!hasRun && !isAnalysing ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {SCOPE_DISCOVERY_UI_COPY.emptyPurpose}
              </p>
              <Button
                type="button"
                className="min-h-10 w-full sm:w-auto"
                disabled={isLoadingResults}
                onClick={() => void handleAnalyse(false)}
              >
                {SCOPE_DISCOVERY_UI_COPY.analyseButton}
              </Button>
            </div>
          ) : null}

          {hasRun && !isAnalysing ? (
            <div className="space-y-4">
              {counts.openTotal === 0 && !decidedComplete ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {SCOPE_DISCOVERY_UI_COPY.noSuggestions}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => void handleAnalyse(true)}
                  >
                    {SCOPE_DISCOVERY_UI_COPY.analyseAgainButton}
                  </Button>
                </div>
              ) : null}

              {decidedComplete ? (
                <p className="text-sm text-muted-foreground">
                  {SCOPE_DISCOVERY_UI_COPY.allDecided}
                </p>
              ) : null}

              {(counts.important > 0 ||
                counts.worthChecking > 0 ||
                counts.clarifications > 0 ||
                counts.other > 0 ||
                counts.conflicts > 0) && (
                <p className="text-xs text-muted-foreground">
                  {[
                    counts.important ? `${counts.important} important` : null,
                    counts.worthChecking
                      ? `${counts.worthChecking} worth checking`
                      : null,
                    counts.clarifications
                      ? `${counts.clarifications} clarifications`
                      : null,
                    counts.other ? `${counts.other} other` : null,
                    counts.conflicts
                      ? `${counts.conflicts} conflicts`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {useWorkAreaHierarchy ? (
                <div className="space-y-4">
                  {workAreaSections.map((section) =>
                    renderWorkAreaSection(section)
                  )}
                </div>
              ) : (
                <>
                  {renderGroupedBuckets(grouped, {
                    showDismissed: false,
                    defaultImportantOpen: true,
                  })}

                  {counts.dismissed > 0 ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setShowDismissed((prev) => !prev)}
                      >
                        {showDismissed
                          ? "Hide dismissed"
                          : `Show dismissed (${counts.dismissed})`}
                      </button>
                      {showDismissed
                        ? renderCards(grouped.dismissed, false)
                        : null}
                    </div>
                  ) : null}
                </>
              )}

              {!isStale ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    disabled={pendingSuggestion != null}
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
