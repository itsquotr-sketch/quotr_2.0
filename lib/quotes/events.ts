import { APPEND_QUOTE_UPDATED_RPC, invokeQuoteTxn } from "@/lib/quotes/quote-rpc";
import type { QuoteActorType, QuoteEventType } from "@/lib/quotes/types";

export type AppendQuoteEventInput = {
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  orgId: string;
  projectId: string;
  quoteId: string;
  eventType: QuoteEventType;
  actorType: QuoteActorType;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Draft-only quote_updated history. Canonical lifecycle events
 * (sent/accepted/...) are written inside domain RPCs, not here.
 */
export async function appendQuoteEvent(
  input: AppendQuoteEventInput
): Promise<string | null> {
  if (input.eventType !== "quote_updated") {
    return "Could not record quote history. Please try again.";
  }

  const result = await invokeQuoteTxn(input.supabase, APPEND_QUOTE_UPDATED_RPC, {
    p_quote_id: input.quoteId,
    p_metadata: input.metadata ?? {},
  });
  if ("error" in result) {
    if (process.env.NODE_ENV === "development") {
      console.error("[quote-event]", input.eventType, result.error);
    }
    return result.error;
  }
  return null;
}
