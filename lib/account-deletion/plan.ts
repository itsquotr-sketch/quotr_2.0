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
  targetIsOwner: boolean;
  issuedQuoteCount: number;
  subscriptionStatus: string | null;
  subscriptionSource: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  restrictedAuthorCount: number;
  detachableAuthorCount: number;
  organisationId: string | null;
  continuingMemberId: string | null;
  retainIssuedDocumentsConfirmed: boolean;
};

export type BillingResolution =
  | "none"
  | "historical"
  | "scheduled_cancellation"
  | "not_stripe"
  | "continuing_billing_owner"
  | "owner_remains"
  | "renewing_unresolved";

export type DeletionEffect = {
  action: "delete" | "suppress" | "retain" | "detach" | "transfer";
  target: string;
  detail: string;
};

export type DeletionPlan = {
  lifecycle: DeletionLifecycle;
  executable: boolean;
  effects: DeletionEffect[];
  issuedLinks: string;
  blockers: string[];
  outcome: string;
};

const NO_ISSUED_LINKS =
  "No issued-document link exists for this request. Nothing is removed.";
const LINKS_REMAIN =
  "Issued quote links stay on https://app.get-quotr.com/q/… and variation links stay on https://app.get-quotr.com/v/…. This request does not remove them.";

function issuedLinks(count: number): string {
  return count > 0 ? LINKS_REMAIN : NO_ISSUED_LINKS;
}

const RENEWING_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "paused",
  "unpaid",
]);

export function classifyBilling(facts: DeletionFacts): BillingResolution {
  if (!facts.subscriptionStatus) return "none";
  const ownerRemains = !facts.targetIsOwner && facts.otherActiveMemberCount > 0;
  const transferredOwner = Boolean(
    facts.continuingMemberId && facts.targetIsOwner && facts.otherActiveMemberCount > 0
  );
  if (ownerRemains) return "owner_remains";
  if (transferredOwner) return "continuing_billing_owner";
  if (facts.subscriptionSource !== "stripe") return "not_stripe";
  if (facts.subscriptionStatus === "scheduled_to_cancel" || facts.cancelAtPeriodEnd) {
    return "scheduled_cancellation";
  }
  if (RENEWING_STATUSES.has(facts.subscriptionStatus)) return "renewing_unresolved";
  return "historical";
}

function subscriptionDetail(facts: DeletionFacts, resolution: BillingResolution): string {
  if (resolution === "scheduled_cancellation") {
    const end = facts.currentPeriodEnd
      ? ` The current period ends ${facts.currentPeriodEnd}.`
      : "";
    return `Cancellation is already scheduled. This request did not change the subscription.${end}`;
  }
  if (resolution === "historical") {
    return `The subscription record stays with status ${facts.subscriptionStatus}. It is not renewing, and this request did not change it.`;
  }
  if (resolution === "not_stripe") {
    return `The stored subscription is ${facts.subscriptionSource ?? "unspecified"} with status ${facts.subscriptionStatus}. There is no Stripe subscription to cancel, and this request did not change the row.`;
  }
  if (resolution === "continuing_billing_owner" || resolution === "owner_remains") {
    return `The subscription stays ${facts.subscriptionStatus}. It was not cancelled. The remaining owner can administer billing.`;
  }
  return "The subscription is still set to renew. This request does not cancel it and does not delete the login.";
}

export function deletionOutcome(effects: DeletionEffect[]): string {
  const removed = effects.filter((effect) => effect.action !== "retain");
  const retained = effects.filter((effect) => effect.action === "retain");
  return `Deleted: ${removed.map((effect) => effect.detail).join(" ")} Retained: ${retained.map((effect) => effect.detail).join(" ")}`;
}

/**
 * Personal-account plan. Company closure and subscription cancellation are
 * never effects. A plan with blockers is not executable and must not be
 * marked completed.
 */
export function planPersonalDeletion(facts: DeletionFacts): DeletionPlan {
  const retained: DeletionEffect[] = [];
  const structural: string[] = [];
  const confirmation: string[] = [];
  const continuingMember = facts.continuingMemberId;

  if (!isDeletionOperator(facts.operatorEmail)) {
    structural.push("operator_not_authorised");
  }
  if (
    facts.targetEmail.trim().toLowerCase() ===
    facts.operatorEmail.trim().toLowerCase()
  ) {
    structural.push("operator_account_protected");
  }
  if (!facts.identityConfirmed) {
    structural.push("identity_not_verified");
  }
  const needsContinuingMember =
    (facts.otherActiveMemberCount > 0 && facts.targetIsOwner) ||
    (facts.restrictedAuthorCount > 0 && facts.otherActiveMemberCount > 0);
  if (needsContinuingMember && !continuingMember) {
    structural.push("continuing_member_required");
  }
  const billing = classifyBilling(facts);
  if (billing === "renewing_unresolved") {
    structural.push("billing_resolution_required");
  }
  if (facts.issuedQuoteCount > 0 && !facts.retainIssuedDocumentsConfirmed) {
    confirmation.push("issued_documents_retention_unconfirmed");
  }

  if (facts.organisationId) {
    retained.push({
      action: "retain",
      target: "organisation",
      detail: "The company was not closed.",
    });
  }
  retained.push({
    action: "retain",
    target: "organisation_storage",
    detail: "Company files were not deleted.",
  });
  if (facts.subscriptionStatus) {
    retained.push({
      action: "retain",
      target: "subscription",
      detail: subscriptionDetail(facts, billing),
    });
  }
  if (facts.issuedQuoteCount > 0) {
    retained.push({
      action: "retain",
      target: "issued_documents",
      detail: issuedLinks(facts.issuedQuoteCount),
    });
  }

  const proposed = structural.length === 0;
  const executable = proposed && confirmation.length === 0;
  const effects: DeletionEffect[] = [];
  if (proposed) {
    effects.push(
      {
        action: "suppress",
        target: "loops_contact",
        detail:
          "The email is suppressed so a later Loops retry cannot create the contact again.",
      },
      {
        action: "delete",
        target: "loops_contact",
        detail: "The Loops contact is deleted when that provider is configured.",
      }
    );
    if (facts.restrictedAuthorCount > 0 || facts.detachableAuthorCount > 0) {
      effects.push({
        action: "detach",
        target: "personal_author",
        detail: continuingMember
          ? "Project and document rows stay. A required author pointer moves to the continuing member. Other personal pointers are cleared. Customer document links are not removed."
          : "Project and document rows stay. The personal author pointer is cleared. Customer document links are not removed.",
      });
    }
    if (continuingMember && facts.targetIsOwner && facts.otherActiveMemberCount > 0) {
      effects.push({
        action: "transfer",
        target: "organisation_owner",
        detail: "The named continuing member becomes the owner. The company is not closed.",
      });
    }
    effects.push({
      action: "delete",
      target: "supabase_auth_user",
      detail:
        "The personal login was deleted. The profile and that person's membership go with it.",
    });
  }
  effects.push(...retained);

  return {
    lifecycle: facts.identityConfirmed ? "verified" : "requested",
    executable,
    effects,
    issuedLinks: issuedLinks(facts.issuedQuoteCount),
    blockers: [...structural, ...confirmation],
    outcome: proposed ? deletionOutcome(effects) : "",
  };
}

export function confirmationMatches(value: string | undefined): boolean {
  return value === DELETE_PERSONAL_ACCOUNT_CONFIRMATION;
}

export function supportResolutionCopy(): string {
  return `Other people still belong to this company. Email ${ACCOUNT_DELETION_SUPPORT_EMAIL} and name the continuing owner. The request stays verified and is not refused.`;
}
