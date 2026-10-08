import type { SupabaseClient } from "@supabase/supabase-js";
import { isReplacedSubcontractPlaceholder } from "@/lib/pricing/replaced-subcontract-line";

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
  clientConditions: string[];
};

const EMPTY: ScheduleScopeReview = { blocking: null, unresolved: [], outside: [], clientExclusions: [], clientConditions: [] };

type LinkedItem = {
  id: string;
  visible_on_quote: boolean | null;
  recalibration_note: string | null;
  total_cost: number | null;
  total_sell: number | null;
};

function linkedItemCovers(item: LinkedItem | undefined): boolean {
  if (!item || item.visible_on_quote !== true) return false;
  return !isReplacedSubcontractPlaceholder(item);
}

function uniqueLines(lines: string[]): string[] {
  return lines.filter((line, index, all) => line.length > 0 && all.indexOf(line) === index);
}

export async function loadScheduleScopeReview(
  supabase: SupabaseClient,
  orgId: string,
  pricingDocumentId: string
): Promise<ScheduleScopeReview> {
  const applications = await supabase
    .from("rfq_schedule_pricing_applications")
    .select("rfq_id, response_id, schedule_item_id, qualification, coverage_decision, coverage_item_id, coverage_wording, coverage_note, excluded_scope, response_exclusion_decision, response_exclusion_item_id, response_exclusion_wording, response_exclusion_note, client_label")
    .eq("org_id", orgId)
    .eq("pricing_document_id", pricingDocumentId)
    .is("superseded_at", null);
  const rows = applications.data ?? [];
  if (rows.length === 0) return EMPTY;
  const rfqIds = [...new Set(rows.map((row) => row.rfq_id as string))];
  const [schedule, resolutions] = await Promise.all([
    supabase.from("rfq_schedule_items").select("id, rfq_id, scope, line_role").in("rfq_id", rfqIds).eq("org_id", orgId),
    supabase.from("rfq_schedule_scope_resolutions").select("schedule_item_id, decision, client_wording, internal_note, coverage_item_id").eq("pricing_document_id", pricingDocumentId).eq("org_id", orgId).is("superseded_at", null),
  ]);
  const linkedIds = [
    ...rows.map((row) => row.coverage_item_id as string | null),
    ...rows.map((row) => row.response_exclusion_item_id as string | null),
    ...(resolutions.data ?? []).map((row) => row.coverage_item_id as string | null),
  ].filter((id): id is string => Boolean(id));
  const linked = linkedIds.length === 0
    ? { data: [] as LinkedItem[] }
    : await supabase.from("pricing_items").select("id, visible_on_quote, recalibration_note, total_cost, total_sell").in("id", linkedIds).eq("org_id", orgId);
  const itemsById = new Map((linked.data ?? []).map((item) => [item.id as string, item as LinkedItem]));
  const covers = (id: string | null) => linkedItemCovers(id ? itemsById.get(id) : undefined);
  const qualificationReady = (row: (typeof rows)[number]) => {
    if (!String(row.qualification ?? "").trim()) return true;
    if (row.coverage_decision === "client_condition" || row.coverage_decision === "client_exclusion") {
      return String(row.coverage_wording ?? "").trim().length >= 3;
    }
    if (row.coverage_decision === "internal_plan") return String(row.coverage_note ?? "").trim().length >= 3;
    if (row.coverage_decision === "covered_by_item") {
      return covers(row.coverage_item_id as string | null) && String(row.coverage_note ?? "").trim().length >= 3;
    }
    return false;
  };
  const exclusionReady = (row: (typeof rows)[number]) => {
    if (!String(row.excluded_scope ?? "").trim()) return true;
    if (row.response_exclusion_decision === "client_exclusion") return String(row.response_exclusion_wording ?? "").trim().length >= 3;
    if (row.response_exclusion_decision === "covered_by_item") {
      return covers(row.response_exclusion_item_id as string | null) && String(row.response_exclusion_note ?? "").trim().length >= 3;
    }
    return false;
  };
  const resolutionClears = (row: { decision?: string | null; client_wording?: string | null; coverage_item_id?: string | null; internal_note?: string | null }) => {
    if (row.decision === "client_exclusion") return String(row.client_wording ?? "").trim().length >= 3;
    if (row.decision === "covered_by_item") {
      return covers(row.coverage_item_id ?? null) && String(row.internal_note ?? "").trim().length >= 3;
    }
    return false;
  };
  const applied = new Set(rows.map((row) => row.schedule_item_id as string));
  const resolved = new Set((resolutions.data ?? []).filter(resolutionClears).map((row) => row.schedule_item_id as string));
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
  const missingCoverage = rows.find((row) => !qualificationReady(row)) ?? rows.find((row) => !exclusionReady(row));
  const clientExclusions = uniqueLines([
    ...rows.filter((row) => row.response_exclusion_decision === "client_exclusion").map((row) => String(row.response_exclusion_wording ?? "").trim()),
    ...(resolutions.data ?? []).filter((row) => row.decision === "client_exclusion").map((row) => String(row.client_wording ?? "").trim()),
  ]);
  const clientConditions = uniqueLines(
    rows.filter((row) => row.coverage_decision === "client_condition").map((row) => String(row.coverage_wording ?? "").trim())
  );
  const blocking = missingCoverage
    ? `Choose how the supplier condition on ${missingCoverage.client_label || "a selected item"} is covered before creating the quote.`
    : unresolved[0]
      ? `Resolve “${unresolved[0].scope}” before creating the quote. It is not covered by the selected prices.`
      : null;
  return { blocking, unresolved, outside, clientExclusions, clientConditions };
}
