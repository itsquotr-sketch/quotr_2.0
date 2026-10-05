"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
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

function writeRatesSectionUrl(
  section: RatesSectionId,
  mode: "push" | "replace"
) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("section") === section) return;
  url.searchParams.set("section", section);
  const next = `${url.pathname}${url.search}`;
  const state = { ratesSection: section };
  if (mode === "replace") window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === "calibrate") {
      url.searchParams.set("section", "calibration");
      window.history.replaceState(
        { ratesSection: "calibration" },
        "",
        `${url.pathname}${url.search}`
      );
    }

    function onPopState() {
      const next =
        parseRatesSection(
          new URL(window.location.href).searchParams.get("section")
        ) ?? "overview";
      setActiveSection(next);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function refresh() {
    const refreshed = await getRatesPageState();
    setState(refreshed);
  }

  function selectSection(id: string) {
    const next = parseRatesSection(id) ?? "overview";
    setActiveSection(next);
    writeRatesSectionUrl(next, "push");
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
      <label className="grid gap-1.5 md:hidden" htmlFor="rates-section">
        <span className="text-xs font-medium text-muted-foreground">
          Rates section
        </span>
        <select
          id="rates-section"
          data-rates-section-select
          aria-label="Rates section"
          className="h-11 min-h-11 w-full rounded-xl border border-border/80 bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
          value={
            RATES_SECTIONS.some((section) => section.id === navActive)
              ? navActive
              : activeSection
          }
          onChange={(event) => selectSection(event.target.value)}
        >
          {RATES_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
          {RATES_SECTIONS.some((section) => section.id === navActive) ? null : (
            <option value={activeSection}>{activeLabel}</option>
          )}
        </select>
      </label>
      <SettingsSectionNav
        items={[...RATES_SECTIONS]}
        activeId={navActive}
        onChange={selectSection}
        label="Rates sections"
        touchTargets
        wrap
        className="hidden md:block"
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
        <div
          className="rounded-lg border border-dashed border-border/70 bg-card"
          data-rates-advanced
        >
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-inset"
            aria-expanded={advancedOpen}
            aria-controls="rates-advanced-settings"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Advanced settings
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {advancedOpen ? (
            <div
              id="rates-advanced-settings"
              className="flex flex-wrap gap-2 px-3 pb-3"
            >
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
          ) : null}
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
