import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganisationRate } from "@/components/setup/types";
import { resolveProductivity } from "@/lib/estimate/productivity";
import type { ProductivityRate } from "@/lib/estimate/types";

/** Stored on the line notes. Pricing and Quote read it and do not rewrite the rate. */
export const DECK_PRODUCTIVITY_SCOPE_REVIEW = "DECK_PRODUCTIVITY_SCOPE_REVIEW";

export const DECK_POSTS_INSTALL_CONFIRM_FACT = "deck.posts_install_scope_confirmation";
export const DECK_CONCRETE_PLACE_CONFIRM_FACT = "deck.concrete_place_scope_confirmation";
export const DECK_POSTS_INSTALL_JOB_HOURS_FACT = "deck.posts_install_hours_per_ea";
export const DECK_CONCRETE_PLACE_JOB_HOURS_FACT = "deck.concrete_place_hours_per_bag";
/** This job chooses the approved 4-minute bag rate and leaves the company row unchanged. */
export const DECK_QUOTR_BENCHMARK_CHOICE = "quotr-benchmark";
export const DECK_CONCRETE_PLACE_BENCHMARK_HOURS = 4 / 60;

/**
 * Installation-only provisional benchmark. Distinct from
 * deck.posts.install.hours_per_ea, whose imported 1 h/post includes excavation.
 */
export const DECK_POST_SET_PRODUCTIVITY_KEY = "deck.posts.set.hours_per_post";
export const DECK_POST_SET_HOURS = 0.5;
export const DECK_POST_SET_SOURCE = "Quotr provisional benchmark";
export const DECK_POST_SET_UNIT = "post";
export const DECK_POST_SET_SCOPE =
  "Place, align/plumb, and temporarily brace a standard 125 × 125 mm post in an already prepared ordinary hole. Excludes excavation, concrete mixing and placement, bearer and joist construction, unusual post restraint, and specialist ground or structural work.";
export const DECK_POST_SET_DECISION =
  "Proposed Quotr assumption, 15 October 2026. No merchant, workbook, or external source approved this 0.5 person-hour figure.";
export const DECK_CONFIRMED_CALIBRATION_SOURCE =
  "Company calibration · confirmed for this job";
export const DECK_COMPANY_PRODUCTIVITY_SOURCE = "Company rate";
export const DECK_THIS_JOB_SOURCE = "This job";
export const DECK_APPROVED_BENCHMARK_SOURCE = "Quotr benchmark";

export function confirmedProductivityToken(hours: number): string {
  const rounded = Math.round(hours * 10000) / 10000;
  return `confirmed:${rounded}`;
}

export type LegacyProductivityDecision =
  | { readonly action: "benchmark" }
  | {
      readonly action: "apply";
      readonly hoursPerUnit: number;
      readonly sourceLabel: string;
      readonly sourceType: "user_rate" | "calibrated_productivity" | "benchmark";
    }
  | {
      readonly action: "review";
      readonly hoursPerUnit: number;
      readonly factKey: string;
      readonly token: string;
      readonly jobFactKey: string;
    };

/**
 * A typed company rate applies. A calibrated rate applies only after this job
 * confirms the same hours. Otherwise the stored calibration stays on the rate
 * row and the new estimate does not treat it as complete.
 */
export function decideLegacyProductivityScope(input: {
  readonly resolved: ProductivityRate;
  readonly confirmation: string | null;
  readonly jobHours: number | null;
  readonly factKey: string;
  readonly jobFactKey: string;
  readonly quotrBenchmarkHours?: number | null;
  readonly benchmarkSourceLabel?: string;
}): LegacyProductivityDecision {
  if (
    input.confirmation === DECK_QUOTR_BENCHMARK_CHOICE &&
    input.quotrBenchmarkHours != null &&
    input.quotrBenchmarkHours > 0
  ) {
    return {
      action: "apply",
      hoursPerUnit: input.quotrBenchmarkHours,
      sourceLabel: input.benchmarkSourceLabel ?? DECK_APPROVED_BENCHMARK_SOURCE,
      sourceType: "benchmark",
    };
  }
  if (input.jobHours != null && input.jobHours > 0 && input.confirmation !== DECK_QUOTR_BENCHMARK_CHOICE) {
    return {
      action: "apply",
      hoursPerUnit: input.jobHours,
      sourceLabel: "This job",
      sourceType: "user_rate",
    };
  }
  if (input.resolved.sourceType === "user_rate" && input.resolved.hoursPerUnit > 0) {
    return {
      action: "apply",
      hoursPerUnit: input.resolved.hoursPerUnit,
      sourceLabel: input.resolved.sourceLabel,
      sourceType: "user_rate",
    };
  }
  if (
    input.resolved.sourceType === "calibrated_productivity" &&
    input.resolved.hoursPerUnit > 0
  ) {
    const token = confirmedProductivityToken(input.resolved.hoursPerUnit);
    if (input.confirmation === token) {
      return {
        action: "apply",
        hoursPerUnit: input.resolved.hoursPerUnit,
        sourceLabel: DECK_CONFIRMED_CALIBRATION_SOURCE,
        sourceType: "calibrated_productivity",
      };
    }
    return {
      action: "review",
      hoursPerUnit: input.resolved.hoursPerUnit,
      factKey: input.factKey,
      token,
      jobFactKey: input.jobFactKey,
    };
  }
  return { action: "benchmark" };
}

