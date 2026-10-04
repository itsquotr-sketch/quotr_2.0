"use client";

import { useMemo, useState } from "react";
import { PrepareFinalPricingButton, OpenFinalPricingLink } from "@/components/pricing/PrepareFinalPricingButton";
import { Button } from "@/components/ui/button";
import type { BuilderReviewView } from "@/lib/assistant/builder-review";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  TAKEOFF_PRICING_EXPLANATION,
  projectAssumptionsReview,
  projectLabourTakeoff,
  projectMaterialsTakeoff,
  type ReviewGroup,
  type TakeoffGroup,
  type TakeoffRow,
} from "@/lib/assistant/presentation/estimate-takeoffs";
import { cn } from "@/lib/utils";

const actionClassName = "h-11 min-h-11 w-full text-sm lg:w-auto";
const pricingClassName =
  "h-11 min-h-11 w-full bg-[var(--brand-orange)] text-sm text-white hover:bg-[var(--brand-orange)]/90 focus-visible:ring-[var(--brand-orange)] lg:w-auto";
const primaryActionClassName = "sm:col-span-2 lg:col-span-1";
const controlClassName =
  "h-11 min-h-11 w-full min-w-0 rounded-md border border-border bg-card px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]";

type PricingRoute = {
  projectId: string;
  estimateId?: string;
  pricingDocumentId?: string | null;
  entry: "create" | "open";
  label: string;
};

type TakeoffActions = {
  isRegenerating?: boolean;
  onEditJob?: () => void;
  onReviewWorkArea?: () => void;
  onRegenerate?: () => void;
  regenerateLabel?: string;
  pricing?: PricingRoute | null;
  onViewWorkArea?: (workAreaId: string) => void;
};

function Actions({
  isRegenerating = false,
  onEditJob,
  onReviewWorkArea,
  onRegenerate,
  regenerateLabel = "Regenerate estimate",
  pricing = null,
}: TakeoffActions) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap" data-takeoff-actions>
      {onRegenerate ? (
        <Button
          type="button"
          className={cn(pricingClassName, primaryActionClassName)}
          data-takeoff-regenerate
          disabled={isRegenerating}
          onClick={onRegenerate}
        >
          {isRegenerating ? "Updating estimate…" : regenerateLabel}
        </Button>
      ) : null}
      {pricing?.entry === "create" ? (
        <div className={primaryActionClassName}>
          <PrepareFinalPricingButton
            projectId={pricing.projectId}
            estimateId={pricing.estimateId}
            className={pricingClassName}
            label={pricing.label}
          />
        </div>
      ) : null}
      {pricing?.entry === "open" && pricing.pricingDocumentId ? (
        <div className={primaryActionClassName}>
          <OpenFinalPricingLink
            projectId={pricing.projectId}
            pricingDocumentId={pricing.pricingDocumentId}
            className={pricingClassName}
            variant="default"
            label={pricing.label}
          />
        </div>
      ) : null}
      {onReviewWorkArea ? (
        <Button
          type="button"
          variant="outline"
          className={actionClassName}
          data-takeoff-review-details
          onClick={onReviewWorkArea}
        >
          Review Work Area details
        </Button>
      ) : null}
      {onEditJob ? (
        <Button
          type="button"
          variant="outline"
          className={actionClassName}
          data-takeoff-edit-job
          onClick={onEditJob}
        >
          {ASSISTANT_ACTION_LABELS.editJobDetails}
        </Button>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-4 text-foreground/70">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold leading-7 tabular-nums lg:text-lg lg:font-medium">{value}</p>
    </div>
  );
}

function StaleNotice({ warning }: { warning: string | null }) {
  if (!warning) {
    return <p className="sr-only" data-takeoff-stale="false">Estimate figures</p>;
  }
  return (
    <p
      className="mt-4 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
      data-takeoff-stale="true"
    >
      Previous estimate. {warning}
    </p>
  );
}

