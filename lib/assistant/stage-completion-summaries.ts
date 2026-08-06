/**
 * Stage 3.1B.7A/7B — Compact completion summary builders (presentation only).
 * No persistence, AI, or commercial logic. Never fabricates Facts.
 */

import type { QualityLevel, Question, WorkArea } from "@/components/assistant/types";
import { QUALITY_OPTIONS } from "@/components/assistant/QualityBlock";
import type { ScopeReview, ScopeReviewFact } from "@/lib/assistant/types";
import {
  formatAnswerOptionLabel,
  formatFactValueForDisplay,
} from "@/lib/scopes/fact-labels";

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

export const SUMMARY_VISIBLE_ITEM_LIMIT = 5;

export type WorkAreaSummaryLists = {
  readonly included: readonly string[];
  readonly notIncluded: readonly string[];
};

export function buildWorkAreaSummaryLists(
  workAreas: readonly WorkArea[]
): WorkAreaSummaryLists {
  return {
    included: workAreas
      .filter((wa) => wa.status !== "excluded")
      .map((wa) => wa.name),
    notIncluded: workAreas
      .filter((wa) => wa.status === "excluded")
      .map((wa) => wa.name),
  };
}

export type WorkAreaFactHighlight = {
  readonly workAreaName: string;
  readonly bullets: readonly string[];
};

/**
 * Per–Work Area dashboard bullets from existing Facts (+ known quality label).
 * Skips empty values; never invents measurements.
 */
export function buildWorkAreaFactHighlights(params: {
  readonly workAreas: readonly WorkArea[];
  readonly scopeReview: ScopeReview;
  readonly qualityLevel?: QualityLevel | null;
}): readonly WorkAreaFactHighlight[] {
  const qualityTitle = params.qualityLevel
    ? QUALITY_OPTIONS.find((o) => o.value === params.qualityLevel)?.title
    : null;

  return params.workAreas
    .filter((wa) => wa.status !== "excluded")
    .map((wa) => {
      const review = params.scopeReview.workAreas.find(
        (r) => r.workAreaId === wa.id
      );
      const bullets = pickFactHighlightBullets({
        facts: review?.facts ?? [],
        qualityTitle: qualityTitle ?? null,
      });
      return { workAreaName: wa.name, bullets };
    });
}

function pickFactHighlightBullets(params: {
  readonly facts: readonly ScopeReviewFact[];
  readonly qualityTitle: string | null;
}): string[] {
  const bullets: string[] = [];
  if (params.qualityTitle) {
    bullets.push(`${params.qualityTitle} specification`);
  }

  const ranked = [...params.facts]
    .map((fact) => ({
      fact,
      score: factHighlightScore(fact),
      line: formatFactHighlightLine(fact),
    }))
    .filter((row) => row.line && row.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const row of ranked) {
    if (!row.line) continue;
    if (bullets.some((b) => b.toLowerCase() === row.line!.toLowerCase())) {
      continue;
    }
    bullets.push(row.line);
    if (bullets.length >= 4) break;
  }

  return bullets;
}

function factHighlightScore(fact: ScopeReviewFact): number {
  const key = fact.key.toLowerCase();
  if (/area_m2|area/.test(key)) return 100;
  if (/length|width|height|lm\b/.test(key)) return 90;
  if (/material|timber|board|finish|coating/.test(key)) return 80;
  if (/existing|demolition|removal|new_construction|condition/.test(key)) {
    return 70;
  }
  if (/access|slope|level/.test(key)) return 60;
  if (fact.unit) return 40;
  return 20;
}

