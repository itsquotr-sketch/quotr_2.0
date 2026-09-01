import { formatQuoteDateTime } from "@/lib/quotes/display";
import type { QuoteDeliveryRecord } from "@/lib/quotes/delivery-types";

function statusLabel(status: QuoteDeliveryRecord["status"]): string {
  switch (status) {
    case "preparing":
      return "Preparing";
    case "accepted":
      return "Email submitted — finalising Quote status";
    case "submitted":
      return "Submitted";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Complained";
    default:
      return status;
  }
}

export function QuoteDeliveryHistory({
  deliveries,
  viewedAt,
}: {
  deliveries: QuoteDeliveryRecord[];
  viewedAt: string | null;
}) {
  if (deliveries.length === 0 && !viewedAt) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 print:hidden">
      <p className="text-xs font-medium text-muted-foreground">Delivery</p>
      {viewedAt ? (
        <p className="text-xs text-foreground">
          First client-page view{" "}
          <span className="text-muted-foreground">
            {formatQuoteDateTime(viewedAt)}
          </span>
        </p>
      ) : null}
      <ul className="space-y-2">
        {deliveries.map((row) => (
          <li key={row.id} className="text-xs leading-relaxed">
            <p className="font-medium">
              {row.attempt_number > 1 ? "Resent" : "Submitted"} to{" "}
              {row.recipient_email}
            </p>
            <p className="text-muted-foreground">
              {statusLabel(row.status)}
              {row.submitted_at
                ? ` · ${formatQuoteDateTime(row.submitted_at)}`
                : ""}
            </p>
            {row.delivered_at ? (
              <p className="text-muted-foreground">
                Delivered {formatQuoteDateTime(row.delivered_at)}
              </p>
            ) : null}
            {row.status === "failed" && row.failure_message_safe ? (
              <p className="text-destructive">{row.failure_message_safe}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
