import type { ClarifyAssumption, ClarifyView } from "@/lib/assistant/clarify/types";
import type { JobPlanView } from "@/lib/assistant/job-plan/types";

export type EstimateReadinessView = {
  readonly heading: string;
  readonly explanation: string;
  readonly known: readonly string[];
  readonly assumptions: readonly ClarifyAssumption[];
  readonly checks: readonly string[];
  readonly confidenceLabel: string | null;
  readonly canEstimateNow: boolean;
  readonly blocksEstimate: boolean;
  readonly blockerCopy: string | null;
  readonly enoughToEstimate: boolean;
};

export type ComposeReadinessInput = {
  readonly clarify: ClarifyView;
  readonly jobPlan: JobPlanView;
  readonly qualityLevel: string | null;
  readonly constraints: readonly { readonly key: string; readonly value: unknown }[];
};
