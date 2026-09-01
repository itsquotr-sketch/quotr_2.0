import type {
  BillingEnvironment,
  OrgBillingCustomer,
  OrgBillingOverride,
  OrgSubscription,
  ProcessedEventStatus,
} from "@/lib/billing/types";

export type EventClaimRecord = {
  stripeEventId: string;
  eventType: string;
  status: ProcessedEventStatus;
};

export type BillingStore = {
  getCustomerByOrg(
    orgId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<OrgBillingCustomer | null>;
  getCustomerByStripeId(
    stripeCustomerId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<OrgBillingCustomer | null>;
  upsertCustomer(
    row: Pick<
      OrgBillingCustomer,
      | "orgId"
      | "billingEnvironment"
      | "stripeCustomerId"
      | "billingName"
      | "billingEmail"
    >
  ): Promise<OrgBillingCustomer>;
  getSubscriptionByOrg(
    orgId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<OrgSubscription | null>;
  getSubscriptionByStripeId(
    stripeSubscriptionId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<OrgSubscription | null>;
  upsertSubscription(row: OrgSubscription): Promise<OrgSubscription>;
  patchSubscription(
    orgId: string,
    billingEnvironment: BillingEnvironment,
    patch: Partial<OrgSubscription>
  ): Promise<OrgSubscription | null>;
  listOverrides(
    orgId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<OrgBillingOverride[]>;
  getProcessedEvent(
    stripeEventId: string,
    billingEnvironment: BillingEnvironment
  ): Promise<EventClaimRecord | null>;
  claimProcessedEvent(input: {
    stripeEventId: string;
    eventType: string;
    billingEnvironment: BillingEnvironment;
  }): Promise<{ inserted: boolean; existing: EventClaimRecord | null }>;
  finalizeProcessedEvent(input: {
    stripeEventId: string;
    billingEnvironment: BillingEnvironment;
    status: Exclude<ProcessedEventStatus, "received">;
    errorCode?: string | null;
    errorSafe?: string | null;
  }): Promise<void>;
};
