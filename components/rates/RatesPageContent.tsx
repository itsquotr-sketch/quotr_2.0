"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsSectionNav } from "@/components/layout/section-nav";
import {
  LABOUR_RATE_CATALOGUE,
  MATERIAL_RATE_CATALOGUE,
  SCOPE_RATE_CATALOGUE,
} from "@/lib/rates/catalogue";
import { DECK_PRODUCTIVITY_RATE_CATALOGUE } from "@/lib/rates/specific-material-catalogue";
import { getRatesPageState } from "@/lib/rates/actions";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import type { RatesPageState } from "@/lib/rates/types";
import {
  parseRatesSection,
  type RatesSectionId,
} from "@/lib/setup/recommendation-destinations";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { cn } from "@/lib/utils";
import { BenchmarkFallbackSection } from "./BenchmarkFallbackSection";
import { CalibrationSummaryCard } from "./CalibrationSummaryCard";
import { CompanyDefaultsSection } from "./CompanyDefaultsSection";
import { RatesTableSection } from "./RatesTableSection";
import { SpecificMaterialRatesSection } from "./SpecificMaterialRatesSection";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { resolveCompanyGrossMarginPercent } from "@/lib/rates/cost-first-presentation";

type RatesPageContentProps = {
  initialState: RatesPageState;
  initialSection?: RatesSectionId;
};

/** Primary Rates navigation — used-now contractor setup. */
const RATES_SECTIONS = [
  { id: "core", label: "Core labour" },
  { id: "productivity", label: "Labour productivity" },
  { id: "work_types", label: "Work types" },
  { id: "materials", label: "All materials" },
  { id: "defaults", label: "Defaults" },
  { id: "benchmarks", label: "Fallbacks" },
] as const;

/** Historical package rates — kept reachable, not primary nav. */
const LEGACY_RATES_SECTION = {
  id: "legacy" as const,
  label: "Legacy package rates",
};

function sortWorkTypesByPreference(
  types: string[],
  preferred: string[]
): string[] {
  const preferredSet = new Set(preferred);
  const preferredOrdered = preferred.filter((type) => types.includes(type));
  const rest = types.filter((type) => !preferredSet.has(type)).sort();
  return [...preferredOrdered, ...rest];
}