function formatFactHighlightLine(fact: ScopeReviewFact): string | null {
  const display =
    formatFactValueForDisplay(
      fact.rawValue ?? fact.value,
      fact.unit,
      fact.options
    ) ?? (fact.value?.trim() ? fact.value.trim() : null);
  if (!display || display === "—") return null;

  const key = fact.key.toLowerCase();
  // Measurement-like: show value with unit context (value already may include unit)
  if (/area_m2|length|width|height|lm|count|span/.test(key)) {
    return display;
  }
  // Booleans / yes-no style: prefer human label from fact label + short value
  if (/^(yes|no|true|false)$/i.test(display)) {
    if (/existing|demolition|removal/.test(key)) {
      return display.toLowerCase() === "yes" || display.toLowerCase() === "true"
        ? fact.label || "Existing work"
        : null;
    }
    return `${fact.label}: ${display}`;
  }
  // Materials / enums: value alone is often enough
  if (/material|timber|finish|access|condition/.test(key)) {
    return display;
  }
  return `${fact.label}: ${display}`;
}

export type ProjectCaptureSummaryModel = {
  readonly briefPreview: string;
  readonly noteCount: number;
  readonly lastUpdatedLabel: string | null;
  readonly outcomeLabel: string;
};

export function buildProjectCaptureSummaryModel(params: {
  readonly briefText: string;
  readonly noteCount: number;
  readonly lastUpdatedAt?: string | null;
}): ProjectCaptureSummaryModel {
  const trimmed = params.briefText.trim().replace(/\s+/g, " ");
  const notePart =
    params.noteCount === 0
      ? "No site notes yet"
      : `${params.noteCount} site note${params.noteCount === 1 ? "" : "s"}`;
  return {
    briefPreview: trimmed
      ? truncateText(trimmed, 72)
      : "No written brief yet",
    noteCount: params.noteCount,
    lastUpdatedLabel: params.lastUpdatedAt
      ? formatRelativeUpdated(params.lastUpdatedAt)
      : null,
    outcomeLabel: trimmed
      ? `Brief captured · ${notePart}`
      : notePart,
  };
}

function formatRelativeUpdated(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const delta = Date.now() - ms;
  if (delta < 60_000) return "Updated just now";
  if (delta < 3_600_000) {
    const m = Math.floor(delta / 60_000);
    return `Updated ${m} min ago`;
  }
  if (delta < 86_400_000) {
    const h = Math.floor(delta / 3_600_000);
    return `Updated ${h}h ago`;
  }
  return `Updated ${new Date(ms).toLocaleDateString()}`;
}

export type QualitySummaryModel = {
  readonly title: string;
  readonly lines: readonly string[];
  readonly outcomeLabel: string;
};

/** Spec-level summary lines — presentation only. */
export function buildQualitySummaryModel(
  level: QualityLevel | null
): QualitySummaryModel {
  if (!level) {
    return { title: "Not selected", lines: [], outcomeLabel: "Not selected" };
  }
  const option = QUALITY_OPTIONS.find((o) => o.value === level);
  const title = option?.title ?? level;
  if (level === "premium") {
    return {
      title,
      lines: ["High finish", "Higher labour allowance"],
      outcomeLabel: `${title} finish selected`,
    };
  }
  if (level === "budget") {
    return {
      title,
      lines: ["Practical finish", "Cost-conscious allowances"],
      outcomeLabel: `${title} finish selected`,
    };
  }
  if (level === "standard") {
    return {
      title,
      lines: ["Typical contractor-grade finish"],
      outcomeLabel: `${title} finish selected`,
    };
  }
  return {
    title,
    lines: [option?.description ?? "Standard assumptions for now"],
    outcomeLabel: `${title} selected`,
  };
}

export type QuestionGroupSummary = {
  readonly label: string;
  readonly status: "complete" | "assumptions" | "open" | "none";
  readonly detail: string;
  readonly icon: "measurements" | "existing" | "finishes" | "compliance" | "unknown" | "other";
};

/**
 * Heuristic presentation groups for question summaries.
 * Does not reorder or remove questions — display only.
 */
