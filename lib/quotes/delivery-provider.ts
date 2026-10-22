import "server-only";

import { sendResendEmail } from "@/lib/email/resend-send";
import { createMockQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider-mock";
import type {
  QuoteDeliveryEmailPayload,
  QuoteDeliveryProvider,
  QuoteDeliveryProviderResult,
} from "@/lib/quotes/delivery-types";

export function createResendQuoteDeliveryProvider(): QuoteDeliveryProvider {
  return {
    name: "resend",
    isConfigured() {
      return Boolean(process.env["RESEND_API_KEY"]?.trim());
    },
    send(payload: QuoteDeliveryEmailPayload): Promise<QuoteDeliveryProviderResult> {
      return sendResendEmail(payload);
    },
  };
}

export function getQuoteDeliveryProvider(): QuoteDeliveryProvider {
  if (process.env["QUOTE_DELIVERY_PROVIDER"] === "mock") {
    return createMockQuoteDeliveryProvider();
  }
  return createResendQuoteDeliveryProvider();
}