function replaceRatesSectionInUrl(section: RatesSectionId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function RatesPageContent({
  initialState,
  initialSection = "core",
}: RatesPageContentProps) {
  const [state, setState] = useState(initialState);
  const [activeSection, setActiveSection] = useState<RatesSectionId>(
    parseRatesSection(initialSection) ?? "core"
  );
  const [showAllWorkTypes, setShowAllWorkTypes] = useState(false);
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    sectionHeadingRef.current?.focus();
  }, [activeSection]);

  const preferred = useMemo(
    () => state.preferredWorkAreaTypes ?? [],
    [state.preferredWorkAreaTypes]
  );

  const workTypeCatalogue = useMemo(() => {
    const used = MATERIAL_RATE_CATALOGUE.filter(
      (entry) =>
        entry.calculatorSupport === "used_now" &&
        entry.work_area_type &&
        (entry.recommended || preferred.includes(entry.work_area_type))
    );

    const types = Array.from(
      new Set(
        used
          .map((entry) => entry.work_area_type)
          .filter((type): type is string => Boolean(type))
      )
    );

    const orderedTypes = sortWorkTypesByPreference(types, preferred);
    const visibleTypes =
      showAllWorkTypes || preferred.length === 0
        ? orderedTypes
        : orderedTypes.filter(
            (type) => preferred.includes(type) || orderedTypes.indexOf(type) < 3
          );

    const byType = new Map<string, RateCatalogueEntry[]>();
    for (const entry of used) {
      if (!entry.work_area_type || !visibleTypes.includes(entry.work_area_type)) {
        continue;
      }
      const list = byType.get(entry.work_area_type) ?? [];
      list.push(entry);
      byType.set(entry.work_area_type, list);
    }

    return visibleTypes
      .map((type) => ({
        type,
        label:
          SCOPE_CATALOGUE.find((item) => item.type === type)?.label ?? type,
        preferred: preferred.includes(type),
        entries: byType.get(type) ?? [],
      }))
      .filter((group) => group.entries.length > 0);
  }, [preferred, showAllWorkTypes]);

  const hasCompanyRates = state.rates.some(
    (rate) => rate.active && rate.cost_rate != null
  );

  async function refresh() {
    const refreshed = await getRatesPageState();
    setState(refreshed);
  }

  function selectSection(id: string) {
    const next = parseRatesSection(id) ?? "core";
    setActiveSection(next);
    replaceRatesSectionInUrl(next);
  }

  const activeLabel =
    RATES_SECTIONS.find((section) => section.id === activeSection)?.label ??
    (activeSection === LEGACY_RATES_SECTION.id
      ? LEGACY_RATES_SECTION.label
      : "Rates");

  const companyGrossMarginPercent = resolveCompanyGrossMarginPercent(
    state.settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT
  );

  return (
    <div className="space-y-6">
      <SettingsSectionNav
        items={[...RATES_SECTIONS]}
        activeId={activeSection}
        onChange={selectSection}
      />

      <h2
        ref={sectionHeadingRef}
        tabIndex={-1}
        className="sr-only focus:not-sr-only focus:rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
      >
        {activeLabel}
      </h2>
      <CalibrationSummaryCard state={state} />

      <Card className="border-border/60 bg-muted/15 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your company rates</CardTitle>
          <CardDescription>
            Enter what work costs your business. Quotr recommends charge-out
            from your company gross margin ({companyGrossMarginPercent}%).
            Existing custom charge-outs are kept until you choose the
            recommended rate. Gross margin is under Defaults; GST under{" "}
            <Link
              href="/app/settings/company"
              className="font-medium underline-offset-4 hover:underline"
            >
              Company settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {!hasCompanyRates ? (
            <p>
              No company rates yet — start with carpenter / builder under Core
              labour. You can add more rates as you use Quotr.
            </p>
          ) : (
            <p>
              Preferred work types personalise the Work types section order.
              Show all remains available — preferences never hide capability.
            </p>
          )}
          <Link
            href="/app/setup?mode=improve"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Improve setup
          </Link>
        </CardContent>
      </Card>

      <div className="min-w-0">
        {activeSection === "core" ? (
          <RatesTableSection
            title="Core labour"
            description={`Enter your cost per hour. Recommended charge-out uses your ${companyGrossMarginPercent}% company gross margin. Custom charge-outs stay until you switch to recommended.`}
            catalogue={LABOUR_RATE_CATALOGUE.filter(
              (entry) =>
                entry.item_key === "labour.carpenter.hour" ||
                entry.item_key === "labour.labourer.hour" ||
                entry.item_key === "labour.general.hour"
            )}
            rates={state.rates}
            onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
            companyGrossMarginPercent={companyGrossMarginPercent}
            variant="labour"
            showEngineColumn
          />
        ) : null}

        {activeSection === "productivity" ? (
          <RatesTableSection
            title="Labour productivity"
            description="Hours per physical unit — not dollars. Editing hours changes labour TIME. Your labour $/hr is under Core labour and changes MONEY, not hours. These hours include normal handling at the workface. Abnormal access/carry is a Project Condition, applied once."
            catalogue={DECK_PRODUCTIVITY_RATE_CATALOGUE}
            rates={state.rates}
            onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
            companyGrossMarginPercent={companyGrossMarginPercent}
            variant="productivity"
            showEngineColumn
          />
        ) : null}

        {activeSection === "work_types" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Component rates calculators actually use
                {preferred.length > 0
                  ? " — preferred work types listed first."
                  : "."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllWorkTypes((prev) => !prev)}
              >
                {showAllWorkTypes ? "Show preferred first" : "Show all work types"}
              </Button>
            </div>
            {workTypeCatalogue.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No component rate groups to show. Choose work types in Setup or
                open All materials.
              </p>
            ) : (
              workTypeCatalogue.map((group) => (
                <RatesTableSection
                  key={group.type}
                  title={
                    group.preferred
                      ? `${group.label} (common for your company)`
                      : group.label
                  }
                  description={
                    group.type === "deck"
                      ? "Decking $/m² is cost per m² of deck area for the same boards — a fallback if you have no $/lm board rate under All materials. It is not a $/lm rate and not a whole-deck package (framing and fixings are separate)."
                      : "Enter your cost. Charge-out follows company gross margin unless you keep a custom charge-out."
                  }
                  catalogue={group.entries}
                  rates={state.rates}
                  onRatesChange={(rates) =>
                    setState((prev) => ({ ...prev, rates }))
                  }
                  companyGrossMarginPercent={companyGrossMarginPercent}
                  variant="grouped"
                  showEngineColumn
                  showAddButton={false}
                />
              ))
            )}
          </div>
        ) : null}

        {activeSection === "materials" ? (
          <SpecificMaterialRatesSection
            rates={state.rates}
            onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
            companyGrossMarginPercent={companyGrossMarginPercent}
          />
        ) : null}

        {activeSection === "legacy" ? (
          <RatesTableSection
            title="Legacy package rates"
            description="Older overall package rates kept for history and compatibility. Current estimates use Core labour, Work types, and materials above — prefer those. Cost-first still applies if you edit a cost here."
            catalogue={SCOPE_RATE_CATALOGUE}
            rates={state.rates}
            onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
            companyGrossMarginPercent={companyGrossMarginPercent}
            variant="grouped"
            showEngineColumn
          />
        ) : null}

        {activeSection === "defaults" ? (
          <CompanyDefaultsSection
            settings={state.settings}
            onSettingsChange={(settings) =>
              setState((prev) => ({ ...prev, settings }))
            }
          />
        ) : null}

        {activeSection === "benchmarks" ? (
          <BenchmarkFallbackSection settings={state.settings} />
        ) : null}
      </div>

      <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-3">
        <p className="text-xs font-medium text-muted-foreground">Advanced</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Older overall package rates are kept for history only. Current jobs use
          Core labour, Work types, and materials.
        </p>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mt-2 h-8 px-2 text-xs"
          )}
          onClick={() => selectSection(LEGACY_RATES_SECTION.id)}
          aria-current={
            activeSection === LEGACY_RATES_SECTION.id ? "page" : undefined
          }
        >
          {LEGACY_RATES_SECTION.label}
        </button>
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
