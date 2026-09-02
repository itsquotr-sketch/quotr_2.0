import type { EntitlementCapability } from "@/lib/billing/capabilities";

/**
 * Historical QuoteEntitlementKey union, including the legacy alias.
 */
export type QuoteEntitlementKey =
  | Extract<
      EntitlementCapability,
      "quotes.send" | "quotes.acceptance" | "quotes.approval" | "margin.guardrails"
    >
  | "quote.approval";
