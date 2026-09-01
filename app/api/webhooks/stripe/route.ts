import { handleStripeWebhookRequest } from "@/lib/billing/webhook-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
