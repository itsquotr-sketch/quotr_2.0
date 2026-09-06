"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSectionNav } from "@/components/layout/section-nav";
import { LABOUR_RATE_CATALOGUE, SCOPE_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import {
  DECK_PRODUCTIVITY_RATE_CATALOGUE,
  FENCE_PRODUCTIVITY_RATE_CATALOGUE,
  RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
  SPECIFIC_MATERIAL_RATE_GROUPS,
  WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
} from "@/lib/rates/specific-material-catalogue";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import { getRatesPageState } from "@/lib/rates/actions";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import type { RatesPageState } from "@/lib/rates/types";
import {
  parseRatesSection,
  type RatesSectionId,
} from "@/lib/setup/recommendation-destinations";
import { cn } from "@/lib/utils";
import { BenchmarkFallbackSection } from "./BenchmarkFallbackSection";
import { CompanyDefaultsSection } from "./CompanyDefaultsSection";
import { MaterialWastageDefaultsSection } from "./MaterialWastageDefaultsSection";
import { RatesTableSection } from "./RatesTableSection";
import { CompanyDnaRatesCompare } from "./CompanyDnaRatesCompare";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { resolveCompanyGrossMarginPercent } from "@/lib/rates/cost-first-presentation";
import type { CompanySettings } from "@/lib/settings/types";

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

function plantCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => [...group.entries]).filter(
      (entry) =>
        entry.item_key.startsWith("plant.") ||
        entry.workAreaLabel?.toLowerCase().includes("plant")
    ),
    "material"
  );
}

function subcontractCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => [...group.entries]).filter(
      (entry) => entry.category === "subcontractor"
    ),
    "material"
  );
}

