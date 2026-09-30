"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CompanyDefaultsSection } from "@/components/rates/CompanyDefaultsSection";
import { RatesCalibrationAccess } from "@/components/rates/RatesCalibrationAccess";
import { buildCalibrationSummary } from "@/lib/rates/calibration";
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
      <section className="rounded-xl border border-border/70 bg-card px-4 py-4">
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

      <section className="rounded-xl border border-border/70 bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            Carpenter: {roleState(state.rates, "labour.carpenter.hour")}. Labourer:{" "}
            {roleState(state.rates, "labour.labourer.hour")}.{" "}
            <button
              type="button"
              className="font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              onClick={() => onOpenSection("labour")}
            >
              Open labour
            </button>
          </li>
          {gaps.map((section) => (
            <li key={section.id}>
              <span className="text-[var(--brand-orange)]">
                {section.pricingRequired} {section.label.toLowerCase()} Pricing Required.
              </span>{" "}
              <button
                type="button"
                className="font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                onClick={() => onOpenSection(section.id)}
              >
                Review {section.label.toLowerCase()}
              </button>
            </li>
          ))}
          {attentionAreas.map((area) => (
            <li key={area.workAreaType}>
              {area.label} productivity is not fully calibrated.
            </li>
          ))}
          {gaps.length === 0 && attentionAreas.length === 0 ? (
            <li className="text-muted-foreground">
              No pricing gaps in the current catalogue. Calibrate a work area
              below when you want productivity to follow your crew.
            </li>
          ) : null}
        </ul>
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
