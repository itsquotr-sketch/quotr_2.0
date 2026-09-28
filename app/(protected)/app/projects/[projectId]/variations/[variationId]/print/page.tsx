import { VariationDocument } from "@/components/variations/VariationDocument";
import { VariationPrintButton } from "@/components/variations/VariationPrintButton";
import {
  formatAttachmentSize,
  variationAttachmentKind,
  variationAttachmentTypeLabel,
} from "@/lib/variations/attachment-files";
import { calculateRevisedContractValue } from "@/lib/variations/domain";
import {
  buildVariationDocument,
  proposedRevisedContract,
} from "@/lib/variations/presentation";
import { loadVariationEditor } from "@/lib/variations/workspace-actions";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = {
  params: Promise<{ projectId: string; variationId: string }>;
  searchParams: Promise<{ revision?: string }>;
};

export default async function VariationPrintPage({ params, searchParams }: PageProps) {
  await connection();
  const { projectId, variationId } = await params;
  const query = await searchParams;
  const editor = await loadVariationEditor(projectId, variationId);
  if (!editor.ok) notFound();
  const viewing =
    editor.variation.revisions.find((revision) => revision.id === query.revision) ??
    editor.variation.revisions.find((revision) => revision.status !== "superseded");
  if (!viewing) notFound();
  const baseline = {
    currency: editor.baseline.currency,
    gstRate: editor.baseline.gstRate,
    taxTreatment: editor.baseline.taxTreatment,
    sellExGst: editor.baseline.sellExGst,
    gstAmount: editor.baseline.gstAmount,
    sellInclGst: editor.baseline.sellInclGst,
  };
  const accepted = editor.acceptedRevisions
    .filter((row) => row.id !== viewing.id)
    .map((row) => ({
      id: row.id,
      status: "accepted" as const,
      isCurrent: true,
      totalSellAdjustmentExGst: row.totalSellAdjustmentExGst,
      gstAdjustment: row.gstAdjustment,
      totalAdjustmentInclGst: row.totalAdjustmentInclGst,
      items: [],
    }));
  const current = calculateRevisedContractValue({ baseline, revisions: accepted });
  const proposed = proposedRevisedContract({
    baseline,
    accepted,
    candidate: {
      id: viewing.id,
      status: viewing.status,
      isCurrent: true,
      totalSellAdjustmentExGst: viewing.totalSellAdjustmentExGst,
      gstAdjustment: viewing.gstAdjustment,
      totalAdjustmentInclGst: viewing.totalAdjustmentInclGst,
      items: viewing.items.map((item) => ({
        itemType: item.itemType,
        lineSellAdjustmentExGst: item.lineSellAdjustmentExGst,
      })),
    },
  });
  const model = buildVariationDocument({
    companyName: editor.companyName,
    clientName: editor.clientName,
    projectTitle: editor.projectTitle,
    siteAddress: editor.siteAddress,
    variationNumber: editor.variation.variationNumber,
    revisionNumber: viewing.revisionNumber,
    issuedAt: editor.history.find((row) => row.id === viewing.id)?.issuedAtIso ?? null,
    identity: editor.documentIdentities[viewing.id] ?? null,
    status: viewing.status,
    title: viewing.title,
    summary: viewing.summary,
    clientNotes: viewing.clientNotes,
    currency: viewing.currency,
    items: viewing.items.map((item) => ({
      itemType: item.itemType,
      clientDescription: item.clientDescription,
      lineSellAdjustmentExGst: item.lineSellAdjustmentExGst,
      substitutionGroupId: item.substitutionGroupId,
      sortOrder: item.sortOrder,
      quantity: item.quantity,
      unit: item.unit,
    })),
    totals: {
      totalSellAdjustmentExGst: viewing.totalSellAdjustmentExGst,
      gstAdjustment: viewing.gstAdjustment,
      totalAdjustmentInclGst: viewing.totalAdjustmentInclGst,
    },
    baseline,
    currentContract: current.ok
      ? {
          exGst: current.value.revisedContractValueExGst,
          inclGst: current.value.revisedContractValueInclGst,
        }
      : null,
    proposed,
    supportingFiles: editor.attachments
      .filter((file) => file.revisionId === viewing.id && file.visibility === "client" && file.uploadStatus === "ready")
      .map((file) => ({
        fileId: file.id,
        displayFilename: file.displayFilename,
        caption: file.caption,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        typeLabel: variationAttachmentTypeLabel(file.mimeType),
        sizeLabel: formatAttachmentSize(file.byteSize),
        kind: variationAttachmentKind(file.mimeType),
        viewUrl: null,
        downloadUrl: null,
      })),
  });

  return (
    <div className="min-h-svh bg-neutral-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
      <VariationPrintButton />
      <VariationDocument model={model} />
    </div>
  );
}
