import { effectiveJobPlanBoolean } from "@/lib/assistant/job-plan/exclusion-provenance";
import { jobPlanNumber, jobPlanString, presentationFromBoolean } from "@/lib/assistant/job-plan/facts";
import { bathroomQuestionGroupVisible, resolveBathroomJobScope } from "@/lib/estimate/bathroom-scope";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";

function boolScope(
  workAreaId: string,
  id: string,
  label: string,
  factKey: string,
  context: JobPlanAdapterContext,
  surfaceReason: string
): JobPlanScopeItem {
  const value = effectiveJobPlanBoolean(
    context.facts,
    workAreaId,
    factKey,
    context.briefText
  );
  return {
    id,
    workAreaId,
    label,
    presentation: presentationFromBoolean(value),
    kind: "user_scope",
    togglable: true,
    write: {
      factKey,
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label,
    },
    sourceFactKey: factKey,
    surfaceReason,
  };
}

export const bathroomJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "bathroom",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const id = workArea.id;
    const jobScope = resolveBathroomJobScope({
      jobScope: jobPlanString(context.facts, id, "bathroom.job_scope"),
      renovationType: jobPlanString(context.facts, id, "bathroom.renovation_type"),
    });
    const length = jobPlanNumber(context.facts, id, "bathroom.length_m");
    const width = jobPlanNumber(context.facts, id, "bathroom.width_m");
    const height = jobPlanNumber(context.facts, id, "bathroom.wall_height_m");
    const floor =
      jobPlanNumber(context.facts, id, "bathroom.floor_area_m2") ??
      (length != null && width != null ? Math.round(length * width * 100) / 100 : null) ??
      jobPlanNumber(context.facts, id, "bathroom.area_m2");
    const finish = jobPlanString(context.facts, id, "bathroom.finish_level");
    const chips = [
      jobScope
        ? {
            key: "scope",
            label: "Work",
            value: jobScope.replace(/_/g, " "),
            advanced: false,
          }
        : null,
      length != null && width != null
        ? {
            key: "plan",
            label: "Plan",
            value: `${length} × ${width} m`,
            advanced: false,
          }
        : null,
      height != null
        ? { key: "height", label: "Height", value: `${height} m`, advanced: false }
        : null,
      floor != null
        ? { key: "area", label: "Floor", value: `${floor}m²`, advanced: false }
        : null,
      finish
        ? { key: "finish", label: "Finish", value: finish, advanced: false }
        : null,
    ].filter((c): c is NonNullable<typeof c> => c != null);

    const items = [
      boolScope(id, "demolition", "Demolition / strip-out", "bathroom.demolition_required", context, "User-facing bathroom scope"),
      boolScope(id, "waterproofing", "Waterproofing", "bathroom.waterproofing_included", context, "User-facing bathroom scope"),
      ...(bathroomQuestionGroupVisible("tiling", jobScope)
        ? [
            boolScope(
              id,
              "tiling",
              "Tiling",
              "bathroom.tiling_included",
              context,
              "User-facing bathroom scope"
            ),
          ]
        : []),
      ...(bathroomQuestionGroupVisible("linings", jobScope)
        ? [
            boolScope(
              id,
              "wall-lining",
              "Wall lining",
              "bathroom.wall_lining_included",
              context,
              "User-facing bathroom scope"
            ),
          ]
        : []),
      ...(bathroomQuestionGroupVisible("ceiling_lining", jobScope)
        ? [
            boolScope(
              id,
              "ceiling-lining",
              "Ceiling lining",
              "bathroom.ceiling_lining_included",
              context,
              "User-facing bathroom scope"
            ),
          ]
        : []),
    ];

    return {
      workAreaId: id,
      workAreaType: "bathroom",
      name: workArea.name,
      status: workArea.status,
      summary: chips.map((c) => c.value).join(" · "),
      specChips: chips,
      included: items.filter((i) => i.presentation === "INCLUDED"),
      notIncluded: items.filter((i) => i.presentation === "NOT_INCLUDED"),
      notConfirmed: items.filter((i) => i.presentation === "NOT_CONFIRMED"),
      confirmCount: items.filter((i) => i.presentation === "NOT_CONFIRMED").length,
    };
  },
};
