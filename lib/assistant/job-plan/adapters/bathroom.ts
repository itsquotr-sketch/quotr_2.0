import { effectiveJobPlanBoolean } from "@/lib/assistant/job-plan/exclusion-provenance";
import { jobPlanNumber, jobPlanString, presentationFromBoolean } from "@/lib/assistant/job-plan/facts";
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
    const area = jobPlanNumber(context.facts, id, "bathroom.area_m2");
    const reno = jobPlanString(context.facts, id, "bathroom.renovation_type");
    const finish = jobPlanString(context.facts, id, "bathroom.finish_level");
    const chips = [
      area != null
        ? { key: "area", label: "Area", value: `${area}m²`, advanced: false }
        : null,
      reno
        ? { key: "reno", label: "Type", value: reno, advanced: false }
        : null,
      finish
        ? { key: "finish", label: "Finish", value: finish, advanced: false }
        : null,
    ].filter((c): c is NonNullable<typeof c> => c != null);

    const items = [
      boolScope(id, "demolition", "Demolition / strip-out", "bathroom.demolition_required", context, "User-facing bathroom scope"),
      boolScope(id, "waterproofing", "Waterproofing", "bathroom.waterproofing_included", context, "User-facing bathroom scope"),
      boolScope(id, "tiling", "Tiling", "bathroom.tiling_included", context, "User-facing bathroom scope"),
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
