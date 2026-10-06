"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { AnalyticsRefreshContext, type AnalyticsRefreshResult } from "@/components/analytics/refresh-context";
import { loadAnalyticsPeriodView } from "@/lib/analytics/actions";
import type { AnalyticsView as AnalyticsViewData } from "@/lib/analytics/measure";
import { analyticsPeriodHref, analyticsRangeHref } from "@/lib/analytics/presentation";

type RefreshInput = {
  period: string;
  from?: string;
  to?: string;
  restore?: boolean;
};

export function AnalyticsLive({
  initial,
}: {
  initial: {
    view: AnalyticsViewData;
    upgrade: { message: string; href: string } | null;
  };
}) {
  const [view, setView] = useState(initial.view);
  const [upgrade, setUpgrade] = useState(initial.upgrade);
  const request = useRef(0);

  const commit = useCallback(async (input: RefreshInput): Promise<AnalyticsRefreshResult> => {
    const id = ++request.current;
    const result = await loadAnalyticsPeriodView(input.period, input.from, input.to);
    if (id !== request.current) return { ok: false, stale: true };
    if (result.kind === "invalid_range") return { ok: false, error: result.error };
    if (result.kind !== "ready") {
      return { ok: false, error: result.kind === "denied" ? result.message : "Sign in required." };
    }
    setView(result.view);
    setUpgrade(result.upgrade);
    if (!input.restore) {
      const href =
        result.view.periodId === "custom"
          ? analyticsRangeHref({
              period: "custom",
              from: result.view.from ?? "",
              to: result.view.to ?? "",
            })
          : analyticsPeriodHref(result.view.periodId);
      window.history.pushState(null, "", href);
    }
    return { ok: true };
  }, []);

  useEffect(() => {
    function onPop() {
      const params = new URLSearchParams(window.location.search);
      void commit({
        period: params.get("period") ?? "this_month",
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        restore: true,
      });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [commit]);

  return (
    <AnalyticsRefreshContext.Provider value={commit}>
      <AnalyticsView view={view} upgrade={upgrade} />
    </AnalyticsRefreshContext.Provider>
  );
}
