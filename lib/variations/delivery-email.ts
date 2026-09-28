import { formatPricingMoney } from "@/lib/pricing/format";
import {
  formatNamedFromHeader,
  quoteChannelFromAddress,
} from "@/lib/email/application-email";

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
  publicUrl: string;
  contactEmail: string | null;
  contactPhone: string | null;
}): { subject: string; html: string; text: string } {
  const company = input.companyName.trim() || "Your builder";
  const client = input.clientName?.trim() || "there";
  const project = input.projectTitle.trim() || "your project";
  const total = formatPricingMoney(input.adjustmentInclGst);
  const subject = buildVariationDeliverySubject({
    variationNumber: input.variationNumber,
    projectTitle: project,
  });
  const contact = [input.contactEmail?.trim(), input.contactPhone?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const proposed =
    "This Variation is proposed and has not yet been accepted.";

  const text = [
    `Hello ${client},`,
    "",
    `${company} has sent a proposed Variation for ${project}.`,
    `Variation ${input.variationNumber}`,
    `Revision ${input.revisionNumber}`,
    input.title.trim(),
    `Adjustment incl GST: ${total}`,
    "",
    proposed,
    "",
    `View Variation: ${input.publicUrl}`,
    "",
    contact || null,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:24px">
        <tr><td>
          <p style="margin:0 0 4px;font-size:16px;font-weight:700">${escapeHtml(company)}</p>
          <p style="margin:0 0 16px">Hello ${escapeHtml(client)},</p>
          <p style="margin:0 0 12px">${escapeHtml(company)} has sent a proposed Variation for ${escapeHtml(project)}.</p>
          <p style="margin:0">Variation ${input.variationNumber} · Revision ${input.revisionNumber}</p>
          <p style="margin:0 0 8px;font-weight:700">${escapeHtml(input.title.trim())}</p>
          <p style="margin:0 0 16px">Adjustment incl GST: ${escapeHtml(total)}</p>
          <p style="margin:0 0 16px">${escapeHtml(proposed)}</p>
          <p style="margin:0 0 16px"><a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;background:#c2410c;color:#fff;text-decoration:none;border-radius:8px">View Variation</a></p>
          ${contact ? `<p style="margin:0;color:#444">${escapeHtml(contact)}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
