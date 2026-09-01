import type { AssistantStage } from "@/components/assistant/types";
import type { JobPlanScopeWrite } from "@/lib/assistant/job-plan/types";

export type ClarifyAskClass =
  | "HARD_MINIMUM"
  | "ASK_NOW"
  | "ASSUME_IF_SKIPPED"
  | "REFINEMENT"
  | "ADVANCED"
  | "DERIVED_NEVER_ASK";

export type ClarifyEconomicClass =
  | "REQUIRED_FOR_ECONOMIC_MODEL"
  | "HIGH_VALUE_OPTIONAL"
  | "LOW_VALUE";

export type ClarifySource =
  | "job_plan_check"
  | "scope_fact"
  | "quality"
  | "project_condition"
  | "attention";

export type ClarifyWriteTarget = "FACT" | "CONSTRAINT" | "QUALITY" | "NONE";

export type ClarifyCandidate = {
  readonly id: string;
  readonly source: ClarifySource;
  readonly workAreaId: string | null;
  readonly workAreaName: string | null;
  readonly workAreaType: string | null;
  readonly factKey: string | null;
  readonly constraintKey: string | null;
  readonly questionKey: string;
  readonly label: string;
  readonly question: string;
  readonly askClass: ClarifyAskClass;
  readonly inputType: "boolean" | "select" | "number" | "text";
  readonly unit?: string;
  readonly options?: readonly string[];
  readonly writeTarget: ClarifyWriteTarget;
  readonly write: JobPlanScopeWrite | null;
  readonly blocksEstimate: boolean;
  readonly assumable: boolean;
  readonly rankScore: number;
  readonly rankReason: string;
  readonly assumptionStatement: string | null;
  readonly economicClass?: ClarifyEconomicClass;
};

export type ClarifyAssumption = {
  readonly id: string;
  readonly label: string;
  readonly statement: string;
  readonly factKey: string | null;
  readonly constraintKey: string | null;
  readonly workAreaId: string | null;
  readonly source: "assumption";
  readonly persistedExclusion: false;
};

export type ClarifyView = {
  readonly candidates: readonly ClarifyCandidate[];
  readonly deferred: readonly ClarifyCandidate[];
  readonly assumptions: readonly ClarifyAssumption[];
  /** Disclosures if the builder chooses Estimate now now (visible + deferred). */
  readonly estimateNowAssumptions: readonly ClarifyAssumption[];
  readonly visibleCount: number;
  readonly remainingRequiredCount: number;
  readonly blocksEstimate: boolean;
  readonly canEstimateNow: boolean;
  readonly enoughToEstimate: boolean;
};

export type ComposeClarifyInput = {
  readonly stage: AssistantStage;
  readonly briefText: string | null;
  readonly qualityLevel: string | null;
  readonly workAreas: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly status: string;
  }[];
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
    readonly source?: string | null;
  }[];
  readonly constraints: readonly {
    readonly key: string;
    readonly value: unknown;
  }[];
  readonly jobPlan: {
    readonly cards: readonly {
      readonly workAreaId: string;
      readonly workAreaType: string;
      readonly name: string;
      readonly included: readonly {
        readonly id: string;
        readonly sourceFactKey: string | null;
        readonly write: JobPlanScopeWrite | null;
      }[];
      readonly notIncluded: readonly {
        readonly id: string;
        readonly sourceFactKey: string | null;
        readonly write: JobPlanScopeWrite | null;
      }[];
      readonly notConfirmed: readonly {
        readonly id: string;
        readonly label: string;
        readonly sourceFactKey: string | null;
        readonly write: JobPlanScopeWrite | null;
        readonly workAreaId: string;
      }[];
    }[];
  };
  readonly pcCandidates?: readonly {
    readonly questionKey: string;
    readonly targetKey: string;
    readonly question: string;
    readonly inputType: "select" | "boolean" | "number" | "text" | "multi_select";
    readonly options?: readonly string[];
    readonly priority: string;
  }[];
};
