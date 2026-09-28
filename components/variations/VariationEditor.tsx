"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VariationDeliveryPanel } from "@/components/variations/VariationDeliveryPanel";
import { VariationSupportingFiles } from "@/components/variations/VariationSupportingFiles";
import { listVariationAttachments } from "@/lib/variations/attachment-actions";
import {
  formatAttachmentSize,
  variationAttachmentKind,
  variationAttachmentTypeLabel,
} from "@/lib/variations/attachment-files";
import { VariationDocument } from "@/components/variations/VariationDocument";
import { VariationRatePicker, variationRateSourceText, type VariationRateChoice } from "@/components/variations/VariationRatePicker";
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
import {
  addDraftVariationItem,
  convertDraftVariationItemToSimple,
  createVariationRevision,
  deleteDraftVariationItem,
  deleteUnissuedDraftVariation,
  issueVariationRevision,
  withdrawIssuedVariation,
  loadVariation,
  refreshVariationComponentRate,
  saveDraftVariationBuildUp,
  searchVariationComponentRates,
  updateDraftVariation,
  updateDraftVariationItem,
} from "@/lib/variations/actions";
import {
  aggregateComponentCost,
  approximateClientUnitRate,
  calculateRevisedContractValue,
  componentLineCost,
  type InternalVariation,
  type VariationCostCategory,
  type VariationItemType,
  type VariationRateSource,
  variationRateSourceLabel,
  type VariationPricingMode,
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
import { VARIATION_IDENTITY_SEND_BLOCK, VARIATION_QUOTE_REFERENCE_UNAVAILABLE, type VariationDocumentIdentity } from "@/lib/variations/document-identity";
import type {
  VariationAttachmentView,
  VariationBaselineView,
  VariationDeliveryAttempt,
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
  clientEmail: string | null;
  siteAddress: string | null;
  history: VariationRevisionHistoryRow[];
  deliveries: VariationDeliveryAttempt[];
  documentIdentities: Record<string, VariationDocumentIdentity | null>;
  withdrawalReason: string | null;
  acceptedRevisions: AcceptedMoney[];
  viewRevisionId: string | null;
  startPreview?: boolean;
  startWithdraw?: boolean;
  attachments: VariationAttachmentView[];
};

type BuildUpDraft = {
  confirmModeChange: boolean;
  targetMarginPercent: number;
  sellProvenance: "calculated" | "manual" | "pricing_required";
  manualSellTotal: number | null;
  components: Array<{
    id: string | null;
    category: VariationCostCategory;
    description: string;
    quantity: number;
    unit: string;
    unitCost: number | null;
    sortOrder: number;
    canonicalKey: string | null;
    clearRate: boolean;
  }>;
};

type ItemSavePayload =
  | { kind: "single"; item: SingleItem; itemId?: string; buildUp: BuildUpDraft | null; convertToSimple: boolean }
  | {
      kind: "substitution";
      remove: SingleItem;
      add: SingleItem;
      removeId?: string;
      addId?: string;
      removeBuildUp: BuildUpDraft | null;
      addBuildUp: BuildUpDraft | null;
      removeConvert: boolean;
      addConvert: boolean;
    };

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
  const [confirmWithdraw, setConfirmWithdraw] = useState(props.startWithdraw === true && props.variation.status === "issued");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [previewOpen, setPreviewOpen] = useState(props.startPreview === true);
  const [itemEditor, setItemEditor] = useState<"add" | string | null>(null);
  const [attachments, setAttachments] = useState(props.attachments);
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
        pricingMode: item.pricingMode,
        authoritativeLineSell: item.lineSellAdjustmentExGst,
        authoritativeLineCost: item.lineCostAdjustment,
      })),
      clientAttachments: attachments
        .filter((file) => file.revisionId === current.id && file.visibility === "client")
        .map((file) => ({ uploadStatus: file.uploadStatus, objectConfirmed: file.objectConfirmed })),
    });
  }, [attachments, current]);

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
        pricingMode: item.pricingMode,
        authoritativeLineSell: item.lineSellAdjustmentExGst,
        authoritativeLineCost: item.lineCostAdjustment,
      }))),
      totalsCost: viewing.totalDirectCostAdjustment,
      totalsSell: viewing.totalSellAdjustmentExGst,
    });
  }, [props.baseline.currency, viewing]);

  async function reload(): Promise<void> {
    const [loaded, files] = await Promise.all([
      loadVariation({ variationId: props.variation.id }),
      listVariationAttachments({ projectId: props.projectId, variationId: props.variation.id }),
    ]);
    if (!loaded.ok) return;
    setVariation(loaded.variation);
    if (files.ok) setAttachments(files.attachments);
    setHistory((previous) =>
      loaded.variation.revisions.map((revision) => ({
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        title: revision.title,
        status: revision.status,
        statusLabel: variationStatusLabel(revision.status),
        issuedAt: previous.find((row) => row.id === revision.id)?.issuedAt ?? null,
        issuedAtIso: previous.find((row) => row.id === revision.id)?.issuedAtIso ?? null,
        withdrawnAt: previous.find((row) => row.id === revision.id)?.withdrawnAt ?? null,
        netExGst: revision.totalSellAdjustmentExGst,
        label: revision.status === "superseded" ? "Historical" : "Current",
      }))
    );
  }

  async function persistSide(input: {
    itemId?: string;
    item: SingleItem;
    buildUp: BuildUpDraft | null;
    convertToSimple: boolean;
  }): Promise<{ ok: boolean; error?: string; itemId?: string }> {
    if (!current) return { ok: false, error: "That variation update is not available." };
    if (input.buildUp) {
      if (input.item.itemType !== "addition" && input.item.itemType !== "omission") {
        return { ok: false, error: "Check this variation item and try again." };
      }
      return saveDraftVariationBuildUp({
        variationId: variation.id,
        revisionId: current.id,
        itemId: input.itemId ?? null,
        confirmModeChange: input.buildUp.confirmModeChange,
        itemType: input.item.itemType,
        clientDescription: input.item.clientDescription,
        workAreaId: input.item.workAreaId,
        snapshotLineId: input.item.snapshotLineId,
        quantity: input.item.quantity,
        unit: input.item.unit,
        sortOrder: input.item.sortOrder,
        substitutionGroupId: input.item.substitutionGroupId,
        targetMarginPercent: input.buildUp.targetMarginPercent,
        sellProvenance: input.buildUp.sellProvenance,
        manualSellTotal: input.buildUp.manualSellTotal,
        components: input.buildUp.components,
      });
    }
    if (input.convertToSimple && input.itemId) {
      return convertDraftVariationItemToSimple({
        variationId: variation.id,
        revisionId: current.id,
        itemId: input.itemId,
        confirmModeChange: true,
        ...input.item,
      });
    }
    if (input.itemId) {
      return updateDraftVariationItem({
        variationId: variation.id,
        revisionId: current.id,
        itemId: input.itemId,
        ...input.item,
      });
    }
    return addDraftVariationItem({ variationId: variation.id, revisionId: current.id, ...input.item });
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

  async function confirmDeleteDraft(): Promise<void> {
    if (lock.current || !current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const result = await deleteUnissuedDraftVariation({
      projectId: props.projectId,
      variationId: variation.id,
      revisionId: current.id,
    });
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "That variation update is not available.");
      return;
    }
    setConfirmDelete(false);
    router.refresh();
    router.push(`/app/projects/${props.projectId}/variations?notice=draft-deleted`);
  }

  async function submitWithdraw(): Promise<void> {
    if (lock.current || !current) return;
    if (!withdrawReason.trim()) {
      setError("Enter a withdrawal reason.");
      return;
    }
    lock.current = true;
    setPending(true);
    setError(null);
    const result = await withdrawIssuedVariation({
      projectId: props.projectId,
      variationId: variation.id,
      revisionId: current.id,
      reason: withdrawReason.trim(),
    });
    if (!result.ok) {
      lock.current = false;
      setPending(false);
      setError(result.error ?? "This Variation can’t be withdrawn.");
      return;
    }
    setConfirmWithdraw(false);
    router.refresh();
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{variationStatusLabel(viewing.status)}</Badge>
            <span className="text-sm text-muted-foreground">{historical ? "Historical revision" : "Current revision"}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-11 min-h-11 items-center rounded-xl border px-3 text-sm">
            Actions
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
            <DropdownMenuItem className="min-h-11" onClick={() => setPreviewOpen(true)}>View client document</DropdownMenuItem>
            {current.status === "issued" && !historical ? (
              <DropdownMenuItem className="min-h-11" onClick={() => void run(() => createVariationRevision({ variationId: variation.id, revisionId: current.id }))}>
                Create new revision
              </DropdownMenuItem>
            ) : null}
            {current.status === "issued" && !historical ? (
              <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => setConfirmWithdraw(true)}>
                Withdraw Variation
              </DropdownMenuItem>
            ) : null}
            {canDelete && draft ? (
              <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete draft
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {viewing.status === "withdrawn" ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm">
          Withdrawn{history.find((row) => row.id === viewing.id)?.withdrawnAt ? ` ${history.find((row) => row.id === viewing.id)?.withdrawnAt}` : ""}.
          {props.withdrawalReason ? ` Reason: ${props.withdrawalReason}` : ""} This reason stays off the client document.
        </p>
      ) : null}
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
              <p className="mt-1">{lead.quantity} {lead.unit} · {provenanceLabel(readProvenance(lead.internalMetadata, lead.itemType, lead.lineSellAdjustmentExGst == null ? lead.unitSell : lead.lineSellAdjustmentExGst))}</p>
              {(group.kind === "pair" ? [group.remove, group.add] : [lead]).map((row) => row.pricingMode === "build_up" ? (
                <div key={row.id} className="mt-2 min-w-0 space-y-1 text-muted-foreground">
                  <p>{row.components.length} internal cost {row.components.length === 1 ? "component" : "components"}</p>
                  <p>{row.lineCostAdjustment == null ? "Internal cost incomplete" : `${row.itemType === "omission" ? "COST reduction" : "COST"} ${formatSignedAdjustment(row.lineCostAdjustment, currency)}`}</p>
                  <p>{row.lineSellAdjustmentExGst == null ? VARIATION_PRICING_REQUIRED_LABEL : `Client sell total, ex GST ${formatSignedAdjustment(row.lineSellAdjustmentExGst, currency)}`}</p>
                  {row.lineSellAdjustmentExGst != null && row.quantity > 0 ? (
                    <p>Approx. client rate per unit {formatSignedAdjustment(approximateClientUnitRate(Math.abs(row.lineSellAdjustmentExGst), row.quantity) ?? 0, currency).replace(/^[+−]/, "")}/{row.unit}</p>
                  ) : null}
                  {row.lineCostAdjustment == null && row.lineSellAdjustmentExGst != null ? <p>Internal cost is incomplete. Margin and profit are not available.</p> : null}
                  <details className="min-w-0">
                    <summary className="min-h-11 cursor-pointer py-2">Internal cost build-up</summary>
                    <div className="grid gap-2">
                      {row.components.map((component) => (
                        <div key={component.id} className="min-w-0 rounded-xl border px-3 py-2">
                          <p className="break-words">{component.category} · {component.description}</p>
                          <p>{component.quantity} {component.unit} · {component.unitCost == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(component.lineCost ?? 0, currency)}</p>
                          <p className="text-xs text-muted-foreground">{variationRateSourceLabel(component.costSource)}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ) : null)}
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

      {viewing ? (
        <VariationSupportingFiles
          projectId={props.projectId}
          variationId={variation.id}
          revisionId={viewing.id}
          editable={draft}
          items={viewing.items.map((item) => ({ id: item.id, clientDescription: item.clientDescription }))}
          attachments={attachments}
          onChange={setAttachments}
        />
      ) : null}

      <section className="rounded-2xl border bg-card p-4" data-variation-commercial-summary="true">
        <h2 className="text-base font-semibold">Commercial summary</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="Addition total" value={additionTotal == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(additionTotal, currency)} />
          <Row label="Omission total" value={omissionTotal == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(omissionTotal, currency)} />
          <Row label="Net adjustment ex GST" value={viewing.totalSellAdjustmentExGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(viewing.totalSellAdjustmentExGst, currency)} />
          <Row label="GST" value={viewing.gstAdjustment == null ? "Not calculated yet" : formatSignedAdjustment(viewing.gstAdjustment, currency)} />
          <Row label="Adjustment incl GST" value={viewing.totalAdjustmentInclGst == null ? VARIATION_PRICING_REQUIRED_LABEL : formatSignedAdjustment(viewing.totalAdjustmentInclGst, currency)} />
          {marginReadout?.costLabel ? <Row label="Known internal cost adjustment" value={marginReadout.costLabel} /> : null}
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
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" role="alert">
              {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          )}
          <Button className="mt-3" size="touch" type="button" disabled={!readiness.ready || pending} onClick={() => setConfirmIssue(true)}>Issue revision</Button>
        </section>
      ) : null}

      {current.status === "issued" && !historical ? (
        <VariationDeliveryPanel
          projectId={props.projectId}
          variationId={variation.id}
          revisionId={current.id}
          variationNumber={variation.variationNumber}
          revisionNumber={current.revisionNumber}
          title={current.title}
          adjustmentInclGst={current.totalAdjustmentInclGst}
          currency={currency}
          recipientName={props.documentIdentities[current.id]?.clientName || props.clientName}
          recipientEmail={props.clientEmail}
          attempts={props.deliveries}
          blockedMessage={props.documentIdentities[current.id]?.available ? null : `${VARIATION_QUOTE_REFERENCE_UNAVAILABLE}. ${VARIATION_IDENTITY_SEND_BLOCK}`}
        />
      ) : null}

      {current.status === "issued" && !historical ? (
        <Button type="button" size="touch" disabled={pending} onClick={() => void run(() => createVariationRevision({ variationId: variation.id, revisionId: current.id }))}>
          {pending ? "Creating revision…" : "Create new revision"}
        </Button>
      ) : null}

      <section>
        <h2 className="text-base font-semibold">Revision history</h2>
        <ul className="mt-2 space-y-2">
          {history.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 break-words">Revision {row.revisionNumber} · {row.title} · {row.statusLabel} · {row.label}{row.issuedAt ? ` · Issued ${row.issuedAt}` : ""}{row.withdrawnAt ? ` · Withdrawn ${row.withdrawnAt}` : ""}{row.netExGst != null ? ` · ${formatSignedAdjustment(row.netExGst, currency)}` : ""}</span>
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
        issuedAt={history.find((row) => row.id === viewing.id)?.issuedAtIso ?? null}
        identity={props.documentIdentities[viewing.id] ?? null}
        attachments={attachments.filter((file) => file.revisionId === viewing.id && file.visibility === "client" && file.uploadStatus === "ready")}
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
          rateContext={{ projectId: props.projectId, variationId: variation.id, revisionId: current.id, onReload: reload }}
          onClose={() => setItemEditor(null)}
          onSave={(payload) =>
            void run(async () => {
              if (payload.kind === "single") {
                return persistSide({ item: payload.item, buildUp: payload.buildUp, convertToSimple: false });
              }
              const groupId = crypto.randomUUID();
              const first = await persistSide({
                item: { ...payload.remove, substitutionGroupId: groupId },
                buildUp: payload.removeBuildUp,
                convertToSimple: false,
              });
              if (!first.ok || !first.itemId) return first;
              const second = await persistSide({
                item: { ...payload.add, substitutionGroupId: groupId },
                buildUp: payload.addBuildUp,
                convertToSimple: false,
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
            void run(() => deleteDraftVariationItem({
              variationId: variation.id,
              revisionId: current.id,
              itemId: itemEditor.slice("delete:".length),
            })).then((ok) => { if (ok) setItemEditor(null); });
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
          rateContext={{ projectId: props.projectId, variationId: variation.id, revisionId: current.id, onReload: reload }}
          onClose={() => setItemEditor(null)}
          onSave={(payload) =>
            void run(async () => {
              if (payload.kind === "single") {
                return persistSide({
                  itemId: payload.itemId,
                  item: payload.item,
                  buildUp: payload.buildUp,
                  convertToSimple: payload.convertToSimple,
                });
              }
              const first = await persistSide({
                itemId: payload.removeId,
                item: payload.remove,
                buildUp: payload.removeBuildUp,
                convertToSimple: payload.removeConvert,
              });
              if (!first.ok) return first;
              return persistSide({
                itemId: payload.addId,
                item: payload.add,
                buildUp: payload.addBuildUp,
                convertToSimple: payload.addConvert,
              });
            }).then((ok) => { if (ok) setItemEditor(null); })
          }
        />
      ) : null}

      <Dialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <DialogContent data-issue-confirm="true" className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue this revision</DialogTitle>
            <DialogDescription>{issueConfirmationCopy(variation.variationNumber, current.revisionNumber, attachments.filter((file) => file.revisionId === current.id && file.visibility === "client" && file.uploadStatus === "ready").length)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => setConfirmIssue(false)}>Keep editing</Button>
            <Button type="button" size="touch" autoFocus disabled={pending || !readiness.ready} onClick={() => void run(() => issueVariationRevision({ variationId: variation.id, revisionId: current.id }), true).then((ok) => { if (ok) setConfirmIssue(false); })}>
              {pending ? "Issuing…" : "Issue revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdraw Variation {variation.variationNumber}?</DialogTitle>
            <DialogDescription>This keeps the issued document and revision history, but removes this Variation from pending contract value. It cannot be accepted unless a new revision is created.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="withdraw-reason">Withdrawal reason</Label>
            <textarea
              id="withdraw-reason"
              className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
            />
          </div>
          {error ? <p role="alert" className="text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => setConfirmWithdraw(false)} disabled={pending}>Cancel</Button>
            <Button type="button" variant="destructive" size="touch" disabled={pending} onClick={() => void submitWithdraw()}>
              {pending ? "Withdrawing…" : "Withdraw Variation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!pending) setConfirmDelete(open); }}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete draft Variation?</DialogTitle>
            <DialogDescription>This will permanently remove this unissued draft and its items. This action can’t be undone. Variation numbers are not reused.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button type="button" variant="destructive" size="touch" disabled={pending} onClick={() => void confirmDeleteDraft()}>
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
  identity: VariationDocumentIdentity | null;
  attachments: VariationAttachmentView[];
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
    identity: props.identity,
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
    supportingFiles: props.attachments.map((file) => ({
      fileId: file.id,
      displayFilename: file.displayFilename,
      caption: file.caption,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      typeLabel: variationAttachmentTypeLabel(file.mimeType),
      sizeLabel: formatAttachmentSize(file.byteSize),
      kind: variationAttachmentKind(file.mimeType),
      viewUrl: null,
      downloadUrl: null,
    })),
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

const COST_CATEGORY_LABELS: Record<VariationCostCategory, string> = {
  material: "Material",
  labour: "Labour",
  subcontract: "Subcontract",
  plant: "Plant / equipment",
  allowance: "Allowance",
  other: "Other",
};

type CostDraft = {
  key: string;
  id: string | null;
  category: VariationCostCategory;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  costSource: VariationRateSource;
  canonicalRateKey: string | null;
  sourceLabel: string | null;
  detail: string | null;
  sourceRecordId: string | null;
  derivedBenchmark: boolean;
  adoptRate: boolean;
  clearRate: boolean;
};

type RateContext = {
  projectId: string;
  variationId: string;
  revisionId: string;
  itemId: string | null;
  onReload: () => Promise<void>;
};

function blankCostDraft(): CostDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    category: "material",
    description: "",
    quantity: "1",
    unit: "",
    unitCost: "",
    costSource: "missing",
    canonicalRateKey: null,
    sourceLabel: null,
    detail: null,
    sourceRecordId: null,
    derivedBenchmark: false,
    adoptRate: false,
    clearRate: false,
  };
}

type ComponentEditorActions = { save: () => void; cancel: () => void };

function componentMoney(currency: string, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return VARIATION_PRICING_REQUIRED_LABEL;
  return formatSignedAdjustment(value, currency).replace(/^\+/, "");
}

function ComponentEditor(props: {
  editorId: string;
  rows: CostDraft[];
  currency: string;
  catalogues: Partial<Record<VariationCostCategory, VariationRateChoice[]>>;
  onCatalogue: (category: VariationCostCategory, rates: VariationRateChoice[]) => void;
  onChange: (rows: CostDraft[]) => void;
  onPresence: (id: string, actions: ComponentEditorActions | null, task?: "add" | "edit") => void;
  onListOpenChange?: (open: boolean) => void;
  hidden?: boolean;
  rateContext?: RateContext;
}) {
  const [draft, setDraft] = useState<CostDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPending, setPickerPending] = useState(false);
  const [pickerTruncated, setPickerTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const addCostRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [ratesAvailable, setRatesAvailable] = useState<boolean | null>(true);
  const [refreshKey, setRefreshKey] = useState<string | null>(null);
  const [refreshProposal, setRefreshProposal] = useState<{ current: number | null; proposed: number | null; label: string | null } | null>(null);
  const searchSerial = useRef(0);
  const actionsRef = useRef<ComponentEditorActions>({ save: () => {}, cancel: () => {} });

  async function probeCategory(category: VariationCostCategory): Promise<void> {
    if (category === "material" || category === "labour") {
      setRatesAvailable(true);
      return;
    }
    if (category === "other") {
      setRatesAvailable(false);
      return;
    }
    setRatesAvailable(null);
    const result = await searchVariationComponentRates({ category, unit: "", query: "" });
    if (!result.ok) {
      setRateError(result.error);
      setRatesAvailable(false);
      return;
    }
    setRatesAvailable(result.rates.length > 0);
  }

  function openEditor(row: CostDraft): void {
    const editing = props.rows.some((entry) => entry.key === row.key);
    setDraft({ ...row });
    setShowDescription(row.costSource !== "company_rate" && row.costSource !== "quotr_benchmark");
    setPickerOpen(false);
    setSearched(false);
    setPickerPending(false);
    setEditorError(null);
    setRateError(null);
    props.onPresence(props.editorId, actionsRef.current, editing ? "edit" : "add");
    void probeCategory(row.category);
  }

  function chooseManual(row: CostDraft): void {
    const hadRate = row.canonicalRateKey != null || row.costSource === "company_rate" || row.costSource === "quotr_benchmark";
    setDraft({
      ...row,
      costSource: row.unitCost.trim() === "" ? "missing" : "manual",
      canonicalRateKey: null,
      sourceLabel: null,
      detail: null,
      sourceRecordId: null,
      derivedBenchmark: false,
      adoptRate: false,
      clearRate: hadRate || row.clearRate,
    });
    setShowDescription(true);
    setPickerOpen(false);
  }

  async function searchRates(category: VariationCostCategory): Promise<void> {
    if (props.catalogues[category]) {
      setPickerPending(false);
      setSearched(true);
      setRateError(null);
      return;
    }
    const serial = searchSerial.current + 1;
    searchSerial.current = serial;
    setPickerPending(true);
    setRateError(null);
    const result = await searchVariationComponentRates({ category, unit: "", catalogue: true });
    if (serial !== searchSerial.current) return;
    setPickerPending(false);
    if (!result.ok) {
      setRateError(result.error);
      setPickerTruncated(false);
      return;
    }
    props.onCatalogue(category, result.rates);
    setPickerTruncated(result.truncated);
    setSearched(true);
  }

  function saveComponent(): void {
    if (!draft) return;
    const quantity = Number(draft.quantity);
    if (!draft.description.trim()) {
      setEditorError("Enter a component description.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setEditorError("Enter a component quantity.");
      return;
    }
    if (!draft.unit.trim()) {
      setEditorError("Enter a unit.");
      return;
    }
    const usingRate = draft.costSource === "company_rate" || draft.costSource === "quotr_benchmark";
    if (pickerOpen && !usingRate) {
      setEditorError("Choose a rate or enter the cost manually.");
      return;
    }
    const exists = props.rows.some((row) => row.key === draft.key);
    pendingFocus.current = draft.key;
    props.onChange(exists ? props.rows.map((row) => (row.key === draft.key ? draft : row)) : [...props.rows, draft]);
    setDraft(null);
    setPickerOpen(false);
    setEditorError(null);
    props.onPresence(props.editorId, null);
  }

  function cancelComponent(): void {
    pendingFocus.current = draft && props.rows.some((row) => row.key === draft.key) ? draft.key : "add";
    setDraft(null);
    setPickerOpen(false);
    setEditorError(null);
    setRateError(null);
    props.onPresence(props.editorId, null);
  }

  useEffect(() => {
    actionsRef.current.save = saveComponent;
    actionsRef.current.cancel = cancelComponent;
  });

  useEffect(() => {
    const editorId = props.editorId;
    const onPresence = props.onPresence;
    return () => onPresence(editorId, null);
  }, [props.editorId, props.onPresence]);

  const openedKey = draft?.key ?? null;
  useEffect(() => {
    if (!openedKey) return;
    document.getElementById(`component-category-${openedKey}`)?.focus();
  }, [openedKey]);

  useEffect(() => {
    if (draft || !pendingFocus.current) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "add") addCostRef.current?.focus();
    else document.getElementById(`cost-card-${target}`)?.focus();
  }, [draft]);

  const rateLocked = draft != null && (draft.costSource === "company_rate" || draft.costSource === "quotr_benchmark");

  return (
    <div hidden={props.hidden} className="grid min-w-0 gap-3">
      {draft ? null : props.rows.length === 0 ? (
        <div className="grid gap-1">
          <p className="text-sm">No costs added yet.</p>
          <p className="text-sm text-muted-foreground">Add material, labour, subcontract or another cost.</p>
        </div>
      ) : null}
      {draft ? null : props.rows.map((row) => {
        const quantity = Number(row.quantity);
        const unitCost = row.unitCost.trim() === "" ? null : Number(row.unitCost);
        const line = componentLineCost(quantity, unitCost != null && Number.isFinite(unitCost) ? unitCost : null);
        const source = row.costSource === "company_rate" || row.costSource === "quotr_benchmark"
          ? variationRateSourceText({ badge: row.costSource === "company_rate" ? "Company Rate" : "Quotr benchmark", derived: row.derivedBenchmark })
          : variationRateSourceLabel(row.costSource);
        return (
          <div id={`cost-card-${row.key}`} key={row.key} tabIndex={-1} className="grid min-w-0 gap-2 rounded-xl border p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-sm font-medium">{row.description || "Untitled component"}</p>
            <p className="text-sm text-muted-foreground">{COST_CATEGORY_LABELS[row.category]} · {source}</p>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{row.quantity} {row.unit || "unit"} × {componentMoney(props.currency, unitCost != null && Number.isFinite(unitCost) ? unitCost : null)}</span>
              <span className="font-medium tabular-nums">{componentMoney(props.currency, line)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="touch" onClick={() => openEditor(row)}>Edit</Button>
              <Button type="button" variant="destructive" size="touch" onClick={() => props.onChange(props.rows.filter((entry) => entry.key !== row.key))}>Remove</Button>
            </div>
            {props.rateContext?.itemId && row.id && row.canonicalRateKey ? (
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => {
                  const context = props.rateContext;
                  if (!context?.itemId || !row.id) return;
                  void (async () => {
                    setRateError(null);
                    const preview = await refreshVariationComponentRate({
                      projectId: context.projectId,
                      variationId: context.variationId,
                      revisionId: context.revisionId,
                      itemId: context.itemId,
                      componentId: row.id,
                      confirm: false,
                    });
                    if (!preview.ok) {
                      setRateError(preview.error);
                      return;
                    }
                    setRefreshKey(row.key);
                    setRefreshProposal({
                      current: preview.currentCost ?? null,
                      proposed: preview.proposedCost ?? null,
                      label: preview.sourceLabel ?? null,
                    });
                  })();
                }}
              >
                Refresh rate
              </Button>
            ) : null}
            {refreshKey === row.key && refreshProposal ? (
              <div className="grid gap-2 rounded-xl border p-3 text-sm">
                <p>
                  {refreshProposal.current === refreshProposal.proposed
                    ? "This rate is already current."
                    : `Update this component from ${componentMoney(props.currency, refreshProposal.current)} to ${componentMoney(props.currency, refreshProposal.proposed)}?`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {refreshProposal.current !== refreshProposal.proposed ? (
                    <Button
                      type="button"
                      size="touch"
                      onClick={() => {
                        const context = props.rateContext;
                        if (!context?.itemId || !row.id) return;
                        void (async () => {
                          const applied = await refreshVariationComponentRate({
                            projectId: context.projectId,
                            variationId: context.variationId,
                            revisionId: context.revisionId,
                            itemId: context.itemId,
                            componentId: row.id,
                            confirm: true,
                          });
                          if (!applied.ok || applied.unitCost == null) {
                            setRateError(applied.ok ? "That rate is no longer available. Choose another rate or enter the cost manually." : applied.error);
                            return;
                          }
                          props.onChange(props.rows.map((entry) => entry.key === row.key ? {
                            ...entry,
                            unitCost: String(applied.unitCost),
                            costSource: applied.proposedSource ?? applied.costSource,
                            sourceLabel: applied.sourceLabel ?? entry.sourceLabel,
                            adoptRate: false,
                            clearRate: false,
                          } : entry));
                          setRefreshKey(null);
                          setRefreshProposal(null);
                          await context.onReload();
                        })();
                      }}
                    >
                      Update this component
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="touch" onClick={() => { setRefreshKey(null); setRefreshProposal(null); }}>Close</Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {rateError && !draft ? <p role="alert" className="text-sm">{rateError}</p> : null}
      {!draft ? (
        <Button ref={addCostRef} type="button" variant="outline" size="touch" onClick={() => openEditor(blankCostDraft())}>+ Add cost</Button>
      ) : (
        <div className="grid min-w-0 gap-3">
          <button type="button" className="min-h-11 w-fit px-1 text-left text-sm font-medium" onClick={cancelComponent}>← Back to item</button>
          <div className="grid gap-1.5">
            <Label htmlFor={`component-category-${draft.key}`}>Cost category</Label>
            <select
              id={`component-category-${draft.key}`}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
              value={draft.category}
              onChange={(event) => {
                const category = event.target.value as VariationCostCategory;
                setDraft({
                  ...draft,
                  category,
                  description: "",
                  unit: "",
                  unitCost: "",
                  costSource: "missing",
                  canonicalRateKey: null,
                  sourceLabel: null,
                  detail: null,
                  sourceRecordId: null,
                  derivedBenchmark: false,
                  adoptRate: false,
                  clearRate: draft.clearRate || draft.canonicalRateKey != null,
                });
                setPickerOpen(false);
                setSearched(false);
                void probeCategory(category);
              }}
            >
              {Object.entries(COST_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {ratesAvailable === null ? <p className="text-sm text-muted-foreground">Loading rates…</p> : ratesAvailable === false ? (
            <div className="grid gap-2">
              <p className="text-sm">No compatible saved rates are available for this category. Enter the cost manually.</p>
              <Button type="button" variant="outline" size="touch" onClick={() => chooseManual(draft)}>Enter manually</Button>
            </div>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Cost source</legend>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`cost-source-${draft.key}`}
                  checked={!pickerOpen && draft.costSource !== "company_rate" && draft.costSource !== "quotr_benchmark"}
                  onChange={() => chooseManual(draft)}
                />
                Enter manually
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`cost-source-${draft.key}`}
                  checked={pickerOpen || draft.costSource === "company_rate" || draft.costSource === "quotr_benchmark"}
                  onChange={() => {
                    setPickerOpen(true);
                    setRateError(null);
                    void searchRates(draft.category);
                  }}
                />
                Select from Rates
              </label>
            </fieldset>
          )}
          {pickerOpen ? (
            <VariationRatePicker
              category={draft.category}
              currency={props.currency}
              selectedKey={draft.canonicalRateKey}
              rates={props.catalogues[draft.category] ?? []}
              pending={pickerPending && !props.catalogues[draft.category]}
              searched={searched || Boolean(props.catalogues[draft.category])}
              truncated={pickerTruncated}
              error={rateError}
              onListOpenChange={props.onListOpenChange}
              onApplied={(patch) => {
                setDraft({
                  ...draft,
                  description: patch.description,
                  unit: patch.unit,
                  unitCost: patch.unitCost,
                  costSource: patch.costSource,
                  canonicalRateKey: patch.canonicalRateKey,
                  sourceLabel: patch.sourceLabel,
                  detail: patch.detail,
                  sourceRecordId: patch.sourceRecordId,
                  derivedBenchmark: patch.derived,
                  adoptRate: true,
                  clearRate: false,
                });
                setShowDescription(false);
                setPickerOpen(false);
                setEditorError(null);
              }}
            />
          ) : null}
          {rateLocked && !pickerOpen ? (
            <div className="grid gap-2 rounded-xl border bg-background p-3 text-sm">
              <p className="font-medium">{draft.description}</p>
              <p>{[draft.detail, draft.unit].filter(Boolean).join(" · ")}</p>
              <p>
                {componentMoney(props.currency, Number(draft.unitCost))} / {draft.unit} · {variationRateSourceText({ badge: draft.costSource === "company_rate" ? "Company Rate" : "Quotr benchmark", derived: draft.derivedBenchmark })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="touch" onClick={() => { setPickerOpen(true); setRateError(null); void searchRates(draft.category); }}>Change rate</Button>
                <Button type="button" variant="outline" size="touch" onClick={() => chooseManual(draft)}>Enter manually</Button>
              </div>
            </div>
          ) : null}
          {pickerOpen ? null : rateLocked && !showDescription ? (
            <Button type="button" variant="outline" size="touch" onClick={() => setShowDescription(true)}>Edit internal description</Button>
          ) : (
            <Field id={`component-description-${draft.key}`} label="Internal description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
          )}
          <Field id={`component-qty-${draft.key}`} label="Component quantity" value={draft.quantity} onChange={(value) => setDraft({ ...draft, quantity: value })} numeric />
          {rateLocked || pickerOpen ? null : (
            <div className="grid gap-1.5">
              <Label htmlFor={`component-unit-${draft.key}`}>Unit</Label>
              <Input
                id={`component-unit-${draft.key}`}
                className="h-11"
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              />
            </div>
          )}
          {rateLocked || pickerOpen ? null : (
            <Field
              id={`component-cost-${draft.key}`}
              label="Internal COST per unit"
              value={draft.unitCost}
              numeric
              onChange={(value) => setDraft({
                ...draft,
                unitCost: value,
                costSource: value.trim() === "" ? "missing" : "manual",
                canonicalRateKey: null,
                sourceLabel: null,
                sourceRecordId: null,
                derivedBenchmark: false,
                adoptRate: false,
                clearRate: true,
              })}
            />
          )}
          <p className="text-sm">
            Component COST {componentMoney(props.currency, componentLineCost(Number(draft.quantity), draft.unitCost.trim() === "" ? null : Number(draft.unitCost)))}
          </p>
          {editorError ? <p role="alert" className="text-sm">{editorError}</p> : null}
          {rateError && !pickerOpen ? <p role="alert" className="text-sm">{rateError}</p> : null}
        </div>
      )}
    </div>
  );
}

function draftsFromComponents(components: InternalVariation["revisions"][number]["items"][number]["components"]): CostDraft[] {
  return components.map((component) => ({
    key: component.id,
    id: component.id,
    category: component.category,
    description: component.description,
    quantity: String(component.quantity),
    unit: component.unit,
    unitCost: component.unitCost == null ? "" : String(component.unitCost),
    costSource: component.costSource,
    canonicalRateKey: component.canonicalRateKey,
    sourceLabel: component.sourceLabel,
    detail: null,
    sourceRecordId: component.sourceRecordId,
    derivedBenchmark: false,
    adoptRate: false,
    clearRate: false,
  }));
}

function buildUpFromDrafts(rows: CostDraft[], marginPercent: number, provenance: BuildUpDraft["sellProvenance"], manualSellTotal: number | null, confirmModeChange: boolean): BuildUpDraft | null {
  const components = rows.map((row, index) => {
    const quantity = Number(row.quantity);
    const unitCost = row.unitCost.trim() === "" ? null : Number(row.unitCost);
    return {
      id: row.id,
      category: row.category,
      description: row.description.trim(),
      quantity,
      unit: row.unit.trim(),
      unitCost: unitCost != null && Number.isFinite(unitCost) ? unitCost : null,
      sortOrder: index,
      canonicalKey: row.adoptRate ? row.canonicalRateKey : null,
      clearRate: row.clearRate && !row.adoptRate,
    };
  });
  if (components.some((row) => !row.description || !row.unit || !Number.isFinite(row.quantity) || row.quantity <= 0)) return null;
  const cost = aggregateComponentCost(components.map((row) => componentLineCost(row.quantity, row.unitCost)));
  const nextProvenance = provenance === "manual" ? "manual" : cost == null ? "pricing_required" : "calculated";
  return {
    confirmModeChange,
    targetMarginPercent: marginPercent,
    sellProvenance: nextProvenance,
    manualSellTotal: nextProvenance === "manual" ? manualSellTotal : null,
    components,
  };
}

function PricingMethodCards(props: {
  labelledBy: string;
  value: VariationPricingMode;
  onChange: (mode: VariationPricingMode) => void;
}) {
  const options = [
    { value: "simple" as const, title: "Enter a total price", detail: "Enter the internal cost or client sell directly." },
    { value: "build_up" as const, title: "Build from materials and labour", detail: "Combine material, labour and other internal costs." },
  ];
  return (
    <div role="radiogroup" aria-labelledby={props.labelledBy} className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = props.value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`min-h-11 rounded-xl border px-3 py-3 text-left ${selected ? "border-foreground bg-muted" : "bg-background"}`}
            onClick={() => props.onChange(option.value)}
          >
            <span className="block text-sm font-medium">{option.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
          </button>
        );
      })}
    </div>
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
    pricingMode?: VariationPricingMode;
    components?: CostDraft[];
    sellTotal?: string;
    removePricingMode?: VariationPricingMode;
    addPricingMode?: VariationPricingMode;
    removeComponents?: CostDraft[];
    addComponents?: CostDraft[];
    removeSellTotal?: string;
    addSellTotal?: string;
  };
  onClose: () => void;
  onSave: (payload: ItemSavePayload) => void;
  rateContext?: Omit<RateContext, "itemId">;
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
  const [pricingMode, setPricingMode] = useState<VariationPricingMode>(initial?.pricingMode ?? "simple");
  const [components, setComponents] = useState<CostDraft[]>(initial?.components ?? []);
  const [sellTotal, setSellTotal] = useState(initial?.sellTotal ?? "");
  const [modeConfirmed, setModeConfirmed] = useState(false);
  const componentEditors = useRef(new Map<string, ComponentEditorActions>());
  const [rateCatalogues, setRateCatalogues] = useState<Partial<Record<VariationCostCategory, VariationRateChoice[]>>>({});
  const rememberRateCatalogue = useCallback((category: VariationCostCategory, rates: VariationRateChoice[]) => {
    setRateCatalogues((current) => (current[category] ? current : { ...current, [category]: rates }));
  }, []);
  const rateListOpen = useRef(false);
  const setRateListOpen = useCallback((open: boolean) => {
    rateListOpen.current = open;
  }, []);
  const [activeComponentEditor, setActiveComponentEditor] = useState<string | null>(null);
  const [componentTask, setComponentTask] = useState<"add" | "edit" | null>(null);
  const setComponentPresence = useCallback((id: string, actions: ComponentEditorActions | null, task?: "add" | "edit") => {
    if (actions) componentEditors.current.set(id, actions);
    else componentEditors.current.delete(id);
    setActiveComponentEditor((current) => {
      if (actions) return id;
      if (current !== id) return current;
      return componentEditors.current.keys().next().value ?? null;
    });
    setComponentTask((current) => (actions ? task ?? "add" : componentEditors.current.size > 0 ? current : null));
  }, []);
  const [removeMode, setRemoveMode] = useState<VariationPricingMode>(initial?.removePricingMode ?? "simple");
  const [addMode, setAddMode] = useState<VariationPricingMode>(initial?.addPricingMode ?? "simple");
  const [removeComponents, setRemoveComponents] = useState<CostDraft[]>(initial?.removeComponents ?? []);
  const [addComponents, setAddComponents] = useState<CostDraft[]>(initial?.addComponents ?? []);
  const [removeSellTotal, setRemoveSellTotal] = useState(initial?.removeSellTotal ?? "");
  const [addSellTotal, setAddSellTotal] = useState(initial?.addSellTotal ?? "");
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
    <Dialog open onOpenChange={(open, details) => {
      if (!open && details.reason === "escape-key" && rateListOpen.current) {
        details.cancel();
        return;
      }
      if (!open) props.onClose();
    }}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(calc(100vw-0.75rem),840px)] max-w-[calc(100%-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[840px]">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-14 sm:px-6">
          <DialogTitle>{activeComponentEditor ? (componentTask === "edit" ? "Edit cost" : "Add cost") : props.title}</DialogTitle>
          <DialogDescription>Prices are per unit and ex GST. Internal costs and rate sources stay off the client document.</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (activeComponentEditor) {
            componentEditors.current.get(activeComponentEditor)?.save();
            return;
          }
          if (props.pending) return;
          const modeChanged = Boolean(initial) && pricingMode !== (initial?.pricingMode ?? "simple");
          if (modeChanged && !modeConfirmed) {
            setFormError("Confirm the pricing method change before saving.");
            return;
          }
          if (kind === "substitution") {
            const remove = singleItem("omission", removeDescription, removeMode === "build_up" ? null : Number(removeMagnitude), initial?.sortOrder ?? 0, "manual", initial?.substitutionGroupId ?? null);
            const add = singleItem("addition", addDescription, addMode === "build_up" ? null : Number(addMagnitude), (initial?.sortOrder ?? 0) + 1, "manual", initial?.substitutionGroupId ?? null);
            const removeBuildUp = removeMode === "build_up" ? buildUpFromDrafts(removeComponents, Number.isFinite(parsedMargin) ? parsedMargin : props.defaultMarginPercent, removeSellTotal.trim() === "" ? "calculated" : "manual", removeSellTotal.trim() === "" ? null : Number(removeSellTotal), (initial?.removePricingMode ?? "simple") !== "build_up") : null;
            const addBuildUp = addMode === "build_up" ? buildUpFromDrafts(addComponents, Number.isFinite(parsedMargin) ? parsedMargin : props.defaultMarginPercent, addSellTotal.trim() === "" ? "calculated" : "manual", addSellTotal.trim() === "" ? null : Number(addSellTotal), (initial?.addPricingMode ?? "simple") !== "build_up") : null;
            if (!remove || !add || !removeDescription.trim() || !addDescription.trim() || (removeMode === "simple" && remove.unitSell == null) || (addMode === "simple" && add.unitSell == null) || (removeMode === "build_up" && !removeBuildUp) || (addMode === "build_up" && !addBuildUp)) {
              setFormError("Complete both sides of the substitution.");
              return;
            }
            props.onSave({
              kind: "substitution",
              remove,
              add,
              removeId: initial?.removeId,
              addId: initial?.addId,
              removeBuildUp,
              addBuildUp,
              removeConvert: removeMode === "simple" && (initial?.removePricingMode ?? "simple") === "build_up",
              addConvert: addMode === "simple" && (initial?.addPricingMode ?? "simple") === "build_up",
            });
            return;
          }
          const itemType: VariationItemType = kind === "no_cost" ? "no_cost_scope_change" : kind;
          if (pricingMode === "build_up" && itemType !== "no_cost_scope_change") {
            const manualTotal = sellTotal.trim() === "" ? null : Number(sellTotal);
            const draft = buildUpFromDrafts(
              components,
              Number.isFinite(parsedMargin) ? parsedMargin : props.defaultMarginPercent,
              provenance === "manual" ? "manual" : "calculated",
              manualTotal != null && Number.isFinite(manualTotal) ? manualTotal : null,
              modeChanged,
            );
            const item = singleItem(itemType, description, null, initial?.sortOrder ?? 0, "pricing_required", null);
            if (!item || !draft || !description.trim()) {
              setFormError("Add a description and complete each cost component before saving.");
              return;
            }
            if (draft.sellProvenance === "manual" && (manualTotal == null || !Number.isFinite(manualTotal) || manualTotal <= 0)) {
              setFormError("Enter the client sell total before saving.");
              return;
            }
            props.onSave({ kind: "single", item, itemId: initial?.itemId, buildUp: draft, convertToSimple: false });
            return;
          }
          const nextProvenance: CommercialProvenance = kind === "no_cost" ? "no_cost" : provenance === "calculated" && calculated != null ? "calculated" : provenance;
          const item = singleItem(itemType, description, kind === "no_cost" ? 0 : shownSell, initial?.sortOrder ?? 0, nextProvenance, null);
          if (!item || !description.trim()) {
            setFormError("Add a description before saving this item.");
            return;
          }
          props.onSave({
            kind: "single",
            item,
            itemId: initial?.itemId,
            buildUp: null,
            convertToSimple: modeChanged && pricingMode === "simple",
          });
        }}>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6">
          <section className="grid gap-3" aria-labelledby="variation-item-scope">
          {activeComponentEditor ? null : (
          <div className="grid gap-3">
          <h2 id="variation-item-scope" className="text-xs font-semibold tracking-wide text-muted-foreground">Scope change</h2>
          <div className="grid gap-2">
            <Label id="item-kind-label">Change type</Label>
            <div id="item-kind" role="radiogroup" aria-labelledby="item-kind-label" className="grid gap-2 sm:grid-cols-3">
              {([
                ["addition", "Addition", "Adds scope and contract value"],
                ["omission", "Omission", "Removes scope and reduces contract value"],
                ["substitution", "Substitution", "Replaces accepted scope"],
              ] as const).map(([value, label, help]) => {
                const selected = kind === value;
                const disabled = Boolean(initial?.lockedType) || (value === "substitution" && Boolean(initial) && !initial?.lockedType);
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-left ${selected ? "border-foreground bg-muted" : "bg-background"} disabled:opacity-60`}
                    onClick={() => { setKind(value); setProvenance("pricing_required"); }}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{help}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-pressed={kind === "no_cost"}
              disabled={Boolean(initial?.lockedType)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm ${kind === "no_cost" ? "border-foreground bg-muted" : "bg-background"}`}
              onClick={() => { setKind("no_cost"); setProvenance("no_cost"); }}
            >
              No-cost scope change
            </button>
            {initial?.lockedType ? <p className="text-xs text-muted-foreground">Delete this substitution and add it again to change the type.</p> : null}
            {!initial?.lockedType && initial ? <p className="text-xs text-muted-foreground">To make this a substitution, delete it and add a substitution.</p> : null}
          </div>
          {kind === "substitution" ? (
            <>
              <Field id="remove-description" label="Remove" value={removeDescription} onChange={setRemoveDescription} />
              <p id="remove-pricing-mode" className="text-sm font-medium">Pricing method</p>
              <PricingMethodCards labelledBy="remove-pricing-mode" value={removeMode} onChange={setRemoveMode} />
              {removeMode === "simple" ? <Field id="remove-amount" label="Amount to remove" value={removeMagnitude} onChange={setRemoveMagnitude} numeric /> : (
                <Field id="remove-sell-total" label="Client sell total, ex GST" value={removeSellTotal} onChange={setRemoveSellTotal} numeric />
              )}
              <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p>
              <Field id="add-description" label="Add" value={addDescription} onChange={setAddDescription} />
              <p id="add-pricing-mode" className="text-sm font-medium">Pricing method</p>
              <PricingMethodCards labelledBy="add-pricing-mode" value={addMode} onChange={setAddMode} />
              {addMode === "simple" ? <Field id="add-amount" label="Amount to add" value={addMagnitude} onChange={setAddMagnitude} numeric /> : (
                <Field id="add-sell-total" label="Client sell total, ex GST" value={addSellTotal} onChange={setAddSellTotal} numeric />
              )}
            </>
          ) : <Field id="item-description" label="Client-facing description" value={description} onChange={setDescription} />}
          <div className="grid gap-1.5">
            <Label htmlFor="item-scope">Link to accepted scope (optional)</Label>
            <select id="item-scope" className="h-11 rounded-xl border bg-background px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
              <option value="">New scope / no linked item</option>
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
          <details className="rounded-xl border px-3 py-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Client quantity and unit</summary>
            <div className="grid gap-3 pb-2 sm:grid-cols-2">
              <Field id="item-qty" label="Quantity" value={quantity} onChange={setQuantity} numeric />
              <Field id="item-unit" label="Unit" value={unit} onChange={setUnit} />
            </div>
          </details>
          </div>
          )}
          {kind === "substitution" && removeMode === "build_up" ? (
            <ComponentEditor editorId="remove" hidden={activeComponentEditor != null && activeComponentEditor !== "remove"} rows={removeComponents} currency={props.currency} catalogues={rateCatalogues} onCatalogue={rememberRateCatalogue} onChange={setRemoveComponents} onPresence={setComponentPresence} onListOpenChange={setRateListOpen} rateContext={props.rateContext ? { ...props.rateContext, itemId: initial?.removeId ?? null } : undefined} />
          ) : null}
          {kind === "substitution" && addMode === "build_up" ? (
            <ComponentEditor editorId="add" hidden={activeComponentEditor != null && activeComponentEditor !== "add"} rows={addComponents} currency={props.currency} catalogues={rateCatalogues} onCatalogue={rememberRateCatalogue} onChange={setAddComponents} onPresence={setComponentPresence} onListOpenChange={setRateListOpen} rateContext={props.rateContext ? { ...props.rateContext, itemId: initial?.addId ?? null } : undefined} />
          ) : null}
          </section>
          {activeComponentEditor || kind === "no_cost" || kind === "substitution" ? null : (
            <section className="grid gap-3" aria-labelledby="variation-item-pricing">
            <h2 id="variation-item-pricing" className="text-xs font-semibold tracking-wide text-muted-foreground">Pricing</h2>
            <div className="grid gap-2">
              <p id="item-pricing-mode" className="text-sm font-medium">Pricing method</p>
              <PricingMethodCards labelledBy="item-pricing-mode" value={pricingMode} onChange={(mode) => { setPricingMode(mode); setModeConfirmed(false); }} />
              {initial && pricingMode !== (initial.pricingMode ?? "simple") && !modeConfirmed ? (
                <div className="grid gap-2">
                  <p className="text-xs text-muted-foreground">
                    {pricingMode === "build_up"
                      ? "Changing to Build from costs does not turn the existing unit cost into components."
                      : "Changing to Simple price deletes the draft cost components."}
                  </p>
                  <Button type="button" variant="outline" size="touch" onClick={() => setModeConfirmed(true)}>Confirm pricing method change</Button>
                </div>
              ) : null}
            </div>
            {pricingMode === "simple" ? <div className="grid gap-3">
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
            </div> : null}
            </section>
          )}
          {kind !== "no_cost" && kind !== "substitution" && pricingMode === "build_up" ? (
            <section className="grid gap-3" aria-labelledby="variation-item-build-up">
            {activeComponentEditor ? null : (
              <div className="grid gap-3">
            <h2 id="variation-item-build-up" className="text-xs font-semibold tracking-wide text-muted-foreground">Cost build-up</h2>
              <Field id="item-margin" label="Target gross margin" value={margin} onChange={(value) => { setMargin(value); if (provenance !== "manual") setProvenance("calculated"); }} numeric />
              <p className="text-xs text-muted-foreground">Target margin is the gross margin used to calculate client sell from internal cost.</p>
              </div>
            )}
              <ComponentEditor editorId="item" hidden={activeComponentEditor != null && activeComponentEditor !== "item"} rows={components} currency={props.currency} catalogues={rateCatalogues} onCatalogue={rememberRateCatalogue} onChange={(rows) => { setComponents(rows); if (provenance !== "manual") setProvenance("calculated"); }} onPresence={setComponentPresence} onListOpenChange={setRateListOpen} rateContext={props.rateContext ? { ...props.rateContext, itemId: initial?.itemId ?? null } : undefined} />
            {activeComponentEditor ? null : (
              <div className="grid gap-3">
              {kind === "omission" ? <p className="text-xs text-muted-foreground">{VARIATION_OMISSION_HELP}</p> : null}
              {(() => {
                const cost = aggregateComponentCost(components.map((row) => componentLineCost(Number(row.quantity), row.unitCost.trim() === "" ? null : Number(row.unitCost))));
                const calculatedTotal = cost == null ? null : sellFromKnownCost(cost, parsedMargin);
                const total = provenance === "manual" && sellTotal.trim() !== "" ? Number(sellTotal) : calculatedTotal;
                const approx = total != null && Number.isFinite(total) ? approximateClientUnitRate(total, Number(quantity) || 1) : null;
                const signedCost = cost == null ? null : formatSignedAdjustment(kind === "omission" ? -cost : cost, props.currency);
                const signedSell = total == null || !Number.isFinite(total) ? null : formatSignedAdjustment(kind === "omission" ? -total : total, props.currency);
                return (
                  <>
                    {components.length === 0 ? <p className="text-sm">Add at least one cost.</p> : null}
                    {components.length > 0 && cost == null && provenance !== "manual" ? <p className="text-sm">Add the missing internal cost before saving this item.</p> : null}
                    {components.length > 0 && cost == null && provenance === "manual" ? <p className="text-sm">Internal cost is incomplete. Margin and profit are not available.</p> : null}
                    {cost != null && signedCost && signedSell ? <p className="text-sm">Internal COST {signedCost} · Client sell {signedSell} ex GST</p> : null}
                    {cost != null && signedSell ? <p className="text-sm">Calculated client sell, ex GST {signedSell}</p> : null}
                    {approx != null ? <p className="text-sm">Approx. client rate per unit {formatSignedAdjustment(approx, props.currency).replace(/^[+−]/, "")}</p> : null}
                  </>
                );
              })()}
              {provenance === "manual" ? (
                <>
                  <p className="text-sm">This client sell is a manual override.</p>
                  <Field id="item-sell-total" label="Client sell total, ex GST" value={sellTotal} onChange={(value) => { setSellTotal(value); setProvenance(value.trim() === "" ? "pricing_required" : "manual"); }} numeric />
                  <Button type="button" variant="outline" size="touch" onClick={() => { setSellTotal(""); setProvenance("calculated"); }}>Reset to calculated sell</Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="touch" onClick={() => {
                  const cost = aggregateComponentCost(components.map((row) => componentLineCost(Number(row.quantity), row.unitCost.trim() === "" ? null : Number(row.unitCost))));
                  const next = cost == null ? null : sellFromKnownCost(cost, parsedMargin);
                  setSellTotal(next == null ? "" : String(next));
                  setProvenance("manual");
                }}>Enter a manual client sell</Button>
              )}
              </div>
            )}
            </section>
          ) : null}
          {kind === "no_cost" ? <p className="text-sm text-muted-foreground">This is a documented no-cost change. It is not a missing price.</p> : null}
          </div>
          {formError ? <p role="alert" className="px-4 py-2 text-sm sm:px-6">{formError}</p> : null}
          <DialogFooter className="shrink-0 border-t bg-popover px-4 py-3 sm:px-6">
            {activeComponentEditor ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="touch" onClick={() => componentEditors.current.get(activeComponentEditor)?.cancel()}>Cancel</Button>
                <Button type="button" size="touch" onClick={() => componentEditors.current.get(activeComponentEditor)?.save()}>{componentTask === "edit" ? "Save cost" : "Add cost"}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="touch" onClick={props.onClose} disabled={props.pending}>Cancel</Button>
                <Button type="submit" size="touch" disabled={props.pending}>{props.pending ? "Saving…" : props.title === "Add item" ? "Add item" : "Save item"}</Button>
              </div>
            )}
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
  rateContext?: Omit<RateContext, "itemId">;
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
      rateContext={props.rateContext}
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
        pricingMode: item.pricingMode,
        components: draftsFromComponents(item.components),
        sellTotal: item.lineSellAdjustmentExGst == null ? "" : String(Math.abs(item.lineSellAdjustmentExGst)),
        removePricingMode: remove?.pricingMode ?? "simple",
        addPricingMode: add?.pricingMode ?? "simple",
        removeComponents: draftsFromComponents(remove?.components ?? []),
        addComponents: draftsFromComponents(add?.components ?? []),
        removeSellTotal: remove?.lineSellAdjustmentExGst == null ? "" : String(Math.abs(remove.lineSellAdjustmentExGst)),
        addSellTotal: add?.lineSellAdjustmentExGst == null ? "" : String(Math.abs(add.lineSellAdjustmentExGst)),
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
