import { ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";
import {
  isUsableInviteAcceptUrl,
  teamInviteFromHeader,
} from "@/lib/email/application-email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export { inviteAcceptPath } from "@/lib/email/application-email";

function roleArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

export function buildInviteEmail(input: {
  organisationName: string;
  inviterName: string;
  role: MembershipRole;
  acceptUrl: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  void input.inviterName;
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const company = input.organisationName.trim() || "a Quotr company";
  const expires = input.expiresAt.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const subject = `${company} invited you to Quotr`;
  const text = [
    `${company} invited you to join their Quotr team as ${roleArticle(roleLabel)} ${roleLabel}.`,
    "",
    "Accept your invitation:",
    input.acceptUrl,
    "",
    `This invitation expires on ${expires}.`,
    "",
    "If you weren't expecting this invitation, you can ignore this email.",
    "",
    "Sent via Quotr",
  ].join("\n");
  const href = escapeHtml(input.acceptUrl);
  const html = `<!doctype html>
<html>
<body style="padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px">
          <tr>
            <td>
              <p style="padding:0 0 16px 0;margin:0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#111">Quotr</p>
              <p style="padding:0 0 16px 0;margin:0;font-size:15px">${escapeHtml(company)} invited you to join their Quotr team as ${roleArticle(roleLabel)} <strong>${escapeHtml(roleLabel)}</strong>.</p>
              <p style="padding:24px 0;margin:0">
                <a href="${href}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">Accept invitation</a>
              </p>
              <p style="padding:0 0 16px 0;margin:0;font-size:13px;color:#52525b">If the button does not open, use this link:<br /><a href="${href}" style="color:#111111;word-break:break-all">${href}</a></p>
              <p style="padding:0 0 8px 0;margin:0;font-size:13px;color:#52525b">This invitation expires on ${escapeHtml(expires)}.</p>
              <p style="padding:0 0 16px 0;margin:0;font-size:13px;color:#52525b">If you weren't expecting this invitation, you can ignore this email.</p>
              <p style="padding:0;margin:0;font-size:11px;color:#a1a1aa">Sent via Quotr</p>
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
  const from = teamInviteFromHeader();
  if (!from) {
    return {
      ok: false,
      errorSafe: "Invitation email is not configured yet. You can resend after email is set up.",
    };
  }
  if (!isUsableInviteAcceptUrl(input.acceptUrl)) {
    return {
      ok: false,
      errorSafe: "Invitation email is not configured yet. You can resend after email is set up.",
    };
  }
  const built = buildInviteEmail(input);
  const { getQuoteDeliveryProvider } = await import(
    "@/lib/quotes/delivery-provider"
  );
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
