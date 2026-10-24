/**
 * Account-deletion requests record a person's ask. They do not delete a
 * login, company, document, or subscription.
 */

export const ACCOUNT_DELETION_SUPPORT_EMAIL = "hello@get-quotr.com";

export const DELETION_RESOLUTIONS = ["recorded", "needs_support"] as const;
export type DeletionResolution = (typeof DELETION_RESOLUTIONS)[number];

export type DeletionRequestRecord = {
  identityConfirmed: boolean;
  resolution: DeletionResolution;
  otherActiveMemberCount: number;
  issuedQuoteCount: number;
  subscriptionStatus: string | null;
};

export function normalizeDeletionEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 320 || !normalized.includes("@")) return null;
  return normalized;
}

/**
 * Another active member never blocks the request. Support resolves the
 * company with the owner. A sole active member is recorded for review.
 */
export function deletionRequestResolution(input: {
  otherActiveMemberCount: number;
}): DeletionResolution {
  if (input.otherActiveMemberCount > 0) return "needs_support";
  return "recorded";
}

export function publicDeletionAcknowledgement(): string {
  return "If this email belongs to a Quotr account, the request is recorded. Submitting it does not delete the account, the company, or its documents. Sign in and open Profile to confirm it is you and to see the status. If you cannot sign in, email hello@get-quotr.com.";
}

export function deletionStatusCopy(record: DeletionRequestRecord): {
  title: string;
  body: string;
} {
  const retained =
    "Quotr has not deleted the account, the company, issued quotes, or the subscription. No deletion period is promised, because deletion is not carried out from this request.";
  if (!record.identityConfirmed) {
    return {
      title: "Request recorded, identity not confirmed",
      body: `${retained} Confirm it is you with your current password. Until then, support will not treat this as confirmed.`,
    };
  }
  if (record.resolution === "needs_support") {
    return {
      title: "Request recorded for support",
      body: `${retained} Other people still belong to this company, and ownership cannot be transferred here. Email ${ACCOUNT_DELETION_SUPPORT_EMAIL} and support will resolve the company and those people with you.`,
    };
  }
  return {
    title: "Request recorded",
    body: `${retained} Support will review the confirmed request.`,
  };
}
