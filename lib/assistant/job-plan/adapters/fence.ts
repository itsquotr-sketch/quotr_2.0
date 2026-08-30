import { jobPlanBoolean, jobPlanNumber, jobPlanString, presentationFromBoolean } from "@/lib/assistant/job-plan/facts";
import {
  classifyFenceSystem,
  fenceGateScopeApplies,
  fenceSystemLabel,
  isModularFenceSystem,
  isTimberFenceSystem,
} from "@/lib/estimate/fence-systems";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";
import type { EstimateFact } from "@/lib/estimate/types";

function booleanCheck(params: {
  id: string;
  workAreaId: string;
  label: string;
  factKey: string;
  facts: readonly EstimateFact[];
  surfaceReason: string;
}): JobPlanScopeItem {
  const value = jobPlanBoolean(params.facts, params.workAreaId, params.factKey);
  return {
    id: params.id,
    workAreaId: params.workAreaId,
    label: params.label,
    presentation: presentationFromBoolean(value),
    kind: "user_scope",
    togglable: true,
    write: {
      factKey: params.factKey,
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: params.label,
    },
    sourceFactKey: params.factKey,
    surfaceReason: params.surfaceReason,
  };
}

function compactSummary(
  context: JobPlanAdapterContext,
  workAreaId: string
): { summary: string; chips: JobPlanSpecChip[] } {
  const chips: JobPlanSpecChip[] = [];
  const systemRaw =
    jobPlanString(context.facts, workAreaId, "fence.system") ??
    jobPlanString(context.facts, workAreaId, "fence.material");
  const system = classifyFenceSystem(
    systemRaw,
    jobPlanString(context.facts, workAreaId, "fence.paling_or_panel_type")
  );
  if (system !== "missing" && system !== "unsupported") {
    chips.push({
      key: "system",
      label: "Type",
      value: fenceSystemLabel(system),
      advanced: false,
    });
  }
  const length = jobPlanNumber(context.facts, workAreaId, "fence.length_m");
  if (length != null) {
    chips.push({
      key: "length",
      label: "Length",
      value: `${length}m`,
      advanced: false,
    });
  }
  const height = jobPlanNumber(context.facts, workAreaId, "fence.height_m");
  if (height != null) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${height}m`,
      advanced: false,
    });
  }
  return {
    summary: chips.map((c) => c.value).join(" · "),
    chips,
  };
}

export const fenceJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "fence",
  project(
    workArea: JobPlanWorkAreaInput,
    context: JobPlanAdapterContext
  ): JobPlanWorkAreaCard {
    const { summary, chips } = compactSummary(context, workArea.id);
    const system = classifyFenceSystem(
      jobPlanString(context.facts, workArea.id, "fence.system") ??
        jobPlanString(context.facts, workArea.id, "fence.material"),
      jobPlanString(context.facts, workArea.id, "fence.paling_or_panel_type")
    );
    const core: JobPlanScopeItem = {
      id: "fence-core",
      workAreaId: workArea.id,
      label: workArea.name,
      presentation: "INCLUDED",
      kind: "user_scope",
      togglable: false,
      write: null,
      sourceFactKey: null,
      surfaceReason: "Deterministic: Fence Work Area exists",
    };

    const checks: JobPlanScopeItem[] = [
      booleanCheck({
        id: "fence-demo",
        workAreaId: workArea.id,
        label: "Existing fence removal",
        factKey: "fence.demolition_required",
        facts: context.facts,
        surfaceReason: "Check: existing fence removal is optional scope",
      }),
    ];
    if (isTimberFenceSystem(system)) {
      if (fenceGateScopeApplies(system)) {
        checks.push(
          booleanCheck({
            id: "fence-gate",
            workAreaId: workArea.id,
            label: "Gate",
            factKey: "fence.gate_included",
            facts: context.facts,
            surfaceReason: "Check: gate is optional timber scope",
          })
        );
      }
      checks.push(
        booleanCheck({
          id: "fence-capping",
          workAreaId: workArea.id,
          label: "Top capping",
          factKey: "fence.top_capping",
          facts: context.facts,
          surfaceReason: "Check: timber top capping is optional",
        })
      );
    } else if (isModularFenceSystem(system)) {
      checks.push(
        booleanCheck({
          id: "fence-modular-gate",
          workAreaId: workArea.id,
          label: "Gate",
          factKey: "fence.modular_gate_requested",
          facts: context.facts,
          surfaceReason:
            "Check: manufactured modular gate is requested. Not modelled — pricing required if yes.",
        })
      );
    }

    const notConfirmed = checks.filter((item) => item.presentation === "NOT_CONFIRMED");
    const included = [
      core,
      ...checks.filter((item) => item.presentation === "INCLUDED"),
    ];
    const notIncluded = checks.filter((item) => item.presentation === "NOT_INCLUDED");

    return {
      workAreaId: workArea.id,
      workAreaType: "fence",
      name: workArea.name,
      status: workArea.status,
      summary: summary || workArea.name,
      specChips: chips,
      included,
      notIncluded,
      notConfirmed,
      confirmCount: notConfirmed.length,
    };
  },
};
