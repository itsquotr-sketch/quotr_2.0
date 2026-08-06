"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScopeChangeRecommendation } from "@/lib/scope-discovery/scope-impact";
import {
  applyActionLabel,
  humanScopeStateLabel,
  keepActionLabel,
} from "@/lib/scope-discovery/ui/scope-impact-identity";
import { cn } from "@/lib/utils";

export type ScopeImpactRecommendationRowStatus =
  | "idle"
  | "applying"
  | "keeping"
  | "applied"
  | "kept"
  | "failed";

type ScopeImpactRecommendationsPanelProps = {
  recommendations: readonly ScopeChangeRecommendation[];
  rowStatus: ReadonlyMap<string, ScopeImpactRecommendationRowStatus>;
  rowError: ReadonlyMap<string, string>;
  busy: boolean;
  onApply: (rec: ScopeChangeRecommendation) => void;
  onKeep: (rec: ScopeChangeRecommendation) => void;
};

/**
 * Compact “Scope changes to review” panel — human labels only.
 * Never renders Fact keys, catalogue IDs, or suggestion UUIDs.
 */
export function ScopeImpactRecommendationsPanel({
  recommendations,
  rowStatus,
  rowError,
  busy,
  onApply,
  onKeep,
}: ScopeImpactRecommendationsPanelProps) {
  const headingId = useId();

  if (recommendations.length === 0) return null;

  return (
    <section
      className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3"
      aria-labelledby={headingId}
    >
      <div className="space-y-1">
        <h3 id={headingId} className="text-sm font-medium">
          Scope changes to review
        </h3>
        <p className="text-xs text-muted-foreground">
          Answers suggest a scope change. You stay in control — apply the
          change or keep the current scope.
        </p>
      </div>

      <ul className="space-y-3" role="list">
        {recommendations.map((rec) => {
          const status = rowStatus.get(rec.id) ?? "idle";
          const error = rowError.get(rec.id);
          const pending = status === "applying" || status === "keeping";
          const titleId = `${headingId}-${rec.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          const applyLabel = applyActionLabel(
            rec.suggestedState,
            rec.scopeItemTitle
          );
          const keepLabel = keepActionLabel(rec.scopeItemTitle);

          return (
            <li
              key={rec.id}
              className="space-y-2 rounded-md border border-border/50 bg-background/70 px-3 py-2.5"
            >
              <div className="space-y-1">
                <p id={titleId} className="text-sm font-medium leading-snug">
                  {rec.scopeItemTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rec.workAreaLabel}
                </p>
                <dl className="grid gap-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Current</dt>
                    <dd>{humanScopeStateLabel(rec.previousState)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Suggested</dt>
                    <dd>{humanScopeStateLabel(rec.suggestedState)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Because: {rec.triggeringSummary}
                </p>
                <p className="text-xs text-muted-foreground">{rec.explanation}</p>
              </div>

              {status === "applied" || status === "kept" ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {status === "applied"
                    ? "Change applied."
                    : "Kept current scope."}
                </p>
              ) : (
                <div
                  className={cn(
                    "flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                  )}
                >
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || pending}
                    aria-labelledby={titleId}
                    aria-busy={status === "applying"}
                    onClick={() => onApply(rec)}
                  >
                    {status === "applying" ? (
                      <>
                        <Loader2
                          className="mr-1.5 size-3.5 animate-spin"
                          aria-hidden
                        />
                        Applying…
                      </>
                    ) : (
                      "Apply change"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || pending}
                    aria-labelledby={titleId}
                    aria-busy={status === "keeping"}
                    onClick={() => onKeep(rec)}
                  >
                    {status === "keeping" ? (
                      <>
                        <Loader2
                          className="mr-1.5 size-3.5 animate-spin"
                          aria-hidden
                        />
                        Saving…
                      </>
                    ) : (
                      "Keep current scope"
                    )}
                  </Button>
                  <span className="sr-only">
                    {applyLabel}. {keepLabel}.
                  </span>
                </div>
              )}

              {error ? (
                <p
                  className="text-xs text-destructive"
                  role="alert"
                  tabIndex={-1}
                >
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
