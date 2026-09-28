import { createRoot } from "react-dom/client";
import { useState } from "react";
import { VariationSupportingFiles } from "@/components/variations/VariationSupportingFiles";
import type { VariationAttachmentView } from "@/lib/variations/workspace-types";

const ITEM_TEXT = "Landing addition priced item";

function UploadLayoutHarness() {
  const [instance] = useState("variation-editor-mount");
  const [title, setTitle] = useState("Draft variation title");
  const [attachments, setAttachments] = useState<VariationAttachmentView[]>([]);
  return (
    <div id="shell" className="flex min-h-dvh w-full md:h-dvh md:overflow-hidden">
      <aside id="sidebar" className="hidden h-dvh w-[232px] shrink-0 flex-col overflow-hidden md:flex">
        Sidebar
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:overflow-hidden">
        <div id="page" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div id="scroll" className="min-h-0 flex-1 overflow-auto overflow-x-hidden">
            <div
              id="editor"
              data-variation-editor="true"
              data-editor-instance={instance}
              className="min-w-0 space-y-6 overflow-x-hidden"
            >
              <section id="details" className="rounded-2xl border p-4">
                <h2>Variation details</h2>
                <input id="title" aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </section>
              <section id="scope" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2>Scope and pricing</h2>
                  <button type="button">Add item</button>
                </div>
                <article id="item" className="rounded-2xl border bg-card p-4 text-sm">{ITEM_TEXT}</article>
              </section>
              <VariationSupportingFiles
                projectId="project"
                variationId="variation"
                revisionId="revision"
                editable
                items={[{ id: "item-1", clientDescription: ITEM_TEXT }]}
                attachments={attachments}
                onChange={setAttachments}
              />
              <section id="summary" data-variation-commercial-summary="true" className="rounded-2xl border bg-card p-4">
                <h2>Commercial summary</h2>
              </section>
              <section id="history" className="rounded-2xl border bg-card p-4">Revision history</section>
              <section id="issue" className="rounded-2xl border bg-card p-4">Issue revision</section>
              <section id="document" className="rounded-2xl border bg-card p-4">Client document</section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing layout root");
createRoot(root).render(<UploadLayoutHarness />);
