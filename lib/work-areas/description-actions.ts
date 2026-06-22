"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { formatFactValueForDisplay } from "@/lib/scopes/fact-labels";
import {
  buildWorkAreaQuoteDescriptionDraft,
  type WorkAreaQuoteFact,
} from "@/lib/work-areas/quote-description";

export type WorkAreaDescriptionActionState = {
  error?: string;
  success?: boolean;
  quoteDescription?: string | null;
  draft?: string;
};

const updateSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
  quoteDescription: z
    .string()
    .max(4000, "Description is too long.")
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

const draftSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
});

function revalidateProjectPaths(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

async function loadOwnedWorkArea(projectId: string, workAreaId: string) {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." as const };
  }

  const { supabase, orgId } = context;

  const { data: workArea, error } = await supabase
    .from("work_areas")
    .select("id, project_id, type, name, status, quote_description")
    .eq("id", workAreaId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !workArea) {
    return { error: "Work area not found." as const };
  }

  if (workArea.status !== "confirmed") {
    return { error: "Only confirmed work areas can have quote descriptions." as const };
  }

  return { context, workArea };
}

async function loadWorkAreaFacts(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  projectId: string,
  workAreaId: string
): Promise<WorkAreaQuoteFact[]> {
  const { data: facts } = await supabase
    .from("project_facts")
    .select("key, label, value")
    .eq("project_id", projectId)
    .eq("work_area_id", workAreaId);

  return (facts ?? [])
    .map((fact) => {
      const value = formatFactValueForDisplay(fact.value);
      if (!value) {
        return null;
      }
      return {
        key: fact.key,
        label: fact.label,
        value,
      };
    })
    .filter((fact): fact is WorkAreaQuoteFact => fact !== null);
}

export async function updateWorkAreaQuoteDescription(input: {
  projectId: string;
  workAreaId: string;
  quoteDescription: string;
}): Promise<WorkAreaDescriptionActionState> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid description request.",
    };
  }

  const loaded = await loadOwnedWorkArea(
    parsed.data.projectId,
    parsed.data.workAreaId
  );
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { context, workArea } = loaded;
  const quoteDescription = parsed.data.quoteDescription || null;

  const { error } = await context.supabase
    .from("work_areas")
    .update({
      quote_description: quoteDescription,
      quote_description_updated_at: new Date().toISOString(),
    })
    .eq("id", workArea.id)
    .eq("project_id", parsed.data.projectId)
    .eq("org_id", context.orgId);

  if (error) {
    return { error: error.message };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    success: true,
    quoteDescription,
  };
}

export async function generateWorkAreaQuoteDescriptionDraft(input: {
  projectId: string;
  workAreaId: string;
}): Promise<WorkAreaDescriptionActionState> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid draft request." };
  }

  const loaded = await loadOwnedWorkArea(
    parsed.data.projectId,
    parsed.data.workAreaId
  );
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { context, workArea } = loaded;
  const facts = await loadWorkAreaFacts(
    context.supabase,
    parsed.data.projectId,
    workArea.id
  );

  const draft = buildWorkAreaQuoteDescriptionDraft({
    type: workArea.type,
    name: workArea.name,
    facts,
  });

  return { draft };
}
