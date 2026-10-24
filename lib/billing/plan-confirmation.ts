/**
 * Paid-plan confirmation. One service email when a Stripe subscription
 * first becomes active. Not a welcome email, not a tax invoice, and not
 * a renewal receipt.
 *
 * Amounts come from the caller. This module does not invent prices.
 */

import { eventMatchesBillingEnvironment } from "@/lib/billing/environment";
import { getPlanCatalogueEntry } from "@/lib/billing/plans";
import { resolvePlanFromStripePriceItems } from "@/lib/billing/prices";
import type { BillingEnvironment, StripePriceConfig } from "@/lib/billing/types";
import {
  ACCOUNT_WELCOME_REPLY_TO,
  ACCOUNT_WELCOME_WORDMARK_HEIGHT,
  ACCOUNT_WELCOME_WORDMARK_URL,
  ACCOUNT_WELCOME_WORDMARK_WIDTH,
} from "@/lib/auth/account-welcome";
import { isSafeMailboxAddress } from "@/lib/email/application-email";

export const PLAN_CONFIRMATION_TEMPLATE_VERSION = "plan-confirmation-v1";
export const PLAN_CONFIRMATION_REPLY_TO = ACCOUNT_WELCOME_REPLY_TO;
export const PLAN_CONFIRMATION_EMAIL_ENABLED_ENV =
  "PLAN_CONFIRMATION_EMAIL_ENABLED" as const;
export const PLAN_CONFIRMATION_EMAIL_PRODUCTION_ENV =
  "PLAN_CONFIRMATION_EMAIL_PRODUCTION" as const;
export const PLAN_CONFIRMATION_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PLAN_CONFIRMATION_PREVIEW_TEST_RECIPIENT =
  "hello+test@erccontracting.co.nz";

/** Synthetic preview-test amounts. Not a live subscription price. */
export const PLAN_CONFIRMATION_PREVIEW_TEST_FACTS = {
  planCode: "builder" as const,
  includedUsers: 1,
  paidUsers: 1,
  currency: "nzd",
  recurringExclusiveCents: 1000,
  recurringTaxCents: 150,
  taxDisplayName: "GST",
  taxPercent: 15,
  taxInclusive: false,
  openingExclusiveCents: 200,
  openingTaxCents: 30,
  openingTotalCents: 230,
  openingKind: "prorated" as const,
  nextBillingAt: "2026-11-30T11:00:00.000Z",
};
export const PLAN_CONFIRMATION_ANDROID_HOST =
  "quotr-2-0-git-preview-android-free-signup-quotr1.vercel.app";
export const PLAN_CONFIRMATION_PRODUCTION_BILLING_URL =
  "https://app.get-quotr.com/app/settings/billing";

const ALREADY_ACTIVATED_STATUSES = new Set([
  "active",
  "past_due",
  "scheduled_to_cancel",
  "cancelled",
  "paused",
]);

export type PaidPlanConfirmationSignal = {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

export type PlanConfirmationEnvironment = "preview" | "production" | "development";
export type PlanConfirmationSource = "activation" | "preview_test";
export type PlanConfirmationStatus = "pending" | "sending" | "accepted" | "failed";
export type PlanConfirmationOpeningKind =
  | "prorated"
  | "discounted"
  | "prorated_discounted";

export type PlanConfirmationSubscriptionEvent =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "checkout.session.completed";

export type PlanConfirmationFacts = {
  planCode: "builder" | "business";
  currency: string;
  includedUsers: number;
  paidUsers: number;
  recurringExclusiveCents: number;
  recurringTaxCents: number;
  taxDisplayName: string | null;
  taxPercent: number | null;
  taxInclusive: boolean;
  openingExclusiveCents: number | null;
  openingTaxCents: number | null;
  openingTotalCents: number | null;
  openingKind: PlanConfirmationOpeningKind | null;
  /** True only when Stripe reports the opening invoice as paid. */
  openingConfirmedPaid: boolean;
  nextBillingAt: string | null;
};

const ENABLED_VALUE = "true";

export function isPlanConfirmationDeliveryEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  if (env[PLAN_CONFIRMATION_EMAIL_ENABLED_ENV]?.trim() !== ENABLED_VALUE) {
    return false;
  }
  if (env.VERCEL_ENV === "preview") return true;
  if (env.VERCEL_ENV === "production") {
    return env[PLAN_CONFIRMATION_EMAIL_PRODUCTION_ENV]?.trim() === ENABLED_VALUE;
  }
  return false;
}

