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
    ? `Please respond by ${humanDate(input.responseDueOn)}.`
    : "Please respond when you can.";
  const subject = `Request for price — ${scope}`;
  const text = [
    `Hello ${contact},`,
    "",
    `${builder} has asked you to price ${scope}.`,
    due,
    "The request does not include the builder's client, estimate, or other subcontractors.",
    "",
    `View request and respond: ${input.publicUrl}`,
    "",
    "This link is only for you. Submitting a price does not mean the work has been accepted.",
  ].join("\n");
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
          <tr>
            <td>
              <p style="padding:0 0 4px 0;font-size:16px;font-weight:700">${escapeHtml(builder)}</p>
              <p style="padding:0 0 16px 0;font-size:14px;color:#52525b">Request for price</p>
              <p style="padding:0 0 8px 0;font-size:15px">Hello ${escapeHtml(contact)},</p>
              <p style="padding:0 0 8px 0;font-size:15px">${escapeHtml(builder)} has asked you to price ${escapeHtml(scope)}.</p>
              <p style="padding:0 0 16px 0;font-size:15px">${escapeHtml(due)}</p>
              <p style="padding:8px 0 20px 0">
                <a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">View request and respond</a>
              </p>
              <p style="padding:0 0 8px 0;font-size:13px;color:#52525b">The request does not include the builder's client, estimate, or other subcontractors.</p>
              <p style="padding:0;font-size:13px;color:#52525b">This link is only for you. Submitting a price does not mean the work has been accepted.</p>
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

export function buildRfqAnswerEmail(input: {
  builderName: string;
  contactName: string;
  scopeLabel: string;
  answer: string;
  publicUrl: string;
  audience: "private" | "all";
}): { subject: string; html: string; text: string } {
  const builder = input.builderName.trim() || "A builder";
  const contact = input.contactName.trim() || "there";
  const scope = input.scopeLabel.trim() || "the requested work";
  const audience = input.audience === "all"
    ? "This answer was sent to every recipient. It does not name who asked."
    : "This answer was sent only to you.";
  const subject = `Answer on the request — ${scope}`;
  const text = [
    `Hello ${contact},`,
    "",
    `${builder} answered a question about ${scope}.`,
    input.answer.trim(),
    audience,
    "The original request was not changed.",
    "",
    `View request and respond: ${input.publicUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
        <tr><td>
          <p style="font-size:16px;font-weight:700">${escapeHtml(builder)}</p>
          <p>${escapeHtml(builder)} answered a question about ${escapeHtml(scope)}.</p>
          <p>${escapeHtml(input.answer.trim())}</p>
          <p style="color:#52525b">${escapeHtml(audience)} The original request was not changed.</p>
          <p><a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">View request and respond</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html, text };
}

function humanDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
