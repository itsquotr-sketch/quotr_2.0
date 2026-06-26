import type { createClient } from "@/lib/supabase/server";

export type PricingAuditAction =
  | "pricing_item_create"
  | "pricing_item_update"
  | "pricing_item_delete"
  | "pricing_document_status_change"
  | "pricing_recalibration"
  | "pricing_recalibration_dismissed"
  | "quote_create"
  | "quote_refresh"
  | "quote_revision"
  | "quote_status_change";

type AuditLogInput = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organisationId: string;
  projectId: string;
  action: PricingAuditAction | string;
  userId?: string | null;
  pricingDocumentId?: string | null;
  quoteId?: string | null;
  itemId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

/**
 * Best-effort audit logging. Failures are logged but never block the parent action.
 */
export async function logPricingAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    const { error } = await input.supabase.from("pricing_audit_log").insert({
      organisation_id: input.organisationId,
      project_id: input.projectId,
      pricing_document_id: input.pricingDocumentId ?? null,
      quote_id: input.quoteId ?? null,
      item_id: input.itemId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
    });

    if (error) {
      console.error(
        `[pricing-audit] Failed to log ${input.action}:`,
        error.message
      );
    }
  } catch (err) {
    console.error(
      `[pricing-audit] Unexpected error logging ${input.action}:`,
      err
    );
  }
}
