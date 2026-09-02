import { quoteDeliveryFromAddress } from "@/lib/quotes/delivery-email";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inviteAcceptPath(rawToken: string): string {
  return `/invite/${rawToken}`;
}

export function buildInviteEmail(input: {
  organisationName: string;
  inviterName: string;
  role: MembershipRole;
  acceptUrl: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const company = input.organisationName.trim() || "a Quotr company";
  const inviter = input.inviterName.trim() || "A teammate";
  const expires = input.expiresAt.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const subject = `${inviter} invited you to ${company} on Quotr`;
  const text = [
    `${inviter} invited you to join ${company} on Quotr as ${roleLabel}.`,
    "",
    `Accept the invitation: ${input.acceptUrl}`,
    `This link expires on ${expires}.`,
    "",
    "If you were not expecting this, you can ignore the email.",
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
              <p style="padding:0 0 8px 0;font-size:16px;font-weight:700">${escapeHtml(company)}</p>
              <p style="padding:0 0 16px 0;font-size:15px">${escapeHtml(inviter)} invited you to join this Quotr company as <strong>${escapeHtml(roleLabel)}</strong>.</p>
              <p style="padding:24px 0">
                <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">Accept invitation</a>
              </p>
              <p style="padding:0 0 8px 0;font-size:13px;color:#52525b">This link expires on ${escapeHtml(expires)}.</p>
              <p style="padding:0;font-size:11px;color:#a1a1aa">Sent via Quotr</p>
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

export async function sendOrganisationInviteEmail(input: {
  to: string;
  organisationName: string;
  inviterName: string;
  role: MembershipRole;
  acceptUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; errorSafe: string }> {
  const from = quoteDeliveryFromAddress();
  if (!from) {
    return {
      ok: false,
      errorSafe: "Invitation email is not configured yet. You can resend after email is set up.",
    };
  }
  const built = buildInviteEmail(input);
  const provider = getQuoteDeliveryProvider();
  const result = await provider.send({
    to: input.to,
    from,
    subject: built.subject,
    html: built.html,
    text: built.text,
    idempotencyKey: input.idempotencyKey,
  });
  if (!result.ok) {
    return { ok: false, errorSafe: result.messageSafe };
  }
  return { ok: true };
}
