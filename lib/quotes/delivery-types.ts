export type QuoteDeliveryStatus =
  | "preparing"
  | "accepted"
  | "submitted"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained";

export type QuoteDeliveryKind = "send" | "resend";

export type QuoteDeliveryRecord = {
  id: string;
  quote_id: string;
  recipient_email: string;
  recipient_name: string | null;
  message: string | null;
  provider: string;
  kind?: QuoteDeliveryKind;
  status: QuoteDeliveryStatus;
  attempt_number: number;
  snapshot_fingerprint?: string | null;
  provider_message_id?: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  failure_message_safe: string | null;
  created_at: string;
};

export type QuoteDeliveryProviderResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; retryable: boolean; code: string; messageSafe: string };

export type QuoteDeliveryEmailPayload = {
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type QuoteDeliveryProvider = {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: QuoteDeliveryEmailPayload): Promise<QuoteDeliveryProviderResult>;
};