export type DeckPostInstallationDecision = LegacyProductivityDecision & {
  readonly itemKey: string;
};

function companyInstallation(
  rate: ProductivityRate,
  itemKey: string
): DeckPostInstallationDecision | null {
  if (!(rate.hoursPerUnit > 0)) return null;
  if (rate.sourceType === "user_rate") {
    return {
      action: "apply",
      hoursPerUnit: rate.hoursPerUnit,
      sourceLabel: DECK_COMPANY_PRODUCTIVITY_SOURCE,
      sourceType: "user_rate",
      itemKey,
    };
  }
  if (rate.sourceType === "calibrated_productivity") {
    return {
      action: "apply",
      hoursPerUnit: rate.hoursPerUnit,
      sourceLabel: DECK_CONFIRMED_CALIBRATION_SOURCE,
      sourceType: "calibrated_productivity",
      itemKey,
    };
  }
  return null;
}

/**
 * Installation-only post setting. The imported 1 h/post task is not reused.
 * A matching-scope company or calibrated rate wins. An ambiguous calibration
 * on the historical key stays on the organisation and waits for this job.
 */
export function resolveDeckPostInstallation(input: {
  readonly rates?: readonly OrganisationRate[];
  readonly confirmation: string | null;
  readonly jobHours: number | null;
}): DeckPostInstallationDecision {
  const scoped = resolveProductivity({
    productivityKey: DECK_POST_SET_PRODUCTIVITY_KEY,
    unit: DECK_POST_SET_UNIT,
    fallbackHoursPerUnit: DECK_POST_SET_HOURS,
    rates: input.rates,
  });
  const legacy = resolveProductivity({
    productivityKey: "deck.posts.install.hours_per_ea",
    unit: "ea",
    fallbackHoursPerUnit: 1,
    rates: input.rates,
  });
  const legacyDecision = decideLegacyProductivityScope({
    resolved: legacy,
    confirmation: input.confirmation,
    jobHours: input.jobHours,
    factKey: DECK_POSTS_INSTALL_CONFIRM_FACT,
    jobFactKey: DECK_POSTS_INSTALL_JOB_HOURS_FACT,
    quotrBenchmarkHours: DECK_POST_SET_HOURS,
    benchmarkSourceLabel: DECK_POST_SET_SOURCE,
  });
  if (legacyDecision.action === "apply" && legacyDecision.sourceLabel === DECK_THIS_JOB_SOURCE) {
    return { ...legacyDecision, itemKey: DECK_POST_SET_PRODUCTIVITY_KEY };
  }
  if (
    legacyDecision.action === "apply" &&
    legacyDecision.sourceLabel === DECK_POST_SET_SOURCE
  ) {
    return { ...legacyDecision, itemKey: DECK_POST_SET_PRODUCTIVITY_KEY };
  }
  const matching = companyInstallation(scoped, DECK_POST_SET_PRODUCTIVITY_KEY);
  if (matching && scoped.sourceType !== "benchmark") return matching;
  if (legacy.sourceType === "user_rate" && legacy.hoursPerUnit > 0) {
    return {
      action: "apply",
      hoursPerUnit: legacy.hoursPerUnit,
      sourceLabel: DECK_COMPANY_PRODUCTIVITY_SOURCE,
      sourceType: "user_rate",
      itemKey: "deck.posts.install.hours_per_ea",
    };
  }
  if (legacyDecision.action === "review") {
    return { ...legacyDecision, itemKey: "deck.posts.install.hours_per_ea" };
  }
  if (
    legacyDecision.action === "apply" &&
    legacyDecision.sourceType === "calibrated_productivity"
  ) {
    return { ...legacyDecision, itemKey: "deck.posts.install.hours_per_ea" };
  }
  return {
    action: "apply",
    hoursPerUnit: DECK_POST_SET_HOURS,
    sourceLabel: DECK_POST_SET_SOURCE,
    sourceType: "benchmark",
    itemKey: DECK_POST_SET_PRODUCTIVITY_KEY,
  };
}

