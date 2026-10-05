"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CompanyDefaultsSection } from "@/components/rates/CompanyDefaultsSection";
import { RatesCalibrationAccess } from "@/components/rates/RatesCalibrationAccess";
import { buildCalibrationSummary } from "@/lib/rates/calibration";
import { calibrationWorkAreaHref } from "@/lib/rates/calibration-access";
import { summarizeProductivityWorkAreas } from "@/lib/rates/productivity-work-area-summary";
import {
  buildRatesWorkspaceSummary,
  labourRatesCatalogue,
} from "@/lib/rates/rates-workspace-summary";
import type { RatesPageState } from "@/lib/rates/types";
import type { OrganisationSettings } from "@/components/setup/types";

type RatesCalibrationPanelProps = {
  state: RatesPageState;
  preferredWorkAreaTypes?: string[];
  onSettingsChange: (settings: OrganisationSettings) => void;
  onOpenSection: (section: string) => void;
};

function roleState(rates: RatesPageState["rates"], itemKey: string): string {
  const entry = labourRatesCatalogue().find((row) => row.item_key === itemKey);
  const saved = rates.find((row) => row.item_key === itemKey);
  if (saved?.active && saved.cost_rate != null) return "Your company rate";
  if (entry?.defaultCostRate != null) return "Quotr benchmark";
  return "Pricing Required";
}

export function RatesCalibrationPanel({
  state,
  preferredWorkAreaTypes = state.preferredWorkAreaTypes,
  onSettingsChange,
  onOpenSection,
}: RatesCalibrationPanelProps) {
  const calibration = buildCalibrationSummary(state);
  const workspace = buildRatesWorkspaceSummary(state);
  const gaps = workspace.sections.filter(
    (section) => section.id !== "calibration" && section.pricingRequired > 0
  );
  const preferred = new Set(preferredWorkAreaTypes ?? []);
  const workAreas = summarizeProductivityWorkAreas(
    state.rates,
    preferredWorkAreaTypes ?? []
  );
  const attentionAreas = (
    preferred.size > 0
      ? workAreas.filter((row) => preferred.has(row.workAreaType))
      : []
  ).filter((row) => row.status !== "calibrated");

  return (
    <div className="space-y-4" data-rates-calibration-panel>
      <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
        <h2 className="text-base font-semibold tracking-tight">
          What calibration changes
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Calibration improves later estimates using your known costs and
          productivity. It does not rewrite Quotes you have already issued, or
          accepted commercial records. Changes apply when an estimate is created
          or regenerated.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Readiness</dt>
            <dd className="mt-0.5 text-sm font-medium">{calibration.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Gross margin</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">
              {calibration.defaultMarginPercent}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Company rates</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">
              {workspace.coverage.company}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pricing Required</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-[var(--brand-orange)]">
              {workspace.coverage.pricingRequired}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border/60 bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        {gaps.length === 0 && attentionAreas.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No pricing gaps in the current catalogue. Calibrate a work area
            below when you want productivity to follow your crew.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60" data-rates-attention>
            {gaps.map((section) => (
              <li
                key={section.id}
                className="grid grid-cols-1 items-center gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:gap-3"
              >
                <span className="text-sm font-medium">{section.label}</span>
                <span className="text-sm text-[var(--brand-orange)]">
                  {section.pricingRequired} pricing required
                </span>
                <button
                  type="button"
                  className="min-h-11 justify-self-start text-left text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] sm:justify-self-end"
                  onClick={() => onOpenSection(section.id)}
                >
                  Review {section.label.toLowerCase()}
                </button>
              </li>
            ))}
            {attentionAreas.map((area) => (
              <li
                key={area.workAreaType}
                className="grid grid-cols-1 items-center gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:gap-3"
              >
                <span className="text-sm font-medium">{area.label}</span>
                <span className="text-sm text-muted-foreground">
                  Using benchmarks
                </span>
                <Link
                  href={calibrationWorkAreaHref(area)}
                  className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] sm:justify-self-end"
                >
                  Calibrate
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Carpenter: {roleState(state.rates, "labour.carpenter.hour")}. Labourer:{" "}
          {roleState(state.rates, "labour.labourer.hour")}.
        </p>
        <Button
          type="button"
          size="touch"
          className="mt-4"
          onClick={() => onOpenSection(workspace.nextAction.section)}
        >
          {workspace.nextAction.label}
        </Button>
      </section>

      <RatesCalibrationAccess
        rates={state.rates}
        preferredWorkAreaTypes={preferredWorkAreaTypes}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Margin and pricing inputs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These inputs apply to future estimates. GST stays in{" "}
            <Link
              href="/app/settings/company"
              className="font-medium underline-offset-4 hover:underline"
            >
              Company settings
            </Link>
            . Material wastage percentages stay on{" "}
            <button
              type="button"
              className="font-medium underline-offset-4 hover:underline"
              onClick={() => onOpenSection("defaults")}
            >
              margin and wastage
            </button>
            .
          </p>
        </div>
        <CompanyDefaultsSection
          settings={state.settings}
          onSettingsChange={onSettingsChange}
          readOnly={!state.canManageRates}
        />
      </section>
    </div>
  );
}