function materialGroups() {
  return SPECIFIC_MATERIAL_RATE_GROUPS.filter((group) => {
    const title = group.title.toLowerCase();
    if (title.startsWith("waste")) return false;
    const onlyPlant = group.entries.every(
      (entry) =>
        entry.item_key.startsWith("plant.") ||
        entry.workAreaLabel?.toLowerCase().includes("plant")
    );
    return !onlyPlant;
  }).map((group) => ({
    ...group,
    entries: group.entries.filter(
      (entry) =>
        !entry.item_key.startsWith("plant.") &&
        !entry.workAreaLabel?.toLowerCase().includes("plant")
    ),
  }));
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
  const [materialQuery, setMaterialQuery] = useState("");

  const preferred = useMemo(
    () => state.preferredWorkAreaTypes ?? [],
    [state.preferredWorkAreaTypes]
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

  const activeLabel =
    RATES_SECTIONS.find((section) => section.id === navActive)?.label ??
    (activeSection === LEGACY_RATES_SECTION.id
      ? LEGACY_RATES_SECTION.label
      : "Rates");

  const companyGrossMarginPercent = resolveCompanyGrossMarginPercent(
    state.settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT
  );

  const filteredMaterialGroups = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    return materialGroups()
      .map((group) => {
        const entries = catalogueEntriesForRatesSection(group.entries, "material");
        if (!q) return { ...group, entries };
        return {
          ...group,
          entries: entries.filter(
            (entry) =>
              entry.label.toLowerCase().includes(q) ||
              entry.item_key.toLowerCase().includes(q)
          ),
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [materialQuery]);

  const plantEntries = plantCatalogue();
  const subcontractEntries = subcontractCatalogue();
  const wasteEntries = catalogueEntriesForRatesSection(
    WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
    "material"
  );

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
        {view === "core" ? (
          <div className="space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
            <RatesTableSection
              title="Labour"
              description={`Enter your cost per hour. Recommended charge-out uses your ${companyGrossMarginPercent}% company gross margin.`}
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
              readOnly={!state.canManageRates}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold tracking-tight">
                Labour productivity
              </h3>
              <CompanyDnaRatesCompare
                rates={state.rates}
                variant="productivity"
                preferredWorkAreaTypes={preferred}
                canCalibrate={state.canCalibrate}
                onChanged={() => {
                  void refresh();
                }}
              />
            </div>
            <details className="rounded-lg border border-dashed border-border/70 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                All productivity keys
              </summary>
              <div className="mt-3">
                <RatesTableSection
                  title="All productivity keys"
                  description="Advanced view of every labour-hours key. Lower means fewer labour hours per unit. Prefer the Work Area groups above. Editing hours here changes labour TIME, not carpenter $/hr."
                  catalogue={catalogueEntriesForRatesSection(
                    [
                      ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
                      ...RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE,
                      ...FENCE_PRODUCTIVITY_RATE_CATALOGUE,
                    ],
                    "productivity"
                  )}
                  rates={state.rates}
                  onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
                  companyGrossMarginPercent={companyGrossMarginPercent}
                  variant="productivity"
                  showEngineColumn
                  readOnly={!state.canManageRates}
                />
              </div>
            </details>
          </div>
        ) : null}

        {view === "materials" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Materials</h2>
              <p className="text-sm text-muted-foreground">
                Your rate is primary when set. Otherwise Quotr benchmark is used
                where one exists.
              </p>
            </div>
            <Input
              type="search"
              value={materialQuery}
              onChange={(event) => setMaterialQuery(event.target.value)}
              placeholder="Search rates"
              aria-label="Search rates"
              className="h-9 max-w-sm"
            />
            {filteredMaterialGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                No matching material rates.
              </p>
            ) : (
              filteredMaterialGroups.map((group) => (
                <RatesTableSection
                  key={group.title}
                  title={group.title}
                  description={group.description}
                  catalogue={group.entries}
                  rates={state.rates}
                  onRatesChange={(rates) =>
                    setState((prev) => ({ ...prev, rates }))
                  }
                  companyGrossMarginPercent={companyGrossMarginPercent}
                  variant="grouped"
                  showEngineColumn
                  readOnly={!state.canManageRates}
                />
              ))
            )}
          </div>
        ) : null}

        {view === "plant" ? (
          plantEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              No plant rates to manage yet.
            </p>
          ) : (
            <RatesTableSection
              title="Plant"
              description="Hire and plant day rates used by current estimates."
              catalogue={plantEntries}
              rates={state.rates}
              onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
              companyGrossMarginPercent={companyGrossMarginPercent}
              variant="grouped"
              showEngineColumn
              readOnly={!state.canManageRates}
            />
          )
        ) : null}

        {view === "subcontract" ? (
          subcontractEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              No subcontract rates to manage yet.
            </p>
          ) : (
            <RatesTableSection
              title="Subcontract"
              description="Company subcontract rates."
              catalogue={subcontractEntries}
              rates={state.rates}
              onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
              companyGrossMarginPercent={companyGrossMarginPercent}
              variant="grouped"
              showEngineColumn
              readOnly={!state.canManageRates}
            />
          )
        ) : null}

        {view === "waste" ? (
          wasteEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              No waste rates to manage yet.
            </p>
          ) : (
            <RatesTableSection
              title="Waste"
              description="Spoil removal and disposal identities. Material wastage percentages live under Defaults."
              catalogue={wasteEntries}
              rates={state.rates}
              onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
              companyGrossMarginPercent={companyGrossMarginPercent}
              variant="grouped"
              showEngineColumn
              readOnly={!state.canManageRates}
            />
          )
        ) : null}

        {activeSection === "legacy" ? (
          <div className="space-y-4">
            <RatesTableSection
              title="Legacy package rates"
              description="Older overall package rates kept for history and compatibility. Current estimates use labour, productivity, and materials above."
              catalogue={SCOPE_RATE_CATALOGUE}
              rates={state.rates}
              onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
              companyGrossMarginPercent={companyGrossMarginPercent}
              variant="grouped"
              showEngineColumn
              readOnly={!state.canManageRates}
            />
          </div>
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

        {activeSection === "benchmarks" ? (
          <BenchmarkFallbackSection settings={state.settings} />
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
