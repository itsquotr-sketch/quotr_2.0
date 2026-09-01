import { formatPricingMoney } from "@/lib/pricing/format";
import { formatQuoteDeliveryFromHeader } from "@/lib/quotes/delivery-email";
import { formatQuoteDateTime } from "@/lib/quotes/display";
import type { QuoteNotificationEmailKind } from "@/lib/quotes/notifications";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type QuoteResponseEmailInput = {
  kind: QuoteNotificationEmailKind;
  companyName: string | null;
  projectTitle: string | null;
  quoteNumber: string;
  revisionNumber: number;
  signerName: string | null;
  totalInclGst: number | null;
  occurredAt: string | null;
  declineNote: string | null;
  actionUrl: string | null;
};

export function buildQuoteResponseNotificationEmail(
  input: QuoteResponseEmailInput
): { subject: string; html: string; text: string } {
  const project = input.projectTitle?.trim() || "Project";
  const number = input.quoteNumber.trim() || "Quote";
  const signer = input.signerName?.trim() || "A client";
  const company = input.companyName?.trim() || "";
  const occurred = formatQuoteDateTime(input.occurredAt);
  const total =
    input.totalInclGst != null ? formatPricingMoney(input.totalInclGst) : null;
  const note = input.declineNote?.trim() || null;
  const url = input.actionUrl?.trim() || null;

  if (input.kind === "quote_accepted_builder") {
    const subject = `${project} — Quote ${number} accepted`;
    const lines = [
      `${signer} accepted ${number} Revision ${input.revisionNumber}.`,
      total ? `Accepted total: ${total}` : null,
      occurred ? `Accepted: ${occurred}` : null,
      url ? `View quote: ${url}` : null,
    ].filter((line): line is string => Boolean(line));
    return wrapEmail({ subject, company, lines, url, button: "View Quote" });
  }

  if (input.kind === "quote_declined_builder") {
    const subject = `${project} — Quote ${number} declined`;
    const lines = [
      `${signer} declined Quote ${number} Revision ${input.revisionNumber}.`,
      note ? `Note: ${note}` : null,
      url ? `View quote: ${url}` : null,
    ].filter((line): line is string => Boolean(line));
    return wrapEmail({ subject, company, lines, url, button: "View Quote" });
  }

  const subject = `${company || project} — Quote ${number} acceptance recorded`;
  const lines = [
    "Your acceptance has been recorded.",
    company ? company : null,
    `Quote ${number}`,
    `Revision ${input.revisionNumber}`,
    total ? `Accepted total: ${total}` : null,
    occurred ? `Accepted: ${occurred}` : null,
    url ? `View accepted quote: ${url}` : null,
  ].filter((line): line is string => Boolean(line));
  return wrapEmail({
    subject,
    company,
    lines,
    url,
    button: "View accepted quote",
  });
}

function wrapEmail(input: {
  subject: string;
  company: string;
  lines: string[];
  url: string | null;
  button: string;
}): { subject: string; html: string; text: string } {
  const text = input.lines.join("\n");
  const bodyHtml = input.lines
    .map((line) => `<p style="padding:0 0 8px 0;margin:0">${escapeHtml(line)}</p>`)
    .join("");
  const buttonHtml = input.url
    ? `<p style="padding:16px 0 0 0;margin:0"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(input.button)}</a></p>`
    : "";
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <div style="max-width:560px;margin:24px auto;background:#fff;padding:24px;border-radius:12px">
    ${input.company ? `<p style="padding:0 0 12px 0;margin:0;font-weight:700">${escapeHtml(input.company)}</p>` : ""}
    ${bodyHtml}
    ${buttonHtml}
    <p style="padding:24px 0 0 0;margin:0;font-size:12px;color:#71717a">Sent securely via Quotr</p>
  </div>
</body>
</html>`;
  return { subject: input.subject, html, text };
}

export function quoteResponseNotificationFromHeader(companyName: string | null): string | null {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) return null;
  return formatQuoteDeliveryFromHeader(companyName, from);
}
