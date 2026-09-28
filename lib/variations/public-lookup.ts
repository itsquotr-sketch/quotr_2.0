import "server-only";

import { createClient } from "@supabase/supabase-js";
import { roundMoney } from "@/lib/commercial-engine/core/money";
import {
  formatAttachmentSize,
  variationAttachmentKind,
  variationAttachmentTypeLabel,
} from "@/lib/variations/attachment-files";
import {
  hashVariationAccessToken,
  isVariationAccessTokenFormat,
  variationPublicPath,
} from "@/lib/variations/delivery-token";
import { parseVariationDocumentIdentity } from "@/lib/variations/document-identity";
import {
  buildVariationDocument,
  formatContractMoney,
  type VariationDocumentModel,
} from "@/lib/variations/presentation";
import type { VariationItemType } from "@/lib/variations/domain";

export type VariationPublicOutcome = {
  outcome: "accepted" | "declined";
  respondedAt: string | null;
  responderName: string | null;
  declineReason: string | null;
  adjustmentInclLabel: string;
  revisedContractInclLabel: string;
  quoteNumber: string | null;
  quoteRevision: number | null;
};

export type VariationPublicView =
  | {
      state: "proposed";
      token: string;
      document: VariationDocumentModel;
      contactLine: string | null;
      attachmentCount: number;
    }
  | {
      state: "accepted" | "declined";
      document: VariationDocumentModel;
      contactLine: string | null;
      recordPath: string;
      outcome: VariationPublicOutcome;
    }
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
  const responseState =
    row.state === "accepted" || row.state === "declined" || row.state === "proposed"
      ? row.state
      : null;
  if (!responseState) return unavailable();

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

  const revisedEx = roundMoney(baselineEx + acceptedEx);
  const revisedIncl = roundMoney(baselineIncl + acceptedIncl);
  const proposedEx = roundMoney(revisedEx + sell);
  const proposedGst = roundMoney((numberOrNull(row.baselineGst) ?? 0) + acceptedGst + gst);
  const proposedIncl = roundMoney(revisedIncl + incl);
  const contact = [row.contactEmail, row.contactPhone]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" · ");

  const supportingFiles = Array.isArray(row.clientAttachments)
    ? row.clientAttachments.flatMap((file) => {
        if (!file || typeof file !== "object") return [];
        const record = file as Record<string, unknown>;
        const fileId = typeof record.fileId === "string" ? record.fileId : "";
        const displayFilename = typeof record.displayFilename === "string" ? record.displayFilename : "";
        const mimeType = typeof record.mimeType === "string" ? record.mimeType : "";
        const byteSize = numberOrNull(record.byteSize);
        if (!fileId || !displayFilename || !mimeType || byteSize == null) return [];
        const href = `${variationPublicPath(rawToken)}/files/${fileId}`;
        return [{
          fileId,
          displayFilename,
          caption: typeof record.caption === "string" && record.caption.trim() ? record.caption : null,
          mimeType,
          byteSize,
          typeLabel: variationAttachmentTypeLabel(mimeType),
          sizeLabel: formatAttachmentSize(byteSize),
          kind: variationAttachmentKind(mimeType),
          viewUrl: href,
          downloadUrl: `${href}?download=1`,
        }];
      })
    : [];

  const identity = parseVariationDocumentIdentity(row.identity);
  const document = buildVariationDocument({
    companyName: identity?.companyName || (typeof row.companyName === "string" ? row.companyName : ""),
    clientName: identity?.clientName || (typeof row.clientName === "string" ? row.clientName : ""),
    projectTitle: identity?.projectTitle || (typeof row.projectTitle === "string" ? row.projectTitle : ""),
    siteAddress: identity?.siteAddress ?? (typeof row.siteAddress === "string" ? row.siteAddress : null),
    identity,
    variationNumber,
    revisionNumber,
    issuedAt: typeof row.issuedAt === "string" ? row.issuedAt : null,
    status: responseState === "accepted" ? "accepted" : responseState === "declined" ? "rejected" : "issued",
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
    currentContract: responseState === "accepted"
      ? { exGst: roundMoney(revisedEx - sell), inclGst: roundMoney(revisedIncl - incl) }
      : { exGst: revisedEx, inclGst: revisedIncl },
    proposed: responseState === "declined"
      ? null
      : {
          revisedContractValueExGst: responseState === "accepted" ? revisedEx : proposedEx,
          gst: responseState === "accepted"
            ? roundMoney((numberOrNull(row.baselineGst) ?? 0) + acceptedGst)
            : proposedGst,
          revisedContractValueInclGst: responseState === "accepted" ? revisedIncl : proposedIncl,
        },
    supportingFiles,
  });

  if (responseState === "proposed") {
    return {
      state: "proposed",
      token: rawToken,
      document,
      contactLine: contact || null,
      attachmentCount: supportingFiles.length,
    };
  }

  return {
    state: responseState,
    document,
    contactLine: contact || null,
    recordPath: `${variationPublicPath(rawToken)}/response`,
    outcome: {
      outcome: responseState,
      respondedAt: typeof row.respondedAt === "string" ? row.respondedAt : null,
      responderName: typeof row.responderName === "string" ? row.responderName : null,
      declineReason: typeof row.declineReason === "string" && row.declineReason.trim() ? row.declineReason : null,
      adjustmentInclLabel: document.inclLabel,
      revisedContractInclLabel: formatContractMoney(revisedIncl, typeof row.currency === "string" ? row.currency : "NZD"),
      quoteNumber: document.quoteNumber,
      quoteRevision: document.quoteRevision,
    },
  };
}
