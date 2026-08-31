export function normalizeDeliveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function quoteDeliveryIdempotencyKey(input: {
  quoteId: string;
  revisionNumber: number;
  fingerprint: string;
  recipientEmail: string;
  kind: "send" | "resend";
  resendAttempt?: number;
}): string {
  const email = normalizeDeliveryEmail(input.recipientEmail);
  if (input.kind === "send") {
    return `send:v1:${input.quoteId}:${input.revisionNumber}:${input.fingerprint}:${email}`;
  }
  const attempt = input.resendAttempt ?? 1;
  return `resend:v1:${input.quoteId}:${input.revisionNumber}:${input.fingerprint}:${email}:${attempt}`;
}