export function buildQuestionGroupSummaries(params: {
  readonly questions: readonly Question[];
  readonly answers: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >;
}): readonly QuestionGroupSummary[] {
  const groups: {
    label: string;
    icon: QuestionGroupSummary["icon"];
    match: (q: Question) => boolean;
  }[] = [
    {
      label: "Measurements",
      icon: "measurements",
      match: (q) =>
        /length|width|height|area|m2|metre|meter|size|dimension|count|span/i.test(
          `${q.key} ${q.label}`
        ),
    },
    {
      label: "Existing conditions",
      icon: "existing",
      match: (q) =>
        /existing|condition|demolition|removal|structure|substrate|substructure/i.test(
          `${q.key} ${q.label}`
        ),
    },
    {
      label: "Finishes",
      icon: "finishes",
      match: (q) =>
        /finish|coating|paint|stain|material|board|decking|fascia|handrail_finish/i.test(
          `${q.key} ${q.label}`
        ),
    },
    {
      label: "Compliance",
      icon: "compliance",
      match: (q) =>
        /balustrade|handrail|permit|consent|code|compliance|engineering|barrier/i.test(
          `${q.key} ${q.label}`
        ),
    },
  ];

  const used = new Set<string>();
  const results: QuestionGroupSummary[] = [];

  for (const group of groups) {
    const qs = params.questions.filter((q) => group.match(q));
    if (qs.length === 0) continue;
    for (const q of qs) used.add(q.id);
    results.push(
      summariseQuestionGroup(group.label, group.icon, qs, params.answers)
    );
  }

  const other = params.questions.filter((q) => !used.has(q.id));
  if (other.length > 0) {
    results.push(
      summariseQuestionGroup("Other details", "other", other, params.answers)
    );
  }

  // Unknowns roll-up — presentation only from not-sure style answers
  const unknownCount = params.questions.filter((q) => {
    const value = params.answers[q.id] ?? q.value ?? null;
    if (value === null || value === undefined || value === "") return false;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    return /not sure|unknown|unsure/i.test(text);
  }).length;
  results.push({
    label: "Unknowns",
    icon: "unknown",
    status: unknownCount === 0 ? "none" : "assumptions",
    detail: unknownCount === 0 ? "None" : `${unknownCount} listed`,
  });

  if (results.length === 1 && params.questions.length > 0) {
    // Only Unknowns — still show a Questions group
    results.unshift(
      summariseQuestionGroup(
        "Questions",
        "other",
        params.questions,
        params.answers
      )
    );
  }

  return results;
}

export function countAnsweredQuestions(params: {
  readonly questions: readonly Question[];
  readonly answers: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >;
}): number {
  let n = 0;
  for (const q of params.questions) {
    const value = params.answers[q.id] ?? q.value ?? null;
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    n += 1;
  }
  return n;
}

function summariseQuestionGroup(
  label: string,
  icon: QuestionGroupSummary["icon"],
  questions: readonly Question[],
  answers: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >
): QuestionGroupSummary {
  let assumptions = 0;
  let open = 0;
  for (const q of questions) {
    const value = answers[q.id] ?? q.value ?? null;
    if (value === null || value === undefined || value === "") {
      open += 1;
      continue;
    }
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (/not sure|unknown|unsure/i.test(text)) {
      assumptions += 1;
    }
  }
  if (open > 0) {
    return {
      label,
      icon,
      status: "open",
      detail: `${open} open`,
    };
  }
  if (assumptions > 0) {
    return {
      label,
      icon,
      status: "assumptions",
      detail:
        assumptions === 1 ? "1 assumption" : `${assumptions} assumptions`,
    };
  }
  return { label, icon, status: "complete", detail: "Complete" };
}

export type ScopeItemSummaryLists = {
  readonly included: readonly string[];
  readonly notRequired: readonly string[];
  readonly needsDetail: readonly string[];
};

export function buildScopeItemSummaryLists(params: {
  readonly suggestions: readonly {
    readonly proposedTitle: string;
    readonly decisionState: string;
    readonly latestReasonCode?: string | null;
    readonly proposalClass?: string;
  }[];
}): ScopeItemSummaryLists {
  const included: string[] = [];
  const notRequired: string[] = [];
  const needsDetail: string[] = [];

  for (const s of params.suggestions) {
    const cls = String(s.proposalClass ?? "");
    if (
      cls !== "SCOPE_ITEM" &&
      cls !== "CLARIFICATION" &&
      cls !== "EXCLUSION"
    ) {
      continue;
    }
    const reason = String(s.latestReasonCode ?? "");
    if (reason.includes("pending") || reason.includes("routed")) {
      needsDetail.push(s.proposedTitle);
      continue;
    }
    const state = String(s.decisionState).toUpperCase();
    if (state === "ACCEPTED" || state === "MODIFIED") {
      included.push(s.proposedTitle);
    } else if (state === "REJECTED") {
      notRequired.push(s.proposedTitle);
    }
  }

  return { included, notRequired, needsDetail };
}

