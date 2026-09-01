"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import type { ProjectWorkspaceTab } from "@/components/projects/ProjectWorkspaceTabs";
import type { EstimateGenerationResult } from "@/lib/assistant/types";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";

type EstimateGenerationNavProjection = {
  hasEstimate: boolean;
  estimateIsStale: boolean;
  pricingSummary: PricingSummary | null;
};

type EstimateGenerationProjectionContextValue = {
  projection: EstimateGenerationNavProjection;
  applyEstimateGeneration: (result: EstimateGenerationResult) => void;
  markEstimateStale: () => void;
  clearEstimateGeneration: () => void;
};

const EstimateGenerationProjectionContext =
  createContext<EstimateGenerationProjectionContextValue | null>(null);

export function EstimateGenerationProjectionProvider({
  children,
  initialHasEstimate,
  initialEstimateIsStale,
  initialPricingSummary,
}: {
  children: ReactNode;
  initialHasEstimate: boolean;
  initialEstimateIsStale: boolean;
  initialPricingSummary: PricingSummary | null;
}) {
  const [overlay, setOverlay] = useState<EstimateGenerationNavProjection | null>(
    null
  );

  const applyEstimateGeneration = useCallback(
    (result: EstimateGenerationResult) => {
      setOverlay({
        hasEstimate: true,
        estimateIsStale: result.stale,
        pricingSummary: result.pricingSummary,
      });
    },
    []
  );

  const markEstimateStale = useCallback(() => {
    setOverlay((prev) => {
      const hasEstimate = prev?.hasEstimate ?? initialHasEstimate;
      return {
        hasEstimate,
        estimateIsStale: hasEstimate,
        pricingSummary: prev?.pricingSummary ?? initialPricingSummary,
      };
    });
  }, [initialHasEstimate, initialPricingSummary]);

  const clearEstimateGeneration = useCallback(() => {
    setOverlay(null);
  }, []);

  const value = useMemo(() => {
    const projection = overlay ?? {
      hasEstimate: initialHasEstimate,
      estimateIsStale: initialEstimateIsStale,
      pricingSummary: initialPricingSummary,
    };
    return {
      projection,
      applyEstimateGeneration,
      markEstimateStale,
      clearEstimateGeneration,
    };
  }, [
    applyEstimateGeneration,
    markEstimateStale,
    clearEstimateGeneration,
    initialEstimateIsStale,
    initialHasEstimate,
    initialPricingSummary,
    overlay,
  ]);

  return (
    <EstimateGenerationProjectionContext.Provider value={value}>
      {children}
    </EstimateGenerationProjectionContext.Provider>
  );
}

export function useEstimateGenerationProjection(): EstimateGenerationProjectionContextValue | null {
  return useContext(EstimateGenerationProjectionContext);
}

export function ProjectWorkspaceNavProjected({
  projectId,
  activeTab,
  quoteSummary = null,
}: {
  projectId: string;
  activeTab: ProjectWorkspaceTab;
  quoteSummary?: QuoteSummary | null;
}) {
  const ctx = useEstimateGenerationProjection();
  const projection = ctx?.projection;
  return (
    <ProjectWorkspaceNav
      projectId={projectId}
      activeTab={activeTab}
      pricingSummary={projection?.pricingSummary ?? null}
      quoteSummary={quoteSummary}
      hasEstimate={projection?.hasEstimate}
      estimateIsStale={projection?.estimateIsStale}
    />
  );
}
