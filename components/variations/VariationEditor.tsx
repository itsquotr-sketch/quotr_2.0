"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { VariationDocument } from "@/components/variations/VariationDocument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  addDraftVariationItem,
  createVariationRevision,
  deleteDraftVariationItem,
  deleteUnissuedDraftVariation,
  issueVariationRevision,
  loadVariation,
  updateDraftVariation,
  updateDraftVariationItem,
} from "@/lib/variations/actions";
import {
  calculateRevisedContractValue,
  type InternalVariation,
  type VariationItemType,
} from "@/lib/variations/domain";
import {
  buildVariationDocument,
  formatSignedAdjustment,
  internalMarginReadout,
  issueConfirmationCopy,
  magnitudeFromSignedUnit,
  prepareItemsForReadout,
  proposedRevisedContract,
  provenanceLabel,
  sellFromKnownCost,
  signedUnitFromMagnitude,
  variationIssueReadiness,
  variationStatusLabel,
  variationUnitLineReadout,
  VARIATION_NOT_READY_HEADING,
  VARIATION_OMISSION_HELP,
  VARIATION_PRICING_REQUIRED_LABEL,
  VARIATION_READY_DETAIL,
  VARIATION_READY_HEADING,
  type CommercialProvenance,
} from "@/lib/variations/presentation";
import type {
  VariationBaselineView,
  VariationRevisionHistoryRow,
  VariationScopeLineOption,
  VariationWorkAreaOption,
} from "@/lib/variations/workspace-types";

type AcceptedMoney = {
  id: string;
  totalSellAdjustmentExGst: number;
  gstAdjustment: number;
  totalAdjustmentInclGst: number;
};

type EditorProps = {
  projectId: string;
  variation: InternalVariation;
  baseline: VariationBaselineView;
  scopeLines: VariationScopeLineOption[];
  workAreas: VariationWorkAreaOption[];
  defaultMarginPercent: number;
  companyName: string;
  projectTitle: string;
  clientName: string;
  siteAddress: string | null;
  history: VariationRevisionHistoryRow[];
  acceptedRevisions: AcceptedMoney[];
  viewRevisionId: string | null;
};

type ItemSavePayload =
  | { kind: "single"; item: SingleItem; itemId?: string }
  | { kind: "substitution"; remove: SingleItem; add: SingleItem; removeId?: string; addId?: string };

type SingleItem = {
  itemType: VariationItemType;
  clientDescription: string;
  workAreaId: string | null;
  snapshotLineId: string | null;
  stableComponentKey: null;
  quantity: number;
  unit: string;
  unitCost: number | null;
  unitSell: number | null;
  sortOrder: number;
  clientInclusion: null;
  clientExclusion: null;
  substitutionGroupId: string | null;
  internalMetadata: { sellProvenance: CommercialProvenance; targetMarginPercent: number };
};

function readProvenance(metadata: Record<string, unknown>, itemType: string, unitSell: number | null): CommercialProvenance {
  const value = metadata.sellProvenance;
  if (value === "calculated" || value === "manual" || value === "no_cost" || value === "pricing_required") return value;
  if (itemType === "no_cost_scope_change") return "no_cost";
  if (unitSell == null) return "pricing_required";
  return "manual";
}

