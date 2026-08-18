"use client";

import type { ComponentType } from "react";
import {
  DeckQuickSpecEditor,
  type QuickSpecFactWrite,
} from "@/components/assistant/job-plan/DeckQuickSpecEditor";
import type { EstimateFact } from "@/lib/estimate/types";

export type JobPlanQuickSpecEditorProps = {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
};

const QUICK_SPEC_EDITORS: Record<
  string,
  ComponentType<JobPlanQuickSpecEditorProps>
> = {
  deck: DeckQuickSpecEditor,
};

export function getJobPlanQuickSpecEditor(
  workAreaType: string
): ComponentType<JobPlanQuickSpecEditorProps> | null {
  return QUICK_SPEC_EDITORS[workAreaType] ?? null;
}
