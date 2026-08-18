import { jobPlanNumber, jobPlanString } from "@/lib/assistant/job-plan/facts";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export const paintingJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "painting",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const id = workArea.id;
    const location = jobPlanString(context.facts, id, "painting.location");
    const internal = jobPlanNumber(context.facts, id, "painting.internal_area_m2");
    const surfacesFact = context.facts.find(
      (f) => f.work_area_id === id && f.key === "painting.surfaces"
    );
    const surfaces = asList(surfacesFact?.value);

    const chips = [
      location
        ? { key: "location", label: "Location", value: location, advanced: false }
        : null,
      internal != null
        ? { key: "area", label: "Area", value: `${internal}m²`, advanced: false }
        : null,
    ].filter((c): c is NonNullable<typeof c> => c != null);

    const surfaceItems: JobPlanScopeItem[] = surfaces.map((label) => ({
      id: `surface:${label.toLowerCase()}`,
      workAreaId: id,
      label,
      presentation: "INCLUDED" as const,
      kind: "user_scope",
      togglable: false,
      write: null,
      sourceFactKey: "painting.surfaces",
      surfaceReason: "Painting surface list — isolated to this Work Area",
    }));

    const items: JobPlanScopeItem[] =
      surfaceItems.length > 0
        ? surfaceItems
        : [
            {
              id: "painting-core",
              workAreaId: id,
              label: "Painting",
              presentation: "INCLUDED",
              kind: "user_scope",
              togglable: false,
              write: null,
              sourceFactKey: null,
              surfaceReason: "Deterministic: Painting Work Area",
            },
          ];

    return {
      workAreaId: id,
      workAreaType: "painting",
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
