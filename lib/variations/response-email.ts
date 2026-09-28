import { formatSignedAdjustment } from "@/lib/variations/presentation";
import { variationDeliveryFromHeader } from "@/lib/variations/delivery-email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildVariationResponseNotificationEmail(input: {
  projectTitle: string;
  variationNumber: number;
  revisionNumber: number;
  outcome: "accepted" | "declined";
  responderName: string;
  respondedAt: string;
  adjustmentInclGst: number;
  currency: string;
  internalUrl: string;
}): { subject: string; html: string; text: string; from: string | null } {
  const project = input.projectTitle.trim() || "Project";
  const responder = input.responderName.trim() || "The client";
  const decision = input.outcome === "accepted" ? "Accepted" : "Declined";
  const adjustment = formatSignedAdjustment(input.adjustmentInclGst, input.currency || "NZD");
  const when = new Date(input.respondedAt);
  const whenLabel = Number.isNaN(when.getTime())
    ? input.respondedAt
    : new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(when);
  const subject = `${project} — Variation ${input.variationNumber} ${decision.toLowerCase()}`;
  const lines = [
    `${responder} ${decision.toLowerCase()} Variation ${input.variationNumber}, Revision ${input.revisionNumber}.`,
    `Outcome: ${decision}`,
    `Responder: ${responder}`,
    `Response time: ${whenLabel}`,
    `Adjustment incl GST: ${adjustment}`,
    `Open the Variation: ${input.internalUrl}`,
  ];
  const text = lines.join("\n");
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
          <tr>
            <td>
              <p style="padding:0 0 4px 0;font-size:16px;font-weight:700">${escapeHtml(project)}</p>
              <p style="padding:0 0 16px 0;font-size:14px;color:#52525b">Variation ${input.variationNumber} · Revision ${input.revisionNumber}</p>
              <p style="padding:0 0 12px 0;font-size:15px">${escapeHtml(responder)} ${decision.toLowerCase()} this Variation.</p>
              <p style="padding:0 0 4px 0;font-size:14px"><strong>${escapeHtml(decision)}</strong></p>
              <p style="padding:0 0 4px 0;font-size:14px">Responder: ${escapeHtml(responder)}</p>
              <p style="padding:0 0 4px 0;font-size:14px">Response time: ${escapeHtml(whenLabel)}</p>
              <p style="padding:0 0 16px 0;font-size:14px">Adjustment incl GST: ${escapeHtml(adjustment)}</p>
              <p style="padding:8px 0 16px 0">
                <a href="${escapeHtml(input.internalUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">View Variation</a>
              </p>
              <p style="padding:0;font-size:11px;color:#a1a1aa">Sent securely via Quotr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, text, from: variationDeliveryFromHeader(project) };
}
