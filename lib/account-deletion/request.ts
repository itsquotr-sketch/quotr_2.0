/**
 * Account-deletion requests record a person's ask. They do not delete a
 * login, company, document, or subscription.
 */

export const ACCOUNT_DELETION_SUPPORT_EMAIL = "hello@get-quotr.com";

export const DELETION_RESOLUTIONS = ["recorded", "needs_support"] as const;
export type DeletionResolution = (typeof DELETION_RESOLUTIONS)[number];

export const DELETION_LIFECYCLE = [
  "requested",
  "verified",
  "processing",
  "completed",
] as const;
export type DeletionLifecycle = (typeof DELETION_LIFECYCLE)[number];

export type DeletionRequestRecord = {
  status: DeletionLifecycle;
  identityConfirmed: boolean;
  resolution: DeletionResolution;
  otherActiveMemberCount: number;
  issuedQuoteCount: number;
  subscriptionStatus: string | null;
  outcome?: string;
};

export type DeletionActionState = {
  error?: string;
  acknowledgement?: string;
  record?: DeletionRequestRecord;
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
  if (record.status === "completed") {
    return {
      title: "Completed",
      body: record.outcome
        ? record.outcome
        : "The request is marked completed without a stored outcome. Do not treat that as a description of what was deleted.",
    };
  }
  if (record.status === "processing") {
    return {
      title: "Processing",
      body: "An operator is fulfilling the verified request. The personal login has not been deleted yet.",
    };
  }
  if (record.status === "verified" && record.resolution === "needs_support") {
    return {
      title: "Verified",
      body: `Other people still belong to this company. This is not a refusal. Email ${ACCOUNT_DELETION_SUPPORT_EMAIL} and name the active member who will own the company. Nothing has been deleted.`,
    };
  }
  if (record.status === "verified") {
    return {
      title: "Verified",
      body: "Identity is verified. An operator can review the request. Nothing has been deleted.",
    };
  }
  return {
    title: "Requested",
    body: "The request is recorded and identity is not verified. Nothing has been deleted.",
  };
}
