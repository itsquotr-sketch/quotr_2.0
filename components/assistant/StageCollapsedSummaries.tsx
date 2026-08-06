"use client";

/**
 * Stage 3.1B.7B — Compact collapsed summaries (presentation only).
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
import { SUMMARY_VISIBLE_ITEM_LIMIT } from "@/lib/assistant/stage-completion-summaries";
import { cn } from "@/lib/utils";

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-0.5 text-xs text-foreground/90">{children}</div>
    </div>
  );
}

function ItemList({
  items,
  empty,
  marker,
  limit = SUMMARY_VISIBLE_ITEM_LIMIT,
}: {
  items: readonly string[];
  empty?: string;
  marker?: "check" | "x" | "none";
  limit?: number;
}) {
  if (items.length === 0) {
    return (
      <span className="text-muted-foreground">
        {empty ?? "None identified"}
      </span>
    );
  }
  const visible = items.slice(0, limit);
  const overflow = items.length - visible.length;
  return (
    <ul className="space-y-0.5">
      {visible.map((item) => (
        <li key={item} className="flex gap-1.5">
          {marker === "check" ? (
            <Check
              className="mt-0.5 size-3 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {marker === "x" ? (
            <span className="text-muted-foreground" aria-hidden>
              ✕
            </span>
          ) : null}
          <span className="min-w-0 truncate font-medium text-foreground/90">
            {item}
          </span>
        </li>
      ))}
      {overflow > 0 ? (
        <li className="text-muted-foreground">+{overflow} more</li>
      ) : null}
    </ul>
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
  return (
    <div className="space-y-1">
      <p className="line-clamp-2 text-xs font-medium text-foreground/90">
        {model.briefPreview}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {model.noteCount === 0
          ? "No site notes captured yet"
          : `${model.noteCount} site note${model.noteCount === 1 ? "" : "s"}`}
        {model.lastUpdatedLabel ? ` · ${model.lastUpdatedLabel}` : null}
      </p>
    </div>
  );
}

export function WorkAreasCollapsedSummary({
  lists,
  highlights,
}: {
  lists: WorkAreaSummaryLists;
  highlights?: readonly WorkAreaFactHighlight[];
}) {
  if (highlights && highlights.length > 0) {
    return (
      <div className="space-y-2">
        {highlights.slice(0, 4).map((wa) => (
          <div key={wa.workAreaName} className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              {wa.workAreaName}
            </p>
            {wa.bullets.length > 0 ? (
              <ul className="mt-0.5 space-y-0.5">
                {wa.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-1.5 text-[11px] text-muted-foreground"
                  >
                    <span aria-hidden>•</span>
                    <span className="min-w-0 truncate">{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No highlight facts yet
              </p>
            )}
          </div>
        ))}
        {highlights.length > 4 ? (
          <p className="text-[11px] text-muted-foreground">
            +{highlights.length - 4} more work areas
          </p>
        ) : null}
        {lists.notIncluded.length > 0 ? (
          <SummarySection title="Not included">
            <ItemList items={lists.notIncluded} limit={3} />
          </SummarySection>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <SummarySection title="Included">
        <ItemList items={lists.included} empty="No work areas included" />
      </SummarySection>
      <SummarySection title="Not included">
        <ItemList
          items={lists.notIncluded}
          empty="No excluded work areas"
        />
      </SummarySection>
    </div>
  );
}

export function ScopeReviewCollapsedSummary({
  lists,
}: {
  lists: ScopeItemSummaryLists;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <SummarySection title="Included">
        <ItemList
          items={lists.included}
          marker="check"
          empty="No items included yet"
        />
      </SummarySection>
      <SummarySection title="Not required">
        <ItemList
          items={lists.notRequired}
          marker="x"
          empty="Nothing marked not required"
        />
      </SummarySection>
      <SummarySection title="Needs detail">
        <ItemList
          items={lists.needsDetail}
          empty="No clarifications outstanding"
        />
      </SummarySection>
    </div>
  );
}

export function QualityCollapsedSummary({
  model,
}: {
  model: QualitySummaryModel;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-foreground">{model.title}</p>
      {model.lines.map((line) => (
        <p key={line} className="text-[11px] text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

export function QuestionsCollapsedSummary({
  groups,
}: {
  groups: readonly QuestionGroupSummary[];
}) {
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No questions collected for this project yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {groups.map((g) => (
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
  const rows: { label: string; value: string }[] = [
    { label: "Description", value: model.descriptionLabel },
    { label: "Measurements", value: model.measurementsLabel },
    { label: "Scope items", value: model.scopeItemsLabel },
    { label: "Assumptions", value: model.assumptionsLabel },
    { label: "Site constraints", value: model.siteConstraintsLabel },
    { label: "Ready", value: model.ready ? "Yes" : "Pending" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
      {rows.map((row) => (
        <li key={row.label} className="min-w-0 text-xs">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {row.label}
          </span>
          <p className="truncate text-xs font-medium text-foreground/90">
            {row.value}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ConstraintsCollapsedSummary({
  chips,
}: {
  chips: readonly string[];
}) {
  if (chips.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No additional site constraints identified from the project.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-foreground/90"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}
