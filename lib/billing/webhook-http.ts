import "server-only";
import { NextResponse } from "next/server";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { readStripePriceConfig } from "@/lib/billing/prices";
import { constructStripeWebhookEvent } from "@/lib/billing/stripe";
import { createSupabaseBillingStore } from "@/lib/billing/supabase-store";
import { processBillingStripeEvent } from "@/lib/billing/webhook";
import type { StripeEventLike } from "@/lib/billing/types";

export async function handleStripeWebhookRequest(
  request: Request
): Promise<Response> {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let billingEnvironment;
  try {
    billingEnvironment = resolveBillingEnvironment();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let event;
  try {
    event = constructStripeWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let prices;
  try {
    prices = readStripePriceConfig();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let store;
  try {
    store = createSupabaseBillingStore();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const like: StripeEventLike = {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    created: event.created,
    data: {
      object:
        event.data.object && typeof event.data.object === "object"
          ? (event.data.object as unknown as Record<string, unknown>)
          : {},
    },
  };

  const result = await processBillingStripeEvent({
    event: like,
    billingEnvironment,
    prices,
    store,
  });

  return NextResponse.json(
    { ok: result.result !== "failed" && result.result !== "rejected" },
    { status: result.httpStatus }
  );
}
