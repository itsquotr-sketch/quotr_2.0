"use client";

import { useRef, useState } from "react";
import type { EstimatePresentationView } from "@/lib/assistant/presentation/estimate-section";
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

const actionClassName = "h-11 min-h-11 w-full text-sm lg:w-auto";
const pricingClassName =
  "h-11 min-h-11 w-full bg-[var(--brand-orange)] text-sm text-white hover:bg-[var(--brand-orange)]/90 focus-visible:ring-[var(--brand-orange)] lg:w-auto";
const primaryActionClassName = "sm:col-span-2 lg:col-span-1";

export type { EstimatePresentationView };

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
  focusWorkAreaId?: string | null;
  onFocusApplied?: () => void;
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
    <label data-estimate-view-select className="grid gap-1 md:hidden">
      <span className="text-xs leading-4 text-foreground/70">Estimate view</span>
      <select
        value={view}
        aria-label="Estimate view"
        data-estimate-view-dropdown
        className="h-11 min-h-11 w-full rounded-md border border-border bg-card px-3 text-base text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
        onChange={(event) => onChange(event.target.value as EstimatePresentationView)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
    <div
      role="tablist"
      aria-label="Estimate view"
      data-estimate-view-scroll
      className="hidden max-w-full flex-wrap gap-1 border-b border-border md:flex"
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
              "min-h-11 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]",
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
      <p className="text-xs leading-4 text-foreground/70">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold leading-7 tabular-nums lg:text-lg lg:font-medium">{value}</p>
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
            className="grid grid-cols-1 gap-1 border-t border-border/70 py-3 lg:grid-cols-[minmax(0,1.5fr)_5.5rem_4rem_8rem_6.5rem_7rem] lg:items-start lg:gap-3"
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
  focusWorkAreaId = null,
  onFocusApplied,
}: WorkAreaBreakdownProps) {
  const model: WorkAreaBreakdownModel = projectWorkAreaBreakdown(view, scope);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [openedAttention, setOpenedAttention] = useState(false);
  const [appliedFocus, setAppliedFocus] = useState<string | null>(null);
  const focusedHeading = useRef<string | null>(null);
  const firstAttention = model.cards.find((card) => card.attention.length > 0)?.id ?? null;

  if (!openedAttention && !focusWorkAreaId && firstAttention) {
    setOpenedAttention(true);
    setOpenIds(new Set([firstAttention]));
  }
  if (focusWorkAreaId && appliedFocus !== focusWorkAreaId) {
    setAppliedFocus(focusWorkAreaId);
    setOpenIds((current) => {
      if (current.has(focusWorkAreaId)) return current;
      const next = new Set(current);
      next.add(focusWorkAreaId);
      return next;
    });
  }

  function focusHeading(id: string, node: HTMLHeadingElement | null) {
    if (!node || focusWorkAreaId !== id || focusedHeading.current === id) return;
    focusedHeading.current = id;
    node.focus();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    onFocusApplied?.();
  }

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
      <section className="rounded-xl border border-border/60 bg-card px-4 py-4" data-work-area-summary>
        <h2 className="text-lg font-semibold leading-6">{model.title}</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4">
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
              className="overflow-hidden rounded-xl border border-border/60 bg-card"
              data-work-area-card={card.name}
              data-work-area-readiness={card.readiness}
            >
              <h3
                id={`work-area-${card.id}`}
                tabIndex={-1}
                ref={(node) => focusHeading(card.id, node)}
                className="px-4 pt-3 text-base font-semibold leading-snug break-words outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
              >
                {card.name}
              </h3>
              <button
                type="button"
                className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
                aria-expanded={open}
                data-work-area-toggle={card.id}
                onClick={() => toggle(card.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                    <span className="min-w-0">
                      <span className="block text-xs text-foreground/70">Readiness</span>
                      <span className="block font-medium">{card.readiness}</span>
                    </span>
                    {card.attention.length > 0 ? (
                      <span className="min-w-0" data-work-area-pricing-count={card.id}>
                        <span className="block text-xs text-foreground/70">Pricing Required</span>
                        <span className="block font-medium tabular-nums">{card.attention.length}</span>
                      </span>
                    ) : null}
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
                      <span className="hidden min-w-0 lg:block">
                        <span className="block text-xs leading-4 text-foreground/70">Composition</span>
                        <span className="block break-words text-sm leading-5">{card.composition}</span>
                      </span>
                    ) : null}
                    {phrase ? (
                      <span className="hidden min-w-0 lg:block">
                        <span className="block text-xs leading-4 text-foreground/70">Assumptions and checks</span>
                        <span className="block break-words text-sm leading-5">{phrase}</span>
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
                  {card.composition || phrase ? (
                    <p className="text-sm leading-5 text-foreground/80 lg:hidden">
                      {[card.composition, phrase].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
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
                      className="rounded-xl bg-muted/25 px-3 py-3"
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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap" data-work-area-actions>
      {onRegenerate ? (
        <Button
          type="button"
          className={cn(actionClassName, primaryActionClassName)}
          data-work-area-regenerate
          disabled={isRegenerating}
          onClick={onRegenerate}
        >
          {isRegenerating ? ASSISTANT_ACTION_LABELS.updatingEstimate : regenerateLabel}
        </Button>
      ) : null}
      {pricing?.entry === "create" ? (
        <div className={primaryActionClassName} data-work-area-pricing="create">
          <PrepareFinalPricingButton
            projectId={pricing.projectId}
            estimateId={pricing.estimateId}
            className={pricingClassName}
            label={pricing.label}
          />
        </div>
      ) : null}
      {pricing?.entry === "open" && pricing.pricingDocumentId ? (
        <div className={primaryActionClassName} data-work-area-pricing="open">
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
