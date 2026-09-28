"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VariationSupportingFile } from "@/lib/variations/presentation";

export function VariationSupportingGallery({ files }: { files: VariationSupportingFile[] }) {
  const [preview, setPreview] = useState<VariationSupportingFile | null>(null);
  if (files.length === 0) return null;
  return (
    <section className="mt-6 min-w-0" data-variation-supporting-public="true">
      <h2 className="text-base font-semibold">Supporting information</h2>
      <div className="mt-3 grid gap-3">
        {files.map((file) => (
          <article key={file.fileId} className="min-w-0 rounded-xl border border-neutral-200 p-3">
            {file.kind === "image" && file.viewUrl ? (
              <button
                type="button"
                className="block max-w-full rounded-lg focus-visible:ring-3 focus-visible:ring-neutral-400"
                onClick={() => setPreview(file)}
              >
                {/* Signed preview URLs are short-lived and are not a public image host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.viewUrl} alt={file.caption || file.displayFilename} className="max-h-40 max-w-full rounded-lg object-contain print:hidden" />
              </button>
            ) : null}
            <p className="mt-2 break-words text-sm font-medium">{file.displayFilename}</p>
            <p className="text-sm text-neutral-600">{file.typeLabel} · {file.sizeLabel}</p>
            {file.caption ? <p className="mt-1 break-words text-sm">{file.caption}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2 print:hidden">
              {file.viewUrl && (file.kind === "image" || file.mimeType === "application/pdf") ? (
                <Button type="button" size="touch" variant="outline" onClick={() => file.kind === "image" ? setPreview(file) : window.open(file.viewUrl ?? "", "_blank", "noopener,noreferrer")}>
                  View
                </Button>
              ) : null}
              {file.downloadUrl ? (
                <a className="inline-flex h-11 min-h-11 items-center rounded-2xl border px-4 text-sm font-medium focus-visible:ring-3 focus-visible:ring-neutral-400" href={file.downloadUrl}>
                  Download
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <Dialog open={preview != null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-h-[min(90vh,800px)] max-w-[min(100vw-1.5rem,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{preview?.displayFilename}</DialogTitle>
          </DialogHeader>
          {preview?.viewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.viewUrl} alt={preview.caption || preview.displayFilename} className="max-h-[60vh] max-w-full object-contain" />
          ) : null}
          {preview?.caption ? <p className="break-words text-sm">{preview.caption}</p> : null}
          <Button type="button" size="touch" variant="outline" autoFocus onClick={() => setPreview(null)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
