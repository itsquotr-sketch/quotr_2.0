export type BillingLogFields = {
  stripeEventId?: string;
  eventType?: string;
  billingEnvironment?: string;
  result?: string;
  orgId?: string | null;
  errorCode?: string | null;
};

const FORBIDDEN_LOG_KEYS = [
  "card",
  "cvc",
  "number",
  "secret",
  "whsec",
  "sk_live",
  "sk_test",
];

export function billingLogLine(fields: BillingLogFields): string {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === "") {
      continue;
    }
    const text = String(value);
    if (
      FORBIDDEN_LOG_KEYS.some((token) =>
        text.toLowerCase().includes(token.toLowerCase())
      )
    ) {
      continue;
    }
    safe[key] = text;
  }
  return `[billing] ${JSON.stringify(safe)}`;
}

export function logBillingEvent(fields: BillingLogFields): void {
  console.info(billingLogLine(fields));
}
