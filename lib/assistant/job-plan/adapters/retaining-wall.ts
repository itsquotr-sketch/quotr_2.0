import { jobPlanNumber, jobPlanString, presentationFromBoolean } from "@/lib/assistant/job-plan/facts";
import { round2 } from "@/lib/estimate/facts";
import { retainingWallHasCoreHeight } from "@/lib/estimate/calculators/retaining-wall";
import { classifyRetainingWallSystem } from "@/lib/estimate/retaining-wall-systems";
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
  const raw = jobPlanString(params.facts, params.workAreaId, params.factKey);
  const value =
    raw == null
      ? null
      : /^(true|yes)$/i.test(String(raw))
        ? true
        : /^(false|no)$/i.test(String(raw))
          ? false
          : null;
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
  const length = jobPlanNumber(context.facts, workAreaId, "retaining_wall.length_m");
  if (length != null) {
    chips.push({
      key: "length",
      label: "Length",
      value: `${length}m`,
      advanced: false,
    });
  }

  const height = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_m");
  const high = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_high_m");
  const low = jobPlanNumber(context.facts, workAreaId, "retaining_wall.height_low_m");
  if (high != null && low != null && high !== low) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${high}m → ${low}m`,
      advanced: false,
    });
  } else if (height != null) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${height}m`,
      advanced: false,
    });
  } else if (
    retainingWallHasCoreHeight(context.facts, workAreaId) &&
    high != null &&
    low != null
  ) {
    chips.push({
      key: "height",
      label: "Height",
      value: `${round2((high + low) / 2)}m avg`,
      advanced: false,
    });
  }

  const material = jobPlanString(context.facts, workAreaId, "retaining_wall.material");
  if (material) {
    chips.push({
      key: "material",
      label: "System",
      value: material,
      advanced: false,
    });
  }

  return {
    summary: chips.map((c) => c.value).join(" · "),
    chips,
  };
}

export const retainingWallJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "retaining_wall",
  project(
    workArea: JobPlanWorkAreaInput,
    context: JobPlanAdapterContext
  ): JobPlanWorkAreaCard {
    const { summary, chips } = compactSummary(context, workArea.id);
    const system = classifyRetainingWallSystem(
      jobPlanString(context.facts, workArea.id, "retaining_wall.material")
    );
    const core: JobPlanScopeItem = {
      id: "retaining-wall-core",
      workAreaId: workArea.id,
      label: workArea.name,
      presentation: "INCLUDED",
      kind: "user_scope",
      togglable: false,
      write: null,
      sourceFactKey: null,
      surfaceReason: "Deterministic: Retaining Wall Work Area exists",
    };

    const checks: JobPlanScopeItem[] = [
      booleanCheck({
        id: "rw-excavation",
        workAreaId: workArea.id,
        label: "Excavation",
        factKey: "retaining_wall.excavation_required",
        facts: context.facts,
        surfaceReason: "Check: bulk excavation is optional scope",
      }),
      booleanCheck({
        id: "rw-drainage",
        workAreaId: workArea.id,
        label: "Drainage / novacoil",
        factKey: "retaining_wall.drainage_required",
        facts: context.facts,
        surfaceReason:
          "Standard on timber and sleeper walls unless turned off. Not a Clarify blocker.",
      }),
      booleanCheck({
        id: "rw-backfill",
        workAreaId: workArea.id,
        label: "Backfill",
        factKey: "retaining_wall.backfill_included",
        facts: context.facts,
        surfaceReason:
          "Standard drainage aggregate on timber and sleeper walls unless turned off. Not excavation.",
      }),
    ];
    if (system === "CONCRETE_MASONRY_WALL") {
      checks.push(
        booleanCheck({
          id: "rw-waterproofing",
          workAreaId: workArea.id,
          label: "Waterproofing",
          factKey: "retaining_wall.waterproofing_required",
          facts: context.facts,
          surfaceReason: "Check: waterproofing applies to masonry walls only",
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
      workAreaType: "retaining_wall",
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
