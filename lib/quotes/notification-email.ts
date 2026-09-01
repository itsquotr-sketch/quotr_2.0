import { formatPricingMoney } from "@/lib/pricing/format";
import {
  formatQuoteDeliveryFromHeader,
  quoteEmailSafeLogoUrl,
} from "@/lib/quotes/delivery-email";
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
  issuerLogoUrl?: string | null;
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
  const logoUrl = quoteEmailSafeLogoUrl(input.issuerLogoUrl);

  if (input.kind === "quote_accepted_builder") {
    const subject = `${project} — Quote ${number} accepted`;
    const lines = [
      `${signer} accepted ${number} Revision ${input.revisionNumber}.`,
      total ? `Accepted total: ${total} incl GST` : null,
      occurred ? `Accepted: ${occurred}` : null,
    ].filter((line): line is string => Boolean(line));
    return wrapContractorFirstEmail({
      subject,
      company,
      logoUrl,
      eyebrow: `Quote ${number}`,
      lines,
      url,
      button: "View Quote",
      textUrlLabel: "View quote",
    });
  }

  if (input.kind === "quote_declined_builder") {
    const subject = `${project} — Quote ${number} declined`;
    const lines = [
      `${signer} declined Quote ${number} Revision ${input.revisionNumber}.`,
      note ? `Note: ${note}` : null,
    ].filter((line): line is string => Boolean(line));
    return wrapContractorFirstEmail({
      subject,
      company,
      logoUrl,
      eyebrow: `Quote ${number}`,
      lines,
      url,
      button: "View Quote",
      textUrlLabel: "View quote",
    });
  }

  const subject = `Your acceptance of Quote ${number} is confirmed`;
  const lines = [
    "Your acceptance has been recorded.",
    company || null,
    project !== "Project" ? project : null,
    `Quote ${number}`,
    `Revision ${input.revisionNumber}`,
    total ? `Accepted total: ${total} incl GST` : null,
    occurred ? `Accepted: ${occurred}` : null,
  ].filter((line): line is string => Boolean(line));
  return wrapContractorFirstEmail({
    subject,
    company,
    logoUrl,
    eyebrow: `Quote ${number}`,
    lines,
    url,
    button: "View accepted quote",
    textUrlLabel: "View accepted quote",
  });
}

function wrapContractorFirstEmail(input: {
  subject: string;
  company: string;
  logoUrl: string | null;
  eyebrow: string;
  lines: string[];
  url: string | null;
  button: string;
  textUrlLabel: string;
}): { subject: string; html: string; text: string } {
  const textLines = [
    ...input.lines,
    input.url ? `${input.textUrlLabel}: ${input.url}` : null,
  ].filter((line): line is string => Boolean(line));
  const text = textLines.join("\n");
  const bodyHtml = input.lines
    .map(
      (line) =>
        `<p style="padding:0 0 8px 0;margin:0;font-size:15px">${escapeHtml(line)}</p>`
    )
    .join("");
  const buttonHtml = input.url
    ? `<p style="padding:24px 0 0 0;margin:0"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(input.button)}</a></p>`
    : "";
  const logoHtml = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.company || "Company")}" width="160" style="max-width:160px;height:auto;display:block;padding:0 0 16px 0;border:0" />`
    : "";
  const companyHtml = input.company
    ? `<p style="padding:0 0 4px 0;margin:0;font-size:16px;font-weight:700;color:#111">${escapeHtml(input.company)}</p>`
    : "";
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
          <tr>
            <td>
              ${logoHtml}
              ${companyHtml}
              <p style="padding:0 0 20px 0;margin:0;font-size:14px;color:#52525b">${escapeHtml(input.eyebrow)}</p>
              ${bodyHtml}
              ${buttonHtml}
              <p style="padding:24px 0 0 0;margin:0;font-size:11px;color:#a1a1aa">Sent securely via Quotr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: input.subject, html, text };
}

export function quoteResponseNotificationFromHeader(companyName: string | null): string | null {
  const from = process.env["RESEND_FROM_EMAIL"]?.trim();
  if (!from) return null;
  return formatQuoteDeliveryFromHeader(companyName, from);
}