export type EstimateReviewSummaryModel = {
  readonly descriptionLabel: string;
  readonly measurementsLabel: string;
  readonly scopeItemsLabel: string;
  readonly assumptionsLabel: string;
  readonly siteConstraintsLabel: string;
  readonly ready: boolean;
  readonly outcomeLabel: string;
};

export function buildEstimateReviewSummaryModel(params: {
  readonly scopeReview: ScopeReview;
  readonly estimateReady: boolean;
  readonly estimateStale?: boolean;
  readonly constraintCount?: number;
  readonly includedScopeItemCount?: number;
}): EstimateReviewSummaryModel {
  const workAreas = params.scopeReview.workAreas;
  const factCount = workAreas.reduce((n, wa) => n + wa.facts.length, 0);
  const missing = workAreas.reduce((n, wa) => n + wa.missingItems.length, 0);
  const assumptions =
    params.scopeReview.generalAssumptions.length +
    workAreas.reduce((n, wa) => n + wa.assumptions.length, 0);
  const withDescription = workAreas.filter((wa) =>
    Boolean(wa.quoteDescription?.trim() || wa.summary?.trim())
  ).length;
  const constraintCount = params.constraintCount ?? 0;
  const scopeItemCount =
    params.includedScopeItemCount ??
    workAreas.reduce(
      (n, wa) => n + (wa.facts.length > 0 ? 1 : 0),
      0
    );

  const ready = params.estimateReady && !params.estimateStale;

  return {
    descriptionLabel:
      withDescription > 0
        ? `${withDescription} ready`
        : workAreas.length === 0
          ? "None yet"
          : "Review",
    measurementsLabel:
      missing > 0
        ? `${missing} missing`
        : factCount > 0
          ? "Complete"
          : "None yet",
    scopeItemsLabel:
      scopeItemCount === 0
        ? "None yet"
        : `${scopeItemCount} included`,
    assumptionsLabel:
      assumptions === 0
        ? "None"
        : assumptions === 1
          ? "1 listed"
          : `${assumptions} listed`,
    siteConstraintsLabel:
      constraintCount === 0
        ? "None applied"
        : `${constraintCount} applied`,
    ready,
    outcomeLabel: params.estimateStale
      ? "Needs refresh"
      : ready
        ? "Ready for estimate"
        : "Inputs under review",
  };
}

export function buildConstraintChipLabels(params: {
  readonly questions: readonly Question[];
  readonly answers: Readonly<
    Record<string, string | number | boolean | string[] | null | undefined>
  >;
  readonly submittedRows?: readonly {
    readonly label: string;
    readonly value: string | number | boolean;
  }[];
}): readonly string[] {
  if (params.submittedRows && params.submittedRows.length > 0) {
    return params.submittedRows
      .map((row) => {
        const value = formatAnswerOptionLabel(row.value);
        if (!value || value === "—") return null;
        if (/access|carry|occupied|slope|hours|waste/i.test(row.label)) {
          return `${row.label}: ${value}`;
        }
        return value === "Yes" || value === "No"
          ? `${row.label}`
          : `${row.label}: ${value}`;
      })
      .filter((v): v is string => Boolean(v))
      .slice(0, 6);
  }

  const chips: string[] = [];
  for (const q of params.questions) {
    const raw = params.answers[q.id] ?? q.value ?? null;
    if (raw === null || raw === undefined || raw === "") continue;
    const value = formatAnswerOptionLabel(raw);
    if (!value || value === "—") continue;
    chips.push(`${q.label}: ${value}`);
    if (chips.length >= 6) break;
  }
  return chips;
}

