"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleCoverageDecision } from "@/lib/rfqs/schedule-pricing";
import { resolveScheduleGap } from "@/lib/rfqs/schedule-pricing";
import type { ScheduleScopeReview } from "@/lib/rfqs/schedule-scope-gaps";

export function ScheduleScopeGaps({
  review,
  pricingDocumentId,
  canEdit,
  coveringItems,
}: {
  review: ScheduleScopeReview;
  pricingDocumentId: string;
  canEdit: boolean;
  coveringItems: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (review.unresolved.length === 0 && review.outside.length === 0 && !review.blocking) return null;
  return (
    <section className="grid gap-3 rounded-xl border border-border/60 bg-card px-4 py-3" data-schedule-scope-gaps>
      <h2 className="text-base font-semibold">Supplier scope still open</h2>
      {review.blocking ? <p className="text-sm">{review.blocking}</p> : null}
      {review.outside.length > 0 ? (
        <p className="break-words text-sm">Outside this application: {review.outside.map((item) => item.scope).join(", ")}.</p>
      ) : null}
      {review.unresolved.map((item) => (
        <GapForm
          key={item.scheduleItemId}
          scope={item.scope}
          reason={item.reason}
          coveringItems={coveringItems}
          canEdit={canEdit}
          pending={pending}
          onResolve={(coverage) => {
            setError(null);
            startTransition(async () => {
              const result = await resolveScheduleGap({
                pricingDocumentId,
                responseId: item.responseId,
                scheduleItemId: item.scheduleItemId,
                coverage,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        />
      ))}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  );
}

function GapForm({
  scope,
  reason,
  coveringItems,
  canEdit,
  pending,
  onResolve,
}: {
  scope: string;
  reason: string;
  coveringItems: Array<{ id: string; label: string }>;
  canEdit: boolean;
  pending: boolean;
  onResolve: (coverage: { decision: ScheduleCoverageDecision; itemId: string | null; wording: string; note: string }) => void;
}) {
  const [decision, setDecision] = useState<ScheduleCoverageDecision | "">("");
  const [wording, setWording] = useState("");
  const [note, setNote] = useState("");
  const [itemId, setItemId] = useState("");
  return (
    <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
      <p className="break-words font-medium">{scope}</p>
      <p className="break-words">{reason} This does not add a zero-price line.</p>
      {canEdit ? (
        <>
          <label className="flex min-h-11 items-start gap-2">
            <input type="radio" className="mt-1" checked={decision === "covered_by_item"} onChange={() => setDecision("covered_by_item")} />
            <span>Another Pricing item already covers it</span>
          </label>
          {decision === "covered_by_item" ? (
            <label className="grid gap-1">
              Covering Pricing item
              <select className="h-11 min-h-11 rounded-md border border-border bg-background px-3" value={itemId} onChange={(event) => setItemId(event.target.value)}>
                <option value="">Choose an item</option>
                {coveringItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="flex min-h-11 items-start gap-2">
            <input type="radio" className="mt-1" checked={decision === "client_exclusion"} onChange={() => setDecision("client_exclusion")} />
            <span>Exclude it from the client quote</span>
          </label>
          <label className="flex min-h-11 items-start gap-2">
            <input type="radio" className="mt-1" checked={decision === "builder_responsibility"} onChange={() => setDecision("builder_responsibility")} />
            <span>The builder will cover it, privately</span>
          </label>
          {decision === "client_exclusion" ? (
            <textarea className="min-h-20 rounded-md border border-border bg-background px-3 py-2" value={wording} onChange={(event) => setWording(event.target.value)} aria-label={`Client wording for ${scope}`} />
          ) : null}
          {decision === "builder_responsibility" ? (
            <textarea className="min-h-20 rounded-md border border-border bg-background px-3 py-2" value={note} onChange={(event) => setNote(event.target.value)} aria-label={`Internal note for ${scope}`} />
          ) : null}
          <button
            type="button"
            className="h-11 min-h-11 w-fit rounded-md border border-border px-3"
            disabled={pending || !decision}
            onClick={() => decision && onResolve({ decision, itemId: itemId || null, wording, note })}
          >
            Save scope decision
          </button>
        </>
      ) : (
        <p>You can read this gap. A builder resolves it.</p>
      )}
    </div>
  );
}
