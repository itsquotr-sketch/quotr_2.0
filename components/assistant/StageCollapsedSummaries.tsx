"use client";

/**
 * Stage 3.1B.7B / 7G — Compact collapsed summaries (presentation only).
 * Collapsed chrome answers “What happened here?” in one or two lines.
 * Full detail remains in the expanded stage body.
 */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  HelpCircle,
  Ruler,
  Layers,
  Shield,
  Paintbrush,
} from "lucide-react";
import type {
  EstimateReviewSummaryModel,
  ProjectCaptureSummaryModel,
  QualitySummaryModel,
  QuestionGroupSummary,
  ScopeItemSummaryLists,
  WorkAreaFactHighlight,
  WorkAreaSummaryLists,
} from "@/lib/assistant/stage-completion-summaries";
import { compactSummaryOverflow } from "@/lib/assistant/stage-completion-summaries";
import { cn } from "@/lib/utils";

function CompactLine({ children }: { children: ReactNode }) {
  return (
    <p className="line-clamp-2 text-xs font-medium text-foreground/90">
      {children}
    </p>
  );
}

function GroupIcon({
  icon,
}: {
  icon: QuestionGroupSummary["icon"];
}) {
  const className = "size-3.5 shrink-0 text-muted-foreground";
  switch (icon) {
    case "measurements":
      return <Ruler className={className} aria-hidden />;
    case "existing":
      return <Layers className={className} aria-hidden />;
    case "finishes":
      return <Paintbrush className={className} aria-hidden />;
    case "compliance":
      return <Shield className={className} aria-hidden />;
    case "unknown":
      return <HelpCircle className={className} aria-hidden />;
    default:
      return <Check className={className} aria-hidden />;
  }
}

export function ProjectCaptureCollapsedSummary({
  model,
}: {
  model: ProjectCaptureSummaryModel;
}) {
  return <CompactLine>{model.outcomeLabel}</CompactLine>;
}

export function WorkAreasCollapsedSummary({
  lists,
  highlights,
}: {
  lists: WorkAreaSummaryLists;
  highlights?: readonly WorkAreaFactHighlight[];
}) {
  const names =
    lists.included.length === 0
      ? "No work areas"
      : lists.included.length <= 2
        ? lists.included.join(" · ")
        : `${lists.included.slice(0, 2).join(" · ")} +${lists.included.length - 2}`;
  const countLabel =
    lists.included.length === 1
      ? "1 confirmed"
      : `${lists.included.length} confirmed`;
  const excluded =
    lists.notIncluded.length > 0
      ? ` · ${lists.notIncluded.length} not included`
      : "";

  // Prefer compact outcome; highlights remain available when stage is expanded.
  void highlights;

  return (
    <CompactLine>
      {names} · {countLabel}
      {excluded}
    </CompactLine>
  );
}

export function ScopeReviewCollapsedSummary({
  lists,
}: {
  lists: ScopeItemSummaryLists;
}) {
  const pending = lists.pendingScopeDetails?.length ?? lists.needsDetail.length;
  const parts = [
    `${lists.included.length} included`,
    `${lists.notRequired.length} not required`,
  ];
  if (pending > 0) {
    parts.push(`${pending} to confirm in Scope Details`);
  }
  return <CompactLine>{parts.join(" · ")}</CompactLine>;
}

