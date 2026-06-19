import type { createClient } from "@/lib/supabase/server";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";

type ProjectFactRow = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
};

export async function persistDerivedFactsForProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string,
  workAreas: { id: string; type: string; status: string }[],
  projectFacts: ProjectFactRow[]
): Promise<ProjectFactRow[]> {
  const confirmed = workAreas.filter(
    (workArea) => workArea.status === "confirmed"
  );
  const derivedFacts = deriveFactsForProject({
    workAreas: confirmed.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts,
  });

  for (const derived of derivedFacts) {
    let factQuery = supabase
      .from("project_facts")
      .select("id, source")
      .eq("project_id", projectId)
      .eq("key", derived.key);

    if (derived.work_area_id) {
      factQuery = factQuery.eq("work_area_id", derived.work_area_id);
    } else {
      factQuery = factQuery.is("work_area_id", null);
    }

    const { data: existingFact } = await factQuery.maybeSingle();

    if (existingFact?.source === "user") {
      continue;
    }

    const factPayload = {
      label: derived.label,
      value: derived.value,
      unit: derived.unit,
      source: "derived" as const,
      confidence: 1,
    };

    if (existingFact) {
      await supabase
        .from("project_facts")
        .update(factPayload)
        .eq("id", existingFact.id)
        .eq("project_id", projectId);
    } else {
      await supabase.from("project_facts").insert({
        org_id: orgId,
        project_id: projectId,
        work_area_id: derived.work_area_id,
        key: derived.key,
        ...factPayload,
      });
    }
  }

  return mergeDerivedFactsIntoRecords(projectFacts, derivedFacts);
}
