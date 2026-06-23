import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysIsoDate,
  parseStringArray,
  todayIsoDate,
} from "@/lib/pricing/calculations";
import { mapPricingDocument, mapPricingItem } from "@/lib/pricing/mappers";
import { DEFAULT_GST_RATE } from "@/lib/pricing/status";
import { formatFactValueForDisplay } from "@/lib/scopes/fact-labels";
import { getOrgQuoteDefaultsForOrg } from "@/lib/settings/company-actions";
import {
  resolveAssumptionsForSnapshot,
  resolveExclusionsForSnapshot,
  resolveTermsForSnapshot,
} from "@/lib/settings/snapshot";
import { calculateQuoteTotals } from "@/lib/quotes/calculations";
import {
  buildInclusionsFromPricing,
  mapPricingItemsToQuoteItems,
  type QuoteItemFromPricing,
} from "@/lib/quotes/from-pricing";
import {
  buildWorkAreaDescriptionsMap,
  type WorkAreaQuoteFact,
  type WorkAreaQuotePricingItem,
} from "@/lib/work-areas/quote-description";

export type PricingQuoteSnapshot = {
  pricingDocumentId: string;
  estimateId: string | null;
  quoteFields: {
    title: string;
    client_name: string | null;
    site_address: string | null;
    issue_date: string;
    valid_until: string;
    subtotal: number;
    gst_rate: number;
    gst_amount: number;
    total_incl_gst: number;
    scope_summary: string | null;
    inclusions: string[];
    exclusions: string[];
    assumptions: string[];
    terms: string;
  };
  quoteItems: QuoteItemFromPricing[];
};

export async function buildQuoteSnapshotFromReviewedPricing(input: {
  supabase: SupabaseClient;
  orgId: string;
  projectId: string;
  pricingDocumentId: string;
  projectTitle: string;
  projectClientName: string | null;
  projectSiteAddress: string | null;
  reviewedErrorMessage?: string;
}): Promise<{ error: string } | PricingQuoteSnapshot> {
  const {
    supabase,
    orgId,
    projectId,
    pricingDocumentId,
    projectTitle,
    projectClientName,
    projectSiteAddress,
    reviewedErrorMessage = "Mark final pricing as reviewed before refreshing the quote.",
  } = input;

  const { data: documentRow, error: documentError } = await supabase
    .from("pricing_documents")
    .select("*")
    .eq("id", pricingDocumentId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (documentError || !documentRow) {
    return { error: "Pricing document not found." };
  }

  const document = mapPricingDocument(documentRow);

  if (document.status !== "reviewed") {
    return {
      error: reviewedErrorMessage,
    };
  }

  const [{ data: pricingItems }, { data: workAreas }, { data: projectFacts }] =
    await Promise.all([
      supabase
        .from("pricing_items")
        .select("*")
        .eq("pricing_document_id", pricingDocumentId)
        .eq("org_id", orgId)
        .order("sort_order"),
      supabase
        .from("work_areas")
        .select("id, name, type, quote_description")
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .eq("status", "confirmed"),
      supabase
        .from("project_facts")
        .select("work_area_id, key, label, value")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
    ]);

  const items = (pricingItems ?? []).map((row) => mapPricingItem(row));
  const workAreaNames = new Map(
    (workAreas ?? []).map((workArea) => [workArea.id, workArea.name])
  );

  const factsByWorkAreaId = new Map<string, WorkAreaQuoteFact[]>();
  for (const fact of projectFacts ?? []) {
    if (!fact.work_area_id) {
      continue;
    }
    const value = formatFactValueForDisplay(fact.value);
    if (!value) {
      continue;
    }
    const list = factsByWorkAreaId.get(fact.work_area_id) ?? [];
    list.push({
      key: fact.key,
      label: fact.label,
      value,
    });
    factsByWorkAreaId.set(fact.work_area_id, list);
  }

  const pricingItemsByWorkAreaId = new Map<string, WorkAreaQuotePricingItem[]>();
  for (const item of items) {
    if (!item.work_area_id) {
      continue;
    }
    const label = (item.client_label || item.internal_label || "").trim();
    if (!label) {
      continue;
    }
    const list = pricingItemsByWorkAreaId.get(item.work_area_id) ?? [];
    list.push({ label });
    pricingItemsByWorkAreaId.set(item.work_area_id, list);
  }

  const workAreaDescriptions = buildWorkAreaDescriptionsMap(
    workAreas ?? [],
    factsByWorkAreaId,
    pricingItemsByWorkAreaId
  );

  const orgDefaults = await getOrgQuoteDefaultsForOrg(supabase, orgId);
  const quoteGstRate =
    document.gst_rate ?? orgDefaults.defaultGstRate ?? DEFAULT_GST_RATE;
  const quoteTerms = resolveTermsForSnapshot(document.terms, orgDefaults);
  const quoteExclusions = resolveExclusionsForSnapshot(
    parseStringArray(document.exclusions),
    orgDefaults
  );
  const quoteAssumptions = resolveAssumptionsForSnapshot(
    parseStringArray(document.assumptions),
    orgDefaults
  );
  const quoteValidUntil =
    document.valid_until ?? addDaysIsoDate(orgDefaults.defaultQuoteValidityDays);

  const quoteItems = mapPricingItemsToQuoteItems(
    items,
    workAreaNames,
    workAreaDescriptions
  );
  const totals = calculateQuoteTotals(
    quoteItems.map((item) => ({ total: item.total ?? 0, visible: true })),
    quoteGstRate
  );

  const inclusions = buildInclusionsFromPricing(items, workAreaNames);

  return {
    pricingDocumentId,
    estimateId: document.estimate_id,
    quoteFields: {
      title: `Quote — ${projectTitle}`,
      client_name: document.client_name ?? projectClientName,
      site_address: document.site_address ?? projectSiteAddress,
      issue_date: todayIsoDate(),
      valid_until: quoteValidUntil,
      subtotal: totals.subtotal,
      gst_rate: quoteGstRate,
      gst_amount: totals.gstAmount,
      total_incl_gst: totals.totalInclGst,
      scope_summary: document.scope_summary,
      inclusions,
      exclusions: quoteExclusions,
      assumptions: quoteAssumptions,
      terms: quoteTerms,
    },
    quoteItems,
  };
}
