"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { AnalyticsRefreshContext, type AnalyticsRefreshResult } from "@/components/analytics/refresh-context";
import { loadAnalyticsBusinessView, loadAnalyticsHeadlineView } from "@/lib/analytics/actions";
import type { AnalyticsView as AnalyticsViewData, BusinessAnalyticsView } from "@/lib/analytics/measure";
import { analyticsPeriodHref, analyticsRangeHref } from "@/lib/analytics/presentation";

type RefreshInput = {
  period: string;
  from?: string;
  to?: string;
  restore?: boolean;
};

type Phase = "ready" | "updating";

function sameRange(current: AnalyticsViewData, incoming: AnalyticsViewData): boolean {
  return (
    current.periodId === incoming.periodId &&
    current.from === incoming.from &&
    current.to === incoming.to
  );
}

function applyBusiness(current: AnalyticsViewData, incoming: AnalyticsViewData): AnalyticsViewData {
  if (incoming.tier !== "business" || current.tier !== "business") return incoming;
  if (!sameRange(current, incoming)) return current;
  const next: BusinessAnalyticsView = {
    ...current,
    pipeline: incoming.pipeline,
    pipelineUnavailableReason: incoming.pipelineUnavailableReason,
    variations: incoming.variations,
    workAreas: incoming.workAreas,
    workAreaCheck: incoming.workAreaCheck,
    rateSources: incoming.rateSources,
    pricing: incoming.pricing,
  };
  return next;
}

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
  const [headlinePhase, setHeadlinePhase] = useState<Phase>("ready");
  const [businessPhase, setBusinessPhase] = useState<Phase>("ready");
  const [headlineMs, setHeadlineMs] = useState<number | null>(null);
  const [businessMs, setBusinessMs] = useState<number | null>(null);
  const [businessTiming, setBusinessTiming] = useState<Record<string, number> | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const request = useRef(0);
  const tier = useRef(initial.view.tier);

  useEffect(() => {
    tier.current = view.tier;
  }, [view.tier]);

  const commit = useCallback(async (input: RefreshInput): Promise<AnalyticsRefreshResult> => {
    const id = ++request.current;
    const started = performance.now();
    setHeadlinePhase("updating");
    setHeadlineMs(null);
    setBusinessMs(null);
    setBusinessError(null);
    if (tier.current === "business") setBusinessPhase("updating");

    const headlinePromise = loadAnalyticsHeadlineView(input.period, input.from, input.to);
    const businessPromise = loadAnalyticsBusinessView(input.period, input.from, input.to);
    const headline = await headlinePromise;
    if (id !== request.current) return { ok: false, stale: true };
    if (headline.kind === "invalid_range") {
      setHeadlinePhase("ready");
      setBusinessPhase("ready");
      return { ok: false, error: headline.error };
    }
    if (headline.kind !== "ready") {
      setHeadlinePhase("ready");
      setBusinessPhase("ready");
      return { ok: false, error: headline.kind === "denied" ? headline.message : "Sign in required." };
    }

    flushSync(() => {
      setView(headline.view);
      setUpgrade(headline.upgrade);
      setHeadlinePhase("ready");
      setHeadlineMs(Math.round(performance.now() - started));
      if (headline.view.tier !== "business") setBusinessPhase("ready");
    });
    if (!input.restore) {
      const href =
        headline.view.periodId === "custom"
          ? analyticsRangeHref({
              period: "custom",
              from: headline.view.from ?? "",
              to: headline.view.to ?? "",
            })
          : analyticsPeriodHref(headline.view.periodId);
      window.history.pushState(null, "", href);
    }

    const business = await businessPromise;
    if (id !== request.current) return { ok: false, stale: true };
    if (business.kind === "ready") {
      flushSync(() => {
        setView((current) => applyBusiness(current, business.view));
        setUpgrade(business.upgrade);
        setBusinessTiming(business.view.serverTiming);
        setBusinessPhase("ready");
        setBusinessMs(Math.round(performance.now() - started));
      });
      return { ok: true };
    }
    setBusinessPhase("ready");
    setBusinessMs(Math.round(performance.now() - started));
    if (headline.view.tier === "business") {
      setBusinessError(business.kind === "denied" ? business.message : business.kind === "invalid_range" ? business.error : "Sign in required.");
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
      <AnalyticsView
        view={view}
        upgrade={upgrade}
        headlinePhase={headlinePhase}
        businessPhase={businessPhase}
        headlineMs={headlineMs}
        businessMs={businessMs}
        businessTiming={businessTiming}
        businessError={businessError}
      />
    </AnalyticsRefreshContext.Provider>
  );
}