export function resolvePlanConfirmationEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env
): PlanConfirmationEnvironment | null {
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "development") return "development";
  return null;
}

export function planConfirmationIdempotencyKey(input: {
  environment: PlanConfirmationEnvironment;
  stripeSubscriptionId: string;
  source: PlanConfirmationSource;
}): string {
  const base = `${PLAN_CONFIRMATION_TEMPLATE_VERSION}:${input.environment}`;
  if (input.source === "preview_test") {
    return `${base}:test`;
  }
  return `${base}:${input.stripeSubscriptionId}`;
}

export function normalizeBillingMailbox(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!isSafeMailboxAddress(trimmed)) return null;
  return trimmed;
}

/**
 * One recipient: the Stripe customer email, the stored billing email, and
 * a confirmed organisation owner must be the same mailbox.
 */
export function selectPaidPlanRecipient(input: {
  stripeCustomerEmail: string | null;
  storedBillingEmail: string | null;
  confirmedOwnerEmails: readonly string[];
}): { ok: true; email: string } | { ok: false; reason: "mismatch" | "missing" | "not_owner" } {
  const stripeEmail = normalizeBillingMailbox(input.stripeCustomerEmail);
  const storedEmail = normalizeBillingMailbox(input.storedBillingEmail);
  if (!stripeEmail || !storedEmail) return { ok: false, reason: "missing" };
  if (stripeEmail !== storedEmail) return { ok: false, reason: "mismatch" };
  const owners = new Set(
    input.confirmedOwnerEmails
      .map((email) => normalizeBillingMailbox(email))
      .filter((email): email is string => Boolean(email))
  );
  if (!owners.has(stripeEmail)) return { ok: false, reason: "not_owner" };
  return { ok: true, email: stripeEmail };
}

/** Stored on the delivery row. Contains no email address. */
export function planConfirmationSkipReason(
  reason: "mismatch" | "missing" | "not_owner"
): string {
  if (reason === "mismatch") {
    return "Owner email and Stripe billing email differ. Nothing was sent or redirected. Make them match, then retry this delivery.";
  }
  if (reason === "missing") {
    return "Stripe billing email or stored billing email is missing. Nothing was sent. Add both so they match the confirmed owner, then retry this delivery.";
  }
  return "Stripe billing email is not the confirmed owner. Nothing was sent or redirected. Set the Stripe email to that owner, then retry this delivery.";
}

export function shouldEnqueuePaidPlanConfirmation(input: {
  previous: {
    source: string;
    status: string;
    stripeSubscriptionId: string | null;
  } | null;
  next: {
    source: string;
    status: string;
    planCode: string;
    stripeSubscriptionId: string | null;
  };
  activeOverride: boolean;
  eventType: PlanConfirmationSubscriptionEvent;
}): boolean {
  if (input.activeOverride) return false;
  if (
    input.eventType !== "customer.subscription.created" &&
    input.eventType !== "customer.subscription.updated"
  ) {
    return false;
  }
  if (input.next.source !== "stripe") return false;
  if (input.next.status !== "active") return false;
  if (input.next.planCode !== "builder" && input.next.planCode !== "business") {
    return false;
  }
  if (!input.next.stripeSubscriptionId) return false;
  if (
    input.previous?.source === "stripe" &&
    input.previous.stripeSubscriptionId === input.next.stripeSubscriptionId &&
    ALREADY_ACTIVATED_STATUSES.has(input.previous.status)
  ) {
    return false;
  }
  return true;
}

function integerCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function unixToIso(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function planConfirmationFactsFromStripe(input: {
  billingEnvironment: BillingEnvironment;
  expectedCustomerId: string;
  prices: StripePriceConfig;
  subscription: Record<string, unknown>;
}): { ok: true; facts: PlanConfirmationFacts } | { ok: false; reason: string } {
  const livemode = input.subscription.livemode === true;
  if (!eventMatchesBillingEnvironment(input.billingEnvironment, livemode)) {
    return { ok: false, reason: "livemode" };
  }
  if (input.subscription.status !== "active") {
    return { ok: false, reason: "not_active" };
  }
  const customerId =
    typeof input.subscription.customer === "string"
      ? input.subscription.customer
      : record(input.subscription.customer)?.id;
  if (typeof customerId !== "string" || customerId !== input.expectedCustomerId) {
    return { ok: false, reason: "customer" };
  }

  const itemsContainer = record(input.subscription.items);
  const rawItems = Array.isArray(itemsContainer?.data) ? itemsContainer.data : [];
  const priced: { priceId: string; quantity: number; unitAmountCents: number; currency: string }[] = [];
  let periodEnd: number | null = null;
  for (const raw of rawItems) {
    const item = record(raw);
    if (!item) continue;
    const price = record(item.price);
    const priceId = typeof price?.id === "string" ? price.id : null;
    const unitAmountCents = integerCents(price?.unit_amount);
    const currency = typeof price?.currency === "string" ? price.currency.toLowerCase() : "";
    const quantity =
      typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0
        ? item.quantity
        : null;
    if (!priceId || unitAmountCents == null || !currency || quantity == null) {
      return { ok: false, reason: "amounts" };
    }
    priced.push({ priceId, quantity, unitAmountCents, currency });
    const itemEnd =
      typeof item.current_period_end === "number" ? item.current_period_end : null;
    if (itemEnd != null) periodEnd = itemEnd;
  }
  if (typeof input.subscription.current_period_end === "number") {
    periodEnd = input.subscription.current_period_end;
  }
  if (priced.length === 0) return { ok: false, reason: "amounts" };
  const currency = priced[0].currency;
  if (priced.some((item) => item.currency !== currency)) {
    return { ok: false, reason: "currency" };
  }

  const plan = resolvePlanFromStripePriceItems(
    priced.map((item) => ({ priceId: item.priceId, quantity: item.quantity })),
    input.prices
  );
  if (!plan.ok) return { ok: false, reason: plan.errorCode };

  const recurringExclusiveCents = priced.reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0
  );
  const invoice = record(input.subscription.latest_invoice);
  const rateRows = Array.isArray(input.subscription.default_tax_rates)
    ? input.subscription.default_tax_rates
    : [];
  const taxSource =
    rateRows.length > 0
      ? rateRows
      : Array.isArray(invoice?.total_tax_amounts)
        ? invoice.total_tax_amounts.flatMap((raw) => {
            const rate = record(record(raw)?.tax_rate);
            return rate ? [rate] : [];
          })
        : [];
  const taxRates = taxSource.flatMap((raw) => {
    const rate = record(raw);
    if (!rate || typeof rate.percentage !== "number" || !Number.isFinite(rate.percentage)) {
      return [];
    }
    return [
      {
        percentage: rate.percentage,
        displayName: typeof rate.display_name === "string" ? rate.display_name : null,
        inclusive: rate.inclusive === true,
      },
    ];
  });
  if (taxRates.some((rate) => rate.inclusive) && taxRates.some((rate) => !rate.inclusive)) {
    return { ok: false, reason: "tax" };
  }
  const taxInclusive = taxRates.some((rate) => rate.inclusive);
  const taxPercent = taxRates.length === 1 ? taxRates[0].percentage : null;
  const taxDisplayName =
    taxRates.length === 1 ? taxRates[0].displayName : taxRates.length > 1 ? "tax" : null;
  let recurringTaxCents = 0;
  if (!taxInclusive) {
    for (const rate of taxRates) {
      recurringTaxCents += Math.round((recurringExclusiveCents * rate.percentage) / 100);
    }
  } else {
    const combined = taxRates.reduce((sum, rate) => sum + rate.percentage, 0);
    recurringTaxCents = Math.round(
      (recurringExclusiveCents * combined) / (100 + combined)
    );
  }
  const exclusiveCents = taxInclusive
    ? recurringExclusiveCents - recurringTaxCents
    : recurringExclusiveCents;

  let openingExclusiveCents: number | null = null;
  let openingTaxCents: number | null = null;
  let openingTotalCents: number | null = null;
  let openingKind: PlanConfirmationOpeningKind | null = null;
  if (invoice && invoice.object === "invoice") {
    const subtotal = integerCents(invoice.subtotal);
    const total = integerCents(invoice.total);
    const taxFromAmounts = Array.isArray(invoice.total_tax_amounts)
      ? invoice.total_tax_amounts.reduce((sum, raw) => {
          const amount = integerCents(record(raw)?.amount);
          return sum + (amount ?? 0);
        }, 0)
      : null;
    const tax = integerCents(invoice.tax) ?? taxFromAmounts ?? 0;
    const discounts = Array.isArray(invoice.total_discount_amounts)
      ? invoice.total_discount_amounts.reduce((sum, raw) => {
          const amount = integerCents(record(raw)?.amount);
          return sum + (amount ?? 0);
        }, 0)
      : 0;
    const lines = record(invoice.lines);
    const prorated = Array.isArray(lines?.data)
      ? lines.data.some((raw) => record(raw)?.proration === true)
      : false;
    const paid = invoice.status === "paid" || invoice.paid === true;
    if (paid && subtotal != null && total != null && (prorated || discounts > 0)) {
      openingExclusiveCents = subtotal;
      openingTaxCents = tax;
      openingTotalCents = total;
      if (prorated && discounts > 0) openingKind = "prorated_discounted";
      else if (prorated) openingKind = "prorated";
      else openingKind = "discounted";
    }
  }

  return {
    ok: true,
    facts: {
      planCode: plan.planCode,
      currency,
      includedUsers: getPlanCatalogueEntry(plan.planCode).includedUsers,
      paidUsers: plan.paidSeatQuantity,
      recurringExclusiveCents: exclusiveCents,
      recurringTaxCents,
      taxDisplayName,
      taxPercent,
      taxInclusive,
      openingExclusiveCents,
      openingTaxCents,
      openingTotalCents,
      openingKind,
      openingConfirmedPaid: openingKind != null,
      nextBillingAt: unixToIso(periodEnd),
    },
  };
}

