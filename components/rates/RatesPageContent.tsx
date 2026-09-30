"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SettingsSectionNav } from "@/components/layout/section-nav";
import { getRatesPageState } from "@/lib/rates/actions";
import type { RatesPageRate, RatesPageState } from "@/lib/rates/types";
import {
  parseRatesSection,
  type RatesSectionId,
} from "@/lib/setup/recommendation-destinations";
import { cn } from "@/lib/utils";
import { CompanyDefaultsSection } from "./CompanyDefaultsSection";
import { RatesCalibrationPanel } from "./RatesCalibrationPanel";
import { RatesOverview } from "./RatesOverview";
import { MaterialWastageDefaultsSection } from "./MaterialWastageDefaultsSection";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { resolveCompanyGrossMarginPercent } from "@/lib/rates/cost-first-presentation";
import type { CompanySettings } from "@/lib/settings/types";

const RatesNonDefaultSections = dynamic(
  () =>
    import("./RatesNonDefaultSections").then((mod) => mod.RatesNonDefaultSections),
  {
    loading: () => (
      <div className="h-40 rounded-lg border border-dashed border-border/70 bg-muted/10" />
    ),
  }
);

type RatesPageContentProps = {
  initialState: RatesPageState;
  initialSection?: RatesSectionId;
  companySettings?: CompanySettings | null;
};

/** Primary Rates navigation. */
const RATES_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Materials" },
  { id: "labour", label: "Labour" },
  { id: "productivity", label: "Productivity" },
  { id: "subcontract", label: "Subcontract" },
  { id: "plant", label: "Plant" },
  { id: "calibration", label: "Calibration" },
] as const;

/** Historical package rates — kept reachable, not primary nav. */
const LEGACY_RATES_SECTION = {
  id: "legacy" as const,
  label: "Legacy package rates",
};

function replaceRatesSectionInUrl(section: RatesSectionId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function navIdFor(section: RatesSectionId): string {
  if (section === "core") return "labour";
  if (section === "work_types") return "materials";
  return section;
}

function viewFor(section: RatesSectionId): RatesSectionId {
  if (section === "core") return "labour";
  if (section === "work_types") return "materials";
  return section;
}

export function RatesPageContent({
  initialState,
  initialSection = "overview",
  companySettings = null,
}: RatesPageContentProps) {
  const [state, setState] = useState(initialState);
  const [activeSection, setActiveSection] = useState<RatesSectionId>(
    parseRatesSection(initialSection) ?? "overview"
  );

  async function refresh() {
    const refreshed = await getRatesPageState();
    setState(refreshed);
  }

  function selectSection(id: string) {
    const next = parseRatesSection(id) ?? "overview";
    setActiveSection(next);
    replaceRatesSectionInUrl(next);
  }

  const view = viewFor(activeSection);
  const navActive = navIdFor(activeSection);
  const showNonDefault =
    view === "materials" ||
    view === "labour" ||
    view === "productivity" ||
    view === "plant" ||
    view === "subcontract" ||
    view === "waste" ||
    activeSection === LEGACY_RATES_SECTION.id ||
    activeSection === "benchmarks";

  const activeLabel =
    RATES_SECTIONS.find((section) => section.id === navActive)?.label ??
    (activeSection === LEGACY_RATES_SECTION.id
      ? LEGACY_RATES_SECTION.label
      : activeSection === "defaults"
        ? "Margin and wastage"
        : activeSection === "waste"
          ? "Waste"
          : activeSection === "benchmarks"
            ? "Fallback settings"
            : "Rates");

  const companyGrossMarginPercent = resolveCompanyGrossMarginPercent(
    state.settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT
  );

  function onRatesChange(rates: RatesPageRate[]) {
    setState((prev) => ({ ...prev, rates }));
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-rates-compact>
      <SettingsSectionNav
        items={[...RATES_SECTIONS]}
        activeId={navActive}
        onChange={selectSection}
        label="Rates sections"
        touchTargets
      />

      <h2 className="sr-only">{activeLabel}</h2>

      <div className="min-w-0">
        {view === "overview" ? (
          <RatesOverview state={state} onOpenSection={selectSection} />
        ) : null}

        {view === "defaults" ? (
          <div className="space-y-4" data-rates-defaults>
            <CompanyDefaultsSection
              settings={state.settings}
              onSettingsChange={(settings) =>
                setState((prev) => ({ ...prev, settings }))
              }
              readOnly={!state.canManageRates}
            />
            {companySettings ? (
              <MaterialWastageDefaultsSection
                settings={companySettings}
                readOnly={!state.canManageRates}
              />
            ) : null}
          </div>
        ) : null}

        {view === "calibration" ? (
          <RatesCalibrationPanel
            state={state}
            preferredWorkAreaTypes={state.preferredWorkAreaTypes}
            onSettingsChange={(settings) =>
              setState((prev) => ({ ...prev, settings }))
            }
            onOpenSection={selectSection}
          />
        ) : null}

        {showNonDefault ? (
          <RatesNonDefaultSections
            view={view}
            activeSection={activeSection}
            state={state}
            onRatesChange={onRatesChange}
            onChanged={() => {
              void refresh();
            }}
            companyGrossMarginPercent={companyGrossMarginPercent}
          />
        ) : null}
      </div>

      {view === "overview" ? null : (
        <div className="rounded-lg border border-dashed border-border/70 bg-card px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">Advanced</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "px-3 text-xs"
              )}
              onClick={() => selectSection("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "px-3 text-xs"
              )}
              onClick={() => selectSection(LEGACY_RATES_SECTION.id)}
              aria-current={
                activeSection === LEGACY_RATES_SECTION.id ? "page" : undefined
              }
            >
              {LEGACY_RATES_SECTION.label}
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "touch" }),
                "px-3 text-xs"
              )}
              onClick={() => selectSection("benchmarks")}
              aria-current={activeSection === "benchmarks" ? "page" : undefined}
            >
              Fallbacks
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <button
          type="button"
          className="min-h-11 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          onClick={() => {
            void refresh();
          }}
        >
          Refresh rates
        </button>
      </p>
    </div>
  );
}
