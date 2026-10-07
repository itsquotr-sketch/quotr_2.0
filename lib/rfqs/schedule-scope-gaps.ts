import type { SupabaseClient } from "@supabase/supabase-js";

export type ScheduleScopeResolution = {
  scheduleItemId: string;
  rfqId: string;
  responseId: string;
  scope: string;
  reason: string;
};

export type ScheduleScopeReview = {
  blocking: string | null;
  unresolved: ScheduleScopeResolution[];
  outside: Array<{ scope: string; role: string }>;
  clientExclusions: string[];
};

const EMPTY: ScheduleScopeReview = { blocking: null, unresolved: [], outside: [], clientExclusions: [] };

export async function loadScheduleScopeReview(
  supabase: SupabaseClient,
  orgId: string,
  pricingDocumentId: string
): Promise<ScheduleScopeReview> {
  const applications = await supabase
    .from("rfq_schedule_pricing_applications")
    .select("rfq_id, response_id, schedule_item_id, qualification, coverage_decision, excluded_scope, response_exclusion_decision, response_exclusion_wording, client_label")
    .eq("org_id", orgId)
    .eq("pricing_document_id", pricingDocumentId)
    .is("superseded_at", null);
  const rows = applications.data ?? [];
  if (rows.length === 0) return EMPTY;
  const rfqIds = [...new Set(rows.map((row) => row.rfq_id as string))];
  const [schedule, resolutions] = await Promise.all([
    supabase.from("rfq_schedule_items").select("id, rfq_id, scope, line_role").in("rfq_id", rfqIds).eq("org_id", orgId),
    supabase.from("rfq_schedule_scope_resolutions").select("schedule_item_id, decision, client_wording").eq("pricing_document_id", pricingDocumentId).eq("org_id", orgId).is("superseded_at", null),
  ]);
  const applied = new Set(rows.map((row) => row.schedule_item_id as string));
  const resolved = new Set((resolutions.data ?? []).map((row) => row.schedule_item_id as string));
  const responseForRfq = new Map<string, string>();
  for (const row of rows) responseForRfq.set(row.rfq_id as string, row.response_id as string);
  const unresolved: ScheduleScopeResolution[] = [];
  const outside: Array<{ scope: string; role: string }> = [];
  for (const item of schedule.data ?? []) {
    if (applied.has(item.id as string)) continue;
    if (item.line_role === "required" && !resolved.has(item.id as string)) {
      unresolved.push({
        scheduleItemId: item.id as string,
        rfqId: item.rfq_id as string,
        responseId: responseForRfq.get(item.rfq_id as string) ?? "",
        scope: item.scope as string,
        reason: "This required item was not priced into the draft.",
      });
    } else if (item.line_role !== "required") {
      outside.push({ scope: item.scope as string, role: item.line_role as string });
    }
  }
  const missingCoverage = rows.find((row) => String(row.qualification ?? "").trim() && !row.coverage_decision)
    ?? rows.find((row) => String(row.excluded_scope ?? "").trim() && !row.response_exclusion_decision);
  const clientExclusions = [
    ...rows.filter((row) => row.response_exclusion_decision === "client_exclusion").map((row) => String(row.response_exclusion_wording ?? "").trim()),
    ...(resolutions.data ?? []).filter((row) => row.decision === "client_exclusion").map((row) => String(row.client_wording ?? "").trim()),
  ].filter((line, index, all) => line.length > 0 && all.indexOf(line) === index);
  const blocking = missingCoverage
    ? `Choose how the supplier condition on ${missingCoverage.client_label || "a selected item"} is covered before creating the quote.`
    : unresolved[0]
      ? `Resolve “${unresolved[0].scope}” before creating the quote. It is not covered by the selected prices.`
      : null;
  return { blocking, unresolved, outside, clientExclusions };
}
