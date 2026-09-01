export type QuoteNotificationType = "quote_accepted" | "quote_declined";

export type QuoteNotificationEmailKind =
  | "quote_accepted_builder"
  | "quote_accepted_client"
  | "quote_declined_builder";

export type NotificationDeliveryStatus =
  | "pending"
  | "submitted"
  | "delivered"
  | "failed";

export type QuoteNotificationRecord = {
  id: string;
  notification_type: QuoteNotificationType;
  title: string;
  body: string;
  resource_id: string | null;
  project_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  action_url: string | null;
};

export function isMissingNotificationTableError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    ((message.includes("notifications") ||
      message.includes("notification_deliveries")) &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

export function quoteNotificationIdempotencyKey(input: {
  kind: QuoteNotificationEmailKind;
  evidenceId: string;
  recipient: string;
}): string {
  const recipient = input.recipient.trim().toLowerCase();
  if (input.kind === "quote_accepted_builder") {
    return `quote-accepted-builder:v1:${input.evidenceId}:${recipient}`;
  }
  if (input.kind === "quote_accepted_client") {
    return `quote-accepted-client:v1:${input.evidenceId}:${recipient}`;
  }
  return `quote-declined-builder:v1:${input.evidenceId}:${recipient}`;
}
