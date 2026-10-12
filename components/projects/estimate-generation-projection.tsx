"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import type { ProjectWorkflowInput } from "@/lib/projects/workflow-orientation";
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
  quantityConflictDetail: string | null;
  setQuantityConflictDetail: (detail: string | null) => void;
  setEstimateUpdate: (action: (() => void) | null) => void;
  runEstimateUpdate: () => void;
  updateDialogOpen: boolean;
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
  initialQuantityConflictDetail = null,
  initialUpdateDialogOpen = false,
}: {
  children: ReactNode;
  initialHasEstimate: boolean;
  initialEstimateIsStale: boolean;
  initialPricingSummary: PricingSummary | null;
  initialQuantityConflictDetail?: string | null;
  initialUpdateDialogOpen?: boolean;
}) {
  const [overlay, setOverlay] = useState<EstimateGenerationNavProjection | null>(
    null
  );
  const [quantityConflictDetail, setQuantityConflictDetail] = useState<string | null>(
    initialQuantityConflictDetail
  );
  const estimateUpdateRef = useRef<(() => void) | null>(null);
  const setEstimateUpdate = useCallback((action: (() => void) | null) => {
    estimateUpdateRef.current = action;
  }, []);
  const runEstimateUpdate = useCallback(() => {
    estimateUpdateRef.current?.();
  }, []);

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
      quantityConflictDetail,
      setQuantityConflictDetail,
      setEstimateUpdate,
      runEstimateUpdate,
      updateDialogOpen: initialUpdateDialogOpen,
      applyEstimateGeneration,
      markEstimateStale,
      clearEstimateGeneration,
    };
  }, [
    applyEstimateGeneration,
    markEstimateStale,
    clearEstimateGeneration,
    runEstimateUpdate,
    setEstimateUpdate,
    initialUpdateDialogOpen,
    initialEstimateIsStale,
    initialHasEstimate,
    initialPricingSummary,
    overlay,
    quantityConflictDetail,
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
  projectContext,
  quoteSummary = null,
}: {
  projectId: string;
  activeTab: ProjectWorkflowInput["activeTab"];
  projectContext: string;
  quoteSummary?: QuoteSummary | null;
}) {
  const ctx = useEstimateGenerationProjection();
  const projection = ctx?.projection;
  return (
    <ProjectWorkspaceNav
      projectId={projectId}
      activeTab={activeTab}
      projectContext={projectContext}
      pricingSummary={projection?.pricingSummary ?? null}
      quoteSummary={quoteSummary}
      hasEstimate={projection?.hasEstimate}
      estimateIsStale={projection?.estimateIsStale}
      quantityConflictDetail={ctx?.quantityConflictDetail}
      onUpdateEstimate={ctx?.runEstimateUpdate}
      updateDialogOpen={ctx?.updateDialogOpen}
    />
  );
}