export function formatPlanConfirmationMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const major = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, "0");
  const amount = `${sign}${major}.${minor}`;
  if (currency.toLowerCase() === "nzd") return `NZ$${amount}`;
  return `${amount} ${currency.toUpperCase()}`;
}

export function planConfirmationPlanLabel(planCode: "builder" | "business"): string {
  return planCode === "builder" ? "Builder" : "Business";
}

export function planConfirmationSubject(input: {
  planCode: "builder" | "business";
  previewTest: boolean;
}): string {
  const subject = `Your Quotr ${planConfirmationPlanLabel(input.planCode)} plan is active`;
  return input.previewTest ? `Preview test: ${subject}` : subject;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function taxName(facts: PlanConfirmationFacts): string {
  const name = facts.taxDisplayName?.trim();
  return name || "tax";
}

function recurringSentence(facts: PlanConfirmationFacts): string {
  const exclusive = formatPlanConfirmationMoney(facts.recurringExclusiveCents, facts.currency);
  const tax = formatPlanConfirmationMoney(facts.recurringTaxCents, facts.currency);
  const total = formatPlanConfirmationMoney(
    facts.recurringExclusiveCents + facts.recurringTaxCents,
    facts.currency
  );
  if (facts.recurringTaxCents > 0) {
    return `The ongoing subscription price is ${exclusive} + ${tax} ${taxName(facts)} each month (${total} including ${taxName(facts)}).`;
  }
  return `The ongoing subscription price is ${exclusive} each month.`;
}

export function planConfirmationUsersSentence(facts: PlanConfirmationFacts): string {
  if (facts.planCode === "builder") return "Includes 1 user.";
  const included = facts.includedUsers;
  const additional = Math.max(0, facts.paidUsers - included);
  const includedLabel = `${included} ${included === 1 ? "user" : "users"}`;
  if (additional === 0) {
    return `Includes ${includedLabel}. No additional users are billed.`;
  }
  const additionalLabel = `${additional} additional ${additional === 1 ? "user" : "users"}`;
  return `Includes ${includedLabel}, plus ${additionalLabel}.`;
}

function openingSentence(facts: PlanConfirmationFacts): string | null {
  if (
    facts.openingKind == null ||
    facts.openingTotalCents == null ||
    facts.openingExclusiveCents == null ||
    facts.openingTaxCents == null
  ) {
    return null;
  }
  const total = formatPlanConfirmationMoney(facts.openingTotalCents, facts.currency);
  const exclusive = formatPlanConfirmationMoney(facts.openingExclusiveCents, facts.currency);
  const tax = formatPlanConfirmationMoney(facts.openingTaxCents, facts.currency);
  if (!facts.openingConfirmedPaid) return null;
  if (facts.openingTotalCents === 0 && facts.openingKind !== "prorated") {
    return `The first invoice was ${total} because a discount covered it. No payment was taken for that invoice. It is separate from the ongoing subscription price.`;
  }
  const reason =
    facts.openingKind === "prorated_discounted"
      ? "This was a prorated invoice and includes a discount."
      : facts.openingKind === "discounted"
        ? "This invoice includes a discount."
        : "This was a prorated invoice.";
  const taxPart =
    facts.openingTaxCents > 0
      ? ` (${exclusive} + ${tax} ${taxName(facts)})`
      : "";
  return `The first invoice was ${total}${taxPart}. ${reason} It is separate from the ongoing subscription price.`;
}

function nextBillingSentence(facts: PlanConfirmationFacts): string | null {
  if (!facts.nextBillingAt) return null;
  const date = new Date(facts.nextBillingAt);
  if (!Number.isFinite(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return `The next billing date is ${formatted}.`;
}

export function planConfirmationBillingUrlAccepted(
  environment: PlanConfirmationEnvironment | null,
  billingUrl: string
): boolean {
  if (!isWebsiteBillingUrl(billingUrl)) return false;
  if (environment === "production") {
    return billingUrl === PLAN_CONFIRMATION_PRODUCTION_BILLING_URL;
  }
  return true;
}

export function isWebsiteBillingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === PLAN_CONFIRMATION_ANDROID_HOST) return false;
    return url.pathname === "/app/settings/billing";
  } catch {
    return false;
  }
}

