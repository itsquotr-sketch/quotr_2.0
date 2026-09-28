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

  return (
    <div data-variation-list="true" className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Variations</h1>
          <p className="text-sm text-muted-foreground">Changes to the agreed scope and price.</p>
        </div>
        {props.eligible ? (
          <Button type="button" size="touch" onClick={openCreate}>
            Create Variation
          </Button>
        ) : null}
      </div>

      {!props.eligible ? (
        <p className="rounded-2xl border bg-card px-4 py-3 text-sm" data-variation-unavailable="true">
          {props.reason}
        </p>
      ) : null}

      {props.summary ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-variation-summary="true">
          <SummaryCard label="Original accepted contract" value={formatContractMoney(props.summary.originalAcceptedInclGst, currency)} />
          <SummaryCard label="Accepted Variation adjustments, ex GST" value={formatSignedAdjustment(props.summary.acceptedAdjustmentExGst, currency)} />
          <SummaryCard label="Revised accepted contract" value={formatContractMoney(props.summary.revisedAcceptedInclGst, currency)} />
          <SummaryCard label="Issued or pending Variations — ex GST" value={formatSignedAdjustment(props.summary.pendingIssuedExGst, currency)} />
          <SummaryCard label="Draft Variations" value={String(props.summary.draftCount)} />
        </section>
      ) : null}

      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}

      {props.eligible && props.rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-3 text-sm">{VARIATION_EMPTY_LIST}</p>
      ) : null}

      {props.rows.length > 0 ? (
        <ul className="space-y-3">
          {props.rows.map((row) => (
            <li key={row.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">Variation {row.variationNumber}</p>
                  <p className="mt-1 break-words">{row.title}</p>
                  <p className="mt-2 text-muted-foreground">
                    {row.revisionNumber == null ? "Current revision pending" : `Revision ${row.revisionNumber}`}
                  </p>
                  {row.deliveryLabel ? <p className="mt-1 text-muted-foreground">{row.deliveryLabel}</p> : null}
                </div>
                <Badge variant="outline">{row.statusLabel}</Badge>
              </div>
              <dl className="mt-3 grid gap-1">
                <div className="flex flex-wrap justify-between gap-3">
                  <dt>Net adjustment ex GST</dt>
                  <dd className="tabular-nums">
                    {row.netExGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(row.netExGst, currency)}
                  </dd>
                </div>
                {row.createdAt ? <div className="flex justify-between gap-3"><dt>Created</dt><dd>{row.createdAt}</dd></div> : null}
                {row.issuedAt ? <div className="flex justify-between gap-3"><dt>Issued</dt><dd>{row.issuedAt}</dd></div> : null}
                {row.withdrawnAt ? <div className="flex justify-between gap-3"><dt>Withdrawn</dt><dd>{row.withdrawnAt}</dd></div> : null}
                {row.acceptedAt ? <div className="flex justify-between gap-3"><dt>Accepted</dt><dd>{row.acceptedAt}</dd></div> : null}
                {row.declinedAt ? <div className="flex justify-between gap-3"><dt>Declined</dt><dd>{row.declinedAt}</dd></div> : null}
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
              <DialogDescription>Add the title and client-facing summary for a new draft.</DialogDescription>
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
                <Input id="new-variation-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-variation-summary">Client-facing summary</Label>
                <textarea
                  id="new-variation-summary"
                  className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm"
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
    <div className="min-w-0 rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 break-words text-sm font-medium tabular-nums">{props.value}</p>
    </div>
  );
}