export function VariationEditor(props: EditorProps) {
  const router = useRouter();
  const lock = useRef(false);
  const [variation, setVariation] = useState(props.variation);
  const [history, setHistory] = useState(props.history);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [itemEditor, setItemEditor] = useState<"add" | string | null>(null);
  const current =
    variation.revisions.find((revision) => revision.status !== "superseded") ??
    variation.revisions[variation.revisions.length - 1];
  const viewing =
    variation.revisions.find((revision) => revision.id === props.viewRevisionId) ?? current;
  const draft = current?.status === "draft" && viewing?.id === current.id;
  const historical = viewing != null && current != null && viewing.id !== current.id;
  const canDelete = variation.status === "draft" && variation.revisions.every((revision) => revision.status === "draft");

  const readiness = useMemo(() => {
    if (!current) return { ready: false, blockerCodes: ["EMPTY_VARIATION"], blockers: ["Add at least one Variation item."] };
    return variationIssueReadiness({
      title: current.title,
      summary: current.summary,
      items: current.items.map((item) => ({
        itemType: item.itemType,
        clientDescription: item.clientDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitSell: item.unitSell,
        unitCost: item.unitCost,
        substitutionGroupId: item.substitutionGroupId,
      })),
    });
  }, [current]);

  const proposedLabel = useMemo(() => {
    if (!viewing) return null;
    const accepted = props.acceptedRevisions
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
    const proposed = proposedRevisedContract({
      baseline: {
        currency: props.baseline.currency,
        gstRate: props.baseline.gstRate,
        taxTreatment: props.baseline.taxTreatment,
        sellExGst: props.baseline.sellExGst,
        gstAmount: props.baseline.gstAmount,
        sellInclGst: props.baseline.sellInclGst,
      },
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
    return proposed ? formatSignedAdjustment(proposed.revisedContractValueInclGst, props.baseline.currency).replace(/^\+/, "") : null;
  }, [props.acceptedRevisions, props.baseline, viewing]);

  const marginReadout = useMemo(() => {
    if (!viewing) return null;
    return internalMarginReadout({
      currency: props.baseline.currency,
      items: prepareItemsForReadout(viewing.items.map((item) => ({
        itemType: item.itemType,
        clientDescription: item.clientDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitSell: item.unitSell,
        unitCost: item.unitCost,
        substitutionGroupId: item.substitutionGroupId,
      }))),
      totalsCost: viewing.totalDirectCostAdjustment,
      totalsSell: viewing.totalSellAdjustmentExGst,
    });
  }, [props.baseline.currency, viewing]);

  async function reload(): Promise<void> {
    const loaded = await loadVariation({ variationId: props.variation.id });
    if (!loaded.ok) return;
    setVariation(loaded.variation);
    setHistory((previous) =>
      loaded.variation.revisions.map((revision) => ({
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        title: revision.title,
        status: revision.status,
        statusLabel: variationStatusLabel(revision.status),
        issuedAt: previous.find((row) => row.id === revision.id)?.issuedAt ?? null,
        netExGst: revision.totalSellAdjustmentExGst,
        label: revision.status === "superseded" ? "Historical" : "Current",
      }))
    );
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, refresh = false): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setPending(true);
    setError(null);
    setSaved(null);
    const result = await action();
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "That variation update is not available.");
      return false;
    }
    if (refresh) router.refresh();
    else await reload();
    lock.current = false;
    setPending(false);
    return true;
  }

  if (!current || !viewing) return <p>That variation could not be found.</p>;

  const currency = props.baseline.currency;
  const groups = groupItems(viewing.items);
  const additionTotal = sumLines(viewing.items.filter((item) => item.itemType === "addition"));
  const omissionTotal = sumLines(viewing.items.filter((item) => item.itemType === "omission"));

  return (
    <div data-variation-editor="true" className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Variation {props.variation.variationNumber}</h1>
          <p className="text-sm text-muted-foreground">Revision {viewing.revisionNumber}</p>
        </div>
        <Badge variant="outline">{variationStatusLabel(viewing.status)}{historical ? " · Historical" : " · Current"}</Badge>
      </div>
      {historical ? <p className="rounded-xl border bg-card px-4 py-3 text-sm">This is an earlier revision. It is not the current proposal.</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm">{error}</p> : null}
      {saved ? <p role="status" className="text-sm text-muted-foreground">{saved}</p> : null}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-base font-semibold">Variation details</h2>
        <p className="mt-1 text-sm text-muted-foreground">{props.baseline.referenceLabel}</p>
        {draft ? (
          <HeaderForm
            key={`${current.id}:${current.title}:${current.summary ?? ""}:${current.clientNotes ?? ""}:${current.internalNotes ?? ""}`}
            title={current.title}
            summary={current.summary ?? ""}
            clientNotes={current.clientNotes ?? ""}
            internalNotes={current.internalNotes ?? ""}
            pending={pending}
            onSave={(input) =>
              void run(() =>
                updateDraftVariation({
                  variationId: variation.id,
                  revisionId: current.id,
                  title: input.title,
                  summary: input.summary || null,
                  clientNotes: input.clientNotes || null,
                  internalNotes: input.internalNotes || null,
                  proposedTimeEffectDays: current.proposedTimeEffectDays,
                })
              ).then((ok) => { if (ok) setSaved("Details saved"); })
            }
          />
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Title</dt><dd>{viewing.title}</dd></div>
            <div><dt className="text-muted-foreground">Client-facing summary</dt><dd className="break-words">{viewing.summary || "No summary"}</dd></div>
            <div><dt className="text-muted-foreground">Client-facing notes</dt><dd className="break-words">{viewing.clientNotes || "No client notes"}</dd></div>
          </dl>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Scope and pricing</h2>
          {draft && itemEditor == null ? (
            <Button type="button" size="touch" onClick={() => setItemEditor("add")}>Add item</Button>
          ) : null}
        </div>
        {viewing.items.length === 0 ? (
          <p className="rounded-2xl border bg-card px-4 py-3 text-sm">No items yet. Add the scope and price changes included in this Variation.</p>
        ) : null}
        {groups.map((group) => {
          const lead = group.kind === "single" ? group.item : group.remove;
          const line = lead.lineSellAdjustmentExGst;
          const scope = props.scopeLines.find((row) => row.id === lead.snapshotLineId);
          const area = props.workAreas.find((row) => row.id === (lead.workAreaId ?? scope?.workAreaId));
          return (
            <article key={lead.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">{group.kind === "pair" ? "Substitution" : itemBadge(lead.itemType)}</Badge>
                <p className="tabular-nums">{line == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(groupNet(group), currency)}</p>
              </div>
              <p className="mt-2 break-words font-medium">{group.kind === "pair" ? `${group.remove.clientDescription} / ${group.add.clientDescription}` : lead.clientDescription}</p>
              <p className="mt-1 text-muted-foreground">{area ? area.name : "New scope"}{scope ? ` · ${scope.description}` : ""}</p>
              <p className="mt-1">{lead.quantity} {lead.unit} · {provenanceLabel(readProvenance(lead.internalMetadata, lead.itemType, lead.unitSell))}</p>
              {draft ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="touch" variant="outline" onClick={() => setItemEditor(lead.id)}>Edit item</Button>
                  <Button type="button" size="touch" variant="destructive" onClick={() => setItemEditor(`delete:${lead.id}`)}>Delete item</Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border bg-card p-4" data-variation-commercial-summary="true">
        <h2 className="text-base font-semibold">Commercial summary</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="Addition total" value={additionTotal == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(additionTotal, currency)} />
          <Row label="Omission total" value={omissionTotal == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(omissionTotal, currency)} />
          <Row label="Net adjustment ex GST" value={viewing.totalSellAdjustmentExGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(viewing.totalSellAdjustmentExGst, currency)} />
          <Row label="GST" value={viewing.gstAdjustment == null ? "Not calculated yet" : formatSignedAdjustment(viewing.gstAdjustment, currency)} />
          <Row label="Adjustment incl GST" value={viewing.totalAdjustmentInclGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(viewing.totalAdjustmentInclGst, currency)} />
          {marginReadout?.costLabel ? <Row label="Internal cost adjustment" value={marginReadout.costLabel} /> : null}
          {marginReadout?.grossProfitLabel ? <Row label="Gross profit" value={marginReadout.grossProfitLabel} /> : null}
          {marginReadout?.marginLabel ? <Row label="Effective gross margin" value={marginReadout.marginLabel} /> : null}
        </dl>
        {marginReadout?.note ? <p className="mt-2 text-sm text-muted-foreground">{marginReadout.note}</p> : null}
        <p className="mt-3 text-sm">Proposed revised contract if this Variation were accepted: <span className="font-medium">{proposedLabel ?? "Not calculated yet"}</span> <span className="text-muted-foreground">(proposed, not accepted)</span></p>
      </section>

      {draft ? (
        <section className="rounded-2xl border bg-card p-4" data-variation-readiness="true">
          <h2 className="text-base font-semibold">{readiness.ready ? VARIATION_READY_HEADING : VARIATION_NOT_READY_HEADING}</h2>
          {readiness.ready ? <p className="mt-2 text-sm">{VARIATION_READY_DETAIL}</p> : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          )}
          <Button className="mt-3" size="touch" type="button" disabled={!readiness.ready || pending} onClick={() => setConfirmIssue(true)}>Issue revision</Button>
        </section>
      ) : null}

      {current.status === "issued" && !historical ? (
        <Button type="button" size="touch" disabled={pending} onClick={() => void run(() => createVariationRevision({ variationId: variation.id, revisionId: current.id }))}>
          {pending ? "Creating revision…" : "Create new revision"}
        </Button>
      ) : null}

      {canDelete && draft ? (
        <Button type="button" size="touch" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete draft</Button>
      ) : null}

      <section>
        <h2 className="text-base font-semibold">Revision history</h2>
        <ul className="mt-2 space-y-2">
          {history.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 break-words">Revision {row.revisionNumber} · {row.title} · {row.statusLabel} · {row.label}{row.issuedAt ? ` · Issued ${row.issuedAt}` : ""}{row.netExGst != null ? ` · ${formatSignedAdjustment(row.netExGst, currency)}` : ""}</span>
              <Link className="underline" href={`/app/projects/${props.projectId}/variations/${variation.id}?revision=${row.id}`}>View</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold">Client document</h2>
        <p className="mt-1 text-sm text-muted-foreground">Internal notes, cost and margin stay off the client document.</p>
        <Button type="button" className="mt-3" size="touch" variant="outline" onClick={() => setPreviewOpen(true)}>Preview client document</Button>
      </section>

      <ClientPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        companyName={props.companyName}
        clientName={props.clientName}
        projectTitle={props.projectTitle}
        siteAddress={props.siteAddress}
        variationNumber={variation.variationNumber}
        viewing={viewing}
        currency={currency}
        baseline={props.baseline}
        acceptedRevisions={props.acceptedRevisions}
        issuedAt={history.find((row) => row.id === viewing.id)?.issuedAt ?? null}
      />

      {draft && itemEditor === "add" ? (
        <ItemDialog
          title="Add item"
          currency={currency}
          defaultMarginPercent={props.defaultMarginPercent}
          scopeLines={props.scopeLines}
          workAreas={props.workAreas}
          pending={pending}
          initial={null}
          onClose={() => setItemEditor(null)}
          onSave={(payload) =>
            void run(async () => {
              if (payload.kind === "single") {
                return addDraftVariationItem({ variationId: variation.id, revisionId: current.id, ...payload.item });
              }
              const groupId = crypto.randomUUID();
              const first = await addDraftVariationItem({
                variationId: variation.id,
                revisionId: current.id,
                ...payload.remove,
                substitutionGroupId: groupId,
              });
              if (!first.ok || !first.itemId) return first;
              const second = await addDraftVariationItem({
                variationId: variation.id,
                revisionId: current.id,
                ...payload.add,
                substitutionGroupId: groupId,
              });
              if (!second.ok) {
                await deleteDraftVariationItem({ variationId: variation.id, revisionId: current.id, itemId: first.itemId });
              }
              return second;
            }).then((ok) => { if (ok) setItemEditor(null); })
          }
        />
      ) : null}

      {draft && itemEditor && itemEditor.startsWith("delete:") ? (
        <DeleteItemDialog
          pending={pending}
          onClose={() => setItemEditor(null)}
          onConfirm={() => {
            const id = itemEditor.slice("delete:".length);
            const item = viewing.items.find((row) => row.id === id);
            const pair = item?.substitutionGroupId
              ? viewing.items.filter((row) => row.substitutionGroupId === item.substitutionGroupId)
              : item ? [item] : [];
            void run(async () => {
              let last: { ok: boolean; error?: string } = { ok: true };
              for (const row of pair) {
                last = await deleteDraftVariationItem({ variationId: variation.id, revisionId: current.id, itemId: row.id });
                if (!last.ok) return last;
              }
              return last;
            }).then((ok) => { if (ok) setItemEditor(null); });
          }}
        />
      ) : null}

      {draft && itemEditor && itemEditor !== "add" && !itemEditor.startsWith("delete:") ? (
        <EditExistingItem
          itemId={itemEditor}
          items={viewing.items}
          currency={currency}
          defaultMarginPercent={props.defaultMarginPercent}
          scopeLines={props.scopeLines}
          workAreas={props.workAreas}
          pending={pending}
          onClose={() => setItemEditor(null)}
          onSave={(payload) =>
            void run(async () => {
              if (payload.kind === "single") {
                return updateDraftVariationItem({
                  variationId: variation.id,
                  revisionId: current.id,
                  itemId: payload.itemId,
                  ...payload.item,
                });
              }
              const first = await updateDraftVariationItem({
                variationId: variation.id,
                revisionId: current.id,
                itemId: payload.removeId,
                ...payload.remove,
              });
              if (!first.ok) return first;
              return updateDraftVariationItem({
                variationId: variation.id,
                revisionId: current.id,
                itemId: payload.addId,
                ...payload.add,
              });
            }).then((ok) => { if (ok) setItemEditor(null); })
          }
        />
      ) : null}

      <Dialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <DialogContent data-issue-confirm="true" className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue this revision</DialogTitle>
            <DialogDescription>{issueConfirmationCopy(variation.variationNumber, current.revisionNumber)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => setConfirmIssue(false)}>Keep editing</Button>
            <Button type="button" size="touch" autoFocus disabled={pending || !readiness.ready} onClick={() => void run(() => issueVariationRevision({ variationId: variation.id, revisionId: current.id }), true).then((ok) => { if (ok) setConfirmIssue(false); })}>
              {pending ? "Issuing…" : "Issue revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete draft Variation?</DialogTitle>
            <DialogDescription>This will permanently remove this unissued draft and its items. This action can’t be undone. Variation numbers are not reused.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button type="button" variant="destructive" size="touch" disabled={pending} onClick={() => void run(() => deleteUnissuedDraftVariation({ projectId: props.projectId, variationId: variation.id, revisionId: current.id })).then((ok) => { if (ok) router.push(`/app/projects/${props.projectId}/variations`); })}>
              {pending ? "Deleting…" : "Delete draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientPreview(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  clientName: string;
  projectTitle: string;
  siteAddress: string | null;
  variationNumber: number;
  viewing: InternalVariation["revisions"][number];
  currency: string;
  baseline: VariationBaselineView;
  acceptedRevisions: AcceptedMoney[];
  issuedAt: string | null;
}) {
  if (!props.open) return null;
  const viewing = props.viewing;
  const accepted = props.acceptedRevisions.filter((row) => row.id !== viewing.id).map((row) => ({
    id: row.id,
    status: "accepted" as const,
    isCurrent: true,
    totalSellAdjustmentExGst: row.totalSellAdjustmentExGst,
    gstAdjustment: row.gstAdjustment,
    totalAdjustmentInclGst: row.totalAdjustmentInclGst,
    items: [],
  }));
  const baselineMoney = {
    currency: props.baseline.currency,
    gstRate: props.baseline.gstRate,
    taxTreatment: props.baseline.taxTreatment,
    sellExGst: props.baseline.sellExGst,
    gstAmount: props.baseline.gstAmount,
    sellInclGst: props.baseline.sellInclGst,
  };
  const currentContract = calculateRevisedContractValue({ baseline: baselineMoney, revisions: accepted });
  const proposed = proposedRevisedContract({
    baseline: baselineMoney,
    accepted,
    candidate: {
      id: props.viewing.id,
      status: props.viewing.status,
      isCurrent: true,
      totalSellAdjustmentExGst: props.viewing.totalSellAdjustmentExGst,
      gstAdjustment: props.viewing.gstAdjustment,
      totalAdjustmentInclGst: props.viewing.totalAdjustmentInclGst,
      items: props.viewing.items.map((item) => ({ itemType: item.itemType, lineSellAdjustmentExGst: item.lineSellAdjustmentExGst })),
    },
  });
  const model = buildVariationDocument({
    companyName: props.companyName,
    clientName: props.clientName,
    projectTitle: props.projectTitle,
    siteAddress: props.siteAddress,
    variationNumber: props.variationNumber,
    revisionNumber: viewing.revisionNumber,
    issuedAt: props.issuedAt,
    status: viewing.status,
    title: viewing.title,
    summary: viewing.summary,
    clientNotes: viewing.clientNotes,
    currency: viewing.currency || props.currency,
    items: viewing.items,
    totals: {
      totalSellAdjustmentExGst: viewing.totalSellAdjustmentExGst,
      gstAdjustment: viewing.gstAdjustment,
      totalAdjustmentInclGst: viewing.totalAdjustmentInclGst,
    },
    baseline: props.baseline,
    currentContract: currentContract.ok ? { exGst: currentContract.value.revisedContractValueExGst, inclGst: currentContract.value.revisedContractValueInclGst } : null,
    proposed,
  });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview client document</DialogTitle>
          <DialogDescription>This is the client view. Internal cost and margin are not included.</DialogDescription>
        </DialogHeader>
        <VariationDocument model={model} />
        <DialogFooter>
          <Button type="button" variant="outline" size="touch" onClick={() => props.onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HeaderForm(props: {
  title: string;
  summary: string;
  clientNotes: string;
  internalNotes: string;
  pending: boolean;
  onSave: (input: { title: string; summary: string; clientNotes: string; internalNotes: string }) => void;
}) {
  const [title, setTitle] = useState(props.title);
  const [summary, setSummary] = useState(props.summary);
  const [clientNotes, setClientNotes] = useState(props.clientNotes);
  const [internalNotes, setInternalNotes] = useState(props.internalNotes);
  const dirty = title !== props.title || summary !== props.summary || clientNotes !== props.clientNotes || internalNotes !== props.internalNotes;
  return (
    <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); if (!dirty || props.pending) return; props.onSave({ title, summary, clientNotes, internalNotes }); }}>
      <div className="grid gap-1.5">
        <Label htmlFor="variation-title">Title</Label>
        <Input id="variation-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="variation-summary">Client-facing summary</Label>
        <textarea id="variation-summary" className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm" value={summary} onChange={(event) => setSummary(event.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="variation-client-notes">Client-facing notes</Label>
        <textarea id="variation-client-notes" className="min-h-16 w-full rounded-xl border bg-background px-3 py-2 text-sm" value={clientNotes} onChange={(event) => setClientNotes(event.target.value)} />
      </div>
      <div className="grid gap-1.5" data-variation-internal-notes="true">
        <Label htmlFor="variation-internal-notes">Internal notes</Label>
        <textarea id="variation-internal-notes" className="min-h-16 w-full rounded-xl border bg-background px-3 py-2 text-sm" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
        <p className="text-xs text-muted-foreground">Internal notes stay off the client document.</p>
      </div>
      <Button type="submit" size="touch" disabled={props.pending || !dirty}>{props.pending ? "Saving…" : "Save details"}</Button>
    </form>
  );
}

function ItemDialog(props: {
  title: string;
  currency: string;
  defaultMarginPercent: number;
  scopeLines: VariationScopeLineOption[];
  workAreas: VariationWorkAreaOption[];
  pending: boolean;
  initial: null | {
    kind: "addition" | "omission" | "substitution" | "no_cost";
    lockedType: boolean;
    description: string;
    removeDescription: string;
    addDescription: string;
    quantity: string;
    unit: string;
    sellMagnitude: string;
    removeMagnitude: string;
    addMagnitude: string;
    costMagnitude: string;
    margin: string;
    provenance: CommercialProvenance;
    scopeId: string;
    workAreaId: string;
    removeId?: string;
    addId?: string;
    itemId?: string;
    substitutionGroupId: string | null;
    sortOrder: number;
  };
  onClose: () => void;
  onSave: (payload: ItemSavePayload) => void;
}) {
  const initial = props.initial;
  const [kind, setKind] = useState<"addition" | "omission" | "substitution" | "no_cost">(initial?.kind ?? "addition");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [removeDescription, setRemoveDescription] = useState(initial?.removeDescription ?? "");
  const [addDescription, setAddDescription] = useState(initial?.addDescription ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? "1");
  const [unit, setUnit] = useState(initial?.unit ?? "item");
  const [sellMagnitude, setSellMagnitude] = useState(initial?.sellMagnitude ?? "");
  const [removeMagnitude, setRemoveMagnitude] = useState(initial?.removeMagnitude ?? "");
  const [addMagnitude, setAddMagnitude] = useState(initial?.addMagnitude ?? "");
  const [costMagnitude, setCostMagnitude] = useState(initial?.costMagnitude ?? "");
  const [margin, setMargin] = useState(initial?.margin ?? String(props.defaultMarginPercent));
  const [provenance, setProvenance] = useState<CommercialProvenance>(initial?.provenance ?? "pricing_required");
  const [scopeId, setScopeId] = useState(initial?.scopeId ?? "");
  const [workAreaId, setWorkAreaId] = useState(initial?.workAreaId ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const scope = props.scopeLines.find((line) => line.id === scopeId) ?? null;
  const parsedCost = costMagnitude.trim() === "" ? null : Number(costMagnitude);
  const parsedMargin = Number(margin);
  const calculated = parsedCost != null && Number.isFinite(parsedCost) ? sellFromKnownCost(parsedCost, parsedMargin) : null;
  const shownSell = kind === "no_cost" ? 0 : provenance === "calculated" && calculated != null ? calculated : sellMagnitude.trim() === "" ? null : Number(sellMagnitude);
  const sign = kind === "omission" ? -1 : 1;
  const readout = kind === "substitution" || shownSell == null && kind !== "no_cost" ? null : variationUnitLineReadout({
    quantity: Number(quantity) || 1,
    unit: unit || "item",
    unitCost: parsedCost,
    unitSell: kind === "no_cost" ? 0 : shownSell,
    sign,
    currency: props.currency,
  });

  function selectedWorkArea(): string | null {
    if (scope?.workAreaId) return scope.workAreaId;
    return workAreaId || null;
  }

  function singleItem(itemType: VariationItemType, clientDescription: string, magnitude: number | null, sortOrder: number, nextProvenance: CommercialProvenance, groupId: string | null): SingleItem | null {
    const unitSell = itemType === "no_cost_scope_change" ? 0 : signedUnitFromMagnitude(itemType, magnitude);
    if (itemType !== "no_cost_scope_change" && magnitude != null && unitSell == null) return null;
    const unitCost = itemType === "no_cost_scope_change" || parsedCost == null ? null : signedUnitFromMagnitude(itemType, parsedCost);
    return {
      itemType,
      clientDescription,
      workAreaId: selectedWorkArea(),
      snapshotLineId: scope?.id ?? null,
      stableComponentKey: null,
      quantity: Number(quantity) || 1,
      unit: unit || "item",
      unitCost,
      unitSell: nextProvenance === "pricing_required" ? null : unitSell,
      sortOrder,
      clientInclusion: null,
      clientExclusion: null,
      substitutionGroupId: groupId,
      internalMetadata: { sellProvenance: nextProvenance, targetMarginPercent: Number.isFinite(parsedMargin) ? parsedMargin : props.defaultMarginPercent },
    };
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>Prices are per unit and ex GST. Internal cost stays off the client document.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          if (props.pending) return;
          if (kind === "substitution") {
            const remove = singleItem("omission", removeDescription, Number(removeMagnitude), initial?.sortOrder ?? 0, "manual", initial?.substitutionGroupId ?? null);
            const add = singleItem("addition", addDescription, Number(addMagnitude), (initial?.sortOrder ?? 0) + 1, "manual", initial?.substitutionGroupId ?? null);
            if (!remove || !add || remove.unitSell == null || add.unitSell == null) {
              setFormError("Complete both sides of the substitution.");
              return;
            }
            props.onSave({ kind: "substitution", remove, add, removeId: initial?.removeId, addId: initial?.addId });
            return;
          }
          const itemType: VariationItemType = kind === "no_cost" ? "no_cost_scope_change" : kind;
          const nextProvenance: CommercialProvenance = kind === "no_cost" ? "no_cost" : provenance === "calculated" && calculated != null ? "calculated" : provenance;
          const item = singleItem(itemType, description, kind === "no_cost" ? 0 : shownSell, initial?.sortOrder ?? 0, nextProvenance, null);
          if (!item || !description.trim()) {
            setFormError("Add a description before saving this item.");
            return;
          }
          props.onSave({ kind: "single", item, itemId: initial?.itemId });
        }}>
          <div className="grid gap-1.5">
            <Label htmlFor="item-kind">Change type</Label>
            <select id="item-kind" className="h-11 rounded-xl border bg-background px-3 text-sm" value={kind} disabled={initial?.lockedType} onChange={(event) => { const next = event.target.value as typeof kind; setKind(next); setProvenance(next === "no_cost" ? "no_cost" : "pricing_required"); }}>
              <option value="addition">Addition</option>
              <option value="omission">Omission</option>
              {initial?.lockedType || !initial ? <option value="substitution">Substitution</option> : null}
              <option value="no_cost">No-cost scope change</option>
            </select>
            {initial?.lockedType ? <p className="text-xs text-muted-foreground">Delete this substitution and add it again to change the type.</p> : null}
            {!initial?.lockedType && initial ? <p className="text-xs text-muted-foreground">To make this a substitution, delete it and add a substitution.</p> : null}
          </div>
          {kind === "substitution" ? (
            <>
              <Field id="remove-description" label="Remove" value={removeDescription} onChange={setRemoveDescription} />
              <Field id="remove-amount" label="Amount to remove" value={removeMagnitude} onChange={setRemoveMagnitude} numeric />
              <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p>
              <Field id="add-description" label="Add" value={addDescription} onChange={setAddDescription} />
              <Field id="add-amount" label="Amount to add" value={addMagnitude} onChange={setAddMagnitude} numeric />
            </>
          ) : <Field id="item-description" label="Client-facing description" value={description} onChange={setDescription} />}
          <div className="grid gap-1.5">
            <Label htmlFor="item-scope">Accepted scope</Label>
            <select id="item-scope" className="h-11 rounded-xl border bg-background px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
              <option value="">New scope</option>
              {props.scopeLines.map((line) => <option key={line.id} value={line.id}>{(line.workAreaName ? `${line.workAreaName} · ` : "") + line.description}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-area">Work area</Label>
            <select id="item-area" className="h-11 rounded-xl border bg-background px-3 text-sm" value={workAreaId} onChange={(event) => setWorkAreaId(event.target.value)}>
              <option value="">No work area</option>
              {props.workAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="item-qty" label="Quantity" value={quantity} onChange={setQuantity} numeric />
            <Field id="item-unit" label="Unit" value={unit} onChange={setUnit} />
          </div>
          {kind !== "no_cost" && kind !== "substitution" ? (
            <>
              <Field id="item-cost" label="Internal cost per unit" value={costMagnitude} onChange={(value) => { setCostMagnitude(value); if (provenance !== "manual") setProvenance("calculated"); }} numeric />
              <Field id="item-margin" label="Target gross margin" value={margin} onChange={(value) => { setMargin(value); if (provenance !== "manual") setProvenance("calculated"); }} numeric />
              <p className="text-xs text-muted-foreground">Target margin is the gross margin used to calculate client sell from internal cost.</p>
              <Field id="item-sell" label={kind === "omission" ? "Amount to remove, ex GST" : "Client sell per unit, ex GST"} value={provenance === "calculated" && calculated != null ? String(calculated) : sellMagnitude} onChange={(value) => { setSellMagnitude(value); setProvenance(value.trim() === "" ? "pricing_required" : "manual"); }} numeric />
              {kind === "omission" ? <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p> : null}
              <p className="text-xs text-muted-foreground">{provenanceLabel(provenance)}</p>
              {calculated != null ? <p className="text-sm">Calculated client sell per unit: {formatSignedAdjustment(calculated, props.currency).replace(/^\+/, "")}</p> : null}
              {readout?.quantityLabel ? <p className="break-words text-sm">Quantity: {readout.quantityLabel}</p> : null}
              {readout?.lineCostLabel ? <p className="break-words text-sm">Internal line cost: {readout.lineCostLabel}</p> : null}
              {readout?.lineSellLabel ? <p className="break-words text-sm">Client line sell: {readout.lineSellLabel}</p> : null}
              {readout?.grossProfitLabel ? <p className="text-sm">Gross profit: {readout.grossProfitLabel}</p> : null}
              {readout?.marginLabel ? <p className="text-sm">Effective gross margin: {readout.marginLabel}</p> : null}
              {shownSell == null ? <p className="text-sm">{VARIATION_PRICING_REQUIRED_LABEL}</p> : null}
              {provenance === "manual" && calculated != null ? (
                <Button type="button" variant="outline" size="touch" onClick={() => { setSellMagnitude(String(calculated)); setProvenance("calculated"); }}>Reset to calculated sell</Button>
              ) : null}
            </>
          ) : null}
          {kind === "no_cost" ? <p className="text-sm text-muted-foreground">This is a documented no-cost change. It is not a missing price.</p> : null}
          {formError ? <p role="alert" className="text-sm">{formError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={props.onClose} disabled={props.pending}>Cancel</Button>
            <Button type="submit" size="touch" disabled={props.pending}>{props.pending ? "Saving…" : "Save item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditExistingItem(props: {
  itemId: string;
  items: InternalVariation["revisions"][number]["items"];
  currency: string;
  defaultMarginPercent: number;
  scopeLines: VariationScopeLineOption[];
  workAreas: VariationWorkAreaOption[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: ItemSavePayload) => void;
}) {
  const item = props.items.find((row) => row.id === props.itemId);
  if (!item) return null;
  const pair = item.substitutionGroupId ? props.items.filter((row) => row.substitutionGroupId === item.substitutionGroupId) : [];
  const remove = pair.find((row) => row.itemType === "omission");
  const add = pair.find((row) => row.itemType === "addition");
  const paired = Boolean(remove && add);
  const provenance = readProvenance(item.internalMetadata, item.itemType, item.unitSell);
  const storedMargin = item.internalMetadata.targetMarginPercent;
  const margin = typeof storedMargin === "number" ? String(storedMargin) : String(props.defaultMarginPercent);
  return (
    <ItemDialog
      title="Edit item"
      currency={props.currency}
      defaultMarginPercent={props.defaultMarginPercent}
      scopeLines={props.scopeLines}
      workAreas={props.workAreas}
      pending={props.pending}
      onClose={props.onClose}
      onSave={props.onSave}
      initial={{
        kind: paired ? "substitution" : item.itemType === "no_cost_scope_change" ? "no_cost" : item.itemType,
        lockedType: paired,
        description: item.clientDescription,
        removeDescription: remove?.clientDescription ?? "",
        addDescription: add?.clientDescription ?? "",
        quantity: String(item.quantity),
        unit: item.unit,
        sellMagnitude: magnitudeFromSignedUnit(item.unitSell) == null ? "" : String(magnitudeFromSignedUnit(item.unitSell)),
        removeMagnitude: magnitudeFromSignedUnit(remove?.unitSell ?? null) == null ? "" : String(magnitudeFromSignedUnit(remove?.unitSell ?? null)),
        addMagnitude: magnitudeFromSignedUnit(add?.unitSell ?? null) == null ? "" : String(magnitudeFromSignedUnit(add?.unitSell ?? null)),
        costMagnitude: magnitudeFromSignedUnit(item.unitCost) == null ? "" : String(magnitudeFromSignedUnit(item.unitCost)),
        margin,
        provenance,
        scopeId: item.snapshotLineId ?? "",
        workAreaId: item.workAreaId ?? "",
        removeId: remove?.id,
        addId: add?.id,
        itemId: item.id,
        substitutionGroupId: item.substitutionGroupId,
        sortOrder: item.sortOrder,
      }}
    />
  );
}

function DeleteItemDialog(props: { pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete item?</DialogTitle>
          <DialogDescription>This removes the item from the draft. A substitution removes both sides.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="touch" onClick={props.onClose}>Cancel</Button>
          <Button type="button" variant="destructive" size="touch" disabled={props.pending} onClick={props.onConfirm}>{props.pending ? "Deleting…" : "Delete item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: { id: string; label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input id={props.id} inputMode={props.numeric ? "decimal" : undefined} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-3"><dt>{props.label}</dt><dd className="tabular-nums">{props.value}</dd></div>;
}

function itemBadge(itemType: VariationItemType): string {
  if (itemType === "addition") return "Addition";
  if (itemType === "omission") return "Omission";
  return "No-cost";
}

function sumLines(items: ReadonlyArray<{ lineSellAdjustmentExGst: number | null }>): number | null {
  if (items.some((item) => item.lineSellAdjustmentExGst == null)) return null;
  return items.reduce((sum, item) => sum + (item.lineSellAdjustmentExGst ?? 0), 0);
}

function groupNet(group: ReturnType<typeof groupItems>[number]): number {
  if (group.kind === "single") return group.item.lineSellAdjustmentExGst ?? 0;
  return (group.remove.lineSellAdjustmentExGst ?? 0) + (group.add.lineSellAdjustmentExGst ?? 0);
}

function groupItems(items: InternalVariation["revisions"][number]["items"]) {
  const used = new Set<string>();
  const groups: Array<
    | { kind: "single"; item: (typeof items)[number] }
    | { kind: "pair"; remove: (typeof items)[number]; add: (typeof items)[number] }
  > = [];
  for (const item of items) {
    if (used.has(item.id)) continue;
    if (item.substitutionGroupId) {
      const pair = items.filter((row) => row.substitutionGroupId === item.substitutionGroupId);
      const remove = pair.find((row) => row.itemType === "omission");
      const add = pair.find((row) => row.itemType === "addition");
      if (remove && add) {
        used.add(remove.id);
        used.add(add.id);
        groups.push({ kind: "pair", remove, add });
        continue;
      }
    }
    used.add(item.id);
    groups.push({ kind: "single", item });
  }
  return groups;
}