export function buildPlanConfirmationEmail(input: {
  companyName: string;
  facts: PlanConfirmationFacts;
  billingUrl: string;
  previewTest?: boolean;
}): { subject: string; html: string; text: string } {
  const plan = planConfirmationPlanLabel(input.facts.planCode);
  const subject = planConfirmationSubject({
    planCode: input.facts.planCode,
    previewTest: input.previewTest === true,
  });
  const users = planConfirmationUsersSentence(input.facts);
  const identification =
    input.previewTest === true
      ? "Preview test of the paid plan confirmation. This is not a customer activation."
      : null;
  const lines = [
    identification,
    identification ? "" : null,
    `Your Quotr ${plan} plan is active.`,
    "",
    `Company: ${input.companyName}`,
    `Plan: ${plan}`,
    users,
    recurringSentence(input.facts),
    openingSentence(input.facts),
    nextBillingSentence(input.facts),
    "",
    "Your access works on the Quotr website and in the Android app with the same Quotr account.",
    "",
    `Manage billing: ${input.billingUrl}`,
    "",
    `Questions about your plan: ${PLAN_CONFIRMATION_REPLY_TO}`,
    "",
    "This email confirms your plan. It is not a tax invoice. Stripe sends the payment receipt.",
  ].filter((line): line is string => line !== null);
  const text = lines.join("\n");
  const paragraph = (value: string) =>
    `<p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px">${escapeHtml(value)}</p>`;
  const identificationHtml = identification
    ? `<p style="padding:0 0 12px 0;margin:0;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a">${escapeHtml(identification)}</p>`
    : "";
  const body = [
    `Your Quotr ${plan} plan is active.`,
    `Company: ${input.companyName}`,
    `Plan: ${plan}`,
    users,
    recurringSentence(input.facts),
    openingSentence(input.facts),
    nextBillingSentence(input.facts),
    "Your access works on the Quotr website and in the Android app with the same Quotr account.",
  ].filter((line): line is string => line !== null);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="padding:0;margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;table-layout:fixed;">
          <tr>
            <td style="padding:28px 24px;word-wrap:break-word;">
              ${identificationHtml}
              <p style="padding:0 0 20px 0;margin:0;">
                <img src="${escapeHtml(ACCOUNT_WELCOME_WORDMARK_URL)}" alt="Quotr" width="${ACCOUNT_WELCOME_WORDMARK_WIDTH}" height="${ACCOUNT_WELCOME_WORDMARK_HEIGHT}" style="display:block;width:${ACCOUNT_WELCOME_WORDMARK_WIDTH}px;height:${ACCOUNT_WELCOME_WORDMARK_HEIGHT}px;border:0;outline:none;text-decoration:none;" />
              </p>
              ${body.map(paragraph).join("\n")}
              <p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px"><a href="${escapeHtml(input.billingUrl)}">Manage billing</a></p>
              <p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px">Questions about your plan: <a href="mailto:${escapeHtml(PLAN_CONFIRMATION_REPLY_TO)}">${escapeHtml(PLAN_CONFIRMATION_REPLY_TO)}</a></p>
              <p style="padding:0;margin:0;font-size:14px;line-height:22px;color:#52525b">This email confirms your plan. It is not a tax invoice. Stripe sends the payment receipt.</p>
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

export function decidePlanConfirmationSend(input: {
  status: PlanConfirmationStatus;
  leaseUntil: string | null;
  now: string;
  idempotencyKey: string;
  idempotencyStartedAt?: string | null;
  providerMessageId?: string | null;
}): {
  action: "skip_accepted" | "skip_in_flight" | "reconcile" | "send";
  idempotencyKey: string;
} {
  if (input.status === "accepted" || input.providerMessageId) {
    return { action: "skip_accepted", idempotencyKey: input.idempotencyKey };
  }
  if (
    input.status === "sending" &&
    input.leaseUntil &&
    Date.parse(input.leaseUntil) > Date.parse(input.now)
  ) {
    return { action: "skip_in_flight", idempotencyKey: input.idempotencyKey };
  }
  if (input.idempotencyStartedAt) {
    const started = Date.parse(input.idempotencyStartedAt);
    const now = Date.parse(input.now);
    if (
      Number.isFinite(started) &&
      Number.isFinite(now) &&
      now - started >= PLAN_CONFIRMATION_IDEMPOTENCY_WINDOW_MS
    ) {
      return { action: "reconcile", idempotencyKey: input.idempotencyKey };
    }
  }
  return { action: "send", idempotencyKey: input.idempotencyKey };
}
