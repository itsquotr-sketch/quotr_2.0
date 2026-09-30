import type { SupabaseClient } from "@supabase/supabase-js";
import { indexVariationAttachments, type VariationAttachmentRevisionGroup } from "@/lib/variations/attachment-index";
import type { VariationAttachmentVisibility } from "@/lib/variations/attachment-files";
import {
  projectDocumentCentreFromRows,
  type ProjectDocumentCentreModel,
} from "@/lib/projects/document-model";

export type { ProjectDocumentCentreModel };

const DOCUMENT_COLUMNS = "id, title, category, archived_at, created_at";
const VERSION_COLUMNS =
  "id, document_id, version_number, display_filename, mime_type, byte_size, visibility, version_note, upload_status, object_confirmed, created_by, created_at";
const ATTACHMENT_COLUMNS =
  "id, variation_id, variation_revision_id, visibility, mime_type, byte_size, display_filename, created_at, frozen_at, upload_status";

/**
 * Authorised Project Information read.
 * Estimate, Pricing, Quote and Variation pages must not call this.
 * Signed URLs are minted later, when someone chooses View or Download.
 */
export async function readProjectDocumentCentre(
  supabase: SupabaseClient,
  projectId: string,
  orgId: string
): Promise<ProjectDocumentCentreModel> {
  const [documents, versions, profiles, attachments, variations, revisions] = await Promise.all([
    supabase.from("project_documents").select(DOCUMENT_COLUMNS).eq("project_id", projectId),
    supabase.from("project_document_versions").select(VERSION_COLUMNS).eq("project_id", projectId),
    supabase.from("profiles").select("id, full_name").eq("org_id", orgId),
    supabase.from("variation_attachments").select(ATTACHMENT_COLUMNS).eq("project_id", projectId),
    supabase.from("variations").select("id, variation_number").eq("project_id", projectId),
    supabase.from("variation_revisions").select("id, revision_number, status").eq("project_id", projectId),
  ]);

  const names = new Map<string, string>();
  if (!profiles.error) {
    for (const row of (profiles.data ?? []) as Array<{ id?: string; full_name?: string | null }>) {
      if (row.id && row.full_name) names.set(row.id, row.full_name);
    }
  }

  const variationGroups = variationIndex(attachments.data, variations.data, revisions.data);

  return {
    documents: documents.error
      ? []
      : projectDocumentCentreFromRows({
          documents: (documents.data ?? []) as Array<Record<string, unknown>>,
          versions: (versions.data ?? []) as Array<Record<string, unknown>>,
          uploaderNames: names,
        }),
    documentsUnavailable: Boolean(documents.error || versions.error),
    variationGroups: attachments.error || variations.error || revisions.error ? [] : variationGroups,
    variationUnavailable: Boolean(attachments.error || variations.error || revisions.error),
  };
}

function variationIndex(
  attachmentData: unknown,
  variationData: unknown,
  revisionData: unknown
): VariationAttachmentRevisionGroup[] {
  const variationNumbers = new Map<string, number>();
  for (const row of (variationData ?? []) as Array<{ id?: string; variation_number?: number | string }>) {
    const number = typeof row.variation_number === "number" ? row.variation_number : Number(row.variation_number);
    if (row.id && Number.isFinite(number)) variationNumbers.set(row.id, number);
  }
  const revisionMeta = new Map<string, { revisionNumber: number; status: string }>();
  for (const row of (revisionData ?? []) as Array<{ id?: string; revision_number?: number | string; status?: string }>) {
    const number = typeof row.revision_number === "number" ? row.revision_number : Number(row.revision_number);
    if (row.id && Number.isFinite(number)) {
      revisionMeta.set(row.id, { revisionNumber: number, status: row.status || "draft" });
    }
  }
  const sources = ((attachmentData ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    if (row.upload_status !== "ready") return [];
    const variationId = typeof row.variation_id === "string" ? row.variation_id : "";
    const revisionId = typeof row.variation_revision_id === "string" ? row.variation_revision_id : "";
    const variationNumber = variationNumbers.get(variationId);
    const revision = revisionMeta.get(revisionId);
    const visibility = row.visibility === "client" || row.visibility === "internal" ? row.visibility : null;
    const byteSize = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
    if (!variationId || variationNumber == null || !revision || !visibility || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      variationId,
      variationNumber,
      revisionNumber: revision.revisionNumber,
      revisionStatus: revision.status,
      visibility: visibility as VariationAttachmentVisibility,
      mimeType: typeof row.mime_type === "string" ? row.mime_type : "",
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      frozen: row.frozen_at != null,
      displayFilename: typeof row.display_filename === "string" ? row.display_filename : "File",
      byteSize: Number.isFinite(byteSize) ? byteSize : undefined,
    }];
  });
  return indexVariationAttachments(sources);
}