export function labourProductivitySourceLabel(
  sourceType: string,
  sourceLabel: string
): string {
  if (
    sourceLabel === DECK_THIS_JOB_SOURCE ||
    sourceLabel === DECK_POST_SET_SOURCE ||
    sourceLabel === DECK_APPROVED_BENCHMARK_SOURCE ||
    sourceLabel === DECK_CONFIRMED_CALIBRATION_SOURCE ||
    sourceLabel === DECK_COMPANY_PRODUCTIVITY_SOURCE
  ) {
    return sourceLabel;
  }
  if (sourceType === "calibrated_productivity") return DECK_CONFIRMED_CALIBRATION_SOURCE;
  if (sourceType === "user_rate") return DECK_COMPANY_PRODUCTIVITY_SOURCE;
  if (sourceLabel.toLowerCase().includes("provisional")) return DECK_POST_SET_SOURCE;
  return DECK_APPROVED_BENCHMARK_SOURCE;
}

export function productivitySourceNote(sourceType: string, sourceLabel: string): string {
  return `Productivity source: ${labourProductivitySourceLabel(sourceType, sourceLabel)}`;
}

export function scopeReviewNotes(input: {
  readonly summary: string;
  readonly factKey: string;
  readonly token: string;
  readonly jobFactKey: string;
}): string {
  return `${input.summary}\n${DECK_PRODUCTIVITY_SCOPE_REVIEW} fact=${input.factKey} value=${input.token} job=${input.jobFactKey}`;
}

export function scopeReviewDisplay(notes: string | null | undefined): string | null {
  if (!notes?.includes(DECK_PRODUCTIVITY_SCOPE_REVIEW)) return null;
  return notes.split(DECK_PRODUCTIVITY_SCOPE_REVIEW)[0]?.trim() || null;
}

export function parseScopeReview(notes: string | null | undefined): {
  readonly factKey: string;
  readonly value: string;
  readonly jobFactKey: string;
} | null {
  if (!notes?.includes(DECK_PRODUCTIVITY_SCOPE_REVIEW)) return null;
  const tail = notes.split(DECK_PRODUCTIVITY_SCOPE_REVIEW)[1] ?? "";
  const factKey = /fact=(\S+)/.exec(tail)?.[1] ?? "";
  const value = /value=(\S+)/.exec(tail)?.[1] ?? "";
  const jobFactKey = /job=(\S+)/.exec(tail)?.[1] ?? "";
  if (!factKey || !value || !jobFactKey) return null;
  return { factKey, value, jobFactKey };
}

export const DECK_PRODUCTIVITY_REVIEW_DETAIL =
  "Review the stored deck productivity before Pricing or a new Quote. The saved calibration is unchanged.";

export const DECK_POSTS_CALIBRATION_TASK =
  "Think about setting piles or posts for a typical 20 m² ground-level timber deck with normal access. Scenario: 20 m² timber deck · 9 supports · ground-level · normal access.";

export const DECK_POSTS_CALIBRATION_REASON =
  "The saved task does not record that excavation was excluded. Hole excavation is a separate operation, so confirm this rate is installation-only or enter a revised productivity.";

export const DECK_CONCRETE_CALIBRATION_TASK =
  "How would your crew normally mix and pour 20 bags of post-hole concrete (posts already set)? Scenario: 20 × 20 kg bags · posts already set · mix and place at the workface · normal access.";

export const DECK_CONCRETE_CALIBRATION_REASON =
  "It was saved against that fixed bag scenario, not this estimate's purchased bags. Confirm it applies to these bags or enter a revised productivity.";

export function isDeckProductivityScopeDetail(
  detail: string | null | undefined
): boolean {
  const text = detail?.trim() ?? "";
  return text.includes("stored deck productivity") || text.includes(DECK_PRODUCTIVITY_SCOPE_REVIEW);
}

export function deckProductivityPhrase(
  hoursPerUnit: number,
  componentKey: string | null | undefined,
  unit: string | null | undefined
): string {
  const rounded = Math.round(hoursPerUnit * 1000) / 1000;
  const hours = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  const label =
    componentKey === "deck.posts.install"
      ? "post"
      : componentKey === "deck.hole.excavate"
        ? "hole"
        : componentKey === "deck.concrete.place"
          ? "bag"
          : unit?.trim() || "unit";
  return `${hours} h/${label}`;
}

export function productivityScopeReviewBlock(
  notes: readonly (string | null | undefined)[]
): string | null {
  if (!notes.some((row) => parseScopeReview(row))) return null;
  return DECK_PRODUCTIVITY_REVIEW_DETAIL;
}

/** Read-only. A read failure does not invent a block and does not write the estimate. */
export async function deckProductivityScopePricingBlock(
  supabase: SupabaseClient,
  estimateId: string,
  orgId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("estimate_line_items")
    .select("notes")
    .eq("estimate_id", estimateId)
    .eq("org_id", orgId);
  if (error) return null;
  return productivityScopeReviewBlock((data ?? []).map((row) => row.notes as string | null));
}
