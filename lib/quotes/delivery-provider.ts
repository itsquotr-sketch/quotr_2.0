import "server-only";

import { createMockQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider-mock";
import type {
  QuoteDeliveryEmailPayload,
  QuoteDeliveryProvider,
  QuoteDeliveryProviderResult,
} from "@/lib/quotes/delivery-types";

function mapResendFailure(status: number): QuoteDeliveryProviderResult {
  const retryable = status >= 500 || status === 429;
  if (status === 401 || status === 403) {
    return {
      ok: false,
      retryable: false,
      code: "provider_auth",
      messageSafe: "Email delivery is not configured correctly.",
    };
  }
  if (status === 422) {
    return {
      ok: false,
      retryable: false,
      code: "invalid_recipient",
      messageSafe: "The recipient email was rejected.",
    };
  }
  return {
    ok: false,
    retryable,
    code: retryable ? "provider_unavailable" : "provider_rejected",
    messageSafe: retryable
      ? "The email service is temporarily unavailable. Try again shortly."
      : "The email could not be sent.",
  };
}

export function createResendQuoteDeliveryProvider(): QuoteDeliveryProvider {
  return {
    name: "resend",
    isConfigured() {
      return Boolean(process.env["RESEND_API_KEY"]?.trim());
    },
    async send(payload: QuoteDeliveryEmailPayload): Promise<QuoteDeliveryProviderResult> {
      const apiKey = process.env["RESEND_API_KEY"]?.trim();
      if (!apiKey) {
        return {
          ok: false,
          retryable: false,
          code: "provider_auth",
          messageSafe: "Email delivery is not configured.",
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": payload.idempotencyKey,
          },
          body: JSON.stringify({
            from: payload.from,
            to: [payload.to],
            reply_to: payload.replyTo || undefined,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
          }),
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok) {
          return mapResendFailure(response.status);
        }
        let id = "";
        try {
          const parsed = JSON.parse(body) as { id?: unknown };
          id = typeof parsed.id === "string" ? parsed.id : "";
        } catch {
          id = "";
        }
        if (!id) {
          return {
            ok: false,
            retryable: true,
            code: "provider_unavailable",
            messageSafe: "The email service did not confirm delivery.",
          };
        }
        return { ok: true, providerMessageId: id };
      } catch (error) {
        const aborted =
          error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          retryable: true,
          code: aborted ? "provider_timeout" : "network_error",
          messageSafe: aborted
            ? "The email service timed out. Try again shortly."
            : "Could not reach the email service. Try again shortly.",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getQuoteDeliveryProvider(): QuoteDeliveryProvider {
  if (process.env["QUOTE_DELIVERY_PROVIDER"] === "mock") {
    return createMockQuoteDeliveryProvider();
  }
  return createResendQuoteDeliveryProvider();
}
