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
  const parts = [
    `${lists.included.length} included`,
    `${lists.notRequired.length} not required`,
    `${lists.needsDetail.length} need detail`,
  ];
  return <CompactLine>{parts.join(" · ")}</CompactLine>;
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
