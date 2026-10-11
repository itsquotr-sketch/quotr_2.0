import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ceilingProvisionalDecision,
  ceilingProvisionalLineFromPricingItem,
  parseCeilingProvisionalConfirmation,
} from "@/lib/estimate/ceilings-provisional-package";

const PROVISIONAL_LINE_SELECT =
  "id, component_key, quantity, unit, client_label, internal_label, client_description, notes_internal, total_cost, total_sell, visible_on_quote, productivity_rate, calculated_quantity";

export async function clearStaleCeilingProvisionalConfirmation(
  supabase: SupabaseClient,
  orgId: string,
  pricingDocumentId: string
): Promise<string | null> {
  const { data: document, error: documentError } = await supabase
    .from("pricing_documents")
    .select("provisional_ceiling_confirmation")
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (documentError) return "Pricing could not be saved.";
  const stored = parseCeilingProvisionalConfirmation(
    document?.provisional_ceiling_confirmation
  );
  if (!stored) return null;

  const { data: items, error: itemsError } = await supabase
    .from("pricing_items")
    .select(PROVISIONAL_LINE_SELECT)
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", orgId);
  if (itemsError) return "Pricing could not be saved.";

  const decision = ceilingProvisionalDecision({
    lines: (items ?? []).map((row) =>
      ceilingProvisionalLineFromPricingItem(row as Record<string, unknown> & {
        id: string;
      })
    ),
    confirmation: stored,
    documentOrgId: orgId,
  });
  if (decision.confirmed) return null;

  const { error } = await supabase
    .from("pricing_documents")
    .update({
      provisional_ceiling_confirmation: null,
      status: "draft",
      reviewed_at: null,
    })
    .eq("id", pricingDocumentId)
    .eq("org_id", orgId);
  return error ? "Pricing could not be saved." : null;
}
