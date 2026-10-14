import type { SupabaseClient } from "@supabase/supabase-js";
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
}): LegacyProductivityDecision {
  if (
    input.confirmation === DECK_QUOTR_BENCHMARK_CHOICE &&
    input.quotrBenchmarkHours != null &&
    input.quotrBenchmarkHours > 0
  ) {
    return {
      action: "apply",
      hoursPerUnit: input.quotrBenchmarkHours,
      sourceLabel: "Quotr benchmark",
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
        sourceLabel: input.resolved.sourceLabel,
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
