import { formatPricingDate, formatPricingMoney } from "@/lib/pricing/format";
import { formatQuoteReference, getCompanyDisplayName } from "@/lib/quotes/display";
import type { Quote } from "@/lib/quotes/types";
import type { CompanySettings } from "@/lib/settings/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildQuoteDeliveryEmail(input: {
  quote: Quote;
  issuer: CompanySettings | null;
  recipientName: string | null;
  message: string;
  publicUrl: string;
}): { subject: string; html: string; text: string } {
  const reference = formatQuoteReference(input.quote);
  const company = getCompanyDisplayName(input.issuer) || "Quotr";
  const total = formatPricingMoney(input.quote.total_incl_gst);
  const revision = input.quote.revision_number;
  const validUntil = input.quote.valid_until
    ? formatPricingDate(input.quote.valid_until)
    : null;
  const subject = `${company} quote ${reference}`;
  const message = input.message.trim();
  const text = [
    message,
    "",
    `Quote: ${reference}`,
    `Revision: ${revision}`,
    `Total incl. GST: ${total}`,
    validUntil ? `Valid until: ${validUntil}` : null,
    "",
    `View quote: ${input.publicUrl}`,
    "",
    company,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
  <p>${escapeHtml(message).replaceAll("\n", "<br/>")}</p>
  <p>
    Quote <strong>${escapeHtml(reference)}</strong>
    · Revision ${revision}<br/>
    Total incl. GST: <strong>${escapeHtml(total)}</strong>
    ${validUntil ? `<br/>Valid until: ${escapeHtml(validUntil)}` : ""}
  </p>
  <p><a href="${escapeHtml(input.publicUrl)}">View the full quote</a></p>
  <p style="color:#666;font-size:12px">${escapeHtml(company)}</p>
</body></html>`;

  return { subject, html, text };
}

export function quoteDeliverySiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function quoteDeliveryFromAddress(): string | null {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return from || null;
}

export function isQuoteDeliveryProviderConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && quoteDeliveryFromAddress()
  );
}
