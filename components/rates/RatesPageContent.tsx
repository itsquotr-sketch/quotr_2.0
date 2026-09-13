"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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

/** Primary Rates navigation — used-now contractor setup. */
const RATES_SECTIONS = [
  { id: "defaults", label: "Defaults" },
  { id: "materials", label: "Materials" },
  { id: "core", label: "Labour & Productivity" },
  { id: "plant", label: "Plant" },
  { id: "subcontract", label: "Subcontract" },
  { id: "waste", label: "Waste" },
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
  if (section === "productivity") return "core";
  if (section === "work_types") return "materials";
  return section;
}

function viewFor(section: RatesSectionId): RatesSectionId {
  if (section === "productivity") return "core";
  if (section === "work_types") return "materials";
  return section;
}

export function RatesPageContent({
  initialState,
  initialSection = "defaults",
  companySettings = null,
}: RatesPageContentProps) {
  const [state, setState] = useState(initialState);
  const [activeSection, setActiveSection] = useState<RatesSectionId>(
    parseRatesSection(initialSection) ?? "defaults"
  );

  async function refresh() {
    const refreshed = await getRatesPageState();
    setState(refreshed);
  }

  function selectSection(id: string) {
    const next = parseRatesSection(id) ?? "defaults";
    setActiveSection(next);
    replaceRatesSectionInUrl(next);
  }

  const view = viewFor(activeSection);
  const navActive = navIdFor(activeSection);
  const showNonDefault =
    view !== "defaults" ||
    activeSection === LEGACY_RATES_SECTION.id ||
    activeSection === "benchmarks";

  const activeLabel =
    RATES_SECTIONS.find((section) => section.id === navActive)?.label ??
    (activeSection === LEGACY_RATES_SECTION.id
      ? LEGACY_RATES_SECTION.label
      : "Rates");

  const companyGrossMarginPercent = resolveCompanyGrossMarginPercent(
    state.settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT
  );

  function onRatesChange(rates: RatesPageRate[]) {
    setState((prev) => ({ ...prev, rates }));
  }

  return (
    <div className="space-y-4" data-rates-compact>
      <SettingsSectionNav
        items={[...RATES_SECTIONS]}
        activeId={navActive}
        onChange={selectSection}
      />

      <h2 className="sr-only">{activeLabel}</h2>
      <p className="text-sm text-muted-foreground">
        Enter what work costs your business. Gross margin is under Defaults; GST
        under{" "}
        <Link
          href="/app/settings/company"
          className="font-medium underline-offset-4 hover:underline"
        >
          Company settings
        </Link>
        .
      </p>

      <div className="min-w-0">
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

      <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-3">
        <p className="text-xs font-medium text-muted-foreground">Advanced</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Older overall package rates and fallback toggles are kept for history.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 px-2 text-xs"
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
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 px-2 text-xs"
            )}
            onClick={() => selectSection("benchmarks")}
            aria-current={activeSection === "benchmarks" ? "page" : undefined}
          >
            Fallbacks
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <button
          type="button"
          className="underline-offset-4 hover:underline"
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
