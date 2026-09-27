"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDraftVariation } from "@/lib/variations/actions";
import {
  formatContractMoney,
  formatSignedAdjustment,
  VARIATION_EMPTY_LIST,
} from "@/lib/variations/presentation";
import type { VariationListRow, VariationListSummary } from "@/lib/variations/workspace-types";
import Link from "next/link";

export function VariationList(props: {
  projectId: string;
  eligible: boolean;
  reason: string | null;
  rows: VariationListRow[];
  summary: VariationListSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currency = props.summary?.currency ?? "NZD";

  return (
    <div data-variation-list="true" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Variations</h1>
          <p className="text-sm text-muted-foreground">Changes to the agreed scope and price.</p>
        </div>
      </div>

      {!props.eligible ? (
        <p className="rounded-2xl border bg-card px-4 py-3 text-sm" data-variation-unavailable="true">
          {props.reason}
        </p>
      ) : null}

      {props.summary ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-variation-summary="true">
          <SummaryCard label="Original accepted contract" value={formatContractMoney(props.summary.originalAcceptedInclGst, currency)} />
          <SummaryCard label="Accepted Variation adjustments" value={formatSignedAdjustment(props.summary.acceptedAdjustmentExGst, currency)} />
          <SummaryCard label="Revised accepted contract" value={formatContractMoney(props.summary.revisedAcceptedInclGst, currency)} />
          <SummaryCard label="Issued or pending Variations" value={formatSignedAdjustment(props.summary.pendingIssuedExGst, currency)} />
          <SummaryCard label="Draft Variations" value={String(props.summary.draftCount)} />
        </section>
      ) : null}

      {props.eligible && props.rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-3 text-sm">{VARIATION_EMPTY_LIST}</p>
      ) : null}

      {props.rows.length > 0 ? (
        <ul className="space-y-3">
          {props.rows.map((row) => (
            <li key={row.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">Variation {row.variationNumber}</p>
                  <p>{row.title}</p>
                  <p className="text-muted-foreground">
                    Revision {row.revisionNumber ?? "—"} · {row.statusLabel}
                    {row.outcomeLabel ? ` · ${row.outcomeLabel}` : ""}
                  </p>
                </div>
                <Link className="underline" href={`/app/projects/${props.projectId}/variations/${row.id}`}>
                  Open
                </Link>
              </div>
              <dl className="mt-3 grid gap-1">
                <div className="flex justify-between gap-3"><dt>Net adjustment ex GST</dt><dd>{row.netExGst == null ? "—" : formatSignedAdjustment(row.netExGst, currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt>GST</dt><dd>{row.gst == null ? "—" : formatSignedAdjustment(row.gst, currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Adjustment incl GST</dt><dd>{row.inclGst == null ? "—" : formatSignedAdjustment(row.inclGst, currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Created</dt><dd>{row.createdAt}</dd></div>
                {row.issuedAt ? <div className="flex justify-between gap-3"><dt>Issued</dt><dd>{row.issuedAt}</dd></div> : null}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}

      {props.eligible ? (
        <form
          data-variation-create="true"
          className="rounded-2xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              const created = await createDraftVariation({
                projectId: props.projectId,
                title,
                summary: summary || null,
                idempotencyKey: crypto.randomUUID(),
              });
              if (!created.ok || !created.variationId) {
                setError(created.ok ? "That variation could not be created." : created.error);
                return;
              }
              router.push(`/app/projects/${props.projectId}/variations/${created.variationId}`);
              router.refresh();
            });
          }}
        >
          <h2 className="text-base font-semibold">Create Variation</h2>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="new-variation-title">Title</Label>
              <Input id="new-variation-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-variation-summary">Client-facing summary</Label>
              <textarea
                id="new-variation-summary"
                className="min-h-20 rounded-xl border bg-background px-3 py-2 text-sm"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            {error ? <p role="alert" className="text-sm">{error}</p> : null}
            <Button type="submit" disabled={pending}>Create Variation</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function SummaryCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{props.value}</p>
    </div>
  );
}
