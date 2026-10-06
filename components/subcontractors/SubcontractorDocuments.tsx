"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadProjectDocumentToSignedUrl } from "@/lib/projects/document-direct-upload";
import {
  archiveSubcontractorDocument,
  downloadSubcontractorDocument,
  finalizeSubcontractorDocumentUpload,
  prepareSubcontractorDocumentUpload,
  removeSubcontractorDocument,
} from "@/lib/subcontractors/document-actions";
import type { SubcontractorDocument, SubcontractorDocumentKind } from "@/lib/subcontractors/types";
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS } from "@/lib/subcontractors/types";
import { sniffVariationAttachment } from "@/lib/variations/attachment-files";
import { VARIATION_ATTACHMENT_MAX_BYTES } from "@/lib/variations/attachment-files";

const fieldClass = "min-h-11";
const selectClass =
  "h-11 min-h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

type SubcontractorDocumentsProps = {
  subcontractorId: string;
  documents: SubcontractorDocument[];
  canEdit: boolean;
};

function expiryLabel(value: string | null): string {
  if (!value) return "No expiry";
  return `Expires ${value}`;
}

export function SubcontractorDocuments({
  subcontractorId,
  documents,
  canEdit,
}: SubcontractorDocumentsProps) {
  const router = useRouter();
  const [rows, setRows] = useState(documents);
  const [kind, setKind] = useState<SubcontractorDocumentKind>("licence");
  const [title, setTitle] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addDocument() {
    setError(null);
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size <= 0 || file.size > VARIATION_ATTACHMENT_MAX_BYTES) {
      setError(file.size > VARIATION_ATTACHMENT_MAX_BYTES ? "Each file must be 15 MB or smaller." : "Use a JPG, PNG, PDF, DOCX or XLSX file.");
      return;
    }
    const prefix = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const sniffed = sniffVariationAttachment(prefix, file.name);
    if (!sniffed) {
      setError("Use a JPG, PNG, PDF, DOCX or XLSX file.");
      return;
    }
    setPending(true);
    const prepared = await prepareSubcontractorDocumentUpload({
      subcontractorId,
      documentKind: kind,
      title,
      expiresOn,
      notes,
      filename: file.name,
      mimeType: sniffed.mime,
      byteSize: file.size,
    });
    if (prepared.error || !prepared.documentId || !prepared.signedUrl) {
      setPending(false);
      setError(prepared.error ?? "Could not store that document. Please try again.");
      return;
    }
    try {
      await uploadProjectDocumentToSignedUrl({
        signedUrl: prepared.signedUrl,
        file,
        upsert: false,
        onProgress: () => undefined,
        signal: new AbortController().signal,
      });
    } catch {
      setPending(false);
      setError("Could not store that document. Please try again.");
      return;
    }
    const finalized = await finalizeSubcontractorDocumentUpload({
      subcontractorId,
      documentId: prepared.documentId,
    });
    setPending(false);
    if (finalized.error || !finalized.ok) {
      setError(finalized.error ?? "Could not store that document. Please try again.");
      return;
    }
    setRows((current) => [
      ...current,
      {
        id: prepared.documentId!,
        document_kind: kind,
        title: title.trim(),
        reference: null,
        expires_on: expiresOn || null,
        notes: notes.trim() || null,
        original_filename: file.name,
        upload_status: "ready" as const,
      },
    ].sort((left, right) => left.title.localeCompare(right.title)));
    setTitle("");
    setExpiresOn("");
    setNotes("");
    setFile(null);
    router.refresh();
  }

  async function download(documentId: string) {
    setError(null);
    const result = await downloadSubcontractorDocument({ subcontractorId, documentId });
    if (result.error || !result.url) {
      setError(result.error ?? "That document could not be found.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function archive(documentId: string) {
    setError(null);
    const result = await archiveSubcontractorDocument({ subcontractorId, documentId });
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== documentId));
    router.refresh();
  }

  async function remove(documentId: string) {
    setError(null);
    const result = await removeSubcontractorDocument({ subcontractorId, documentId });
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== documentId));
    router.refresh();
  }

  return (
    <div className="space-y-4" data-subcontractor-documents>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((document) => (
            <li key={document.id} className="min-w-0 rounded-xl border border-border/70 px-3 py-3" data-subcontractor-document>
              <p className="break-words font-medium">{document.title}</p>
              <p className="break-words text-sm text-muted-foreground">
                {DOCUMENT_KIND_LABELS[document.document_kind]}
                {" · "}
                {expiryLabel(document.expires_on)}
              </p>
              {document.reference ? (
                <p className="break-words text-sm text-muted-foreground">Reference {document.reference}</p>
              ) : null}
              {document.notes ? <p className="mt-1 break-words text-sm">{document.notes}</p> : null}
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {document.upload_status === "ready" && document.original_filename
                  ? document.original_filename
                  : "No file stored"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {document.upload_status === "ready" ? (
                  <Button type="button" variant="outline" size="touch" onClick={() => void download(document.id)}>
                    Download
                  </Button>
                ) : null}
                {canEdit ? (
                  <>
                    <Button type="button" variant="outline" size="touch" onClick={() => void archive(document.id)}>
                      Archive
                    </Button>
                    <Button type="button" variant="outline" size="touch" onClick={() => void remove(document.id)}>
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border/80 p-3">
          <p className="text-sm font-medium">Add document</p>
          <p className="text-sm text-muted-foreground">
            JPG, PNG, PDF, DOCX, or XLSX up to 15 MB. The file stays private to this organisation and is not sent with a request for quote.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="subcontractor-document-kind">Type</Label>
              <select
                id="subcontractor-document-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as SubcontractorDocumentKind)}
                className={selectClass}
              >
                {DOCUMENT_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {DOCUMENT_KIND_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subcontractor-document-title">Title</Label>
              <Input
                id="subcontractor-document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={fieldClass}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subcontractor-document-expiry">Expiry (optional)</Label>
              <Input
                id="subcontractor-document-expiry"
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                className={fieldClass}
                data-document-expiry
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subcontractor-document-file">File</Label>
              <Input
                id="subcontractor-document-file"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,image/jpeg,image/png,application/pdf"
                className={fieldClass}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subcontractor-document-notes">Notes (optional)</Label>
            <Textarea
              id="subcontractor-document-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20"
              maxLength={2000}
            />
          </div>
          <Button type="button" size="touch" disabled={pending || !title.trim()} onClick={() => void addDocument()}>
            {pending ? "Uploading…" : "Add document"}
          </Button>
        </div>
      ) : null}
      {!canEdit && error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
