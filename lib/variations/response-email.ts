import { quoteEmailSafeLogoUrl } from "@/lib/quotes/delivery-email";
import { variationDeliveryFromHeader } from "@/lib/variations/delivery-email";
import type { VariationResponseReceipt } from "@/lib/variations/response-receipt";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shell(input: {
  logoUrl: string | null;
  companyName: string;
  body: string;
}): string {
  const logoUrl = quoteEmailSafeLogoUrl(input.logoUrl);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(input.companyName || "Contractor")}" width="160" style="max-width:160px;height:auto;display:block;padding:0 0 16px 0;border:0" />`
    : "";
  return `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
          <tr>
            <td>
              ${logo}
              ${input.body}
              <p style="padding:16px 0 0 0;font-size:11px;color:#a1a1aa">Sent securely via Quotr</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="padding:8px 0 16px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

export function buildVariationClientConfirmationEmail(input: {
  receipt: VariationResponseReceipt;
  recordUrl: string;
}): { subject: string; html: string; text: string; from: string | null } {
  const receipt = input.receipt;
  const project = receipt.projectTitle.trim() || "Project";
  const decision = receipt.outcome === "accepted" ? "accepted" : "declined";
  const subject = `Variation ${receipt.variationNumber} ${decision} — ${project}`;
  const quote = receipt.quoteNumber && receipt.quoteRevision != null
    ? `${receipt.quoteNumber}, Revision ${receipt.quoteRevision}`
    : "Accepted Quote reference unavailable";
  const contractLine = receipt.contractUnchanged
    ? "Contract value unchanged."
    : `Revised accepted contract: ${receipt.revisedContractInclLabel} incl GST.`;
  const lines = [
    `${receipt.companyName || "Your contractor"} recorded your response.`,
    `Project: ${project}`,
    `Variation ${receipt.variationNumber}, Revision ${receipt.revisionNumber}`,
    receipt.outcomeLabel,
    `Response date: ${receipt.respondedAtLabel}`,
    `Responder: ${receipt.responderName}`,
    `Adjustment incl GST: ${receipt.adjustmentInclLabel}`,
    contractLine,
    `Master Quote: ${quote}`,
    `View the response record: ${input.recordUrl}`,
  ];
  const html = shell({
    logoUrl: receipt.logoUrl,
    companyName: receipt.companyName,
    body: `
      <p style="padding:0 0 4px 0;font-size:16px;font-weight:700">${escapeHtml(receipt.companyName || "Variation response")}</p>
      <p style="padding:0 0 12px 0;font-size:14px;color:#52525b">${escapeHtml(project)}</p>
      <p style="padding:0 0 8px 0;font-size:15px">Variation ${receipt.variationNumber}, Revision ${receipt.revisionNumber} is ${escapeHtml(decision)}.</p>
      <p style="padding:0 0 4px 0;font-size:14px">Response date: ${escapeHtml(receipt.respondedAtLabel)}</p>
      <p style="padding:0 0 4px 0;font-size:14px">Responder: ${escapeHtml(receipt.responderName)}</p>
      <p style="padding:0 0 4px 0;font-size:14px">Adjustment incl GST: ${escapeHtml(receipt.adjustmentInclLabel)}</p>
      <p style="padding:0 0 4px 0;font-size:14px">${escapeHtml(contractLine)}</p>
      <p style="padding:0 0 12px 0;font-size:14px">Master Quote: ${escapeHtml(quote)}</p>
      ${button(input.recordUrl, "View response record")}
    `,
  });
  return { subject, html, text: lines.join("\n"), from: variationDeliveryFromHeader(receipt.companyName || project) };
}

export function buildVariationResponseNotificationEmail(input: {
  receipt: VariationResponseReceipt;
  internalUrl: string;
}): { subject: string; html: string; text: string; from: string | null } {
  const receipt = input.receipt;
  const project = receipt.projectTitle.trim() || "Project";
  const decision = receipt.outcomeLabel;
  const subject = `${project} — Variation ${receipt.variationNumber} ${receipt.outcome}`;
  const contractLine = receipt.contractUnchanged
    ? "Contract value unchanged."
    : `Revised accepted contract: ${receipt.revisedContractInclLabel} incl GST.`;
  const lines = [
    `${receipt.responderName} ${receipt.outcome} Variation ${receipt.variationNumber}, Revision ${receipt.revisionNumber}.`,
    `Project: ${project}`,
    `Outcome: ${decision}`,
    `Responder: ${receipt.responderName}`,
    `Response time: ${receipt.respondedAtLabel}`,
    `Adjustment incl GST: ${receipt.adjustmentInclLabel}`,
    contractLine,
    `Open the Variation: ${input.internalUrl}`,
  ];
  const html = shell({
    logoUrl: receipt.logoUrl,
    companyName: receipt.companyName,
    body: `
      <p style="padding:0 0 4px 0;font-size:16px;font-weight:700">${escapeHtml(project)}</p>
      <p style="padding:0 0 16px 0;font-size:14px;color:#52525b">Variation ${receipt.variationNumber} · Revision ${receipt.revisionNumber}</p>
      <p style="padding:0 0 12px 0;font-size:15px">${escapeHtml(receipt.responderName)} ${receipt.outcome} this Variation.</p>
      <p style="padding:0 0 4px 0;font-size:14px"><strong>${escapeHtml(decision)}</strong></p>
      <p style="padding:0 0 4px 0;font-size:14px">Responder: ${escapeHtml(receipt.responderName)}</p>
      <p style="padding:0 0 4px 0;font-size:14px">Response time: ${escapeHtml(receipt.respondedAtLabel)}</p>
      <p style="padding:0 0 4px 0;font-size:14px">Adjustment incl GST: ${escapeHtml(receipt.adjustmentInclLabel)}</p>
      <p style="padding:0 0 16px 0;font-size:14px">${escapeHtml(contractLine)}</p>
      ${button(input.internalUrl, "View Variation")}
    `,
  });
  return { subject, html, text: lines.join("\n"), from: variationDeliveryFromHeader(receipt.companyName || project) };
}
