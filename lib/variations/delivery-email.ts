import { formatSignedAdjustment } from "@/lib/variations/presentation";
import {
  formatNamedFromHeader,
  quoteChannelFromAddress,
} from "@/lib/email/application-email";
import { quoteEmailSafeLogoUrl } from "@/lib/quotes/delivery-email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function variationDeliveryFromHeader(companyName: string): string | null {
  const address = quoteChannelFromAddress();
  if (!address) return null;
  return formatNamedFromHeader(companyName.trim() || "Quotr", address);
}

export function buildVariationDeliverySubject(input: {
  variationNumber: number;
  projectTitle: string;
}): string {
  const project = input.projectTitle.trim() || "your project";
  return `Variation ${input.variationNumber} — ${project}`;
}

export function buildVariationDeliveryEmail(input: {
  companyName: string;
  clientName: string | null;
  projectTitle: string;
  variationNumber: number;
  revisionNumber: number;
  title: string;
  adjustmentInclGst: number;
  currency?: string;
  publicUrl: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl?: string | null;
  quoteNumber?: string | null;
  quoteRevision?: number | null;
  contractorAddress?: string | null;
  clientAttachmentCount?: number;
}): { subject: string; html: string; text: string } {
  const company = input.companyName.trim() || "Your builder";
  const client = input.clientName?.trim() || "there";
  const project = input.projectTitle.trim() || "your project";
  const total = formatSignedAdjustment(input.adjustmentInclGst, input.currency || "NZD");
  const subject = buildVariationDeliverySubject({
    variationNumber: input.variationNumber,
    projectTitle: project,
  });
  const contact = [input.contactEmail?.trim(), input.contactPhone?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const address = input.contractorAddress?.trim() || "";
  const quoteLine =
    input.quoteNumber && input.quoteRevision != null
      ? `This Variation relates to accepted Quote ${input.quoteNumber}, Revision ${input.quoteRevision}. It has not yet been accepted and does not currently change the accepted contract value.`
      : "This Variation is proposed and has not yet been accepted.";
  const logoUrl = quoteEmailSafeLogoUrl(input.logoUrl);
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(company)}" width="160" style="max-width:160px;height:auto;display:block;padding:0 0 16px 0;border:0" />`
    : "";
  const supporting =
    (input.clientAttachmentCount ?? 0) > 0
      ? "Supporting documents or photos are available through the secure View Variation link."
      : null;

  const text = [
    `Hello ${client},`,
    "",
    `${company} has sent you proposed Variation ${input.variationNumber} for ${project}.`,
    "Proposed Variation",
    `Variation ${input.variationNumber}`,
    `Revision ${input.revisionNumber}`,
    input.title.trim(),
    `Adjustment incl GST: ${total}`,
    "",
    quoteLine,
    "",
    supporting,
    supporting ? "" : null,
    `View Variation: ${input.publicUrl}`,
    "",
    contact || null,
    address || null,
    company,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

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
              <p style="padding:0 0 4px 0;font-size:16px;font-weight:700;color:#111">${escapeHtml(company)}</p>
              <p style="padding:0 0 20px 0;font-size:14px;color:#52525b">Proposed Variation ${input.variationNumber} · Revision ${input.revisionNumber}</p>
              <p style="padding:0 0 16px 0;font-size:15px">${escapeHtml(company)} has sent you proposed Variation ${input.variationNumber} for ${escapeHtml(project)}.</p>
              <p style="padding:0 0 8px 0;font-size:15px;font-weight:700">${escapeHtml(input.title.trim())}</p>
              <p style="padding:20px 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Adjustment incl GST</p>
              <p style="padding:0 0 8px 0;font-size:22px;font-weight:700">${escapeHtml(total)} incl GST</p>
              <p style="padding:0 0 20px 0;font-size:14px;color:#52525b">${escapeHtml(quoteLine)}</p>
              ${supporting ? `<p style="padding:0 0 16px 0;font-size:14px;color:#52525b">${escapeHtml(supporting)}</p>` : ""}
              <p style="padding:24px 0">
                <a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">View Variation</a>
              </p>
              ${contact ? `<p style="padding:0 0 4px 0;font-size:12px;color:#52525b">${escapeHtml(contact)}</p>` : ""}
              ${address ? `<p style="padding:0 0 4px 0;font-size:12px;color:#52525b">${escapeHtml(address)}</p>` : ""}
              <p style="padding:0 0 16px 0;font-size:12px;color:#52525b">${escapeHtml(company)}</p>
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
