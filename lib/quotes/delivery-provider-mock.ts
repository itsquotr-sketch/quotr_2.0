import type {
  QuoteDeliveryEmailPayload,
  QuoteDeliveryProvider,
  QuoteDeliveryProviderResult,
} from "@/lib/quotes/delivery-types";

export function createMockQuoteDeliveryProvider(options?: {
  configured?: boolean;
  result?: QuoteDeliveryProviderResult;
  onSend?: (payload: QuoteDeliveryEmailPayload) => void;
}): QuoteDeliveryProvider & { sent: QuoteDeliveryEmailPayload[] } {
  const sent: QuoteDeliveryEmailPayload[] = [];
  return {
    name: "mock",
    sent,
    isConfigured() {
      return options?.configured ?? true;
    },
    async send(payload) {
      const replay = sent.find(
        (row) => row.idempotencyKey === payload.idempotencyKey
      );
      if (replay) {
        if (options?.result) return options.result;
        return { ok: true, providerMessageId: "mock_replay" };
      }
      options?.onSend?.(payload);
      sent.push(payload);
      if (options?.result) return options.result;
      return { ok: true, providerMessageId: `mock_${sent.length}` };
    },
  };
}
