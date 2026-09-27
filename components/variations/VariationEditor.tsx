"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
  issueVariationRevision,
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
  VARIATION_OMISSION_HELP,
  VARIATION_PRICING_REQUIRED_ACTION,
  VARIATION_PRICING_REQUIRED_LABEL,
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

function readProvenance(
  metadata: Record<string, unknown>,
  itemType: string,
  unitSell: number | null
): CommercialProvenance {
  const value = metadata.sellProvenance;
  if (value === "calculated" || value === "manual" || value === "no_cost" || value === "pricing_required") {
    return value;
  }
  if (itemType === "no_cost_scope_change") return "no_cost";
  if (unitSell == null) return "pricing_required";
  return "manual";
}

export function VariationEditor(props: EditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const current =
    props.variation.revisions.find((revision) => revision.status !== "superseded") ??
    props.variation.revisions[props.variation.revisions.length - 1];
  const viewing =
    props.variation.revisions.find((revision) => revision.id === props.viewRevisionId) ?? current;
  const draft = current?.status === "draft" && viewing?.id === current.id;
  const historical = viewing != null && current != null && viewing.id !== current.id;

  const readiness = useMemo(() => {
    if (!current) return { ready: false, blockers: ["Add at least one Variation item."] };
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

  const documentModel = useMemo(() => {
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
    const baselineMoney = {
      currency: props.baseline.currency,
      gstRate: props.baseline.gstRate,
      taxTreatment: props.baseline.taxTreatment,
      sellExGst: props.baseline.sellExGst,
      gstAmount: props.baseline.gstAmount,
      sellInclGst: props.baseline.sellInclGst,
    };
    const currentContract = calculateRevisedContractValue({
      baseline: baselineMoney,
      revisions: accepted,
    });
    const proposed = proposedRevisedContract({
      baseline: baselineMoney,
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
    const issued = props.history.find((row) => row.id === viewing.id)?.issuedAt ?? null;
    return buildVariationDocument({
      companyName: props.companyName,
      clientName: props.clientName,
      projectTitle: props.projectTitle,
      siteAddress: props.siteAddress,
      variationNumber: props.variation.variationNumber,
      revisionNumber: viewing.revisionNumber,
      issuedAt: issued,
      status: viewing.status,
      title: viewing.title,
      summary: viewing.summary,
      clientNotes: viewing.clientNotes,
      currency: viewing.currency || props.baseline.currency,
      items: viewing.items,
      totals: {
        totalSellAdjustmentExGst: viewing.totalSellAdjustmentExGst,
        gstAdjustment: viewing.gstAdjustment,
        totalAdjustmentInclGst: viewing.totalAdjustmentInclGst,
      },
      baseline: props.baseline,
      currentContract: currentContract.ok
        ? {
            exGst: currentContract.value.revisedContractValueExGst,
            inclGst: currentContract.value.revisedContractValueInclGst,
          }
        : null,
      proposed,
    });
  }, [props, viewing]);

  const marginReadout = useMemo(() => {
    if (!viewing) return null;
    const prepared = prepareItemsForReadout(
      viewing.items.map((item) => ({
        itemType: item.itemType,
        clientDescription: item.clientDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitSell: item.unitSell,
        unitCost: item.unitCost,
        substitutionGroupId: item.substitutionGroupId,
      }))
    );
    return internalMarginReadout({
      currency: props.baseline.currency,
      items: prepared,
      totalsCost: viewing.totalDirectCostAdjustment,
      totalsSell: viewing.totalSellAdjustmentExGst,
    });
  }, [props.baseline.currency, viewing]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "That variation update is not available.");
        return;
      }
      setConfirmIssue(false);
      router.refresh();
    });
  }

  if (!current || !viewing || !documentModel) {
    return <p>That variation could not be found.</p>;
  }

  const currency = props.baseline.currency;
  const additionRows = viewing.items.filter((item) => item.itemType === "addition");
  const omissionRows = viewing.items.filter((item) => item.itemType === "omission");
  const additionTotal = additionRows.some((item) => item.lineSellAdjustmentExGst == null)
    ? null
    : additionRows.reduce((sum, item) => sum + (item.lineSellAdjustmentExGst ?? 0), 0);
  const omissionTotal = omissionRows.some((item) => item.lineSellAdjustmentExGst == null)
    ? null
    : omissionRows.reduce((sum, item) => sum + (item.lineSellAdjustmentExGst ?? 0), 0);

  return (
    <div data-variation-editor="true" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Variation {props.variation.variationNumber}
          </h1>
          <p className="text-sm text-muted-foreground">Revision {viewing.revisionNumber}</p>
        </div>
        <Badge variant="outline">
          {variationStatusLabel(viewing.status)}
          {historical ? " · Historical" : " · Current"}
        </Badge>
      </div>

      {historical ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">
          This is an earlier revision. It is not the current proposal.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-card px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-base font-semibold">Variation details</h2>
        <p className="mt-1 text-sm text-muted-foreground">{props.baseline.referenceLabel}</p>
        {draft ? (
          <HeaderForm
            variationId={props.variation.id}
            revisionId={current.id}
            title={current.title}
            summary={current.summary ?? ""}
            clientNotes={current.clientNotes ?? ""}
            internalNotes={current.internalNotes ?? ""}
            pending={pending}
            onSave={(input) =>
              run(() =>
                updateDraftVariation({
                  variationId: props.variation.id,
                  revisionId: current.id,
                  title: input.title,
                  summary: input.summary || null,
                  clientNotes: input.clientNotes || null,
                  internalNotes: input.internalNotes || null,
                  proposedTimeEffectDays: current.proposedTimeEffectDays,
                })
              )
            }
          />
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Title</dt><dd>{viewing.title}</dd></div>
            <div><dt className="text-muted-foreground">Summary</dt><dd>{viewing.summary || "—"}</dd></div>
          </dl>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Items</h2>
        {viewing.items.length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : null}
        {viewing.items.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {item.itemType === "addition"
                  ? "Addition"
                  : item.itemType === "omission"
                    ? "Omission"
                    : "No-cost change"}
              </p>
              <p className="tabular-nums">
                {item.lineSellAdjustmentExGst == null
                  ? VARIATION_PRICING_REQUIRED_LABEL
                  : formatSignedAdjustment(item.lineSellAdjustmentExGst, currency)}
              </p>
            </div>
            <p className="mt-1">{item.clientDescription}</p>
            <p className="mt-1 text-muted-foreground">
              {provenanceLabel(readProvenance(item.internalMetadata, item.itemType, item.unitSell))}
              {item.itemType === "omission" ? ` · ${VARIATION_OMISSION_HELP}` : ""}
            </p>
            {draft && viewing.id === current.id ? (
              <ItemPriceEditor
                description={item.clientDescription}
                itemType={item.itemType}
                quantity={item.quantity}
                unit={item.unit}
                unitSell={item.unitSell}
                unitCost={item.unitCost}
                workAreaId={item.workAreaId}
                snapshotLineId={item.snapshotLineId}
                sortOrder={item.sortOrder}
                substitutionGroupId={item.substitutionGroupId}
                pending={pending}
                onDelete={() =>
                  run(() =>
                    deleteDraftVariationItem({
                      variationId: props.variation.id,
                      revisionId: current.id,
                      itemId: item.id,
                    })
                  )
                }
                onSave={(next) =>
                  run(() =>
                    updateDraftVariationItem({
                      variationId: props.variation.id,
                      revisionId: current.id,
                      itemId: item.id,
                      itemType: item.itemType,
                      clientDescription: next.description,
                      workAreaId: item.workAreaId,
                      snapshotLineId: item.snapshotLineId,
                      stableComponentKey: null,
                      quantity: item.quantity,
                      unit: item.unit,
                      unitCost: next.unitCost,
                      unitSell: next.unitSell,
                      sortOrder: item.sortOrder,
                      clientInclusion: item.clientInclusion,
                      clientExclusion: item.clientExclusion,
                      substitutionGroupId: item.substitutionGroupId,
                      internalMetadata: { sellProvenance: next.provenance },
                    })
                  )
                }
              />
            ) : null}
          </article>
        ))}
        {draft ? (
          <ItemComposer
            pending={pending}
            currency={currency}
            defaultMarginPercent={props.defaultMarginPercent}
            scopeLines={props.scopeLines}
            workAreas={props.workAreas}
            sortOrder={viewing.items.length}
            onAdd={(payload) =>
              run(async () => {
                if (payload.kind === "single") {
                  return addDraftVariationItem({
                    variationId: props.variation.id,
                    revisionId: current.id,
                    ...payload.item,
                  });
                }
                const groupId = crypto.randomUUID();
                const first = await addDraftVariationItem({
                  variationId: props.variation.id,
                  revisionId: current.id,
                  ...payload.remove,
                  substitutionGroupId: groupId,
                  sortOrder: payload.remove.sortOrder,
                });
                if (!first.ok || !first.itemId) return first;
                const second = await addDraftVariationItem({
                  variationId: props.variation.id,
                  revisionId: current.id,
                  ...payload.add,
                  substitutionGroupId: groupId,
                });
                if (!second.ok) {
                  await deleteDraftVariationItem({
                    variationId: props.variation.id,
                    revisionId: current.id,
                    itemId: first.itemId,
                  });
                }
                return second;
              })
            }
          />
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-4" data-variation-commercial-summary="true">
        <h2 className="text-base font-semibold">Commercial summary</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt>Addition total</dt><dd className="tabular-nums">{additionTotal == null ? "—" : formatSignedAdjustment(additionTotal, currency)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Omission total</dt><dd className="tabular-nums">{omissionTotal == null ? "—" : formatSignedAdjustment(omissionTotal, currency)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Net adjustment ex GST</dt><dd className="tabular-nums">{viewing.totalSellAdjustmentExGst == null ? "—" : formatSignedAdjustment(viewing.totalSellAdjustmentExGst, currency)}</dd></div>
          <div className="flex justify-between gap-4"><dt>GST</dt><dd className="tabular-nums">{viewing.gstAdjustment == null ? "—" : formatSignedAdjustment(viewing.gstAdjustment, currency)}</dd></div>
          <div className="flex justify-between gap-4 font-medium"><dt>Adjustment incl GST</dt><dd className="tabular-nums">{viewing.totalAdjustmentInclGst == null ? "—" : formatSignedAdjustment(viewing.totalAdjustmentInclGst, currency)}</dd></div>
          {marginReadout?.costLabel ? <div className="flex justify-between gap-4"><dt>Internal COST adjustment</dt><dd>{marginReadout.costLabel}</dd></div> : null}
          {marginReadout?.grossProfitLabel ? <div className="flex justify-between gap-4"><dt>Gross profit</dt><dd>{marginReadout.grossProfitLabel}</dd></div> : null}
          {marginReadout?.marginLabel ? <div className="flex justify-between gap-4"><dt>Effective margin</dt><dd>{marginReadout.marginLabel}</dd></div> : null}
        </dl>
        {marginReadout?.note ? <p className="mt-2 text-sm text-muted-foreground">{marginReadout.note}</p> : null}
        <p className="mt-3 text-sm">
          Proposed revised contract if this Variation were accepted:{" "}
          <span className="font-medium">{documentModel.proposedInclLabel}</span>
          <span className="text-muted-foreground"> (proposed, not accepted)</span>
        </p>
      </section>

      {draft ? (
        <section className="rounded-2xl border bg-card p-4" data-variation-readiness="true">
          <h2 className="text-base font-semibold">Ready to issue</h2>
          {readiness.ready ? (
            <p className="mt-2 text-sm">This revision is ready to issue.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {readiness.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{VARIATION_PRICING_REQUIRED_ACTION}</p>
          <Button className="mt-3" type="button" disabled={!readiness.ready || pending} onClick={() => setConfirmIssue(true)}>
            Issue revision
          </Button>
        </section>
      ) : null}

      {current.status === "issued" && !historical ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              createVariationRevision({
                variationId: props.variation.id,
                revisionId: current.id,
              })
            )
          }
        >
          Create new revision
        </Button>
      ) : null}

      <section>
        <h2 className="text-base font-semibold">Revision history</h2>
        <ul className="mt-2 space-y-2">
          {props.history.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <span>
                Revision {row.revisionNumber} · {row.title} · {row.statusLabel} · {row.label}
                {row.issuedAt ? ` · Issued ${row.issuedAt}` : ""}
                {row.netExGst != null ? ` · ${formatSignedAdjustment(row.netExGst, currency)}` : ""}
              </span>
              <Link className="underline" href={`/app/projects/${props.projectId}/variations/${props.variation.id}?revision=${row.id}`}>
                View
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Client document</h2>
          <Link
            className="text-sm underline"
            href={`/app/projects/${props.projectId}/variations/${props.variation.id}/print?revision=${viewing.id}`}
          >
            Print / Save as PDF
          </Link>
        </div>
        <VariationDocument model={documentModel} />
      </section>

      <Dialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <DialogContent data-issue-confirm="true">
          <DialogHeader>
            <DialogTitle>Issue this revision</DialogTitle>
            <DialogDescription>
              {issueConfirmationCopy(props.variation.variationNumber, current.revisionNumber)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmIssue(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() =>
                run(() =>
                  issueVariationRevision({
                    variationId: props.variation.id,
                    revisionId: current.id,
                  })
                )
              }
            >
              Issue revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderForm(props: {
  variationId: string;
  revisionId: string;
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
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave({ title, summary, clientNotes, internalNotes });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="variation-title">Title</Label>
        <Input id="variation-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="variation-summary">Client-facing summary</Label>
        <textarea
          id="variation-summary"
          className="min-h-20 rounded-xl border bg-background px-3 py-2 text-sm"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="variation-client-notes">Client-facing notes</Label>
        <textarea
          id="variation-client-notes"
          className="min-h-16 rounded-xl border bg-background px-3 py-2 text-sm"
          value={clientNotes}
          onChange={(event) => setClientNotes(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5" data-variation-internal-notes="true">
        <Label htmlFor="variation-internal-notes">Internal notes</Label>
        <textarea
          id="variation-internal-notes"
          className="min-h-16 rounded-xl border bg-background px-3 py-2 text-sm"
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Internal notes stay off the client document.</p>
      </div>
      <Button type="submit" disabled={props.pending}>Save details</Button>
      <span className="sr-only">{props.variationId}{props.revisionId}</span>
    </form>
  );
}

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
  substitutionGroupId: null;
  internalMetadata: { sellProvenance: CommercialProvenance };
};

function ItemComposer(props: {
  pending: boolean;
  currency: string;
  defaultMarginPercent: number;
  scopeLines: VariationScopeLineOption[];
  workAreas: VariationWorkAreaOption[];
  sortOrder: number;
  onAdd: (
    payload:
      | { kind: "single"; item: SingleItem }
      | { kind: "substitution"; remove: SingleItem; add: SingleItem }
  ) => void;
}) {
  const [kind, setKind] = useState<"addition" | "omission" | "substitution" | "no_cost">("addition");
  const [description, setDescription] = useState("");
  const [removeDescription, setRemoveDescription] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("item");
  const [sellMagnitude, setSellMagnitude] = useState("");
  const [removeMagnitude, setRemoveMagnitude] = useState("");
  const [addMagnitude, setAddMagnitude] = useState("");
  const [costMagnitude, setCostMagnitude] = useState("");
  const [margin, setMargin] = useState(String(props.defaultMarginPercent));
  const [provenance, setProvenance] = useState<CommercialProvenance>("pricing_required");
  const [scopeId, setScopeId] = useState("");
  const [workAreaId, setWorkAreaId] = useState("");

  const scope = props.scopeLines.find((line) => line.id === scopeId) ?? null;
  const parsedSell = sellMagnitude.trim() === "" ? null : Number(sellMagnitude);
  const parsedCost = costMagnitude.trim() === "" ? null : Number(costMagnitude);
  const parsedMargin = Number(margin);
  const calculated =
    parsedCost != null && Number.isFinite(parsedCost)
      ? sellFromKnownCost(parsedCost, parsedMargin)
      : null;
  const shownSell =
    kind === "no_cost"
      ? 0
      : provenance === "calculated" && calculated != null
        ? calculated
        : parsedSell;
  const signedPreview =
    kind === "substitution"
      ? null
      : signedUnitFromMagnitude(kind === "no_cost" ? "no_cost_scope_change" : kind, shownSell);

  function selectedWorkArea(): string | null {
    if (scope?.workAreaId) return scope.workAreaId;
    return workAreaId || null;
  }

  function singleItem(
    itemType: VariationItemType,
    clientDescription: string,
    magnitude: number | null,
    sortOrder: number,
    nextProvenance: CommercialProvenance
  ): SingleItem | null {
    const unitSell =
      itemType === "no_cost_scope_change" ? 0 : signedUnitFromMagnitude(itemType, magnitude);
    if (itemType !== "no_cost_scope_change" && magnitude != null && unitSell == null) return null;
    const unitCost =
      itemType === "no_cost_scope_change" || parsedCost == null
        ? null
        : signedUnitFromMagnitude(itemType, parsedCost);
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
      substitutionGroupId: null,
      internalMetadata: { sellProvenance: nextProvenance },
    };
  }

  return (
    <form
      className="rounded-2xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind === "substitution") {
          const remove = singleItem("omission", removeDescription, Number(removeMagnitude), props.sortOrder, "manual");
          const add = singleItem("addition", addDescription, Number(addMagnitude), props.sortOrder + 1, "manual");
          if (!remove || !add || remove.unitSell == null || add.unitSell == null) return;
          props.onAdd({ kind: "substitution", remove, add });
          return;
        }
        const itemType: VariationItemType = kind === "no_cost" ? "no_cost_scope_change" : kind;
        const nextProvenance: CommercialProvenance =
          kind === "no_cost" ? "no_cost" : provenance === "calculated" && calculated != null ? "calculated" : provenance;
        const magnitude = kind === "no_cost" ? 0 : shownSell;
        const item = singleItem(itemType, description, magnitude, props.sortOrder, nextProvenance);
        if (!item) return;
        props.onAdd({ kind: "single", item });
      }}
    >
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="item-kind">Type</Label>
          <select
            id="item-kind"
            className="h-9 rounded-xl border bg-background px-3 text-sm"
            value={kind}
            onChange={(event) => {
              const next = event.target.value as typeof kind;
              setKind(next);
              setProvenance(next === "no_cost" ? "no_cost" : "pricing_required");
            }}
          >
            <option value="addition">Addition</option>
            <option value="omission">Omission</option>
            <option value="substitution">Substitution</option>
            <option value="no_cost">No-cost change</option>
          </select>
        </div>
        {kind === "substitution" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="remove-description">Remove</Label>
              <Input id="remove-description" value={removeDescription} onChange={(event) => setRemoveDescription(event.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="remove-amount">Amount to remove</Label>
              <Input id="remove-amount" inputMode="decimal" value={removeMagnitude} onChange={(event) => setRemoveMagnitude(event.target.value)} required />
              <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-description">Add</Label>
              <Input id="add-description" value={addDescription} onChange={(event) => setAddDescription(event.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-amount">Amount to add</Label>
              <Input id="add-amount" inputMode="decimal" value={addMagnitude} onChange={(event) => setAddMagnitude(event.target.value)} required />
            </div>
          </>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="item-description">Description</Label>
            <Input id="item-description" value={description} onChange={(event) => setDescription(event.target.value)} required />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="item-scope">Accepted scope</Label>
          <select id="item-scope" className="h-9 rounded-xl border bg-background px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
            <option value="">New scope</option>
            {props.scopeLines.map((line) => (
              <option key={line.id} value={line.id}>
                {(line.workAreaName ? `${line.workAreaName} · ` : "") + line.description}
              </option>
            ))}
          </select>
          {scope ? (
            <p className="text-xs text-muted-foreground">
              Accepted {scope.quantity ?? "—"} {scope.unit ?? ""} {scope.acceptedSellLabel ? `· ${scope.acceptedSellLabel}` : ""}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-area">Work area</Label>
          <select id="item-area" className="h-9 rounded-xl border bg-background px-3 text-sm" value={workAreaId} onChange={(event) => setWorkAreaId(event.target.value)}>
            <option value="">No work area</option>
            {props.workAreas.map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>
        {kind !== "substitution" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="item-qty">Quantity</Label>
              <Input id="item-qty" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-unit">Unit</Label>
              <Input id="item-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
            </div>
          </div>
        ) : null}
        {kind !== "no_cost" && kind !== "substitution" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="item-cost">Internal COST</Label>
              <Input
                id="item-cost"
                inputMode="decimal"
                value={costMagnitude}
                onChange={(event) => {
                  setCostMagnitude(event.target.value);
                  if (provenance !== "manual") setProvenance("calculated");
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-margin">Target margin %</Label>
              <Input
                id="item-margin"
                inputMode="decimal"
                value={margin}
                onChange={(event) => {
                  setMargin(event.target.value);
                  if (provenance !== "manual") setProvenance("calculated");
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-sell">{kind === "omission" ? "Amount to remove" : "Client sell"}</Label>
              <Input
                id="item-sell"
                inputMode="decimal"
                value={provenance === "calculated" && calculated != null ? String(calculated) : sellMagnitude}
                onChange={(event) => {
                  setSellMagnitude(event.target.value);
                  setProvenance(event.target.value.trim() === "" ? "pricing_required" : "manual");
                }}
              />
              {kind === "omission" ? <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p> : null}
              <p className="text-xs text-muted-foreground">{provenanceLabel(provenance)}</p>
              {signedPreview != null ? (
                <p className="text-sm tabular-nums" data-omission-sign={kind === "omission" ? "negative" : "positive"}>
                  {formatSignedAdjustment(signedPreview, props.currency)}
                </p>
              ) : (
                <p className="text-sm">{VARIATION_PRICING_REQUIRED_LABEL}</p>
              )}
              {provenance === "manual" && calculated != null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSellMagnitude(String(calculated));
                    setProvenance("calculated");
                  }}
                >
                  Reset to calculated sell
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
        {kind === "no_cost" ? (
          <p className="text-sm text-muted-foreground">This is a documented no-cost change. It is not a missing price.</p>
        ) : null}
        <Button type="submit" disabled={props.pending}>Add item</Button>
      </div>
    </form>
  );
}

function ItemPriceEditor(props: {
  description: string;
  itemType: VariationItemType;
  quantity: number;
  unit: string;
  unitSell: number | null;
  unitCost: number | null;
  workAreaId: string | null;
  snapshotLineId: string | null;
  sortOrder: number;
  substitutionGroupId: string | null;
  pending: boolean;
  onDelete: () => void;
  onSave: (next: {
    description: string;
    unitSell: number | null;
    unitCost: number | null;
    provenance: CommercialProvenance;
  }) => void;
}) {
  const initial = magnitudeFromSignedUnit(props.unitSell);
  const [description, setDescription] = useState(props.description);
  const [amount, setAmount] = useState(initial == null ? "" : String(initial));
  if (props.itemType === "no_cost_scope_change") {
    return (
      <form
        className="mt-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave({
            description,
            unitSell: 0,
            unitCost: null,
            provenance: "no_cost",
          });
        }}
      >
        <Label htmlFor={`edit-desc-${props.sortOrder}`}>Description</Label>
        <Input id={`edit-desc-${props.sortOrder}`} value={description} onChange={(event) => setDescription(event.target.value)} required />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={props.pending}>Save item</Button>
          <Button type="button" variant="outline" size="sm" disabled={props.pending} onClick={props.onDelete}>
            Delete
          </Button>
        </div>
      </form>
    );
  }
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const magnitude = amount.trim() === "" ? null : Number(amount);
        props.onSave({
          description,
          unitSell: signedUnitFromMagnitude(props.itemType, magnitude),
          unitCost: props.unitCost,
          provenance: magnitude == null ? "pricing_required" : "manual",
        });
      }}
    >
      <Label htmlFor={`edit-desc-${props.sortOrder}`}>Description</Label>
      <Input id={`edit-desc-${props.sortOrder}`} value={description} onChange={(event) => setDescription(event.target.value)} required />
      <Label htmlFor={`edit-amount-${props.sortOrder}`}>
        {props.itemType === "omission" ? "Amount to remove" : "Client sell"}
      </Label>
      <Input
        id={`edit-amount-${props.sortOrder}`}
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={props.pending}>Save item</Button>
        <Button type="button" variant="outline" size="sm" disabled={props.pending} onClick={props.onDelete}>
          Delete
        </Button>
      </div>
      <span className="sr-only">
        {props.quantity}{props.unit}{props.workAreaId}{props.snapshotLineId}{props.sortOrder}{props.substitutionGroupId}
      </span>
    </form>
  );
}