function Cell({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-foreground/70 lg:sr-only">{label}</p>
      <p
        className={cn(
          "break-words [overflow-wrap:anywhere]",
          emphasize && "font-medium",
          label !== "Description" &&
            label !== "Portion" &&
            label !== "Source" &&
            label !== "Productivity" &&
            label !== "Productivity basis" &&
            label !== "Productivity source" &&
            label !== "Hourly-rate source" &&
            "tabular-nums lg:text-right"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function moneyCell(row: TakeoffRow, amount: string | null): string | null {
  if (row.pricingRequired) return "Pricing Required";
  return amount;
}

function IdentityCell({ row, kind }: { row: TakeoffRow; kind: "materials" | "labour" }) {
  if (kind === "labour") {
    return (
      <div className="min-w-0">
        <p className="text-sm text-foreground/70 lg:sr-only">Worker type</p>
        <p className="break-words text-sm" data-worker-type={row.id}>
          {row.workerType ?? "Worker type not specified"}
        </p>
        {row.pricedUsing ? (
          <p className="mt-1 break-words text-sm text-foreground/80" data-priced-using={row.id}>
            {row.pricedUsing}
          </p>
        ) : null}
        <p className="mt-1 break-words font-medium [overflow-wrap:anywhere]" data-labour-activity={row.id}>
          {row.activity ?? row.description}
        </p>
      </div>
    );
  }
  const primary = row.product ?? row.description;
  const useLine =
    row.materialUse && row.materialUse !== primary ? row.materialUse : null;
  const secondary = [useLine, row.specification].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <p className="text-sm text-foreground/70 lg:sr-only">Material</p>
      <p className="break-words font-medium [overflow-wrap:anywhere]" data-material-product={row.id}>
        {primary}
      </p>
      {row.genericCaption ? (
        <p className="mt-1 text-sm text-foreground/70" data-material-caption={row.id}>
          {row.genericCaption}
        </p>
      ) : null}
      {secondary ? (
        <p className="mt-1 break-words text-sm text-foreground/80" data-material-use={row.id}>
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-4 text-foreground/70">{label}</p>
      <p className="break-words text-sm leading-5 [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function ViewWorkAreaButton({
  workAreaId,
  onViewWorkArea,
}: {
  workAreaId: string | null;
  onViewWorkArea?: (workAreaId: string) => void;
}) {
  if (!workAreaId || !onViewWorkArea) return null;
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
      data-takeoff-view-work-area={workAreaId}
      onClick={() => onViewWorkArea(workAreaId)}
    >
      View work area
    </button>
  );
}

function CompactTakeoffRow({
  row,
  kind,
  open,
  onToggle,
  onViewWorkArea,
}: {
  row: TakeoffRow;
  kind: "materials" | "labour";
  open: boolean;
  onToggle: () => void;
  onViewWorkArea?: (workAreaId: string) => void;
}) {
  const materials = kind === "materials";
  const title = materials ? (row.product ?? row.description) : (row.activity ?? row.description);
  const panelId = `takeoff-detail-${row.id}`;
  const money = moneyCell(row, materials ? row.total : row.total) ?? "—";
  const quantity = [row.quantity, row.unit].filter(Boolean).join(" ");
  const useLine = materials
    ? [row.materialUse && row.materialUse !== title ? row.materialUse : null, row.specification]
        .filter(Boolean)
        .join(" · ")
    : null;
  const labourSummary = [row.hours, money].filter((part) => part && part !== "—").join(" · ");
  return (
    <div className="lg:hidden" data-takeoff-compact={row.id}>
      <button
        type="button"
        className="flex min-h-11 w-full items-start gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? "Hide details" : "View details"} for ${title}`}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words text-base font-medium leading-snug [overflow-wrap:anywhere]">
            {title}
          </span>
          {materials && useLine ? (
            <span className="mt-0.5 block break-words text-sm leading-5 text-foreground/80">{useLine}</span>
          ) : null}
          {materials && row.genericCaption ? (
            <span className="mt-0.5 block text-xs leading-4 text-foreground/70">{row.genericCaption}</span>
          ) : null}
          {!materials ? (
            <span className="mt-0.5 block text-sm leading-5 text-foreground/80">
              {row.workerType ?? "Worker type not specified"}
            </span>
          ) : null}
          {!materials && row.pricedUsing ? (
            <span className="mt-0.5 block text-sm leading-5 text-foreground/80">{row.pricedUsing}</span>
          ) : null}
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm leading-5 tabular-nums">
            {materials && quantity ? <span>{quantity}</span> : null}
            {!materials && labourSummary ? <span>{labourSummary}</span> : null}
            {materials ? <span>{money}</span> : null}
            {materials && row.source ? (
              <span className="font-normal text-foreground/75">{row.source}</span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 pt-0.5 text-sm leading-5 text-foreground/70">
          {open ? "Hide details" : "View details"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="grid grid-cols-1 gap-2 pb-3 min-[420px]:grid-cols-2">
          <Detail label="Work Area" value={row.workArea} />
          {row.portion ? <Detail label="Portion" value={row.portion} /> : null}
          {materials ? (
            <>
              {row.specification ? <Detail label="Specification" value={row.specification} /> : null}
              <Detail label="Quantity" value={row.quantity ?? "—"} />
              <Detail label="Unit" value={row.unit ?? "—"} />
              <Detail label="Unit cost" value={moneyCell(row, row.unitCost) ?? "—"} />
              <Detail label="Total" value={money} />
              <Detail label="Rate source" value={row.source ?? "—"} />
              {row.genericCaption ? <Detail label="Category" value={row.genericCaption} /> : null}
            </>
          ) : (
            <>
              <Detail label="Worker type" value={row.workerType ?? "Worker type not specified"} />
              <Detail label="Activity" value={row.activity ?? row.description} />
              <Detail label="Hours" value={row.hours ?? "—"} />
              <Detail label="Productivity basis" value={row.productivityBasis ?? "—"} />
              <Detail label="Productivity source" value={row.productivitySource ?? "—"} />
              <Detail label="Hourly cost" value={moneyCell(row, row.hourlyCost) ?? "—"} />
              <Detail label="Hourly-rate source" value={row.hourlyRateSource ?? "—"} />
              <Detail label="Labour cost" value={money} />
              {row.pricedUsing ? <Detail label="Pricing basis" value={row.pricedUsing} /> : null}
            </>
          )}
          {row.pricingRequired ? (
            <p className="text-sm leading-5 text-foreground/80 min-[420px]:col-span-2">
              {TAKEOFF_PRICING_EXPLANATION}
            </p>
          ) : null}
          <ViewWorkAreaButton workAreaId={row.workAreaId} onViewWorkArea={onViewWorkArea} />
          <p className="text-sm leading-5 text-foreground/75 min-[420px]:col-span-2">
            {materials
              ? "Change physical quantities in Work Area details. Complete commercial prices in Pricing."
              : "Labour hours shown here are the hours already on the estimate. Complete commercial prices in Pricing."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function TakeoffRows({
  rows,
  kind,
  onViewWorkArea,
}: {
  rows: readonly TakeoffRow[];
  kind: "materials" | "labour";
  onViewWorkArea?: (workAreaId: string) => void;
}) {
  const materials = kind === "materials";
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const grid = materials
    ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.7fr)_4.5rem_3.5rem_6.5rem_7rem_minmax(0,0.9fr)]"
    : "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_4.5rem_minmax(0,0.9fr)_minmax(0,0.8fr)_6rem_minmax(0,0.8fr)_6.5rem]";

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-w-0" data-takeoff-desktop={kind}>
      <div className={cn("hidden text-sm text-foreground/70 lg:grid lg:gap-3", grid)}>
        <span>{materials ? "Material" : "Labour"}</span>
        <span>Portion</span>
        {materials ? (
          <>
            <span className="text-right">Quantity</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Unit cost</span>
            <span className="text-right">Total</span>
            <span>Rate source</span>
          </>
        ) : (
          <>
            <span className="text-right">Hours</span>
            <span>Productivity basis</span>
            <span>Productivity source</span>
            <span className="text-right">Hourly cost</span>
            <span>Hourly-rate source</span>
            <span className="text-right">Labour cost</span>
          </>
        )}
      </div>
      <ul>
        {rows.map((row) => {
          const open = openIds.has(row.id);
          return (
            <li
              key={row.id}
              className={cn("border-t border-border/70 lg:grid lg:items-start lg:gap-3 lg:py-3", grid)}
              data-takeoff-row={row.id}
              data-takeoff-shared={row.shared ? "true" : "false"}
              data-pricing-required={row.pricingRequired ? "true" : "false"}
              data-takeoff-open={open ? "true" : "false"}
            >
              <CompactTakeoffRow
                row={row}
                kind={kind}
                open={open}
                onToggle={() => toggle(row.id)}
                onViewWorkArea={onViewWorkArea}
              />
              <div className="hidden lg:contents">
                <IdentityCell row={row} kind={kind} />
                <Cell label="Portion" value={row.portion ?? "—"} />
                {materials ? (
                  <>
                    <Cell label="Quantity" value={row.quantity ?? "—"} />
                    <Cell label="Unit" value={row.unit ?? "—"} />
                    <Cell label="Unit cost" value={moneyCell(row, row.unitCost) ?? "—"} />
                    <Cell label="Total" value={moneyCell(row, row.total) ?? "—"} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground/70 lg:sr-only">Rate source</p>
                      <p
                        className={cn(
                          "break-words text-sm",
                          row.pricingRequired && "font-medium text-amber-800 dark:text-amber-200"
                        )}
                        data-takeoff-source={row.id}
                      >
                        {row.source ?? "—"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Cell label="Hours" value={row.hours ?? "—"} />
                    <Cell label="Productivity basis" value={row.productivityBasis ?? "—"} />
                    <Cell label="Productivity source" value={row.productivitySource ?? "—"} />
                    <Cell label="Hourly cost" value={moneyCell(row, row.hourlyCost) ?? "—"} />
                    <Cell label="Hourly-rate source" value={row.hourlyRateSource ?? "—"} />
                    <Cell label="Labour cost" value={moneyCell(row, row.total) ?? "—"} />
                  </>
                )}
                {row.pricingRequired ? (
                  <p className={cn("text-sm text-foreground/75", materials ? "lg:col-span-7" : "lg:col-span-8")}>
                    {TAKEOFF_PRICING_EXPLANATION}
                  </p>
                ) : null}
                <div className={cn("hidden lg:block", materials ? "lg:col-span-7" : "lg:col-span-8")}>
                  <ViewWorkAreaButton workAreaId={row.workAreaId} onViewWorkArea={onViewWorkArea} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function filterGroups(
  groups: readonly TakeoffGroup[],
  query: string,
  workArea: string
): TakeoffGroup[] {
  const needle = query.trim().toLowerCase();
  return groups
    .filter((group) => workArea === "all" || group.workArea === workArea)
    .map((group) => ({
      workArea: group.workArea,
      rows: group.rows.filter((row) => {
        if (!needle) return true;
        const haystack = [
          row.description,
          row.product,
          row.materialUse,
          row.specification,
          row.activity,
          row.workArea,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((group) => group.rows.length > 0);
}

function TakeoffBoard({
  title,
  marker,
  lineCountLabel,
  lineCount,
  facts,
  pricingRequiredCount,
  knownCost,
  staleWarning,
  groups,
  emptyMessage,
  kind,
  actions,
}: {
  title: string;
  marker: "materials" | "labour";
  lineCountLabel: string;
  lineCount: number;
  facts: readonly { label: string; value: string }[];
  pricingRequiredCount: number;
  knownCost: string | null;
  staleWarning: string | null;
  groups: readonly TakeoffGroup[];
  emptyMessage: string;
  kind: "materials" | "labour";
  actions: TakeoffActions;
}) {
  const [query, setQuery] = useState("");
  const [workArea, setWorkArea] = useState("all");
  const names = useMemo(() => groups.map((group) => group.workArea), [groups]);
  const visible = filterGroups(groups, query, workArea);
  const partial = pricingRequiredCount > 0 && knownCost != null;

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-estimate-takeoff={marker}>
      <section className="rounded-xl border border-border/70 bg-card px-4 py-4">
        <h2 className="text-lg font-semibold leading-6">{title}</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4">
          <Stat label={lineCountLabel} value={String(lineCount)} />
          {facts.map((fact) => (
            <Stat key={fact.label} label={fact.label} value={fact.value} />
          ))}
          {pricingRequiredCount > 0 ? (
            <Stat label="Pricing Required" value={String(pricingRequiredCount)} />
          ) : null}
        </div>
        {pricingRequiredCount > 0 ? (
          <p className="mt-4 text-sm text-foreground/80" data-takeoff-pricing-note>
            {partial
              ? `Partially priced. ${TAKEOFF_PRICING_EXPLANATION}`
              : TAKEOFF_PRICING_EXPLANATION}
          </p>
        ) : null}
        <StaleNotice warning={staleWarning} />
      </section>

      <Actions {...actions} />

      {lineCount === 0 ? (
        <p className="rounded-xl border border-border/70 bg-card px-4 py-4 text-sm" data-takeoff-empty>
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={kind === "materials" ? "Search materials" : "Search labour"}
              aria-label={kind === "materials" ? "Search materials" : "Search labour"}
              data-takeoff-search
              className={controlClassName}
            />
            <select
              value={workArea}
              onChange={(event) => setWorkArea(event.target.value)}
              aria-label="Work Area"
              data-takeoff-work-area-filter
              className={controlClassName}
            >
              <option value="all">All Work Areas</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-border/70 bg-card px-4 py-4 text-sm" data-takeoff-no-match>
              No lines match this search.
            </p>
          ) : (
            visible.map((group) => (
              <section
                key={group.workArea}
                className="rounded-xl border border-border/70 bg-card px-4 py-3"
                data-takeoff-group={group.workArea}
              >
                <h3 className="text-base font-semibold leading-snug break-words">{group.workArea}</h3>
                <TakeoffRows
                  rows={group.rows}
                  kind={kind}
                  onViewWorkArea={actions.onViewWorkArea}
                />
              </section>
            ))
          )}
          <p className="text-sm text-foreground/75">
            {kind === "materials"
              ? "Change physical quantities in Work Area details. Complete commercial prices in Pricing."
              : "Labour hours shown here are the hours already on the estimate. Complete commercial prices in Pricing."}
          </p>
        </div>
      )}
    </div>
  );
}

export function MaterialsTakeoff({
  view,
  ...actions
}: TakeoffActions & { view: BuilderReviewView }) {
  const model = projectMaterialsTakeoff(view);
  return (
    <TakeoffBoard
      title={model.title}
      marker="materials"
      kind="materials"
      lineCountLabel="Material lines"
      lineCount={model.lineCount}
      facts={
        model.knownCost
          ? [{ label: model.knownCostLabel, value: model.knownCost }]
          : []
      }
      pricingRequiredCount={model.pricingRequiredCount}
      knownCost={model.knownCost}
      staleWarning={model.staleWarning}
      groups={model.groups}
      emptyMessage="No material lines in this estimate."
      actions={actions}
    />
  );
}

export function LabourTakeoff({
  view,
  ...actions
}: TakeoffActions & { view: BuilderReviewView }) {
  const model = projectLabourTakeoff(view);
  const facts: { label: string; value: string }[] = [];
  if (model.knownHours) facts.push({ label: model.knownHoursLabel, value: model.knownHours });
  if (model.knownCost) facts.push({ label: model.knownCostLabel, value: model.knownCost });
  return (
    <TakeoffBoard
      title={model.title}
      marker="labour"
      kind="labour"
      lineCountLabel="Labour lines"
      lineCount={model.lineCount}
      facts={facts}
      pricingRequiredCount={model.pricingRequiredCount}
      knownCost={model.knownCost}
      staleWarning={model.staleWarning}
      groups={model.groups}
      emptyMessage="No labour lines in this estimate."
      actions={actions}
    />
  );
}

function ReviewList({
  title,
  items,
  marker,
}: {
  title: string;
  items: ReviewGroup["attention"];
  marker: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3" data-review-section={marker}>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="border-t border-border/60 py-2 text-sm break-words" data-review-entry={item.id}>
            <p>{item.label}</p>
            {item.detail ? <p className="mt-1 text-foreground/75">{item.detail}</p> : null}
            {item.portion && item.portion !== item.detail ? (
              <p className="mt-1 text-foreground/75">{item.portion}</p>
            ) : null}
            {item.count > 1 ? (
              <p className="mt-1 text-foreground/75">{item.count} lines</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssumptionsChecks({
  view,
  ...actions
}: TakeoffActions & { view: BuilderReviewView }) {
  const model = projectAssumptionsReview(view);
  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-estimate-takeoff="checks">
      <section className="rounded-xl border border-border/70 bg-card px-4 py-4">
        <h2 className="text-lg font-semibold leading-6">{model.title}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Requires attention" value={String(model.attentionCount)} />
          <Stat label="Assumptions" value={String(model.assumptionCount)} />
          <Stat label="Benchmark and rate notices" value={String(model.benchmarkCount)} />
        </div>
        <StaleNotice warning={model.staleWarning} />
      </section>
      <Actions {...actions} />
      {model.empty ? (
        <p className="rounded-xl border border-border/70 bg-card px-4 py-4 text-sm" data-takeoff-empty>
          No assumptions or checks on this estimate.
        </p>
      ) : (
        <div className="space-y-3">
          {model.groups.map((group) => (
            <details
              key={group.id}
              className="rounded-xl border border-border/70 bg-card px-4 py-2"
              data-review-group={group.name}
            >
              <summary className="min-h-11 cursor-pointer rounded-sm py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]">
                <span className="block break-words text-base font-semibold leading-snug">{group.name}</span>
                <span className="mt-1 grid grid-cols-3 gap-2 text-sm font-normal leading-5 text-foreground/80">
                  <span>
                    <span className="block text-xs leading-4 text-foreground/70">Requires attention</span>
                    {group.attention.length}
                  </span>
                  <span>
                    <span className="block text-xs leading-4 text-foreground/70">Assumptions</span>
                    {group.assumptions.length}
                  </span>
                  <span>
                    <span className="block text-xs leading-4 text-foreground/70">Benchmark notices</span>
                    {group.benchmarks.length}
                  </span>
                </span>
              </summary>
              <ReviewList title="Requires attention" items={group.attention} marker="attention" />
              <ReviewList title="Assumptions" items={group.assumptions} marker="assumptions" />
              <ReviewList title="Benchmark and rate notices" items={group.benchmarks} marker="benchmarks" />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
