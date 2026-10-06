"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { AnalyticsRefreshContext, type AnalyticsRefreshResult } from "@/components/analytics/refresh-context";
import { loadAnalyticsPeriodView } from "@/lib/analytics/actions";
import type { AnalyticsPageData } from "@/lib/analytics/load-analytics";
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

type Transport = "single" | "split" | "stream";

function selectedTransport(): Transport {
  try {
    const value = sessionStorage.getItem("quotr-analytics-transport");
    if (value === "single" || value === "split" || value === "stream") return value;
  } catch {
    // Private browsing can block storage. The page then uses the stream.
  }
  return "stream";
}

async function postScope(
  scope: "headline" | "business" | "full" | "stream",
  period: string,
  from?: string,
  to?: string
): Promise<AnalyticsPageData> {
  try {
    const response = await fetch("/api/analytics/period", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ period, from, to, scope }),
    });
    const payload = (await response.json()) as AnalyticsPageData;
    if (payload && typeof payload === "object" && "kind" in payload) return payload;
  } catch {
    // The caller treats a failed read as denied and keeps the previous figures.
  }
  return {
    kind: "denied",
    message: "Analytics could not be loaded.",
    reasonCode: null,
    upgradeTarget: null,
  };
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
    let pushed = false;

    function push(next: AnalyticsViewData) {
      if (input.restore || pushed) return;
      pushed = true;
      const href =
        next.periodId === "custom"
          ? analyticsRangeHref({ period: "custom", from: next.from ?? "", to: next.to ?? "" })
          : analyticsPeriodHref(next.periodId);
      window.history.pushState(null, "", href);
    }

    function reject(payload: AnalyticsPageData): AnalyticsRefreshResult {
      setHeadlinePhase("ready");
      setBusinessPhase("ready");
      if (payload.kind === "invalid_range") return { ok: false, error: payload.error };
      return { ok: false, error: payload.kind === "denied" ? payload.message : "Sign in required." };
    }

    function paintHeadline(payload: Extract<AnalyticsPageData, { kind: "ready" }>) {
      flushSync(() => {
        setView(payload.view);
        setUpgrade(payload.upgrade);
        setHeadlinePhase("ready");
        setHeadlineMs(Math.round(performance.now() - started));
        if (payload.view.tier !== "business") setBusinessPhase("ready");
      });
      push(payload.view);
    }

    function paintPanels(payload: Extract<AnalyticsPageData, { kind: "ready" }>, replace: boolean) {
      flushSync(() => {
        setView((current) => (replace ? payload.view : applyBusiness(current, payload.view)));
        setUpgrade(payload.upgrade);
        setBusinessTiming(payload.view.serverTiming);
        setBusinessPhase("ready");
        setBusinessMs(Math.round(performance.now() - started));
      });
    }

    const transport = selectedTransport();
    if (transport === "single") {
      const payload = await loadAnalyticsPeriodView(input.period, input.from, input.to);
      if (id !== request.current) return { ok: false, stale: true };
      if (payload.kind !== "ready") return reject(payload);
      const elapsed = Math.round(performance.now() - started);
      flushSync(() => {
        setView(payload.view);
        setUpgrade(payload.upgrade);
        setHeadlinePhase("ready");
        setBusinessPhase("ready");
        setHeadlineMs(elapsed);
        setBusinessMs(elapsed);
        setBusinessTiming(payload.view.serverTiming);
      });
      push(payload.view);
      return { ok: true };
    }

    if (transport === "split") {
      const headlinePromise = postScope("headline", input.period, input.from, input.to);
      const businessPromise = postScope("business", input.period, input.from, input.to);
      const headline = await headlinePromise;
      if (id !== request.current) return { ok: false, stale: true };
      if (headline.kind !== "ready") return reject(headline);
      paintHeadline(headline);
      const business = await businessPromise;
      if (id !== request.current) return { ok: false, stale: true };
      if (business.kind !== "ready") {
        setBusinessPhase("ready");
        setBusinessMs(Math.round(performance.now() - started));
        if (headline.view.tier === "business") {
          setBusinessError(
            business.kind === "denied" ? business.message : business.kind === "invalid_range" ? business.error : "Sign in required."
          );
        }
        return { ok: true };
      }
      paintPanels(business, false);
      return { ok: true };
    }

    let sawHeadline = false;
    let result: AnalyticsRefreshResult = { ok: true };
    try {
      const response = await fetch("/api/analytics/period", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ period: input.period, from: input.from, to: input.to, scope: "stream" }),
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error("missing body");
      const decoder = new TextDecoder();
      let buffer = "";
      const take = (payload: AnalyticsPageData) => {
        if (id !== request.current) {
          result = { ok: false, stale: true };
          return;
        }
        if (payload.kind !== "ready") {
          if (!sawHeadline) result = reject(payload);
          else if (payload.kind === "denied" || payload.kind === "invalid_range") {
            setBusinessPhase("ready");
            setBusinessError(payload.kind === "denied" ? payload.message : payload.error);
          }
          return;
        }
        if (!sawHeadline) {
          sawHeadline = true;
          paintHeadline(payload);
          if (payload.view.tier !== "business" || payload.view.workAreas !== null) paintPanels(payload, true);
          return;
        }
        paintPanels(payload, false);
      };
      while (result.ok) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) take(JSON.parse(line) as AnalyticsPageData);
          newline = buffer.indexOf("\n");
        }
      }
    } catch {
      if (id !== request.current) return { ok: false, stale: true };
      if (!sawHeadline) {
        return reject({
          kind: "denied",
          message: "Analytics could not be loaded.",
          reasonCode: null,
          upgradeTarget: null,
        });
      }
      setBusinessPhase("ready");
      setBusinessError("Analytics could not be loaded.");
    }
    return id === request.current ? result : { ok: false, stale: true };
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
