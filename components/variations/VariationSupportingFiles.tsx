"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadVariationFileToSignedUrl } from "@/lib/variations/attachment-direct-upload";
import {
  formatAttachmentSize,
  variationAttachmentKind,
  variationAttachmentSelectionError,
  variationAttachmentTypeLabel,
} from "@/lib/variations/attachment-files";
import {
  failVariationAttachmentUpload,
  finalizeVariationAttachment,
  prepareVariationAttachmentUpload,
  removeVariationAttachment,
  reorderVariationAttachments,
  signVariationAttachment,
  updateVariationAttachment,
} from "@/lib/variations/attachment-actions";
import type { VariationAttachmentView } from "@/lib/variations/workspace-types";

type ItemOption = { id: string; clientDescription: string };

type Props = {
  projectId: string;
  variationId: string;
  revisionId: string;
  editable: boolean;
  items: ItemOption[];
  attachments: VariationAttachmentView[];
  onChange: (update: (current: VariationAttachmentView[]) => VariationAttachmentView[]) => void;
};

type Transfer = { progress: number | null; previewUrl: string | null; error: string | null };

const ACCEPT = ".jpg,.jpeg,.png,.pdf,.docx,.xlsx,image/jpeg,image/png,application/pdf";

export function VariationSupportingFiles(props: Props) {
  const files = props.attachments
    .filter((file) => file.revisionId === props.revisionId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4" data-variation-supporting="true">
      <h2 className="text-base font-semibold">Supporting information</h2>
      <div className="mt-4 grid gap-6">
        <FileGroup {...props} visibility="client" title="Client attachments" description="Visible to the client and included with this Variation." files={files.filter((file) => file.visibility === "client")} addLabel="Add photos or files" />
        <FileGroup {...props} visibility="internal" title="Internal files" description="Only your organisation can see these files." files={files.filter((file) => file.visibility === "internal")} addLabel="Add internal files" />
      </div>
    </section>
  );
}

