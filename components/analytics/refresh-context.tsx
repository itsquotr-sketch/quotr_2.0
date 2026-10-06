"use client";

import { createContext, useContext } from "react";

export type AnalyticsRefreshInput = {
  period: string;
  from?: string;
  to?: string;
  restore?: boolean;
};

export type AnalyticsRefreshResult =
  | { ok: true }
  | { ok: false; error?: string; stale?: boolean };

export const AnalyticsRefreshContext = createContext<
  ((input: AnalyticsRefreshInput) => Promise<AnalyticsRefreshResult>) | null
>(null);

export function useAnalyticsRefresh() {
  return useContext(AnalyticsRefreshContext);
}
