"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import {
  LABOUR_RATE_CATALOGUE,
  MATERIAL_RATE_CATALOGUE,
  SCOPE_RATE_CATALOGUE,
} from "@/lib/rates/catalogue";
import { createStarterRates, getRatesPageState } from "@/lib/rates/actions";
import type { RatesPageState } from "@/lib/rates/types";
import { BenchmarkFallbackSection } from "./BenchmarkFallbackSection";
import { CalibrationSummaryCard } from "./CalibrationSummaryCard";
import { CompanyDefaultsSection } from "./CompanyDefaultsSection";
import { RatesTableSection } from "./RatesTableSection";

type RatesPageContentProps = {
  initialState: RatesPageState;
};

export function RatesPageContent({ initialState }: RatesPageContentProps) {
  const [state, setState] = useState(initialState);
  const [creatingStarter, setCreatingStarter] = useState(false);
  const [starterError, setStarterError] = useState<string | null>(null);

  const hasRates = state.rates.some(
    (rate) => rate.active && rate.cost_rate != null
  );

  async function handleCreateStarterRates() {
    setCreatingStarter(true);
    setStarterError(null);

    const result = await createStarterRates();

    if (result.error) {
      setStarterError(result.error);
      setCreatingStarter(false);
      return;
    }

    const refreshed = await getRatesPageState();
    setState(refreshed);
    setCreatingStarter(false);
  }

  return (
    <div className="space-y-6">
      <CalibrationSummaryCard state={state} />

      {!hasRates ? (
        <EmptyState
          title="No rates set yet"
          description="Create starter rates to begin calibrating Quotr to your business. You can refine scope and material rates afterwards."
          action={
            <div className="space-y-2">
              {starterError ? (
                <p className="text-sm text-destructive">{starterError}</p>
              ) : null}
              <Button
                type="button"
                onClick={handleCreateStarterRates}
                disabled={creatingStarter}
              >
                {creatingStarter ? "Creating…" : "Create starter rates"}
              </Button>
            </div>
          }
        />
      ) : null}

      <CompanyDefaultsSection
        settings={state.settings}
        onSettingsChange={(settings) =>
          setState((prev) => ({ ...prev, settings }))
        }
      />

      <RatesTableSection
        title="Labour rates"
        description="Used when Quotr estimates in-house labour. If charge rate is blank, Quotr derives it from your default margin."
        catalogue={LABOUR_RATE_CATALOGUE}
        rates={state.rates}
        onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
        variant="labour"
      />

      <RatesTableSection
        title="Scope / package rates"
        description="Optional shortcut rates. Planned rates are stored for future estimation support."
        catalogue={SCOPE_RATE_CATALOGUE}
        rates={state.rates}
        onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
        variant="grouped"
        showEngineColumn
      />

      <RatesTableSection
        title="Materials and allowances"
        description="Recommended rates that replace benchmark assumptions when set."
        catalogue={MATERIAL_RATE_CATALOGUE.filter(
          (entry) =>
            entry.recommended || entry.calculatorSupport === "used_now"
        )}
        rates={state.rates}
        onRatesChange={(rates) => setState((prev) => ({ ...prev, rates }))}
        variant="grouped"
        showEngineColumn
      />

      <BenchmarkFallbackSection settings={state.settings} />
    </div>
  );
}
