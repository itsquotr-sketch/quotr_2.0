import "server-only";

import { createClient } from "@supabase/supabase-js";
import { roundMoney } from "@/lib/commercial-engine/core/money";
import {
  hashVariationAccessToken,
  isVariationAccessTokenFormat,
} from "@/lib/variations/delivery-token";
import {
  buildVariationDocument,
  type VariationDocumentModel,
} from "@/lib/variations/presentation";
import type { VariationItemType } from "@/lib/variations/domain";

export type VariationPublicView =
  | { state: "proposed"; document: VariationDocumentModel; contactLine: string | null }
  | { state: "withdrawn" }
  | { state: "unavailable" };

function unavailable(): VariationPublicView {
  return { state: "unavailable" };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function lookupPublicVariationByToken(
  rawToken: string
): Promise<VariationPublicView> {
  if (!isVariationAccessTokenFormat(rawToken)) return unavailable();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return unavailable();
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("lookup_variation_client_by_token_hash_v1", {
    p_token_hash: hashVariationAccessToken(rawToken),
  });
  if (error || !data || typeof data !== "object") return unavailable();
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return unavailable();
  if (row.state === "withdrawn") return { state: "withdrawn" };
  if (row.state !== "proposed") return unavailable();

  const sell = numberOrNull(row.totalSellAdjustmentExGst);
  const gst = numberOrNull(row.gstAdjustment);
  const incl = numberOrNull(row.totalAdjustmentInclGst);
  const baselineEx = numberOrNull(row.baselineExGst);
  const baselineIncl = numberOrNull(row.baselineInclGst);
  const acceptedEx = numberOrNull(row.acceptedAdjustmentExGst) ?? 0;
  const acceptedGst = numberOrNull(row.acceptedAdjustmentGst) ?? 0;
  const acceptedIncl = numberOrNull(row.acceptedAdjustmentInclGst) ?? 0;
  const variationNumber = numberOrNull(row.variationNumber);
  const revisionNumber = numberOrNull(row.revisionNumber);
  const gstRate = numberOrNull(row.gstRate);
  if (
    sell == null ||
    gst == null ||
    incl == null ||
    baselineEx == null ||
    baselineIncl == null ||
    variationNumber == null ||
    revisionNumber == null ||
    gstRate == null ||
    typeof row.title !== "string" ||
    typeof row.currency !== "string"
  ) {
    return unavailable();
  }

  const items = Array.isArray(row.items)
    ? row.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const itemType = record.itemType;
        if (itemType !== "addition" && itemType !== "omission" && itemType !== "no_cost_scope_change") {
          return [];
        }
        return [{
          itemType: itemType as VariationItemType,
          clientDescription: typeof record.clientDescription === "string" ? record.clientDescription : "",
          lineSellAdjustmentExGst: numberOrNull(record.lineSellAdjustmentExGst),
          substitutionGroupId: typeof record.substitutionGroupId === "string" ? record.substitutionGroupId : null,
          sortOrder: numberOrNull(record.sortOrder) ?? 0,
          quantity: numberOrNull(record.quantity) ?? undefined,
          unit: typeof record.unit === "string" ? record.unit : undefined,
        }];
      })
    : [];

  const currentEx = roundMoney(baselineEx + acceptedEx);
  const currentIncl = roundMoney(baselineIncl + acceptedIncl);
  const proposedEx = roundMoney(currentEx + sell);
  const proposedGst = roundMoney((numberOrNull(row.baselineGst) ?? 0) + acceptedGst + gst);
  const proposedIncl = roundMoney(currentIncl + incl);
  const contact = [row.contactEmail, row.contactPhone]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" · ");

  const document = buildVariationDocument({
    companyName: typeof row.companyName === "string" ? row.companyName : "",
    clientName: typeof row.clientName === "string" && row.clientName.trim() ? row.clientName : "Client",
    projectTitle: typeof row.projectTitle === "string" ? row.projectTitle : "",
    siteAddress: typeof row.siteAddress === "string" ? row.siteAddress : null,
    variationNumber,
    revisionNumber,
    issuedAt: typeof row.issuedAt === "string" ? row.issuedAt : null,
    status: "issued",
    title: row.title,
    summary: typeof row.summary === "string" ? row.summary : null,
    clientNotes: typeof row.clientNotes === "string" ? row.clientNotes : null,
    currency: row.currency,
    items,
    totals: {
      totalSellAdjustmentExGst: sell,
      gstAdjustment: gst,
      totalAdjustmentInclGst: incl,
    },
    baseline: { sellExGst: baselineEx, sellInclGst: baselineIncl },
    currentContract: { exGst: currentEx, inclGst: currentIncl },
    proposed: {
      revisedContractValueExGst: proposedEx,
      gst: proposedGst,
      revisedContractValueInclGst: proposedIncl,
    },
  });

  return { state: "proposed", document, contactLine: contact || null };
}
