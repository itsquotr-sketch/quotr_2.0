"use client";

import { Button } from "@/components/ui/button";
import {
  buildRatesWorkspaceSummary,
  type RatesWorkspaceSection,
  type RatesWorkspaceSectionId,
} from "@/lib/rates/rates-workspace-summary";
import type { RatesPageState } from "@/lib/rates/types";

type RatesOverviewProps = {
  state: RatesPageState;
  onOpenSection: (section: RatesWorkspaceSectionId | "defaults" | "waste" | "legacy" | "benchmarks") => void;
};

function coverageLine(section: RatesWorkspaceSection): string | null {
  const total = section.company + section.benchmark + section.pricingRequired;
  if (section.id === "calibration" || total === 0) return null;
  return `${section.company} company · ${section.benchmark} Quotr benchmark · ${section.pricingRequired} Pricing Required`;
}

export function RatesOverview({ state, onOpenSection }: RatesOverviewProps) {
  const summary = buildRatesWorkspaceSummary(state);
  const { coverage, nextAction } = summary;

  return (
    <div className="space-y-4" data-rates-overview>
      <section className="rounded-xl border border-border/70 bg-card px-4 py-4">
        <h2 className="text-base font-semibold tracking-tight">Your rate book</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Company rates you have set, Quotr benchmarks still in use, and rates
          that still need a price.
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          <div className="min-w-0">
            <dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
              Company rates
            </dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
              {coverage.company}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
              Quotr benchmarks
            </dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
              {coverage.benchmark}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
              Pricing Required
            </dt>
            <dd
              className="mt-0.5 text-base font-semibold tabular-nums text-[var(--brand-orange)] sm:text-lg"
              data-rates-pricing-required={coverage.pricingRequired}
            >
              {coverage.pricingRequired}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-medium">{nextAction.label}.</span>{" "}
            <span className="text-muted-foreground">{nextAction.reason}.</span>
          </p>
          <Button
            type="button"
            size="touch"
            className="w-full sm:w-auto"
            onClick={() => onOpenSection(nextAction.section)}
          >
            {nextAction.label}
          </Button>
        </div>
      </section>

      <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
        {summary.sections.map((section) => {
          const line = coverageLine(section);
          return (
            <li key={section.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-inset"
                onClick={() => onOpenSection(section.id)}
              >
                <span className="text-sm font-medium">{section.label}</span>
                <span className="text-sm text-muted-foreground">
                  {section.purpose}
                </span>
                {section.id === "calibration" ? (
                  <span className="text-xs text-muted-foreground">
                    Readiness: {summary.readinessLabel}
                  </span>
                ) : line ? (
                  <span className="text-xs text-muted-foreground">
                    {line}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No rates in this section yet.
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-dashed border-border/70 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Also available</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["defaults", "Margin and wastage"],
              ["waste", "Waste disposal"],
              ["legacy", "Legacy package rates"],
              ["benchmarks", "Fallback settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="min-h-11 rounded-full border border-border/70 bg-card px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              onClick={() => onOpenSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
