/**
 * Race-safe persistence for one manual continuation.
 * A unique index is the lock. The losing request re-reads the winner.
 * Two different scopes are different keys and both are kept.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MANUAL_WORK_AREA_LINE_MARKER } from "@/lib/work-areas/manual-pricing-route";

type DbError = { code?: string; message?: string } | null;

export function isUniqueViolation(error: DbError): boolean {
  if (!error) return false;
  return (
    error.code === "23505" ||
    /duplicate key value|unique constraint/i.test(error.message ?? "")
  );
}

type Claimed = { id: string } | { error: { code?: string; message: string } };

function failed(error: DbError, fallback: string): { error: { code?: string; message: string } } {
  return {
    error: {
      code: error?.code,
      message: error?.message ?? fallback,
    },
  };
}

export async function claimConfirmedManualWorkArea(
  supabase: SupabaseClient,
  row: {
    org_id: string;
    project_id: string;
    type: string;
    name: string;
    status: "confirmed";
    summary: string;
    quote_description: string;
    sort_order: number;
    ai_confidence: null;
  }
): Promise<Claimed> {
  const inserted = await supabase
    .from("work_areas")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (!inserted.error && inserted.data?.id) {
    return { id: String(inserted.data.id) };
  }
  if (!isUniqueViolation(inserted.error)) {
    return failed(inserted.error, "Could not save this work.");
  }
  const existing = await supabase
    .from("work_areas")
    .select("id")
    .eq("org_id", row.org_id)
    .eq("project_id", row.project_id)
    .eq("type", row.type)
    .eq("status", "confirmed")
    .eq("name", row.name)
    .eq("quote_description", row.quote_description)
    .limit(1)
    .maybeSingle();
  if (existing.error || !existing.data?.id) {
    return failed(existing.error, "Could not save this work.");
  }
  return { id: String(existing.data.id) };
}

export async function claimOpenManualPricingDocument(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<Claimed> {
  const inserted = await supabase
    .from("pricing_documents")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (!inserted.error && inserted.data?.id) {
    return { id: String(inserted.data.id) };
  }
  if (!isUniqueViolation(inserted.error)) {
    return failed(inserted.error, "Failed to create pricing.");
  }
  const existing = await supabase
    .from("pricing_documents")
    .select("id")
    .eq("org_id", String(row.org_id))
    .eq("project_id", String(row.project_id))
    .is("estimate_id", null)
    .in("status", ["draft", "reviewed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error || !existing.data?.id) {
    return failed(existing.error, "Failed to create pricing.");
  }
  return { id: String(existing.data.id) };
}

export async function claimManualWorkAreaPricingLine(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<Claimed> {
  const inserted = await supabase
    .from("pricing_items")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (!inserted.error && inserted.data?.id) {
    return { id: String(inserted.data.id) };
  }
  if (!isUniqueViolation(inserted.error)) {
    return failed(inserted.error, "Could not save this price line.");
  }
  const existing = await supabase
    .from("pricing_items")
    .select("id")
    .eq("pricing_document_id", String(row.pricing_document_id))
    .eq("work_area_id", String(row.work_area_id))
    .like("notes_internal", `%${MANUAL_WORK_AREA_LINE_MARKER}%`)
    .limit(1)
    .maybeSingle();
  if (existing.error || !existing.data?.id) {
    return failed(existing.error, "Could not save this price line.");
  }
  return { id: String(existing.data.id) };
}

/**
 * Add calculated lines to the open manual Pricing document.
 * Does not write quotes or quote items.
 */
export async function attachEstimateLinesToOpenManualPricing(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    documentId: string;
    estimateId: string;
    requirementSnapshotId: string | null;
    resetReview: boolean;
    scopeSummary: string | null;
    rows: Record<string, unknown>[];
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const update: Record<string, unknown> = {
    estimate_id: input.estimateId,
    scope_summary: input.scopeSummary,
  };
  if (input.requirementSnapshotId) {
    update.requirement_snapshot_id = input.requirementSnapshotId;
  }
  if (input.resetReview) {
    update.status = "draft";
    update.reviewed_at = null;
  }

  const claim = async (payload: Record<string, unknown>) =>
    supabase
      .from("pricing_documents")
      .update(payload)
      .eq("id", input.documentId)
      .eq("org_id", input.orgId)
      .is("estimate_id", null)
      .select("id");

  let claimed = await claim(update);
  if (
    claimed.error?.message?.includes("requirement_snapshot_id") &&
    update.requirement_snapshot_id != null
  ) {
    delete update.requirement_snapshot_id;
    claimed = await claim(update);
  }
  if (claimed.error) {
    return { ok: false, message: claimed.error.message };
  }
  if (!claimed.data || claimed.data.length === 0) {
    return { ok: true };
  }

  if (input.rows.length > 0) {
    const stamped: Record<string, unknown>[] = input.rows.map((row) => ({
      ...row,
      org_id: input.orgId,
      pricing_document_id: input.documentId,
    }));
    let inserted = await supabase.from("pricing_items").insert(stamped);
    if (inserted.error?.message?.includes("component_key")) {
      inserted = await supabase.from("pricing_items").insert(
        stamped.map((row) => {
          const copy: Record<string, unknown> = { ...row };
          delete copy.component_key;
          return copy;
        })
      );
    }
    if (inserted.error) {
      await supabase
        .from("pricing_documents")
        .update({ estimate_id: null })
        .eq("id", input.documentId)
        .eq("org_id", input.orgId)
        .eq("estimate_id", input.estimateId);
      return { ok: false, message: inserted.error.message };
    }
  }

  return { ok: true };
}
