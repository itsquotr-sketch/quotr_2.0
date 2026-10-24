import {
  isDeletionOperator,
  DELETE_PERSONAL_ACCOUNT_CONFIRMATION,
} from "@/lib/account-deletion/operator";
import {
  ACCOUNT_DELETION_SUPPORT_EMAIL,
  type DeletionLifecycle,
} from "@/lib/account-deletion/request";

export const ISSUED_QUOTE_LINK_ORIGIN = "https://app.get-quotr.com";

export type DeletionFacts = {
  targetEmail: string;
  operatorEmail: string;
  identityConfirmed: boolean;
  otherActiveMemberCount: number;
  issuedQuoteCount: number;
  subscriptionStatus: string | null;
  blockingReferenceCount: number;
  organisationId: string | null;
};

export type DeletionEffect = {
  action: "delete" | "suppress" | "retain";
  target: string;
  detail: string;
};

export type DeletionPlan = {
  lifecycle: DeletionLifecycle;
  executable: boolean;
  effects: DeletionEffect[];
  issuedLinks: string;
  blockers: string[];
};

const NO_ISSUED_LINKS =
  "No issued-document link exists for this request. Nothing is removed.";
const LINKS_REMAIN =
  "Issued quote links stay on https://app.get-quotr.com/q/… and variation links stay on https://app.get-quotr.com/v/…. This request does not remove them.";

function issuedLinks(count: number): string {
  return count > 0 ? LINKS_REMAIN : NO_ISSUED_LINKS;
}

/**
 * Personal-account plan. Organisation closure is never an effect.
 * A plan with blockers is not executable.
 */
export function planPersonalDeletion(facts: DeletionFacts): DeletionPlan {
  const retained: DeletionEffect[] = [];
  const blockers: string[] = [];

  if (!isDeletionOperator(facts.operatorEmail)) {
    blockers.push("operator_not_authorised");
  }
  if (
    facts.targetEmail.trim().toLowerCase() ===
    facts.operatorEmail.trim().toLowerCase()
  ) {
    blockers.push("operator_account_protected");
  }
  if (!facts.identityConfirmed) {
    blockers.push("identity_not_verified");
  }
  if (facts.otherActiveMemberCount > 0) {
    blockers.push("other_members_need_support");
  }
  if (facts.issuedQuoteCount > 0) {
    blockers.push("issued_documents_retained");
  }
  if (facts.subscriptionStatus) {
    blockers.push("subscription_retained");
  }
  if (facts.blockingReferenceCount > 0) {
    blockers.push("personal_records_still_referenced");
  }

  if (facts.organisationId) {
    retained.push({
      action: "retain",
      target: "organisation",
      detail:
        "Organisation closure is separate. The company row, its projects, and its files stay.",
    });
  }
  retained.push({
    action: "retain",
    target: "organisation_storage",
    detail:
      "Storage objects belong to the company. This request does not delete those files.",
  });
  if (facts.subscriptionStatus) {
    retained.push({
      action: "retain",
      target: "subscription",
      detail: `Subscription status ${facts.subscriptionStatus} stays with the company. Cancellation stays on the Quotr website. No retention period is added here.`,
    });
  }
  if (facts.issuedQuoteCount > 0) {
    retained.push({
      action: "retain",
      target: "issued_documents",
      detail: issuedLinks(facts.issuedQuoteCount),
    });
  }

  const executable = blockers.length === 0;
  const lifecycle: DeletionLifecycle = facts.identityConfirmed ? "verified" : "requested";
  const effects: DeletionEffect[] = [...retained];
  if (executable) {
    effects.unshift(
      {
        action: "suppress",
        target: "loops_contact",
        detail:
          "Record the email so a later Loops retry cannot create the contact again.",
      },
      {
        action: "delete",
        target: "loops_contact",
        detail: "Delete the Loops contact when that provider is configured.",
      },
      {
        action: "delete",
        target: "supabase_auth_user",
        detail:
          "Delete the login. The profile and that person's membership cascade from it.",
      }
    );
  }

  return {
    lifecycle,
    executable,
    effects,
    issuedLinks: issuedLinks(facts.issuedQuoteCount),
    blockers,
  };
}

export function confirmationMatches(value: string | undefined): boolean {
  return value === DELETE_PERSONAL_ACCOUNT_CONFIRMATION;
}

export function supportResolutionCopy(): string {
  return `Other people still belong to this company. Email ${ACCOUNT_DELETION_SUPPORT_EMAIL}. The request stays verified and is not refused.`;
}