/** Quick Estimate presentation metrics — no money / no calculations. */
export type QuickEstimatePresentationModel = {
  readonly estimatedWorkAreas: string;
  readonly includedScopeItems: string;
  readonly outstandingClarifications: string;
  readonly confidenceDrivers: readonly string[];
};

export function buildQuickEstimatePresentationModel(params: {
  readonly workAreaNames: readonly string[];
  readonly includedScopeItemCount: number;
  readonly outstandingClarificationCount: number;
  readonly assumptionCount: number;
  readonly missingCount: number;
  readonly constraintCount: number;
}): QuickEstimatePresentationModel {
  const wa =
    params.workAreaNames.length === 0
      ? "None yet"
      : params.workAreaNames.length <= 3
        ? params.workAreaNames.join(", ")
        : `${params.workAreaNames.slice(0, 2).join(", ")} +${params.workAreaNames.length - 2} more`;

  const drivers: string[] = [];
  if (params.workAreaNames.length > 0) {
    drivers.push(
      `${params.workAreaNames.length} work area${params.workAreaNames.length === 1 ? "" : "s"} confirmed`
    );
  }
  if (params.constraintCount > 0) {
    drivers.push(
      `${params.constraintCount} site constraint${params.constraintCount === 1 ? "" : "s"}`
    );
  }
  if (params.assumptionCount > 0) {
    drivers.push(
      `${params.assumptionCount} assumption${params.assumptionCount === 1 ? "" : "s"}`
    );
  }
  if (params.missingCount > 0) {
    drivers.push(
      `${params.missingCount} detail${params.missingCount === 1 ? "" : "s"} still open`
    );
  }
  if (drivers.length === 0) {
    drivers.push("Waiting for scope inputs");
  }

  return {
    estimatedWorkAreas: wa,
    includedScopeItems:
      params.includedScopeItemCount === 0
        ? "None confirmed yet"
        : `${params.includedScopeItemCount} included`,
    outstandingClarifications:
      params.outstandingClarificationCount === 0
        ? "None"
        : `${params.outstandingClarificationCount} open`,
    confidenceDrivers: drivers.slice(0, 4),
  };
}

export type StepperStepSummary = {
  readonly primary: string;
  readonly secondary?: string;
};

export function buildStepperStepSummaries(params: {
  readonly answeredQuestionCount: number;
  readonly estimateReady: boolean;
  readonly estimateStale?: boolean;
  readonly constraintCount: number;
  readonly includedScopeItemCount: number;
  readonly needsDetailCount: number;
  readonly includedWorkAreaCount: number;
  readonly qualityTitle: string | null;
  readonly briefSubmitted: boolean;
}): Partial<
  Record<
    | "brief"
    | "confirm_work_areas"
    | "quality"
    | "work_area_questions"
    | "constraints"
    | "estimate_ready",
    StepperStepSummary
  >
> {
  return {
    brief: params.briefSubmitted
      ? { primary: "Captured" }
      : { primary: "In progress" },
    confirm_work_areas: {
      primary:
        params.includedWorkAreaCount === 0
          ? "None yet"
          : `${params.includedWorkAreaCount} included`,
    },
    quality: {
      primary: params.qualityTitle ?? "Not set",
    },
    work_area_questions: {
      primary:
        params.answeredQuestionCount === 0
          ? "Not started"
          : `${params.answeredQuestionCount} answered`,
    },
    constraints: {
      primary:
        params.constraintCount === 0
          ? "None applied"
          : `${params.constraintCount} applied`,
    },
    estimate_ready: {
      primary: params.estimateStale
        ? "Needs refresh"
        : params.estimateReady
          ? "Ready"
          : "Pending",
      secondary:
        params.includedScopeItemCount > 0
          ? `${params.includedScopeItemCount} included${
              params.needsDetailCount > 0
                ? ` · ${params.needsDetailCount} clarification${
                    params.needsDetailCount === 1 ? "" : "s"
                  }`
                : ""
            }`
          : undefined,
    },
  };
}
