import { formatPricingDate, formatPricingMoney } from "@/lib/pricing/format";
import { formatQuoteReference, getCompanyDisplayName } from "@/lib/quotes/display";
import { validateLegacyLogoUrl } from "@/lib/settings/logo";
import type { Quote } from "@/lib/quotes/types";
import type { CompanySettings } from "@/lib/settings/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function isSafeContractorReplyToEmail(
  value: string | null | undefined
): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (/[\r\n,<>]/.test(trimmed)) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function extractEmailAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const angled = trimmed.match(/<([^>]+)>/);
  const candidate = (angled?.[1] ?? trimmed).trim();
  return isSafeContractorReplyToEmail(candidate) ? candidate : null;
}

export function formatQuoteDeliveryFromHeader(
  companyName: string | null | undefined,
  fromAddressRaw: string
): string {
  const address = extractEmailAddress(fromAddressRaw) ?? fromAddressRaw.trim();
  const company = companyName?.trim() ?? "";
  if (!company) {
    return address;
  }
  const display = `${company} via Quotr`;
  const quoted = /[,<>@"]/.test(display)
    ? `"${display.replaceAll('"', '\\"')}"`
    : display;
  return `${quoted} <${address}>`;
}

export function quoteDeliveryReplyToFallback(): string | null {
  const configured = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  if (configured && isSafeContractorReplyToEmail(configured)) {
    return configured;
  }
  const from = quoteDeliveryFromAddress();
  return from ? extractEmailAddress(from) : null;
}

export function resolveQuoteDeliveryReplyTo(
  issuerEmail?: string | null
): string | null {
  if (isSafeContractorReplyToEmail(issuerEmail)) {
    return issuerEmail!.trim();
  }
  return quoteDeliveryReplyToFallback();
}

export function quoteEmailSafeLogoUrl(
  logoUrl: string | null | undefined
): string | null {
  const result = validateLegacyLogoUrl(logoUrl);
  if (!result.ok || !result.url) return null;
  try {
    const parsed = new URL(result.url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return result.url;
  } catch {
    return null;
  }
}

function safeLogoUrl(logoUrl: string | null | undefined): string | null {
  return quoteEmailSafeLogoUrl(logoUrl);
}

export function buildQuoteDeliverySubject(input: {
  companyName: string | null | undefined;
  quoteNumber: string;
  projectTitle?: string | null;
}): string {
  const company = input.companyName?.trim() ?? "";
  const project = input.projectTitle?.trim() ?? "";
  const quotePart = `Quote ${input.quoteNumber}`;
  if (company && project) {
    return `${company} — ${quotePart} for ${project}`;
  }
  if (company) {
    return `${company} — ${quotePart}`;
  }
  if (project) {
    return `${quotePart} for ${project}`;
  }
  return quotePart;
}

export function buildQuoteDeliveryEmail(input: {
  quote: Quote;
  issuer: CompanySettings | null;
  recipientName: string | null;
  message: string;
  publicUrl: string;
  projectTitle?: string | null;
}): { subject: string; html: string; text: string } {
  const reference = formatQuoteReference(input.quote);
  const company = getCompanyDisplayName(input.issuer);
  const total = formatPricingMoney(input.quote.total_incl_gst);
  const revision = input.quote.revision_number;
  const validUntil = input.quote.valid_until
    ? formatPricingDate(input.quote.valid_until)
    : null;
  const projectTitle = input.projectTitle?.trim() || null;
  const subject = buildQuoteDeliverySubject({
    companyName: company,
    quoteNumber: reference,
    projectTitle,
  });
  const message = input.message.trim();
  const clientFirst = input.recipientName?.trim() || "there";
  const greetingProject = projectTitle || "your project";
  const logoUrl = safeLogoUrl(input.issuer?.logoUrl);
  const contactEmail = input.issuer?.contactEmail?.trim() || "";
  const contactPhone = input.issuer?.contactPhone?.trim() || "";
  const contactLine = [contactEmail, contactPhone].filter(Boolean).join(" · ");

  const text = [
    message,
    "",
    company ? company : null,
    `Quote ${reference}`,
    `Revision ${revision}`,
    `Total incl. GST: ${total}`,
    validUntil ? `Valid until: ${validUntil}` : null,
    "",
    `View quote: ${input.publicUrl}`,
    "",
    "This secure link shows this exact quote revision.",
    contactLine || null,
    "Sent securely via Quotr",
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(company || "Company")}" width="160" style="max-width:160px;height:auto;display:block;padding:0 0 16px 0;border:0" />`
    : "";
  const companyHtml = company
    ? `<p style="padding:0 0 4px 0;font-size:16px;font-weight:700;color:#111">${escapeHtml(company)}</p>`
    : "";
  const messageHtml = escapeHtml(message).replaceAll("\n", "<br/>");

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
              <p style="padding:0 0 20px 0;font-size:14px;color:#52525b">Quote ${escapeHtml(reference)}</p>
              <p style="padding:0 0 16px 0;font-size:15px">${messageHtml || `Hi ${escapeHtml(clientFirst)}, please find our quote for ${escapeHtml(greetingProject)}.`}</p>
              <p style="padding:20px 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Total</p>
              <p style="padding:0 0 8px 0;font-size:22px;font-weight:700">${escapeHtml(total)} incl GST</p>
              ${validUntil ? `<p style="padding:0 0 20px 0;font-size:14px;color:#52525b">Valid until ${escapeHtml(validUntil)}</p>` : ""}
              <p style="padding:24px 0">
                <a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">View Quote</a>
              </p>
              <p style="padding:0 0 20px 0;font-size:12px;color:#71717a">This secure link shows this exact quote revision.</p>
              ${contactLine ? `<p style="padding:0 0 4px 0;font-size:12px;color:#52525b">${escapeHtml(contactLine)}</p>` : ""}
              ${company ? `<p style="padding:0 0 16px 0;font-size:12px;color:#52525b">${escapeHtml(company)}</p>` : ""}
              <p style="padding:0;font-size:11px;color:#a1a1aa">Sent securely via Quotr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
