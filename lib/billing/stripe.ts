import "server-only";
import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let stripeClient: Stripe | null = null;

export function isStripeSecretConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripeClient(
  env: Readonly<Record<string, string | undefined>> = process.env
): Stripe {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeClient;
}

export function getStripeWebhookSecret(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return secret;
}

export function constructStripeWebhookEvent(
  payload: string,
  signature: string | null,
  env: Readonly<Record<string, string | undefined>> = process.env
): Stripe.Event {
  if (!signature?.trim()) {
    throw new Error("Missing Stripe-Signature header.");
  }
  return Stripe.webhooks.constructEvent(
    payload,
    signature,
    getStripeWebhookSecret(env)
  );
}
