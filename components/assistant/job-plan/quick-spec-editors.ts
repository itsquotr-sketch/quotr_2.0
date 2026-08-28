"use client";

import type { ComponentType } from "react";
import {
  DeckQuickSpecEditor,
  type QuickSpecFactWrite,
} from "@/components/assistant/job-plan/DeckQuickSpecEditor";
import { FenceQuickSpecEditor } from "@/components/assistant/job-plan/FenceQuickSpecEditor";
import { RetainingWallQuickSpecEditor } from "@/components/assistant/job-plan/RetainingWallQuickSpecEditor";
import type { EstimateFact } from "@/lib/estimate/types";

export type JobPlanConstraintWrite = (input: {
  key: string;
  label: string;
  value: string;
  inputType?: "select" | "boolean";
}) => void;

export type JobPlanQuickSpecEditorProps = {
  workAreaId: string;
  facts: readonly EstimateFact[];
  onSpecFact?: QuickSpecFactWrite;
  /** Canonical Project Conditions — never a second retaining-wall namespace. */
  constraints?: readonly { key: string; value: unknown }[];
  onConstraint?: JobPlanConstraintWrite;
};

const QUICK_SPEC_EDITORS: Record<
  string,
  ComponentType<JobPlanQuickSpecEditorProps>
> = {
  deck: DeckQuickSpecEditor,
  retaining_wall: RetainingWallQuickSpecEditor,
  fence: FenceQuickSpecEditor,
};

export function getJobPlanQuickSpecEditor(
  workAreaType: string
): ComponentType<JobPlanQuickSpecEditorProps> | null {
  return QUICK_SPEC_EDITORS[workAreaType] ?? null;
}
