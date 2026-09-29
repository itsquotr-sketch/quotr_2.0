/**
 * Quotr-generated email signature.
 *
 * Identity only. Does not send mail or choose a From address.
 * Drop the HTML fragment into a Quotr-written message. Do not use it on
 * contractor quote or variation mail, which already close with the
 * contractor's own identity.
 *
 * Callers that already show a Quotr wordmark or logo should not add another.
 * This fragment has neither.
 */

export const QUOTR_EMAIL_SIGNATURE_VARIANTS = ["founder", "team"] as const;

export type QuotrEmailSignatureVariant =
  (typeof QUOTR_EMAIL_SIGNATURE_VARIANTS)[number];

const WEBSITE_LABEL = "get-quotr.com";
const WEBSITE_HREF = "https://get-quotr.com";
const TAGLINE = "Estimating and quoting for trades.";

const FONT = "Arial,Helvetica,sans-serif";
const INK = "#111111";
const MUTED = "#52525b";
const RULE = "#e4e4e7";
/** App brand orange, oklch(0.705 0.213 47.604), as a hex email clients accept. */
const ACCENT = "#ff6900";

type SignatureCopy = {
  name: string;
  role: string | null;
  companyLine: string | null;
  reply: string;
};

const COPY: Record<QuotrEmailSignatureVariant, SignatureCopy> = {
  founder: {
    name: "Jean-Luc Ellis",
    role: "Co-Founder, Quotr",
    companyLine: "Quotr",
    reply: "Questions or feedback? Just reply to this email.",
  },
  team: {
    name: "The Quotr team",
    role: null,
    companyLine: null,
    reply: "Need a hand? Reply to this email.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textLine(content: string, options: {
  size: number;
  color: string;
  weight: number;
  paddingBottom: number;
}): string {
  return `<p style="margin:0;padding:0 0 ${options.paddingBottom}px 0;font-family:${FONT};font-size:${options.size}px;line-height:1.45;font-weight:${options.weight};color:${options.color}">${escapeHtml(content)}</p>`;
}

export function buildQuotrEmailSignature(
  variant: QuotrEmailSignatureVariant
): { html: string; text: string } {
  const copy = COPY[variant];
  const text = [
    copy.name,
    copy.role,
    copy.role || copy.companyLine ? "" : null,
    copy.companyLine,
    TAGLINE,
    WEBSITE_HREF,
    "",
    copy.reply,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const nameHtml = textLine(copy.name, {
    size: 15,
    color: INK,
    weight: 700,
    paddingBottom: copy.role ? 2 : 10,
  });
  const roleHtml = copy.role
    ? textLine(copy.role, {
        size: 13,
        color: MUTED,
        weight: 400,
        paddingBottom: 10,
      })
    : "";
  const companyHtml = copy.companyLine
    ? textLine(copy.companyLine, {
        size: 13,
        color: INK,
        weight: 700,
        paddingBottom: 2,
      })
    : "";
  const taglineHtml = textLine(TAGLINE, {
    size: 13,
    color: MUTED,
    weight: 400,
    paddingBottom: 2,
  });
  const websiteHtml = `<p style="margin:0;padding:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:1.45"><a href="${WEBSITE_HREF}" style="color:${INK};text-decoration:underline">${escapeHtml(WEBSITE_LABEL)}</a></p>`;
  const replyHtml = textLine(copy.reply, {
    size: 12,
    color: MUTED,
    weight: 400,
    paddingBottom: 0,
  });

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0">
  <tr>
    <td style="padding:20px 0 0 0;border-top:1px solid ${RULE}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
        <tr>
          <td width="3" bgcolor="${ACCENT}" style="width:3px;background-color:${ACCENT};font-size:1px;line-height:1px">&nbsp;</td>
          <td style="padding:0 0 0 12px;font-family:${FONT}">
            ${nameHtml}
            ${roleHtml}
            ${companyHtml}
            ${taglineHtml}
            ${websiteHtml}
            ${replyHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return { html, text };
}