function FileGroup(props: Props & {
  visibility: "client" | "internal";
  title: string;
  description: string;
  files: VariationAttachmentView[];
  addLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url: string; caption: string | null } | null>(null);
  const [transfers, setTransfers] = useState<Record<string, Transfer>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const cancelled = useRef(new Set<string>());
  const previews = useRef(new Map<string, string>());
  const active = props.files.filter((file) => file.uploadStatus === "ready");

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function replace(localId: string, next: VariationAttachmentView | null): void {
    props.onChange((current) => {
      const rest = current.filter((row) => row.id !== localId);
      return next ? rest.concat(next) : rest;
    });
  }

  function rememberPreview(id: string, url: string | null): void {
    const previous = previews.current.get(id);
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    if (url) previews.current.set(id, url);
    else previews.current.delete(id);
  }

  function setTransfer(id: string, next: Transfer | null): void {
    setTransfers((current) => {
      const copy = { ...current };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }

  async function uploadOne(file: File, retry?: VariationAttachmentView): Promise<void> {
    const localId = retry?.id ?? `local-${crypto.randomUUID()}`;
    cancelled.current.delete(localId);
    const previewUrl = /\.(jpe?g|png)$/i.test(file.name) ? URL.createObjectURL(file) : null;
    rememberPreview(localId, previewUrl);
    const pending: VariationAttachmentView = {
      id: localId,
      revisionId: props.revisionId,
      visibility: props.visibility,
      displayFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
      caption: retry?.caption ?? null,
      internalDescription: retry?.internalDescription ?? null,
      linkedVariationItemId: retry?.linkedVariationItemId ?? null,
      sortOrder: retry?.sortOrder ?? props.files.length,
      uploadStatus: "pending",
      objectConfirmed: false,
      createdAt: retry?.createdAt ?? new Date().toISOString(),
      frozen: false,
    };
    replace(retry?.id ?? localId, pending);
    setTransfer(localId, { progress: null, previewUrl, error: null });
    const controller = new AbortController();
    controllers.current.set(localId, controller);

    const prefix = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const rejection = variationAttachmentSelectionError(file.name, file.size, prefix);
    if (rejection || cancelled.current.has(localId)) {
      if (!cancelled.current.has(localId)) {
        replace(localId, { ...pending, uploadStatus: "failed", objectConfirmed: false });
        setTransfer(localId, { progress: null, previewUrl, error: rejection });
      }
      return;
    }

    const prepared = await prepareVariationAttachmentUpload({
      projectId: props.projectId,
      variationId: props.variationId,
      revisionId: props.revisionId,
      visibility: props.visibility,
      originalFilename: file.name,
      byteSize: file.size,
      headerBase64: btoa(String.fromCharCode(...prefix)),
      retryAttachmentId: retry && !retry.id.startsWith("local-") ? retry.id : null,
    });
    if (cancelled.current.has(localId)) {
      if (prepared.ok) {
        await removeVariationAttachment({
          projectId: props.projectId,
          variationId: props.variationId,
          attachmentId: prepared.attachmentId,
        });
      }
      return;
    }
    if (!prepared.ok) {
      const failedId = prepared.attachmentId ?? localId;
      rememberPreview(failedId, previewUrl);
      replace(localId, { ...pending, id: failedId, uploadStatus: "failed", objectConfirmed: false });
      setTransfer(localId, null);
      setTransfer(failedId, { progress: null, previewUrl, error: prepared.error });
      return;
    }

    const serverId = prepared.attachmentId;
    rememberPreview(serverId, previewUrl);
    const serverPending: VariationAttachmentView = {
      ...pending,
      id: serverId,
      displayFilename: prepared.displayFilename,
      mimeType: prepared.mimeType,
      uploadStatus: "pending",
      objectConfirmed: false,
    };
    replace(localId, serverPending);
    setTransfer(localId, null);
    controllers.current.delete(localId);
    controllers.current.set(serverId, controller);
    if (cancelled.current.has(localId)) cancelled.current.add(serverId);
    setTransfer(serverId, { progress: null, previewUrl, error: null });

    try {
      await uploadVariationFileToSignedUrl({
        signedUrl: prepared.signedUrl,
        file,
        upsert: Boolean(retry && !retry.id.startsWith("local-")),
        signal: controller.signal,
        onProgress: (progress) => setTransfer(serverId, { progress, previewUrl, error: null }),
      });
    } catch (uploadError) {
      if (cancelled.current.has(serverId) || cancelled.current.has(localId)) return;
      await failVariationAttachmentUpload({
        projectId: props.projectId,
        variationId: props.variationId,
        attachmentId: serverId,
      });
      replace(serverId, { ...serverPending, uploadStatus: "failed", objectConfirmed: false });
      setTransfer(serverId, {
        progress: null,
        previewUrl,
        error: uploadError instanceof Error && uploadError.message === "ABORTED" ? null : "That file did not finish uploading. Remove it and try again.",
      });
      return;
    }

    if (cancelled.current.has(serverId)) return;
    const finalized = await finalizeVariationAttachment({
      projectId: props.projectId,
      variationId: props.variationId,
      attachmentId: serverId,
    });
    if (cancelled.current.has(serverId)) return;
    if (!finalized.ok) {
      replace(serverId, { ...serverPending, uploadStatus: "failed", objectConfirmed: false });
      setTransfer(serverId, { progress: null, previewUrl, error: finalized.error });
      return;
    }
    replace(serverId, finalized.attachment);
    setTransfer(serverId, null);
    rememberPreview(serverId, null);
  }

  function addFiles(list: FileList | File[], retry?: VariationAttachmentView): void {
    setError(null);
    for (const file of [...list]) void uploadOne(file, retry);
  }

  async function cancel(file: VariationAttachmentView): Promise<void> {
    cancelled.current.add(file.id);
    controllers.current.get(file.id)?.abort();
    rememberPreview(file.id, null);
    setTransfer(file.id, null);
    if (file.id.startsWith("local-")) {
      replace(file.id, null);
      return;
    }
    const result = await removeVariationAttachment({
      projectId: props.projectId,
      variationId: props.variationId,
      attachmentId: file.id,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    replace(file.id, null);
  }

  async function openFile(file: VariationAttachmentView, mode: "view" | "download"): Promise<void> {
    const signed = await signVariationAttachment({
      projectId: props.projectId,
      variationId: props.variationId,
      attachmentId: file.id,
    });
    if (!signed.ok) {
      setError(signed.error);
      return;
    }
    if (mode === "view" && variationAttachmentKind(file.mimeType) === "image") {
      setPreview({ name: file.displayFilename, url: signed.url, caption: file.caption });
      return;
    }
    window.open(signed.url, "_blank", "noopener,noreferrer");
  }

  async function move(file: VariationAttachmentView, direction: -1 | 1): Promise<void> {
    const ids = active.map((row) => row.id);
    const index = ids.indexOf(file.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const [picked] = ids.splice(index, 1);
    ids.splice(target, 0, picked);
    const result = await reorderVariationAttachments({
      projectId: props.projectId,
      variationId: props.variationId,
      revisionId: props.revisionId,
      visibility: props.visibility,
      ids,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    props.onChange((current) => current.map((row) => {
      const position = ids.indexOf(row.id);
      return position >= 0 ? { ...row, sortOrder: position } : row;
    }));
  }

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      {props.visibility === "internal" ? <p className="mt-1 text-sm font-medium">Internal</p> : null}
      {props.editable ? (
        <label
          className={`mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed px-3 py-3 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 ${dragging ? "bg-muted" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
          }}
        >
          {props.addLabel}
          <input className="sr-only" type="file" accept={ACCEPT} multiple aria-label={props.addLabel} onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) addFiles(event.target.files);
            event.target.value = "";
          }} />
        </label>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
      <div className="mt-3 grid gap-3">
        {props.files.map((file, index) => (
          <FileCard
            key={file.id}
            file={file}
            transfer={transfers[file.id] ?? null}
            editable={props.editable}
            items={props.items}
            projectId={props.projectId}
            variationId={props.variationId}
            canMoveUp={index > 0 && file.uploadStatus === "ready"}
            canMoveDown={index < props.files.length - 1 && file.uploadStatus === "ready"}
            onMove={(direction) => void move(file, direction)}
            onRetry={(picked) => addFiles([picked], file)}
            onOpen={(mode) => void openFile(file, mode)}
            onCancel={() => void cancel(file)}
            onRemove={async () => {
              rememberPreview(file.id, null);
              setTransfer(file.id, null);
              if (file.id.startsWith("local-")) {
                replace(file.id, null);
                return;
              }
              const result = await removeVariationAttachment({
                projectId: props.projectId,
                variationId: props.variationId,
                attachmentId: file.id,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              replace(file.id, null);
            }}
            onSave={async (patch) => {
              const result = await updateVariationAttachment({
                projectId: props.projectId,
                variationId: props.variationId,
                attachmentId: file.id,
                displayFilename: patch.displayFilename,
                caption: patch.caption,
                internalDescription: patch.internalDescription,
                linkedVariationItemId: patch.linkedVariationItemId,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              props.onChange((current) => current.map((row) => row.id === file.id ? {
                ...row,
                displayFilename: result.displayFilename,
                caption: file.visibility === "client" ? patch.caption || null : null,
                internalDescription: file.visibility === "internal" ? patch.internalDescription || null : null,
                linkedVariationItemId: patch.linkedVariationItemId,
              } : row));
            }}
          />
        ))}
      </div>
      <Dialog open={preview != null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-h-[min(90vh,800px)] max-w-[min(100vw-1.5rem,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.caption || preview.name} className="max-h-[60vh] max-w-full object-contain" />
          ) : null}
          {preview?.caption ? <p className="break-words text-sm">{preview.caption}</p> : null}
          <Button type="button" size="touch" variant="outline" autoFocus onClick={() => setPreview(null)}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileCard(props: {
  file: VariationAttachmentView;
  transfer: Transfer | null;
  editable: boolean;
  items: ItemOption[];
  projectId: string;
  variationId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onRetry: (file: File) => void;
  onOpen: (mode: "view" | "download") => void;
  onCancel: () => void;
  onRemove: () => Promise<void>;
  onSave: (patch: { displayFilename: string; caption: string; internalDescription: string; linkedVariationItemId: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState(props.file.displayFilename);
  const [caption, setCaption] = useState(props.file.caption ?? "");
  const [note, setNote] = useState(props.file.internalDescription ?? "");
  const [link, setLink] = useState(props.file.linkedVariationItemId ?? "");
  const uploading = props.file.uploadStatus === "pending" && props.transfer != null;
  const failed = props.file.uploadStatus === "failed" || (props.file.uploadStatus === "pending" && props.transfer == null);
  const status = uploading ? "Uploading…" : failed ? "Upload failed" : "Ready";
  const kind = variationAttachmentKind(props.file.mimeType);
  const patch = { displayFilename: name, caption, internalDescription: note, linkedVariationItemId: link || null };
  const progress = props.transfer?.progress ?? null;
  return (
    <article className="min-h-24 min-w-0 rounded-xl border p-3" data-upload-status={uploading ? "pending" : failed ? "failed" : "ready"}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
        {props.transfer?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.transfer.previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border object-cover" />
        ) : kind === "image" && props.file.uploadStatus === "ready" ? (
          <Thumbnail projectId={props.projectId} variationId={props.variationId} attachmentId={props.file.id} alt={props.file.displayFilename} onOpen={() => props.onOpen("view")} />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-xs">{variationAttachmentTypeLabel(props.file.mimeType)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">{props.file.displayFilename}</p>
          <p className="text-sm text-muted-foreground">{variationAttachmentTypeLabel(props.file.mimeType)} · {formatAttachmentSize(props.file.byteSize)}</p>
          <p className="text-sm" aria-live="polite">
            {uploading ? <Loader2 className="mr-1 inline size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {status}{uploading && progress != null ? ` ${progress}%` : ""}
          </p>
          {uploading ? (
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ?? undefined}
              aria-label="Upload progress"
            >
              <div
                className={`h-full bg-foreground/70 ${progress == null ? "w-1/3 motion-safe:animate-pulse" : ""}`}
                style={progress == null ? undefined : { width: `${progress}%` }}
              />
            </div>
          ) : null}
          {props.file.visibility === "internal" ? <p className="text-sm font-medium">Internal</p> : null}
          {failed ? <p role="alert" className="text-sm">Upload failed. {props.transfer?.error ?? "This file did not finish uploading. Retry this file or remove it."}</p> : null}
          {props.editable && props.file.uploadStatus === "ready" ? (
            <div className="mt-2 grid gap-2">
              <Label htmlFor={`name-${props.file.id}`}>Display name</Label>
              <Input id={`name-${props.file.id}`} className="h-11" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void props.onSave({ ...patch, displayFilename: name })} />
              {props.file.visibility === "client" ? (
                <>
                  <Label htmlFor={`caption-${props.file.id}`}>Caption</Label>
                  <Input id={`caption-${props.file.id}`} className="h-11" value={caption} onChange={(event) => setCaption(event.target.value)} onBlur={() => void props.onSave({ ...patch, caption })} />
                  <Label htmlFor={`link-${props.file.id}`}>Linked Variation item</Label>
                  <select id={`link-${props.file.id}`} className="h-11 min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={link} onChange={(event) => { setLink(event.target.value); void props.onSave({ ...patch, linkedVariationItemId: event.target.value || null }); }}>
                    <option value="">No linked item</option>
                    {props.items.map((item) => <option key={item.id} value={item.id}>{item.clientDescription}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <Label htmlFor={`note-${props.file.id}`}>Internal description</Label>
                  <Input id={`note-${props.file.id}`} className="h-11" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void props.onSave({ ...patch, internalDescription: note, linkedVariationItemId: null })} />
                </>
              )}
            </div>
          ) : props.file.caption ? <p className="mt-1 break-words text-sm">{props.file.caption}</p> : props.file.internalDescription ? <p className="mt-1 break-words text-sm">{props.file.internalDescription}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {props.file.uploadStatus === "ready" && (kind === "image" || props.file.mimeType === "application/pdf") ? (
              <Button type="button" size="touch" variant="outline" onClick={() => props.onOpen("view")}>View</Button>
            ) : null}
            {props.file.uploadStatus === "ready" ? (
              <Button type="button" size="touch" variant="outline" onClick={() => props.onOpen("download")}>Download</Button>
            ) : null}
            {props.editable && uploading ? (
              <Button type="button" size="touch" variant="outline" onClick={props.onCancel}>Cancel</Button>
            ) : null}
            {props.editable && !uploading ? (
              <>
                {props.file.uploadStatus === "ready" ? (
                  <>
                    <Button type="button" size="touch" variant="outline" disabled={!props.canMoveUp} onClick={() => props.onMove(-1)}>Move up</Button>
                    <Button type="button" size="touch" variant="outline" disabled={!props.canMoveDown} onClick={() => props.onMove(1)}>Move down</Button>
                  </>
                ) : null}
                {failed ? (
                  <label className="inline-flex h-11 min-h-11 cursor-pointer items-center rounded-2xl border px-4 text-sm has-[:focus-visible]:ring-3">
                    Retry
                    <input className="sr-only" type="file" accept={ACCEPT} aria-label={`Retry ${props.file.displayFilename}`} onChange={(event) => { const picked = event.target.files?.[0]; if (picked) props.onRetry(picked); event.target.value = ""; }} />
                  </label>
                ) : null}
                <Button type="button" size="touch" variant="destructive" onClick={() => void props.onRemove()}>Remove</Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function Thumbnail(props: { projectId: string; variationId: string; attachmentId: string; alt: string; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void signVariationAttachment({
      projectId: props.projectId,
      variationId: props.variationId,
      attachmentId: props.attachmentId,
    }).then((result) => {
      if (!cancelled && result.ok) setUrl(result.url);
    });
    return () => { cancelled = true; };
  }, [props.attachmentId, props.projectId, props.variationId]);
  return (
    <button type="button" className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border focus-visible:ring-3" onClick={props.onOpen} aria-label={`Preview ${props.alt}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={props.alt} className="h-full w-full object-cover" />
      ) : <span className="text-xs">Image</span>}
    </button>
  );
}
