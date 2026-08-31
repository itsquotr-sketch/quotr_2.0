import { formatPricingDate } from "@/lib/pricing/format";
import type { QuoteDeliveryRecord } from "@/lib/quotes/delivery-types";

function stamp(value: string | null): string | null {
  if (!value) return null;
  return formatPricingDate(value.length <= 10 ? value : value.slice(0, 10));
}

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
          First client-page view {stamp(viewedAt)}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {deliveries.map((row) => (
          <li key={row.id} className="text-xs leading-relaxed">
            <span className="font-medium">
              {row.attempt_number > 1 ? "Resent" : "Sent"} to {row.recipient_email}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {statusLabel(row.status)}
              {row.submitted_at ? ` ${stamp(row.submitted_at)}` : ""}
              {row.delivered_at ? ` · Delivered ${stamp(row.delivered_at)}` : ""}
            </span>
            {row.status === "failed" && row.failure_message_safe ? (
              <span className="block text-destructive">
                {row.failure_message_safe}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
