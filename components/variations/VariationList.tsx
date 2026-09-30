"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDraftVariation, createVariationRevision, deleteUnissuedDraftVariation } from "@/lib/variations/actions";
import {
  formatContractMoney,
  formatSignedAdjustment,
  VARIATION_EMPTY_LIST,
  VARIATION_PRICING_REQUIRED_LABEL,
} from "@/lib/variations/presentation";
import type { VariationListRow, VariationListSummary } from "@/lib/variations/workspace-types";

export function VariationList(props: {
  projectId: string;
  acceptedQuoteHref?: string | null;
  eligible: boolean;
  reason: string | null;
  rows: VariationListRow[];
  summary: VariationListSummary | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(props.notice ?? null);
  const [deleteTarget, setDeleteTarget] = useState<VariationListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const createKey = useRef("");
  const createLock = useRef(false);
  const currency = props.summary?.currency ?? "NZD";

  function openCreate(): void {
    createKey.current = crypto.randomUUID();
    setError(null);
    setCreateOpen(true);
  }

  function closeCreate(): void {
    if (createLock.current) return;
    setCreateOpen(false);
  }

  async function submitCreate(): Promise<void> {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setError(null);
    const created = await createDraftVariation({
      projectId: props.projectId,
      title,
      summary: summary || null,
      idempotencyKey: createKey.current,
    });
    if (!created.ok || !created.variationId) {
      createLock.current = false;
      setCreating(false);
      setError(created.ok ? "That variation could not be created." : created.error);
      return;
    }
    router.push(`/app/projects/${props.projectId}/variations/${created.variationId}`);
  }

  async function confirmListDelete(): Promise<void> {
    if (!deleteTarget?.currentRevisionId || deleting) return;
    setDeleting(true);
    setError(null);
    const result = await deleteUnissuedDraftVariation({
      projectId: props.projectId,
      variationId: deleteTarget.id,
      revisionId: deleteTarget.currentRevisionId,
    });
    if (!result.ok) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    setDeleting(false);
    setDeleteTarget(null);
    setNotice("Draft Variation deleted.");
    router.refresh();
  }

  const summaryRows = props.summary
    ? [
        ["Original accepted contract", formatContractMoney(props.summary.originalAcceptedInclGst, currency)],
        ["Accepted Variation adjustments, ex GST", formatSignedAdjustment(props.summary.acceptedAdjustmentExGst, currency)],
        ["Revised accepted contract", formatContractMoney(props.summary.revisedAcceptedInclGst, currency)],
        ["Issued or pending Variations — ex GST", formatSignedAdjustment(props.summary.pendingIssuedExGst, currency)],
        ["Draft Variations", String(props.summary.draftCount)],
      ]
    : [];

  return (
    <div data-variation-list="true" className="min-w-0">
      <div className="flex min-w-0 flex-col gap-5">
      <div className="order-1 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Variations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Changes to the agreed scope and price.</p>
        </div>
        {props.eligible ? (
          <Button type="button" size="touch" className="hidden lg:inline-flex" onClick={openCreate}>
            Create Variation
          </Button>
        ) : null}
      </div>

      {props.eligible ? (
        <Button type="button" size="touch" className="order-2 w-full sm:w-auto lg:hidden" onClick={openCreate}>
          Create Variation
        </Button>
      ) : null}

      {!props.eligible ? (
        <p className="order-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-none" data-variation-unavailable="true">
          {props.reason}
        </p>
      ) : null}

      {notice ? <p role="status" className="order-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm">{notice}</p> : null}
      {error && !createOpen && deleteTarget == null ? <p role="alert" className="order-2 rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm">{error}</p> : null}

      {props.eligible && props.rows.length === 0 ? (
        <p className="order-3 rounded-xl border border-border/70 bg-card px-4 py-4 text-sm shadow-none lg:order-4">{VARIATION_EMPTY_LIST}</p>
      ) : null}

      {props.rows.length > 0 ? (
        <ul className="order-3 space-y-3 lg:order-4">
          {props.rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border/70 bg-card p-4 text-sm shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variation {row.variationNumber}</p>
                  <p className="mt-1 break-words text-base font-semibold leading-snug">{row.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    {row.revisionNumber == null ? "Current revision pending" : `Revision ${row.revisionNumber}`}
                  </p>
                </div>
                <Badge variant="outline">{row.deliveryLabel ?? row.statusLabel}</Badge>
              </div>
              {row.status === "accepted" || row.status === "rejected" ? (
                <p className="mt-3 break-words text-muted-foreground" data-variation-list-scan="true">
                  {row.statusLabel}
                  {row.status === "accepted" && row.acceptedAt ? ` · ${row.acceptedAt}` : ""}
                  {row.status === "rejected" && row.declinedAt ? ` · ${row.declinedAt}` : ""}
                  {row.inclGst != null ? ` · ${formatSignedAdjustment(row.inclGst, currency)}` : ""}
                </p>
              ) : null}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <MoneyScan
                  label="Net adjustment ex GST"
                  value={row.netExGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(row.netExGst, currency)}
                  attention={row.netExGst == null}
                />
                <MoneyScan
                  label="GST"
                  value={row.gst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(row.gst, currency)}
                  attention={row.gst == null}
                />
                <MoneyScan
                  label="Adjustment incl GST"
                  value={row.inclGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(row.inclGst, currency)}
                  attention={row.inclGst == null}
                  prominent
                />
                {row.createdAt ? <MoneyScan label="Created" value={row.createdAt} /> : null}
                {row.issuedAt ? <MoneyScan label="Issued" value={row.issuedAt} /> : null}
                {row.withdrawnAt ? <MoneyScan label="Withdrawn" value={row.withdrawnAt} /> : null}
                {row.status === "accepted" ? (
                  <>
                    {row.acceptedAt ? <MoneyScan label="Accepted" value={row.acceptedAt} /> : null}
                    {row.responseSource ? <MoneyScan label="Customer response" value={row.responseSource} /> : null}
                    {row.responderName ? <MoneyScan label="Responder" value={row.responderName} /> : null}
                    {row.inclGst != null ? <MoneyScan label="Adjustment applied" value={formatSignedAdjustment(row.inclGst, currency)} /> : null}
                    {row.revisedContractInclGst != null ? <MoneyScan label="Revised accepted contract" value={formatContractMoney(row.revisedContractInclGst, currency)} /> : null}
                  </>
                ) : null}
                {row.status === "rejected" ? (
                  <>
                    {row.declinedAt ? <MoneyScan label="Declined" value={row.declinedAt} /> : null}
                    {row.responseSource ? <MoneyScan label="Customer response" value={row.responseSource} /> : null}
                    {row.responderName ? <MoneyScan label="Responder" value={row.responderName} /> : null}
                    {row.declineReason ? <MoneyScan label="Reason" value={row.declineReason} /> : null}
                  </>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="touch" render={<Link href={`/app/projects/${props.projectId}/variations/${row.id}`} />}>
                  {row.status === "draft" ? "Continue draft" : "View Variation"}
                </Button>
                {row.status === "issued" && row.currentRevisionId ? (
                  <CreateRevisionButton
                    projectId={props.projectId}
                    variationId={row.id}
                    revisionId={row.currentRevisionId}
                    onDone={(href) => router.push(href)}
                    onError={setNotice}
                  />
                ) : null}
                {row.status === "draft" || row.status === "issued" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-11 min-h-11 items-center rounded-xl border px-3 text-sm">
                      Actions
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
                      {row.status === "issued" ? (
                        <DropdownMenuItem className="min-h-11" onClick={() => router.push(`/app/projects/${props.projectId}/variations/${row.id}?preview=1`)}>
                          View client document
                        </DropdownMenuItem>
                      ) : null}
                      {row.status === "draft" && row.currentRevisionId ? (
                        <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => setDeleteTarget(row)}>
                          Delete draft
                        </DropdownMenuItem>
                      ) : null}
                      {row.status === "issued" && row.currentRevisionId ? (
                        <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => router.push(`/app/projects/${props.projectId}/variations/${row.id}?withdraw=1`)}>
                          Withdraw Variation
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {summaryRows.length > 0 ? (
        <section className="order-4 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-none lg:hidden" data-variation-summary="compact" aria-label="Contract summary">
          <h2 className="text-sm font-semibold">Contract summary</h2>
          <dl className="mt-2">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-t border-border/70 py-2 first:border-t-0">
                <dt className="min-w-0 text-sm text-muted-foreground">{label}</dt>
                <dd className="min-w-0 max-w-[55%] text-right text-sm font-medium break-words tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {props.summary ? (
        <section className="order-2 hidden gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-3" data-variation-summary="true">
          {summaryRows.map(([label, value]) => (
            <SummaryCard key={label} label={label} value={value} />
          ))}
        </section>
      ) : null}

      {props.acceptedQuoteHref ? (
        <p className="order-5 text-sm lg:order-3">
          <Link
            href={props.acceptedQuoteHref}
            className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View accepted Quote →
          </Link>
          <span className="mt-1 block text-muted-foreground">The accepted Quote remains the contract baseline.</span>
        </p>
      ) : null}
      </div>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete draft Variation?</DialogTitle>
            <DialogDescription>This will permanently remove this unissued draft and its items. This action can’t be undone. Variation numbers are not reused.</DialogDescription>
          </DialogHeader>
          {error ? <p role="alert" className="text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" size="touch" disabled={deleting} onClick={() => void confirmListDelete()}>
              {deleting ? "Deleting…" : "Delete draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {props.eligible && createOpen ? (
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
          <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Variation</DialogTitle>
              <DialogDescription>Add the title and summary of change for a new draft.</DialogDescription>
            </DialogHeader>
            <form
              data-variation-create="true"
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCreate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="new-variation-title">Title</Label>
                <Input id="new-variation-title" className="min-h-11 text-base md:text-sm" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-variation-summary">Summary of change</Label>
                <textarea
                  id="new-variation-summary"
                  className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-base md:text-sm"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </div>
              {error ? <p role="alert" className="text-sm">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" size="touch" onClick={closeCreate} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" size="touch" disabled={creating}>
                  {creating ? "Creating Variation…" : "Create Variation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function CreateRevisionButton(props: {
  projectId: string;
  variationId: string;
  revisionId: string;
  onDone: (href: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      disabled={pending}
      onClick={() => {
        if (lock.current) return;
        lock.current = true;
        setPending(true);
        void createVariationRevision({
          variationId: props.variationId,
          revisionId: props.revisionId,
        }).then((result) => {
          if (!result.ok || !result.variationId) {
            lock.current = false;
            setPending(false);
            props.onError(result.ok ? "That revision could not be created." : result.error);
            return;
          }
          props.onDone(`/app/projects/${props.projectId}/variations/${props.variationId}`);
        });
      }}
    >
      {pending ? "Creating revision…" : "Create new revision"}
    </Button>
  );
}

function SummaryCard(props: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-none">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 break-words text-sm font-semibold tabular-nums">{props.value}</p>
    </div>
  );
}

function MoneyScan(props: { label: string; value: string; attention?: boolean; prominent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={`mt-0.5 break-words tabular-nums ${props.prominent ? "text-base font-semibold" : "font-medium"} ${props.attention ? "text-[var(--brand-orange)]" : ""}`}>
        {props.value}
      </dd>
    </div>
  );
}
