/**
 * RECOVERY-3 — Job Plan projection types.
 *
 * Presentation only. No persisted Job Plan table or enum.
 * SoT remains work_areas + Facts + scope decisions + constraints.
 */

import type { EstimateFact } from "@/lib/estimate/types";

/** User-facing Job Plan states. Not a DB enum. */
export type JobPlanScopePresentation =
  | "INCLUDED"
  | "NOT_INCLUDED"
  | "NOT_CONFIRMED";

export type JobPlanItemKind = "user_scope" | "specification";

export type JobPlanScopeWrite = {
  readonly factKey: string;
  readonly valueType: "boolean" | "select";
  readonly includeValue: string | boolean;
  readonly excludeValue: string | boolean;
  readonly label: string;
};

export type JobPlanScopeItem = {
  readonly id: string;
  readonly workAreaId: string;
  readonly label: string;
  readonly presentation: JobPlanScopePresentation;
  readonly kind: JobPlanItemKind;
  /** False for core work that is removed only with the Work Area. */
  readonly togglable: boolean;
  readonly write: JobPlanScopeWrite | null;
  readonly sourceFactKey: string | null;
  /** Why this row is visible (audit / tests). */
  readonly surfaceReason: string;
};

export type JobPlanSpecChip = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly advanced: boolean;
  /** True when the value is a disclosed assumption, not a known fact. */
  readonly assumed?: boolean;
};

export type JobPlanWorkAreaCard = {
  readonly workAreaId: string;
  readonly workAreaType: string;
  readonly name: string;
  readonly status: "suggested" | "confirmed" | "excluded";
  readonly summary: string;
  readonly specChips: readonly JobPlanSpecChip[];
  readonly included: readonly JobPlanScopeItem[];
  readonly notIncluded: readonly JobPlanScopeItem[];
  readonly notConfirmed: readonly JobPlanScopeItem[];
  /**
   * Supported catalogue items hidden from the default Job Plan (contextual
   * Check policy) but addable in Edit Scope. Not a second scope system.
   */
  readonly editAvailable?: readonly JobPlanScopeItem[];
  readonly confirmCount: number;
};

export type JobPlanView = {
  readonly cards: readonly JobPlanWorkAreaCard[];
  readonly confirmCount: number;
  readonly excludedWorkAreaIds: readonly string[];
};

export type JobPlanWorkAreaInput = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly status: "suggested" | "confirmed" | "excluded";
  readonly sortOrder?: number;
};

export type JobPlanConstraintInput = {
  readonly key: string;
  readonly value: unknown;
};

export type ComposeJobPlanInput = {
  readonly workAreas: readonly JobPlanWorkAreaInput[];
  readonly facts: readonly EstimateFact[];
  readonly constraints?: readonly JobPlanConstraintInput[];
  readonly qualityLevel?: string | null;
  readonly briefText?: string | null;
};

export type JobPlanAdapterContext = {
  readonly facts: readonly EstimateFact[];
  readonly constraints: readonly JobPlanConstraintInput[];
  readonly qualityLevel: string | null;
  readonly briefText: string | null;
};

export type JobPlanWorkAreaAdapter = {
  readonly workAreaType: string;
  project(
    workArea: JobPlanWorkAreaInput,
    context: JobPlanAdapterContext
  ): JobPlanWorkAreaCard;
};
