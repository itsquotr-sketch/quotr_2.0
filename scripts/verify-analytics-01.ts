/**
 * Analytics definitions, tier split, and tenancy.
 *
 * Run: npx --yes tsx scripts/verify-analytics-01.ts
 */
import { readFileSync } from "node:fs";
import {
  analyticsTablesForTier,
  analyticsTierFromDecisions,
  businessAnalyticsUpgradeCopy,
  deniedBusinessAnalytics,
} from "../lib/analytics/access";
import {
  measureAnalytics,
  presentAnalytics,
  type AnalyticsMeasureInput,
  type AnalyticsProject,
  type AnalyticsQuoteEvent,
  type AnalyticsSnapshot,
  type AnalyticsVariation,
} from "../lib/analytics/measure";
import {
  inPeriod,
  parseAnalyticsPeriod,
  resolveAnalyticsPeriod,
} from "../lib/analytics/periods";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { trialAllowsCapability } from "../lib/billing/entitlement-matrix";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import type { OrgBillingState, OrgSubscription, PlanCode } from "../lib/billing/types";
import {
  ORG_PERMISSIONS,
  permissionsForRole,
  roleAllowsPermission,
} from "../lib/team/permissions";

const ORG = "org-a";
const OTHER = "org-b";
const NOW = new Date("2026-02-15T01:00:00.000Z");

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function subscription(planCode: PlanCode): OrgSubscription {
  const iso = NOW.toISOString();
  return {
    id: "sub",
    orgId: ORG,
    billingEnvironment: "test",
    planCode,
    status: "active",
    source: "stripe",
    stripeSubscriptionId: "sub_stripe",
    stripeCustomerId: "cus_stripe",
    stripeBasePriceId: null,
    stripeSeatPriceId: null,
    paidSeatQuantity: 1,
    currentPeriodStart: iso,
    currentPeriodEnd: iso,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lastStripeEventCreatedAt: iso,
    lastStripeEventId: "evt",
    pastDueSince: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

function state(subscriptionRow: OrgSubscription | null): OrgBillingState {
  return {
    orgId: ORG,
    billingEnvironment: "test",
    customer: null,
    subscription: subscriptionRow,
    activeOverride: null,
    effectiveTrialState: null,
  };
}

function allows(plan: PlanCode, capability: "analytics.personal" | "analytics.business"): boolean {
  return evaluateOrgEntitlement({
    state: state(subscription(plan)),
    capability,
    mode: "strict",
    now: NOW,
  }).ok;
}

const auckland = resolveAnalyticsPeriod({
  period: "this_month",
  timeZone: "Pacific/Auckland",
  now: NOW,
});
const sydney = resolveAnalyticsPeriod({
  period: "this_month",
  timeZone: "Australia/Sydney",
  now: NOW,
});
const lastMonth = resolveAnalyticsPeriod({
  period: "last_month",
  timeZone: "Pacific/Auckland",
  now: NOW,
});

check(
  "Auckland February starts at NZDT midnight",
  auckland.start === "2026-01-31T11:00:00.000Z" &&
    auckland.end === "2026-02-15T11:00:00.000Z"
);
check(
  "Sydney February starts at AEDT midnight",
  sydney.start === "2026-01-31T13:00:00.000Z"
);
check(
  "last month ends where this month starts",
  lastMonth.start === "2025-12-31T11:00:00.000Z" &&
    lastMonth.end === "2026-01-31T11:00:00.000Z"
);
check(
  "an instant before Auckland midnight is outside February",
  !inPeriod("2026-01-31T10:59:59.999Z", auckland) &&
    inPeriod("2026-01-31T11:00:00.000Z", auckland) &&
    !inPeriod(auckland.end, auckland)
);
check(
  "unknown period falls back to this month",
  parseAnalyticsPeriod("forever") === "this_month"
);

const projects: AnalyticsProject[] = [
  { id: "p1", orgId: ORG, title: "Lead job", businessStatus: "lead", archivedAt: null, deletedAt: null },
  { id: "p2", orgId: ORG, title: "Revision job", businessStatus: "quote_sent", archivedAt: null, deletedAt: null },
  { id: "p3", orgId: ORG, title: "Archived job", businessStatus: "quote_sent", archivedAt: "2026-02-10T00:00:00.000Z", deletedAt: null },
  { id: "p4", orgId: ORG, title: "Won job", businessStatus: "won", archivedAt: null, deletedAt: null },
  { id: "p5", orgId: ORG, title: "Earlier send", businessStatus: "won", archivedAt: null, deletedAt: null },
  { id: "p6", orgId: ORG, title: "Deleted lead", businessStatus: "lead", archivedAt: null, deletedAt: "2026-02-01T00:00:00.000Z" },
  { id: "px", orgId: OTHER, title: "Other org", businessStatus: "lead", archivedAt: null, deletedAt: null },
];

function event(
  quoteId: string,
  projectId: string,
  eventType: string,
  occurredAt: string,
  orgId = ORG
): AnalyticsQuoteEvent {
  return { orgId, quoteId, projectId, eventType, occurredAt };
}

function snapshot(
  quoteId: string,
  projectId: string,
  sellExGst: number,
  gstRate: number,
  sellInclGst: number,
  acceptedAt: string,
  orgId = ORG
): AnalyticsSnapshot {
  return { orgId, quoteId, projectId, sellExGst, gstRate, sellInclGst, acceptedAt };
}

const events: AnalyticsQuoteEvent[] = [
  event("q1", "p2", "quote_sent", "2026-02-02T00:00:00.000Z"),
  event("q1", "p2", "quote_viewed", "2026-02-02T02:00:00.000Z"),
  event("q2", "p2", "quote_revision_created", "2026-02-02T03:00:00.000Z"),
  event("q2", "p2", "quote_sent", "2026-02-02T00:00:00.000Z"),
  event("q2", "p2", "quote_accepted", "2026-02-04T00:00:00.000Z"),
  event("q3", "p3", "quote_sent", "2026-02-02T00:00:00.000Z"),
  event("q4", "p4", "quote_sent", "2026-02-03T00:00:00.000Z"),
  event("q4", "p4", "quote_declined", "2026-02-04T00:00:00.000Z"),
  event("q5", "p1", "quote_sent", "2026-02-03T00:00:00.000Z"),
  event("q5", "p1", "quote_expired", "2026-02-12T00:00:00.000Z"),
  event("q6", "p4", "quote_sent", "2026-02-02T00:00:00.000Z"),
  event("q7", "p5", "quote_sent", "2026-01-31T10:00:00.000Z"),
  event("q9", "px", "quote_sent", "2026-02-02T00:00:00.000Z", OTHER),
];

const snapshots: AnalyticsSnapshot[] = [
  snapshot("q2", "p2", 1000, 15, 1150, "2026-02-04T00:00:00.000Z"),
  snapshot("q3", "p3", 2000, 10, 2200, "2026-02-05T00:00:00.000Z"),
  snapshot("q6", "p4", 500, 0, 500, "2026-02-02T12:00:00.000Z"),
  snapshot("q7", "p5", 100, 0, 100, "2026-02-10T00:00:00.000Z"),
  snapshot("q8", "p4", 50, 0, 50, "2026-02-11T00:00:00.000Z"),
  snapshot("qx", "px", 50000, 15, 57500, "2026-02-04T00:00:00.000Z", OTHER),
];

const variations: AnalyticsVariation[] = [
  {
    orgId: ORG,
    variationId: "v-accepted",
    projectId: "p4",
    status: "accepted",
    netAdjustmentExGst: 80,
    gstRate: 15,
    adjustmentInclGst: 92,
    acceptedAt: "2026-02-12T00:00:00.000Z",
  },
  {
    orgId: ORG,
    variationId: "v-rejected",
    projectId: "p4",
    status: "rejected",
    netAdjustmentExGst: 9999,
    gstRate: 15,
    adjustmentInclGst: 11498.85,
    acceptedAt: "2026-02-12T00:00:00.000Z",
  },
  {
    orgId: ORG,
    variationId: "v-old",
    projectId: "p4",
    status: "accepted",
    netAdjustmentExGst: 70,
    gstRate: 15,
    adjustmentInclGst: 80.5,
    acceptedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    orgId: OTHER,
    variationId: "v-other",
    projectId: "px",
    status: "accepted",
    netAdjustmentExGst: 400,
    gstRate: 10,
    adjustmentInclGst: 440,
    acceptedAt: "2026-02-12T00:00:00.000Z",
  },
];

const book: AnalyticsMeasureInput = {
  orgId: ORG,
  window: auckland,
  projects,
  quoteEvents: events,
  snapshots,
  variations,
  deliveries: [
    { orgId: ORG, quoteId: "q1", kind: "send" },
    { orgId: ORG, quoteId: "q1", kind: "resend" },
  ],
  limits: {
    sentTruncated: false,
    snapshotsTruncated: false,
    projectsTruncated: false,
    variationsTruncated: false,
  },
};

const measured = measureAnalytics(book);
const personal = presentAnalytics(measured, "personal", auckland);
const business = presentAnalytics(measured, "business", auckland);

check("active projects ignore archive, won, and deleted", measured.activeProjects === 2);
check(
  "quotes sent count first sends only",
  measured.quotesSent === 6 &&
    measured.sentQuoteIds.slice().sort().join() === "q1,q2,q3,q4,q5,q6"
);
check("resend, viewed, declined, and expired are not extra sends", measured.quotesSent === 6);
check(
  "accepted quotes use snapshots in the period",
  measured.quotesAccepted === 5 &&
    measured.acceptedQuoteIds.slice().sort().join() === "q2,q3,q6,q7,q8"
);
check(
  "accepted value is ex GST across 15%, 10%, and 0%",
  measured.acceptedQuoteValueExGst === 3650 && measured.acceptedQuoteValueExGst !== 4000
);
check(
  "acceptance rate is projects sent, not quote revisions",
  business.tier === "business" &&
    business.acceptance.denominator === 4 &&
    business.acceptance.numerator === 3 &&
    business.acceptance.rate === 0.75
);
check(
  "variation adjustment stays off the quote baseline",
  business.tier === "business" &&
    business.variations.acceptedCount === 1 &&
    business.variations.adjustmentExGst === 80 &&
    business.acceptedQuoteValueExGst === 3650
);
check(
  "timing uses first send and skips a snapshot with no send",
  business.tier === "business" &&
    business.timing.sample === 4 &&
    business.timing.excluded === 1 &&
    business.timing.medianDays === 2.5
);
check(
  "pipeline is current status, not the period",
  business.tier === "business" &&
    business.pipeline?.find((row) => row.status === "lead")?.count === 1 &&
    business.pipeline?.find((row) => row.status === "quote_sent")?.count === 1 &&
    business.pipeline?.every((row) => row.status !== "won")
);
const trendSent = business.tier === "business" ? business.trend.reduce((sum, row) => sum + row.sent, 0) : -1;
const trendAccepted = business.tier === "business" ? business.trend.reduce((sum, row) => sum + row.accepted, 0) : -1;
check("trend totals match the period counts", trendSent === 6 && trendAccepted === 5);

const personalJson = JSON.stringify(personal);
check("personal tier is a complete basic view", personal.tier === "personal" && personal.quotesSent === 6);
check(
  "personal payload has no business measures",
  !("acceptance" in personal) &&
    !("variations" in personal) &&
    !("timing" in personal) &&
    !personalJson.includes("9999") &&
    !personalJson.includes("\"adjustmentExGst\"")
);
check(
  "linked sent records are a subset of the counted sends",
  personal.sentRecords.every((row) => measured.sentQuoteIds.includes(row.quoteId)) &&
    personal.sentRecordTotal === measured.sentQuoteIds.length &&
    personal.sentRecords.every((row) => row.href === `/app/projects/${row.projectId}`)
);
check(
  "linked accepted records are a subset of the counted acceptances",
  personal.acceptedRecords.every((row) => measured.acceptedQuoteIds.includes(row.quoteId)) &&
    personal.acceptedRecordTotal === measured.acceptedQuoteIds.length
);

const emptyWindow = resolveAnalyticsPeriod({
  period: "last_month",
  timeZone: "Pacific/Auckland",
  now: NOW,
});
const empty = presentAnalytics(
  measureAnalytics({ ...book, window: emptyWindow, quoteEvents: [], snapshots: [], variations: [] }),
  "business",
  emptyWindow
);
check(
  "zero denominator is not 0%",
  empty.tier === "business" &&
    empty.quotesSent === 0 &&
    empty.quotesAccepted === 0 &&
    empty.acceptedQuoteValueExGst === 0 &&
    empty.acceptance.denominator === 0 &&
    empty.acceptance.rate === null &&
    empty.timing.medianDays === null
);

const oneSend = measureAnalytics({
  ...book,
  quoteEvents: [event("only", "p1", "quote_sent", "2026-02-02T00:00:00.000Z")],
  snapshots: [],
  variations: [],
});
check("one sent quote stays unaccepted", oneSend.quotesSent === 1 && oneSend.quotesAccepted === 0 && oneSend.acceptance.rate === 0);

check(
  "other organisation rows cannot change the result",
  measureAnalytics({
    ...book,
    snapshots: [...snapshots, snapshot("q-foreign", "p2", 1, 15, 1.15, "2026-02-04T00:00:00.000Z", OTHER)],
  }).acceptedQuoteValueExGst === 3650
);

check("builder has personal analytics only", allows("builder", "analytics.personal") && !allows("builder", "analytics.business"));
check("business has both analytics capabilities", allows("business", "analytics.personal") && allows("business", "analytics.business"));
check("custom has both analytics capabilities", allows("custom", "analytics.personal") && allows("custom", "analytics.business"));

const trial = evaluateOrgEntitlement({
  state: state(buildInternalTrialSubscription({ id: "trial", orgId: ORG, billingEnvironment: "test", now: NOW })),
  capability: "analytics.business",
  mode: "strict",
  now: NOW,
});
const trialPersonal = evaluateOrgEntitlement({
  state: state(buildInternalTrialSubscription({ id: "trial", orgId: ORG, billingEnvironment: "test", now: NOW })),
  capability: "analytics.personal",
  mode: "strict",
  now: NOW,
});
check(
  "active trial follows the business analytics catalogue",
  trial.ok && trialPersonal.ok && trialAllowsCapability("analytics.business") && !trialAllowsCapability("team.invite")
);

const expired = buildInternalTrialSubscription({
  id: "trial",
  orgId: ORG,
  billingEnvironment: "test",
  now: new Date("2026-01-01T00:00:00.000Z"),
  trialEndsAt: new Date("2026-01-15T00:00:00.000Z"),
});
const expiredBusiness = evaluateOrgEntitlement({
  state: state(expired),
  capability: "analytics.business",
  mode: "strict",
  now: NOW,
});
const expiredPersonal = evaluateOrgEntitlement({
  state: state(expired),
  capability: "analytics.personal",
  mode: "strict",
  now: NOW,
});
check(
  "expired trial keeps basic analytics and loses business analytics",
  !expiredBusiness.ok &&
    expiredPersonal.ok &&
    analyticsTierFromDecisions({ personalOk: expiredPersonal.ok, businessOk: expiredBusiness.ok }) === "personal"
);

const builderDecision = evaluateOrgEntitlement({
  state: state(subscription("builder")),
  capability: "analytics.business",
  mode: "strict",
  now: NOW,
});
const denied = deniedBusinessAnalytics({
  message: builderDecision.message,
  reasonCode: builderDecision.reasonCode,
  upgradeTarget: builderDecision.upgradeTarget,
});
check(
  "a direct business denial carries no measures",
  denied.ok === false &&
    denied.error === "This is not included on the current plan." &&
    !("view" in denied) &&
    !JSON.stringify(denied).includes("3650")
);
check(
  "builder direct call stops at the personal tier",
  analyticsTierFromDecisions({ personalOk: true, businessOk: builderDecision.ok }) === "personal" &&
    !analyticsTablesForTier("personal").includes("variation_accepted_adjustments") &&
    analyticsTablesForTier("business").includes("variation_accepted_adjustments")
);
check(
  "upgrade copy does not invent a measured rate",
  businessAnalyticsUpgradeCopy("upgrade_required").includes("Business") &&
    !businessAnalyticsUpgradeCopy("upgrade_required").includes("%")
);

check(
  "viewer keeps the existing read matrix and gains no analytics permission",
  permissionsForRole("viewer").join(",") === "team.view,billing.view" &&
    roleAllowsPermission("viewer", "billing.view") &&
    !roleAllowsPermission("viewer", "projects.create") &&
    !ORG_PERMISSIONS.some((permission) => permission.startsWith("analytics"))
);

const loader = read("lib/analytics/load-analytics.ts");
const action = read("lib/analytics/actions.ts");
const page = read("app/(protected)/app/analytics/page.tsx");
const sidebar = read("components/app-sidebar.tsx");
const menu = read("components/layout/mobile-menu-sheet.tsx");
const mobile = read("components/layout/mobile-nav.tsx");
const view = read("components/analytics/analytics-view.tsx");

check(
  "loader checks personal entitlement before querying",
  loader.indexOf('requireOrgEntitlement(orgId, "analytics.personal")') !== -1 &&
    loader.indexOf('requireOrgEntitlement(orgId, "analytics.personal")') < loader.indexOf(".from(")
);
check(
  "variation adjustments are queried only for business",
  loader.indexOf('tier === "business" && tables.includes("variation_accepted_adjustments")') !== -1 &&
    loader.indexOf('tier === "business" && tables.includes("variation_accepted_adjustments")') <
      loader.indexOf('from("variation_accepted_adjustments")')
);
check(
  "loader uses the signed-in organisation and not a client org id",
  loader.includes("const orgId = auth.orgId") &&
    !loader.includes("searchParams") &&
    loader.includes('.eq("org_id", orgId)') &&
    !loader.includes("roleAllowsPermission")
);
check(
  "direct action checks business entitlement before loading",
  action.includes("export async function loadBusinessAnalyticsDirect(") &&
    action.includes("periodRaw: string") &&
    action.indexOf('requireOrgEntitlement(auth.orgId, "analytics.business")') <
      action.indexOf("await loadAnalyticsPage") &&
    !action.includes("variation_accepted_adjustments") &&
    !action.includes("orgId: string")
);
check(
  "page keeps a basic view and does not key off the viewer role",
  page.includes("Analytics") && !page.includes("viewer") && !page.includes("roleAllowsPermission")
);
check(
  "navigation adds Analytics without moving the mobile bottom bar",
  sidebar.includes('href: "/app/analytics"') &&
    menu.includes('"/app/analytics"') &&
    mobile.includes('data-mobile-nav="five"') &&
    !mobile.includes("/app/analytics")
);
check(
  "copy does not claim margin, profit, forecast, or cash received",
  !/margin|profit|forecast|cash received/i.test(view) &&
    view.includes("not cash") &&
    view.includes("data-analytics-upgrade")
);

console.log("\nExample book (Auckland, February 2026)");
console.log(
  JSON.stringify(
    {
      activeProjects: measured.activeProjects,
      quotesSent: measured.quotesSent,
      quotesAccepted: measured.quotesAccepted,
      acceptedQuoteValueExGst: measured.acceptedQuoteValueExGst,
      acceptance: business.tier === "business" ? business.acceptance : null,
      timing: business.tier === "business" ? business.timing : null,
      variations: business.tier === "business" ? business.variations : null,
    },
    null,
    2
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
