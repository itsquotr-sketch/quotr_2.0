"use server";

/**
 * User-authored scope items under confirmed Work Areas (3.1B.7F-R2).
 * No Facts, no WA creation, no catalogue mutation, no commercial math.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  manualScopeItemIdentity,
  type ManualScopeItemState,
  type ManualScopeItemView,
} from "@/lib/work-areas/scope-items/types";

const addInputSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  scopeItemType: z.string().trim().max(80).optional().nullable(),
});

const decideInputSchema = z.object({
  projectId: z.string().uuid(),
  scopeItemId: z.string().uuid(),
  intendedState: z.enum(["INCLUDED", "NOT_REQUIRED"]),
});

type ActionResult<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly message: string };

function revalidateProject(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

function latestState(
  decisions: readonly { decision_type: string; decided_at: string }[]
): ManualScopeItemState {
  if (decisions.length === 0) return "INCLUDED";
  const sorted = [...decisions].sort((a, b) =>
    String(b.decided_at).localeCompare(String(a.decided_at))
  );
  return sorted[0]?.decision_type === "EXCLUDE" ? "NOT_REQUIRED" : "INCLUDED";
}

export async function listManualScopeItemsForProject(projectId: string): Promise<
  ActionResult<{ readonly items: readonly ManualScopeItemView[] }>
> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { ok: false, message: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { data: items, error } = await supabase
    .from("work_area_scope_items")
    .select(
      "id, work_area_id, identity, title, description, scope_item_type, origin, work_areas(name)"
    )
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) {
    // Table may not exist yet on Preview before 030 is applied — fail soft.
    return { ok: true, items: [] };
  }

  const ids = (items ?? []).map((row) => String(row.id));
  const decisionByItem = new Map<
    string,
    { decision_type: string; decided_at: string }[]
  >();

  if (ids.length > 0) {
    const { data: decisions } = await supabase
      .from("work_area_scope_item_decisions")
      .select("scope_item_id, decision_type, decided_at")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .in("scope_item_id", ids);

    for (const d of decisions ?? []) {
      const key = String(d.scope_item_id);
      const list = decisionByItem.get(key) ?? [];
      list.push({
        decision_type: String(d.decision_type),
        decided_at: String(d.decided_at),
      });
      decisionByItem.set(key, list);
    }
  }

  const views: ManualScopeItemView[] = (items ?? []).map((row) => {
    const wa = row.work_areas as { name?: string | null } | null;
    return {
      id: String(row.id),
      workAreaId: String(row.work_area_id),
      workAreaName: wa?.name?.trim() || "Work area",
      identity: String(row.identity),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      scopeItemType: row.scope_item_type ? String(row.scope_item_type) : null,
      origin: "user",
      state: latestState(decisionByItem.get(String(row.id)) ?? []),
      pricingRequired: true,
      addedByYou: true,
    };
  });

  return { ok: true, items: views };
}

export async function addManualScopeItemAction(input: {
  projectId: string;
  workAreaId: string;
  title: string;
  description?: string | null;
  scopeItemType?: string | null;
}): Promise<ActionResult<{ readonly item: ManualScopeItemView }>> {
  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a scope item name." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { ok: false, message: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { data: wa, error: waError } = await supabase
    .from("work_areas")
    .select("id, name, status, org_id, project_id")
    .eq("id", parsed.data.workAreaId)
    .eq("project_id", parsed.data.projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (waError || !wa || wa.status !== "confirmed") {
    return {
      ok: false,
      message: "Scope items can only be added under a confirmed work area.",
    };
  }

  const identity = manualScopeItemIdentity({
    workAreaId: parsed.data.workAreaId,
    title: parsed.data.title,
  });

  const { data: existing } = await supabase
    .from("work_area_scope_items")
    .select("id")
    .eq("project_id", parsed.data.projectId)
    .eq("work_area_id", parsed.data.workAreaId)
    .eq("identity", identity)
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: false,
      message: "That scope item already exists for this work area.",
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("work_area_scope_items")
    .insert({
      org_id: orgId,
      project_id: parsed.data.projectId,
      work_area_id: parsed.data.workAreaId,
      identity,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      scope_item_type: parsed.data.scopeItemType?.trim() || null,
      origin: "user",
      created_by: user.id,
    })
    .select("id, work_area_id, identity, title, description, scope_item_type")
    .single();

  if (insertError || !inserted) {
    return { ok: false, message: "Scope item could not be saved." };
  }

  const { error: decisionError } = await supabase
    .from("work_area_scope_item_decisions")
    .insert({
      org_id: orgId,
      project_id: parsed.data.projectId,
      scope_item_id: inserted.id,
      decision_type: "INCLUDE",
      decided_by: user.id,
      reason_code: "user_added_included",
    });

  if (decisionError) {
    return {
      ok: false,
      message: "Scope item was created but could not be marked included.",
    };
  }

  revalidateProject(parsed.data.projectId);

  return {
    ok: true,
    item: {
      id: String(inserted.id),
      workAreaId: String(inserted.work_area_id),
      workAreaName: String(wa.name ?? "Work area"),
      identity: String(inserted.identity),
      title: String(inserted.title),
      description: inserted.description ? String(inserted.description) : null,
      scopeItemType: inserted.scope_item_type
        ? String(inserted.scope_item_type)
        : null,
      origin: "user",
      state: "INCLUDED",
      pricingRequired: true,
      addedByYou: true,
    },
  };
}

export async function decideManualScopeItemAction(input: {
  projectId: string;
  scopeItemId: string;
  intendedState: ManualScopeItemState;
}): Promise<ActionResult<{ readonly state: ManualScopeItemState }>> {
  const parsed = decideInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That scope decision could not be saved." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { ok: false, message: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { data: item, error } = await supabase
    .from("work_area_scope_items")
    .select("id")
    .eq("id", parsed.data.scopeItemId)
    .eq("project_id", parsed.data.projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !item) {
    return { ok: false, message: "Scope item was not found." };
  }

  const decisionType =
    parsed.data.intendedState === "INCLUDED" ? "INCLUDE" : "EXCLUDE";

  const { error: decisionError } = await supabase
    .from("work_area_scope_item_decisions")
    .insert({
      org_id: orgId,
      project_id: parsed.data.projectId,
      scope_item_id: parsed.data.scopeItemId,
      decision_type: decisionType,
      decided_by: user.id,
      reason_code:
        decisionType === "INCLUDE"
          ? "user_scope_reincluded"
          : "user_scope_not_required",
    });

  if (decisionError) {
    return { ok: false, message: "Scope decision could not be saved." };
  }

  revalidateProject(parsed.data.projectId);
  return { ok: true, state: parsed.data.intendedState };
}
