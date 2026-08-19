import type { JobPlanScopeWrite } from "@/lib/assistant/job-plan/types";
import type { ClarifyWriteTarget } from "@/lib/assistant/clarify/types";

export type RefineGroupId =
  | "scope"
  | "specification"
  | "structure"
  | "project_conditions"
  | "advanced";

export type RefineTier = "high_value" | "advanced";

export type RefineCandidate = {
  readonly id: string;
  readonly group: RefineGroupId;
  readonly tier: RefineTier;
  readonly workAreaId: string | null;
  readonly workAreaName: string | null;
  readonly workAreaType: string | null;
  readonly factKey: string | null;
  readonly constraintKey: string | null;
  readonly questionKey: string;
  readonly label: string;
  readonly question: string;
  readonly inputType: "boolean" | "select" | "number";
  readonly options?: readonly string[];
  readonly writeTarget: ClarifyWriteTarget;
  readonly write: JobPlanScopeWrite | null;
  /** Only fields the current calculator consumes may be true. */
  readonly consumedByCalculator: true;
};

export type RefineView = {
  readonly highValue: readonly RefineCandidate[];
  readonly advanced: readonly RefineCandidate[];
  readonly hasCandidates: boolean;
};

export type ComposeRefineInput = {
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
      readonly notConfirmed: readonly {
        readonly id: string;
        readonly label: string;
        readonly sourceFactKey: string | null;
        readonly write: JobPlanScopeWrite | null;
        readonly workAreaId: string;
      }[];
    }[];
  };
};

export type RefineWorkAreaAdapter = {
  readonly workAreaType: string;
  candidates(input: {
    readonly workAreaId: string;
    readonly workAreaName: string;
    readonly facts: ComposeRefineInput["facts"];
    readonly briefText: string | null;
    readonly notConfirmed: ComposeRefineInput["jobPlan"]["cards"][number]["notConfirmed"];
  }): readonly RefineCandidate[];
};