/** Named Included / Not required / To confirm in Scope Details lists. */
export function ScopeReviewConfirmedSummaryLists({
  lists,
  includedRows,
  workAreaLabel,
  onReviewScopeDetails,
}: {
  lists: ScopeItemSummaryLists;
  /** Optional provenance rows (Added by you · Pricing required). */
  includedRows?: readonly {
    readonly title: string;
    readonly secondary: string | null;
  }[];
  workAreaLabel?: string;
  onReviewScopeDetails?: () => void;
}) {
  const pending = lists.pendingScopeDetails ?? [];
  return (
    <div className="space-y-3 text-sm">
      {workAreaLabel ? (
        <p className="font-medium text-foreground">{workAreaLabel}</p>
      ) : null}
      <SummaryCategory
        title="Included"
        marker="✓"
        items={lists.included}
        rows={includedRows}
        emptyLabel="None included"
      />
      <SummaryCategory
        title="Not required"
        marker="×"
        items={lists.notRequired}
        emptyLabel="None marked not required"
      />
      {pending.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            To confirm in Scope Details
            <span className="ml-1 font-normal normal-case text-muted-foreground/80">
              ({pending.length})
            </span>
          </p>
          <ul className="mt-1 space-y-2">
            {pending.slice(0, 3).map((item) => (
              <li key={item.title} className="text-sm leading-snug">
                <span className="mr-1.5 text-muted-foreground" aria-hidden>
                  △
                </span>
                <span className="font-medium">{item.title}</span>
                <p className="mt-0.5 pl-4 text-xs text-muted-foreground">
                  {item.reason}
                </p>
              </li>
            ))}
            {pending.length > 3 ? (
              <li className="text-xs text-muted-foreground">
                +{pending.length - 3} more
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These items are included in scope. Quotr will ask for the missing
            information in Scope Details.
          </p>
          {onReviewScopeDetails ? (
            <button
              type="button"
              className="mt-2 text-xs font-medium text-foreground underline-offset-2 hover:underline"
              onClick={onReviewScopeDetails}
            >
              Review Scope Details
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCategory({
  title,
  marker,
  items,
  rows,
  emptyLabel,
}: {
  title: string;
  marker: string;
  items: readonly string[];
  rows?: readonly {
    readonly title: string;
    readonly secondary: string | null;
  }[];
  emptyLabel?: string;
}) {
  const displayRows =
    rows && rows.length > 0
      ? rows
      : items.map((itemTitle) => ({
          title: itemTitle,
          secondary: null as string | null,
        }));
  const { visible, overflow } = compactSummaryOverflow(
    displayRows.map((r) => r.title)
  );
  const visibleRows = displayRows.slice(0, visible.length);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {displayRows.length > 0 ? (
          <span className="ml-1 font-normal normal-case text-muted-foreground/80">
            ({displayRows.length})
          </span>
        ) : null}
      </p>
      {displayRows.length === 0 ? (
        emptyLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p>
        ) : null
      ) : (
        <ul className="mt-1 space-y-0.5">
          {visibleRows.map((row) => (
            <li key={row.title} className="text-sm leading-snug">
              <span className="mr-1.5 text-muted-foreground" aria-hidden>
                {marker}
              </span>
              <span className="font-medium">{row.title}</span>
              {row.secondary ? (
                <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground">
                  {row.secondary}
                </p>
              ) : null}
            </li>
          ))}
          {overflow > 0 ? (
            <li className="text-xs text-muted-foreground">+{overflow} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export function QualityCollapsedSummary({
  model,
}: {
  model: QualitySummaryModel;
}) {
  return <CompactLine>{model.title}</CompactLine>;
}

export function QuestionsCollapsedSummary({
  groups,
  answeredCount,
}: {
  groups: readonly QuestionGroupSummary[];
  /** Optional answered count for a denser one-line summary (7G). */
  answeredCount?: number;
}) {
  if (answeredCount != null) {
    const openGroups = groups.filter((g) => g.status === "open").length;
    const complete =
      openGroups === 0 && groups.some((g) => g.status === "complete");
    return (
      <CompactLine>
        {answeredCount} answered
        {complete ? " · complete" : openGroups > 0 ? " · in progress" : ""}
      </CompactLine>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No questions collected for this project yet.
      </p>
    );
  }

  // Fallback denser list (still short) when no answeredCount provided
  return (
    <ul className="space-y-1">
      {groups.slice(0, 4).map((g) => (
        <li
          key={g.label}
          className="flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <span className="flex items-center gap-1.5 font-medium text-foreground/90">
            <GroupIcon icon={g.icon} />
            {g.label}
          </span>
          <span
            className={cn(
              "text-[11px] text-muted-foreground",
              g.status === "complete" && "text-foreground/80",
              g.status === "assumptions" && "text-amber-800 dark:text-amber-200"
            )}
          >
            {g.status === "complete" ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3" aria-hidden />
                {g.detail}
              </span>
            ) : g.status === "assumptions" ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="size-3" aria-hidden />
                {g.detail}
              </span>
            ) : (
              g.detail
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EstimateReviewCollapsedSummary({
  model,
}: {
  model: EstimateReviewSummaryModel;
}) {
  return <CompactLine>{model.outcomeLabel}</CompactLine>;
}

export function ConstraintsCollapsedSummary({
  chips,
}: {
  chips: readonly string[];
}) {
  if (chips.length === 0) {
    return <CompactLine>None applied</CompactLine>;
  }
  return (
    <CompactLine>
      {chips.length === 1
        ? "1 applied"
        : `${chips.length} applied`}
      {chips[0] ? ` · ${chips[0]}` : ""}
    </CompactLine>
  );
}
