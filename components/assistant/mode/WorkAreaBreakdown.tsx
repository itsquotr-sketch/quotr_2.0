"use client";

import { useState } from "react";
import { PrepareFinalPricingButton, OpenFinalPricingLink } from "@/components/pricing/PrepareFinalPricingButton";
import { Button } from "@/components/ui/button";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  projectWorkAreaBreakdown,
  type WorkAreaBreakdownCard,
  type WorkAreaBreakdownGroup,
  type WorkAreaBreakdownLine,
  type WorkAreaBreakdownModel,
  type WorkAreaBreakdownScope,
} from "@/lib/assistant/presentation/work-area-breakdown";
import type { BuilderReviewView } from "@/lib/assistant/builder-review";
import { cn } from "@/lib/utils";

const actionClassName = "h-11 min-h-11 w-full sm:w-auto";
const pricingClassName =
  "h-11 min-h-11 w-full bg-[var(--brand-orange)] text-white hover:bg-[var(--brand-orange)]/90 focus-visible:ring-[var(--brand-orange)] sm:w-auto";

export type EstimatePresentationView =
  | "overview"
  | "work_areas"
  | "materials"
  | "labour"
  | "checks";

type PricingRoute = {
  projectId: string;
  estimateId?: string;
  pricingDocumentId?: string | null;
  entry: "create" | "open";
  label: string;
};

type WorkAreaBreakdownProps = {
  view: BuilderReviewView;
  scope?: readonly WorkAreaBreakdownScope[];
  isRegenerating?: boolean;
  onEditJob?: () => void;
  onReviewWorkArea?: () => void;
  onRegenerate?: () => void;
  regenerateLabel?: string;
  pricing?: PricingRoute | null;
};

export function EstimateViewControl({
  view,
  onChange,
}: {
  view: EstimatePresentationView;
  onChange: (view: EstimatePresentationView) => void;
}) {
  const items: { id: EstimatePresentationView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "work_areas", label: "By work area" },
    { id: "materials", label: "Materials takeoff" },
    { id: "labour", label: "Labour takeoff" },
    { id: "checks", label: "Assumptions & checks" },
  ];
  return (
    <div className="min-w-0 max-w-full overflow-x-hidden" data-estimate-view-control>
    <div
      role="tablist"
      aria-label="Estimate view"
      data-estimate-view-scroll
      className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-border"
    >
      {items.map((item) => {
        const selected = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-estimate-view-tab={item.id}
            className={cn(
              "min-h-11 shrink-0 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]",
              selected
                ? "border-b-2 border-[var(--brand-orange)] font-medium text-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
        </button>
      );
      })}
    </div>
    </div>
  );
}

