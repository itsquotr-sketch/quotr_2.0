import { quoteDeliveryFromHeader } from "@/lib/email/application-email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function rfqDeliveryFromHeader(companyName: string): string | null {
  return quoteDeliveryFromHeader(companyName);
}

export function buildRfqDeliveryEmail(input: {
  builderName: string;
  contactName: string;
  scopeLabel: string;
  responseDueOn: string | null;
  publicUrl: string;
}): { subject: string; html: string; text: string } {
  const builder = input.builderName.trim() || "A builder";
  const contact = input.contactName.trim() || "there";
  const scope = input.scopeLabel.trim() || "the requested work";
  const due = input.responseDueOn
    ? `Please respond by ${input.responseDueOn}.`
    : "Please respond when you can.";
  const subject = `Request for price — ${scope}`;
  const text = [
    `Hello ${contact},`,
    "",
    `${builder} has asked you to price ${scope}.`,
    due,
    "The request does not include the builder's client, estimate, or other subcontractors.",
    "",
    `View and respond: ${input.publicUrl}`,
    "",
    "This link is only for you. Submitting a price does not mean the work has been accepted.",
  ].join("\n");
  const html = [
    `<p>Hello ${escapeHtml(contact)},</p>`,
    `<p>${escapeHtml(builder)} has asked you to price ${escapeHtml(scope)}.</p>`,
    `<p>${escapeHtml(due)}</p>`,
    "<p>The request does not include the builder's client, estimate, or other subcontractors.</p>",
    `<p><a href="${escapeHtml(input.publicUrl)}">View and respond</a></p>`,
    "<p>This link is only for you. Submitting a price does not mean the work has been accepted.</p>",
  ].join("");
  return { subject, html, text };
}