function reviewPhrase(card: WorkAreaBreakdownCard): string | null {
  const assumptions =
    card.assumptions.length +
    card.portions.reduce((sum, portion) => sum + portion.assumptions.length, 0);
  const checks = card.checks.length;
  const parts: string[] = [];
  if (assumptions === 1) parts.push("1 assumption to review");
  else if (assumptions > 1) parts.push(`${assumptions} assumptions to review`);
  if (checks === 1) parts.push("1 check to review");
  else if (checks > 1) parts.push(`${checks} checks to review`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-foreground/75">{label}</p>
      <p className="mt-1 text-lg font-medium break-words tabular-nums">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 lg:text-inherit">
      <p className="text-sm text-foreground/70 lg:sr-only">{label}</p>
      <p
        className={cn(
          "break-words [overflow-wrap:anywhere]",
          emphasize && "font-medium",
          label !== "Description" && label !== "Source" && "tabular-nums lg:text-right"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LineRows({ lines }: { lines: readonly WorkAreaBreakdownLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="hidden text-sm text-foreground/70 lg:grid lg:grid-cols-[minmax(0,1.5fr)_5.5rem_4rem_8rem_6.5rem_7rem] lg:gap-3">
        <span>Description</span>
        <span className="text-right">Quantity</span>
        <span className="text-right">Unit</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Total</span>
        <span>Source</span>
      </div>
      <ul>
        {lines.map((line) => (
          <li
            key={line.id}
            className="grid gap-1 border-t border-border/70 py-3 lg:grid-cols-[minmax(0,1.5fr)_5.5rem_4rem_8rem_6.5rem_7rem] lg:items-start lg:gap-3"
            data-work-area-line={line.id}
            data-pricing-required={line.pricingRequired ? "true" : "false"}
          >
            <Field label="Description" value={line.description} emphasize />
            <Field label="Quantity" value={line.quantity ?? "—"} />
            <Field label="Unit" value={line.unit ?? "—"} />
            <Field label="Rate" value={line.rate ?? "—"} />
            <Field label="Total" value={line.total ?? "—"} />
            {line.source ? (
              <div className="min-w-0 lg:text-left">
                <p className="text-sm text-foreground/70 lg:sr-only">Source</p>
                <p
                  className={cn(
                    "break-words text-sm",
                    line.pricingRequired && "font-medium text-amber-800 dark:text-amber-200"
                  )}
                >
                  {line.source}
                </p>
              </div>
            ) : null}
            {line.pricingRequired ? (
              <p className="text-sm text-foreground/75 lg:col-span-6">
                This price is completed in Pricing.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupBlock({ group }: { group: WorkAreaBreakdownGroup }) {
  if (group.lines.length === 0) return null;
  return (
    <section className="mt-4" data-work-area-cost-group={group.title}>
      <h4 className="text-sm font-semibold">{group.title}</h4>
      <LineRows lines={group.lines} />
    </section>
  );
}

function CollapsedList({
  title,
  items,
  marker,
}: {
  title: string;
  items: readonly string[];
  marker: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className="mt-3 border-t border-border/70 pt-3" data-work-area-disclosure={marker}>
      <summary className="min-h-11 cursor-pointer rounded-sm py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]">
        {title}
      </summary>
      <ul className="mt-1">
        {items.map((item) => (
          <li key={item} className="border-t border-border/60 py-2 text-sm break-words">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function WorkAreaBreakdown({
  view,
  scope = [],
  isRegenerating = false,
  onEditJob,
  onReviewWorkArea,
  onRegenerate,
  regenerateLabel = "Regenerate estimate",
  pricing = null,
}: WorkAreaBreakdownProps) {
  const model: WorkAreaBreakdownModel = projectWorkAreaBreakdown(view, scope);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-work-area-breakdown>
      <section className="rounded-xl border border-border/70 bg-card px-4 py-4" data-work-area-summary>
        <h2 className="text-base font-semibold">{model.title}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Work Areas"
            value={model.workAreaCount === 1 ? "1 Work Area" : `${model.workAreaCount} Work Areas`}
          />
          {model.pricingRequiredCount > 0 ? (
            <Stat
              label="Requiring prices"
              value={String(model.pricingRequiredCount)}
            />
          ) : null}
          {model.directCost ? <Stat label="Direct cost" value={model.directCost} /> : null}
          {model.previousDirectCost ? (
            <Stat label="Previous direct cost" value={model.previousDirectCost} />
          ) : null}
          {model.sell ? <Stat label="Recommended client sell" value={model.sell} /> : null}
        </div>
        {model.staleWarning ? (
          <p
            className="mt-4 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
            data-work-area-stale="true"
          >
            Previous estimate. {model.staleWarning}
          </p>
        ) : (
          <p className="sr-only" data-work-area-stale="false">
            Current estimate
          </p>
        )}
      </section>

      <Actions
        onEditJob={onEditJob}
        onReviewWorkArea={onReviewWorkArea}
        onRegenerate={onRegenerate}
        regenerateLabel={regenerateLabel}
        isRegenerating={isRegenerating}
        pricing={pricing}
      />

      <div className="space-y-3">
        {model.cards.map((card) => {
          const open = openIds.has(card.id);
          const phrase = reviewPhrase(card);
          return (
            <section
              key={card.id}
              className="overflow-hidden rounded-xl border border-border/70 bg-card"
              data-work-area-card={card.name}
              data-work-area-readiness={card.readiness}
            >
              <h3 className="sr-only">{card.name}</h3>
              <button
                type="button"
                className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
                aria-expanded={open}
                data-work-area-toggle={card.id}
                onClick={() => toggle(card.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold break-words">{card.name}</span>
                  <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                    <span className="min-w-0">
                      <span className="block text-xs text-foreground/70">Readiness</span>
                      <span className="block font-medium">{card.readiness}</span>
                    </span>
                    {card.directCost ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Direct cost</span>
                        <span className="block font-medium tabular-nums">{card.directCost}</span>
                      </span>
                    ) : null}
                    {card.previousDirectCost ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Previous direct cost</span>
                        <span className="block font-medium tabular-nums">{card.previousDirectCost}</span>
                      </span>
                    ) : null}
                    {card.indicativeSell ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Indicative client sell</span>
                        <span className="block font-medium tabular-nums">{card.indicativeSell}</span>
                      </span>
                    ) : null}
                    {card.labourHours ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Labour hours</span>
                        <span className="block font-medium tabular-nums">{card.labourHours}</span>
                      </span>
                    ) : null}
                    {card.composition ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Composition</span>
                        <span className="block break-words">{card.composition}</span>
                      </span>
                    ) : null}
                    {phrase ? (
                      <span className="min-w-0">
                        <span className="block text-xs text-foreground/70">Assumptions and checks</span>
                        <span className="block break-words">{phrase}</span>
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 pt-1 text-sm text-foreground/70">
                  {open ? "Hide breakdown" : "View breakdown"}
                </span>
              </button>

              {open ? (
                <div className="space-y-4 border-t border-border/70 px-4 py-4">
                  {card.included.length > 0 || card.excluded.length > 0 || card.quantities.length > 0 ? (
                    <section data-work-area-scope>
                      <h4 className="text-sm font-semibold">Scope and quantities</h4>
                      {card.included.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm">
                          {card.included.map((item) => (
                            <li key={item} className="break-words">{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {card.quantities.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {card.quantities.map((row) => (
                            <li key={row.id} className="min-w-0 text-sm" data-work-area-quantity={row.id}>
                              <p className="break-words font-medium">{row.label}</p>
                              <p className="tabular-nums text-foreground/80">{row.quantity}</p>
                              {row.detail ? (
                                <p className="break-words text-foreground/75">{row.detail}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {card.excluded.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-foreground/80">Not included</p>
                          <ul className="mt-1 space-y-1 text-sm text-foreground/75">
                            {card.excluded.map((item) => (
                              <li key={item} className="break-words">{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {card.portions.map((portion) => (
                    <section
                      key={portion.id}
                      className="rounded-lg border border-border/70 px-3 py-3"
                      data-work-area-portion={portion.id}
                    >
                      <h4 className="text-sm font-semibold break-words">{portion.label}</h4>
                      {portion.areaLabel ? (
                        <p className="mt-1 text-sm text-foreground/75">{portion.areaLabel}</p>
                      ) : null}
                      {portion.summary ? (
                        <p className="mt-1 text-sm break-words text-foreground/75">{portion.summary}</p>
                      ) : null}
                      {portion.groups.map((group) => (
                        <GroupBlock key={group.id} group={group} />
                      ))}
                      <CollapsedList
                        title={
                          portion.assumptions.length === 1
                            ? "1 assumption"
                            : `${portion.assumptions.length} assumptions`
                        }
                        items={portion.assumptions}
                        marker="portion-assumptions"
                      />
                    </section>
                  ))}

                  {card.sharedGroups.length > 0 ? (
                    <section data-work-area-shared>
                      <h4 className="text-sm font-semibold">Shared across portions</h4>
                      {card.sharedGroups.map((group) => (
                        <GroupBlock key={group.id} group={group} />
                      ))}
                    </section>
                  ) : null}

                  {card.costGroups.length > 0 ? (
                    <section data-work-area-cost>
                      <h4 className="text-sm font-semibold">Cost build-up</h4>
                      {card.costGroups.map((group) => (
                        <GroupBlock key={group.id} group={group} />
                      ))}
                    </section>
                  ) : null}

                  <CollapsedList
                    title={
                      card.assumptions.length === 1
                        ? "1 assumption"
                        : `${card.assumptions.length} assumptions`
                    }
                    items={card.assumptions}
                    marker="assumptions"
                  />
                  <CollapsedList
                    title={
                      card.checks.length === 1
                        ? "1 check to review"
                        : `${card.checks.length} checks to review`
                    }
                    items={card.checks}
                    marker="checks"
                  />

                  {card.attention.length > 0 ? (
                    <section data-work-area-attention>
                      <h4 className="text-sm font-semibold">Required attention</h4>
                      <ul className="mt-2">
                        {card.attention.map((item) => (
                          <li
                            key={item.id}
                            className="border-t border-amber-300/70 py-3"
                            data-pricing-required="true"
                          >
                            <p className="font-medium break-words">{item.description}</p>
                            <p className="mt-1 text-sm text-foreground/75">{item.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <CollapsedList
        title="Other assumptions"
        items={model.otherAssumptions}
        marker="other-assumptions"
      />
      <CollapsedList
        title="Other checks"
        items={model.otherChecks}
        marker="other-checks"
      />
    </div>
  );
}

function Actions({
  onEditJob,
  onReviewWorkArea,
  onRegenerate,
  regenerateLabel,
  isRegenerating,
  pricing,
}: {
  onEditJob?: () => void;
  onReviewWorkArea?: () => void;
  onRegenerate?: () => void;
  regenerateLabel: string;
  isRegenerating: boolean;
  pricing: PricingRoute | null;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" data-work-area-actions>
      {onRegenerate ? (
        <Button
          type="button"
          className={actionClassName}
          data-work-area-regenerate
          disabled={isRegenerating}
          onClick={onRegenerate}
        >
          {isRegenerating ? ASSISTANT_ACTION_LABELS.updatingEstimate : regenerateLabel}
        </Button>
      ) : null}
      {pricing?.entry === "create" ? (
        <div data-work-area-pricing="create">
          <PrepareFinalPricingButton
            projectId={pricing.projectId}
            estimateId={pricing.estimateId}
            className={pricingClassName}
            label={pricing.label}
          />
        </div>
      ) : null}
      {pricing?.entry === "open" && pricing.pricingDocumentId ? (
        <div data-work-area-pricing="open">
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
          data-work-area-review-details
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
          data-work-area-edit-job
          onClick={onEditJob}
        >
          {ASSISTANT_ACTION_LABELS.editJobDetails}
        </Button>
      ) : null}
    </div>
  );
}
