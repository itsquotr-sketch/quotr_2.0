/**
 * PLATFORM-02B — lifecycle and accepted commercial snapshot foundation.
 *
 * Architecture (extend, do not replace):
 * - 007 archives and soft-deletes projects. It is not a stage list.
 * - 010 projects.business_status remains the pre-job pipeline.
 * - 011 pricing documents remain editable commercial preparation.
 * - 012/016 quotes and revisions remain the customer document.
 * - 041 quote_events remain the quote transaction log.
 * - 044 quote_acceptances remain acceptance evidence.
 * - 058 adds the accepted snapshot, explicit position, and project event ledger.
 * Builder and Business are billing plans. Ownership stays on the organisation.
 *
 * Run: npx --yes tsx scripts/verify-platform-02b-lifecycle-foundation.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { getDomainEntityContract } from "../lib/scopes/domain-ownership";
import {
  acceptQuoteBaseline,
  clientFacingAcceptedBaseline,
  commercialDocumentResponsibilities,
  emptyLifecycleStore,
  evaluateFutureRfp,
  evaluateFutureVariation,
  LIFECYCLE_EVENT_COPY,
  LIFECYCLE_TRANSITIONS,
  projectExistingLifecycle,
  quoteCreatedEvent,
  raceAcceptances,
  readLifecycleAnalytics,
  rejectOrdinaryEventMutation,
  rejectOrdinarySnapshotMutation,
  transitionLifecycle,
  type AcceptQuoteCommand,
  type AuthorisedQuoteRevision,
} from "../lib/projects/lifecycle-foundation";

const root = join(__dirname, "..");

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const ORG = "org-a";
const OTHER_ORG = "org-b";
const PROJECT = "project-1";
const OTHER_PROJECT = "project-2";

function quote(overrides: Partial<AuthorisedQuoteRevision> = {}): AuthorisedQuoteRevision {
  return {
    id: "quote-1",
    orgId: ORG,
    projectId: PROJECT,
    revisionNumber: 2,
    status: "sent",
    supersededByQuoteId: null,
    currency: "NZD",
    gstRate: 15,
    taxTreatment: "exclusive",
    subtotal: 18218.38,
    gstAmount: 2732.76,
    totalInclGst: 20951.14,
    directCostTotal: null,
    targetMargin: null,
    effectiveMargin: null,
    inclusions: ["Hardwood decking"],
    exclusions: ["Consent"],
    scopeSummary: "Deck",
    items: [
      {
        id: "item-1",
        orgId: ORG,
        projectId: PROJECT,
        workAreaId: "wa-deck",
        pricingItemId: "price-1",
        estimateLineItemId: "est-1",
        stableItemKey: "deck.decking",
        clientDescription: "Hardwood decking",
        quantity: 36,
        unit: "m2",
        unitSell: 200,
        lineSellExGst: 7200,
        lineGst: null,
        sortOrder: 1,
      },
      {
        id: "item-2",
        orgId: ORG,
        projectId: PROJECT,
        workAreaId: "wa-deck",
        pricingItemId: null,
        estimateLineItemId: null,
        stableItemKey: null,
        clientDescription: "Deck labour",
        quantity: null,
        unit: null,
        unitSell: null,
        lineSellExGst: 1000,
        lineGst: null,
        sortOrder: 2,
      },
    ],
    ...overrides,
  };
}

function command(overrides: Partial<AcceptQuoteCommand> = {}): AcceptQuoteCommand {
  return {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    acceptanceSource: "manual",
    acceptingPartyLabel: "Alex Client",
    acceptedAt: "2026-09-26T00:00:00.000Z",
    quote: quote(),
    ...overrides,
  };
}

function main(): void {
  const migration007 = read("supabase/migrations/007_project_lifecycle.sql");
  const migration010 = read("supabase/migrations/010_business_status.sql");
  const migration044 = read("supabase/migrations/044_quote_acceptance.sql");
  const migration041 = read("supabase/migrations/041_quote_transaction.sql");
  const migration058 = read("supabase/migrations/058_project_lifecycle_foundation.sql");
  const domain = read("lib/scopes/domain-ownership.ts");
  const foundation = read("lib/projects/lifecycle-foundation.ts");
  const action = read("lib/projects/lifecycle-foundation-actions.ts");

  console.log("\nA. Existing architecture discovery");
  check(
    "A1 archive columns stay on projects and are not a stage list",
    migration007.includes("archived_at") &&
      migration007.includes("deleted_at") &&
      !migration007.includes("quote_accepted")
  );
  check(
    "A2 business_status remains the pre-job pipeline",
    migration010.includes("'estimate_ready'") &&
      migration010.includes("'quote_draft'") &&
      migration010.includes("'quote_sent'") &&
      migration010.includes("'won'") &&
      migration010.includes("'lost'")
  );
  check(
    "A3 quote acceptance evidence already exists and stays unique per quote",
    migration044.includes("create table if not exists public.quote_acceptances") &&
      migration044.includes("quote_acceptances_quote_uidx")
  );
  check(
    "A4 quote_events remain the quote transaction log",
    migration041.includes("create table if not exists public.quote_events") &&
      migration041.includes("'quote_accepted'")
  );
  check(
    "A5 domain ownership keeps estimate, pricing and quote responsibilities",
    domain.includes("draft → reviewed → converted_to_quote | archived") &&
      domain.includes("create → send/accept/decline → revise (supersede)")
  );
  check(
    "A6 snapshot entity extends the domain contract",
    getDomainEntityContract("accepted_commercial_snapshot")?.sourceOfTruth.includes(
      "accepted_commercial_snapshots"
    ) === true
  );
  check(
    "A7 migration 058 is additive and does not backfill stages",
    migration058.includes("create table if not exists public.accepted_commercial_snapshots") &&
      !migration058.includes("drop column") &&
      !/update\s+public\.projects\s+set\s+business_status/i.test(migration058)
  );

  console.log("\nB. Valid state transitions");
  let store = emptyLifecycleStore();
  const steps: Array<["draft" | "pricing" | "quote_draft" | "quote_sent" | "quote_accepted" | "active_job" | "completed", string]> = [
    ["pricing", "estimate_ready"],
    ["quote_draft", "pricing_confirmed"],
    ["quote_sent", "quote_sent"],
  ];
  let from: "draft" | "pricing" | "quote_draft" | "quote_sent" | "quote_accepted" | "active_job" =
    "draft";
  for (const [to, eventType] of steps) {
    const moved = transitionLifecycle(store, {
      authenticated: true,
      actorUserId: "user-1",
      authOrgId: ORG,
      projectId: PROJECT,
      orgId: ORG,
      from,
      to,
      occurredAt: "2026-09-26T01:00:00.000Z",
    });
    store = moved.store;
    check(
      `B ${from} → ${to}`,
      moved.result.ok === true &&
        store.events.some((row) => row.eventType === eventType)
    );
    from = to;
  }
  const accepted = acceptQuoteBaseline(store, command());
  store = accepted.store;
  check("B quote sent → quote accepted creates the baseline", accepted.result.ok === true);
  const activated = transitionLifecycle(store, {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "quote_accepted",
    to: "active_job",
    occurredAt: "2026-09-26T02:00:00.000Z",
  });
  store = activated.store;
  check("B quote accepted → active job", activated.result.ok === true);
  const completed = transitionLifecycle(store, {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "active_job",
    to: "completed",
    occurredAt: "2026-09-26T03:00:00.000Z",
  });
  check("B active job → completed", completed.result.ok === true);
  const cancelStore = transitionLifecycle(emptyLifecycleStore(), {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "draft",
    to: "cancelled",
    occurredAt: "2026-09-26T04:00:00.000Z",
  });
  check("B draft → cancelled", cancelStore.result.ok === true);
  check(
    "B SQL transition pairs match the contract",
    (Object.keys(LIFECYCLE_TRANSITIONS) as Array<keyof typeof LIFECYCLE_TRANSITIONS>).every(
      (stage) =>
        LIFECYCLE_TRANSITIONS[stage].length === 0 ||
        migration058.includes(`when v_from = '${stage}'`)
    )
  );

  console.log("\nC. Invalid transition rejection");
  const back = transitionLifecycle(completed.store, {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "completed",
    to: "draft",
    occurredAt: "2026-09-26T05:00:00.000Z",
  });
  check(
    "C completed → draft fails",
    back.result.ok === false && back.result.ok === false && "error" in back.result && back.result.error === "INVALID_TRANSITION"
  );
  const recover = transitionLifecycle(cancelStore.store, {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "cancelled",
    to: "active_job",
    occurredAt: "2026-09-26T05:00:00.000Z",
  });
  check(
    "C cancelled → active job fails",
    recover.result.ok === false && "error" in recover.result && recover.result.error === "INVALID_TRANSITION"
  );
  const noVersion = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ quote: quote({ revisionNumber: null }) })
  );
  check(
    "C acceptance without a quote version fails",
    noVersion.result.ok === false && noVersion.result.error === "QUOTE_VERSION_REQUIRED"
  );
  check(
    "C SQL rejects completed → draft by omission",
    !migration058.includes("when v_from = 'completed' and p_target") &&
      !migration058.includes("when v_from = 'cancelled' and p_target")
  );

  console.log("\nD. Quote-version ownership");
  const otherOrg = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ authOrgId: OTHER_ORG })
  );
  check("D other organisation cannot accept", otherOrg.result.ok === false && otherOrg.result.error === "CROSS_TENANT");
  const otherProject = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ projectId: OTHER_PROJECT })
  );
  check("D quote cannot attach to another project", otherProject.result.ok === false && otherProject.result.error === "CROSS_PROJECT");
  const stale = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ quote: quote({ supersededByQuoteId: "quote-9", status: "sent" }) })
  );
  check("D superseded quote is rejected", stale.result.ok === false && stale.result.error === "STALE_QUOTE_VERSION");

  console.log("\nE. Snapshot creation");
  check("E acceptance succeeds", accepted.result.ok === true);
  if (accepted.result.ok) {
    check("E snapshot records the quote and revision", accepted.result.snapshot.quoteId === "quote-1" && accepted.result.snapshot.revisionNumber === 2);
    check("E organisation and project come from the quote", accepted.result.snapshot.orgId === ORG && accepted.result.snapshot.projectId === PROJECT);
    check("E currency and tax treatment are copied", accepted.result.snapshot.currency === "NZD" && accepted.result.snapshot.taxTreatment === "exclusive");
    check("E direct cost stays null when the quote has none", accepted.result.snapshot.directCostTotal === null);
  }

  console.log("\nF. Snapshot line fidelity");
  if (accepted.result.ok) {
    const [first, second] = accepted.result.snapshot.lines;
    check("F first line keeps description, quantity, unit and work area", first.clientDescription === "Hardwood decking" && first.quantity === 36 && first.unit === "m2" && first.workAreaId === "wa-deck");
    check("F source quote item and pricing item are kept", first.sourceQuoteItemId === "item-1" && first.pricingItemId === "price-1" && first.stableItemKey === "deck.decking");
    check("F line sell is copied and line tax stays null", first.lineSellExGst === 7200 && first.lineGst === null);
    check("F ordering is preserved", first.sortOrder === 1 && second.sortOrder === 2 && second.clientDescription === "Deck labour");
  }

  console.log("\nG. Snapshot totals fidelity");
  if (accepted.result.ok) {
    check(
      "G header totals are the quote values, not a recomputed line sum",
      accepted.result.snapshot.sellExGst === 18218.38 &&
        accepted.result.snapshot.gstAmount === 2732.76 &&
        accepted.result.snapshot.sellInclGst === 20951.14 &&
        accepted.result.snapshot.gstRate === 15
    );
    const lineSum = accepted.result.snapshot.lines.reduce((sum, line) => sum + line.lineSellExGst, 0);
    check("G header is not replaced by the line sum", accepted.result.snapshot.sellExGst !== lineSum);
    check("G inclusions and exclusions are copied", JSON.stringify(accepted.result.snapshot.inclusions) === JSON.stringify(["Hardwood decking"]));
  }
  const missing = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ quote: quote({ subtotal: null }) })
  );
  check("G missing header money is not stored as zero", missing.result.ok === false && missing.store.snapshots.length === 0);

  console.log("\nH. Immutable accepted baseline");
  const before = JSON.stringify(accepted.store.snapshots);
  const mutation = rejectOrdinarySnapshotMutation(accepted.store, "snapshot:quote-1", "update");
  const deletion = rejectOrdinarySnapshotMutation(accepted.store, "snapshot:quote-1", "delete");
  check("H ordinary update and delete are rejected", mutation.error === "IMMUTABLE" && deletion.error === "IMMUTABLE");
  check("H store is unchanged after rejected edits", JSON.stringify(accepted.store.snapshots) === before);
  check(
    "H SQL blocks ordinary update and delete",
    migration058.includes("lifecycle foundation record is immutable") &&
      migration058.includes("accepted_commercial_snapshots_immutable") &&
      migration058.includes("before update or delete")
  );
  check(
    "H service cleanup deletes remain possible",
    migration058.includes("service_role") && migration058.includes("tg_op = 'DELETE'")
  );

  console.log("\nI. Idempotent acceptance");
  const repeat = acceptQuoteBaseline(accepted.store, command());
  check(
    "I repeated acceptance returns the same snapshot",
    repeat.result.ok === true &&
      repeat.result.idempotent === true &&
      repeat.result.snapshot.id === (accepted.result.ok ? accepted.result.snapshot.id : "")
  );
  check("I repeated acceptance does not add a snapshot or event", repeat.store.snapshots.length === 1 && repeat.store.events.filter((row) => row.eventType === "quote_accepted").length === 1);

  console.log("\nJ. Concurrent acceptance protection");
  const raced = raceAcceptances(emptyLifecycleStore(), [command(), command()]);
  check(
    "J two attempts on one quote leave one baseline",
    raced.store.snapshots.length === 1 &&
      raced.results.filter((row) => row.ok).length === 2 &&
      raced.results.some((row) => row.ok && row.idempotent)
  );
  const racedOther = raceAcceptances(emptyLifecycleStore(), [
    command(),
    command({ quote: quote({ id: "quote-old", revisionNumber: 1 }) }),
  ]);
  check(
    "J a second quote cannot replace the baseline",
    racedOther.store.snapshots.length === 1 &&
      racedOther.store.snapshots[0].quoteId === "quote-1" &&
      racedOther.results[1].ok === false &&
      racedOther.results[1].error === "ACCEPTED_BASELINE_EXISTS"
  );
  check(
    "J SQL uniqueness is one snapshot per project and per quote",
    migration058.includes("accepted_commercial_snapshots_project_uidx") &&
      migration058.includes("accepted_commercial_snapshots_quote_uidx") &&
      migration058.includes("ACCEPTED_BASELINE_EXISTS")
  );

  console.log("\nK. Lifecycle event creation");
  const created = quoteCreatedEvent({
    orgId: ORG,
    projectId: PROJECT,
    actorUserId: "user-1",
    quoteId: "quote-1",
    occurredAt: "2026-09-26T00:30:00.000Z",
  });
  check("K quote created event uses stable key and display copy", created.ok === true && created.event.eventType === "quote_created" && created.event.displayCopy === "Quote created" && created.event.displayCopy !== created.event.eventType);
  const required = ["estimate_ready", "pricing_confirmed", "quote_created", "quote_sent", "quote_accepted", "project_activated", "project_completed", "project_cancelled"] as const;
  check(
    "K every required event key is supported",
    required.every((key) => migration058.includes(`'${key}'`) && LIFECYCLE_EVENT_COPY[key].length > 0)
  );
  check(
    "K acceptance event carries identifiers and schema version",
    accepted.store.events.some(
      (row) =>
        row.eventType === "quote_accepted" &&
        row.orgId === ORG &&
        row.projectId === PROJECT &&
        row.actorUserId === "user-1" &&
        row.sourceEntityType === "quote" &&
        row.sourceEntityId === "quote-1" &&
        row.idempotencyKey === "quote_accepted:quote-1" &&
        row.schemaVersion === 1
    )
  );

  console.log("\nL. Append-only event behaviour");
  check("L ordinary event mutation is rejected", rejectOrdinaryEventMutation().error === "IMMUTABLE");
  const unsafe = quoteCreatedEvent({
    orgId: ORG,
    projectId: PROJECT,
    actorUserId: "user-1",
    quoteId: "quote-2",
    occurredAt: "2026-09-26T00:30:00.000Z",
  });
  check("L safe quote event has no cost or prompt metadata", unsafe.ok === true && !("cost" in unsafe.event.metadata) && !("prompt" in unsafe.event.metadata));
  check(
    "L SQL events are append-only",
    migration058.includes("project_lifecycle_events_immutable") &&
      migration058.includes("on conflict (org_id, idempotency_key) do nothing")
  );

  console.log("\nM. Cross-project rejection");
  check("M command project must match the quote project", otherProject.store.snapshots.length === 0);
  const foreignItem = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({
      quote: quote({
        items: [
          {
            ...quote().items[0],
            projectId: OTHER_PROJECT,
          },
        ],
      }),
    })
  );
  check("M a line from another project is rejected", foreignItem.result.ok === false && foreignItem.result.error === "CROSS_PROJECT");

  console.log("\nN. Cross-tenant rejection");
  check("N command organisation must match the quote", otherOrg.store.snapshots.length === 0);
  const foreignTransition = transitionLifecycle(emptyLifecycleStore(), {
    authenticated: true,
    actorUserId: "user-1",
    authOrgId: OTHER_ORG,
    projectId: PROJECT,
    orgId: ORG,
    from: "draft",
    to: "pricing",
    occurredAt: "2026-09-26T01:00:00.000Z",
  });
  check("N another organisation cannot move the project", foreignTransition.result.ok === false && foreignTransition.result.error === "CROSS_TENANT");
  check(
    "N RLS policies compare org_id to auth_org_id",
    migration058.includes("org_id = public.auth_org_id()") &&
      migration058.includes("accepted commercial snapshots in their organisation")
  );

  console.log("\nO. Unauthenticated rejection");
  const signedOut = acceptQuoteBaseline(
    emptyLifecycleStore(),
    command({ authenticated: false, actorUserId: null, authOrgId: null })
  );
  check("O signed-out acceptance fails", signedOut.result.ok === false && signedOut.result.error === "NOT_AUTHENTICATED");
  check(
    "O action and SQL require a session and do not take an organisation id",
    action.includes("getAuthOrgContext") &&
      action.includes("assertOrgOwnsActiveProject") &&
      !action.includes("orgId:") &&
      migration058.includes("NOT_AUTHENTICATED") &&
      migration058.includes("auth.uid()")
  );

  console.log("\nP. Existing-project compatibility");
  check("P lead stays draft", projectExistingLifecycle({ businessStatus: "lead" }) === "draft");
  check("P estimate ready stays pricing", projectExistingLifecycle({ businessStatus: "estimate_ready" }) === "pricing");
  check("P an unaccepted draft quote is not accepted", projectExistingLifecycle({ businessStatus: "estimating", quoteStatus: "draft" }) === "draft");
  check("P archived is not forced into a stage", projectExistingLifecycle({ businessStatus: "archived" }) === null);
  check("P won is only a projection and creates no snapshot", projectExistingLifecycle({ businessStatus: "won" }) === "quote_accepted" && emptyLifecycleStore().snapshots.length === 0);
  check(
    "P existing quotes are not scanned into snapshots",
    !migration058.includes("where status = 'accepted'") &&
      !migration058.includes("business_status = 'won'")
  );

  console.log("\nQ. Existing Estimate/Pricing/Quote equality");
  const responsibilities = commercialDocumentResponsibilities();
  check(
    "Q estimate, pricing and quote responsibilities are unchanged",
    responsibilities.estimate.includes("regenerate") &&
      responsibilities.pricing.includes("converted_to_quote") &&
      responsibilities.quote.includes("supersede") &&
      getDomainEntityContract("estimate")?.lifecycle.includes("regenerate") === true &&
      getDomainEntityContract("pricing_document")?.lifecycle.includes("converted_to_quote") === true &&
      getDomainEntityContract("quote")?.lifecycle.includes("supersede") === true
  );

  console.log("\nR. Frozen Work Area equality");
  check(
    "R Doors, Flooring and Cladding stay frozen",
    DOORS_V1_HUMAN_QA_FROZEN === true &&
      FLOORING_V1_HUMAN_QA_FROZEN === true &&
      CLADDING_V1_HUMAN_QA_FROZEN === true
  );
  check(
    "R lifecycle foundation does not recalculate work areas or rates",
    !foundation.includes("calculateDeck") &&
      !foundation.includes("from \"@/lib/estimate") &&
      !foundation.includes("organisation rates")
  );
  check(
    "R Deck golden cost and mixed-area total remain the regression contract",
    read("scripts/verify-deck-contract-r1a.ts").includes("const SAFETY_COST = 14574.7") &&
      read("scripts/verify-platform-01-r1-presentation.ts").includes("total: 7930.62")
  );

  console.log("\nS. Future Variation boundary");
  if (accepted.result.ok) {
    const snapshot = accepted.result.snapshot;
    const draftVariation = evaluateFutureVariation(snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: snapshot.id,
      version: 1,
      status: "draft",
      additions: [{ description: "Extra step", sellExGst: 500 }],
      omissions: [{ description: "Remove fascia", sellExGst: -100 }],
      substitutions: [{ description: "Change boards", sellExGst: 25 }],
    });
    check("S draft variation does not change contract value", draftVariation.ok === true && draftVariation.revisedSellExGst === null && draftVariation.snapshot === snapshot);
    const approved = evaluateFutureVariation(snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: snapshot.id,
      version: 1,
      status: "approved",
      additions: [{ description: "Extra step", sellExGst: 500 }],
      omissions: [{ description: "Remove fascia", sellExGst: -100 }],
      substitutions: [],
    });
    check("S approved variation is signed and leaves the snapshot untouched", approved.ok === true && approved.revisedSellExGst === 18218.38 + 400 && snapshot.sellExGst === 18218.38);
    const badSign = evaluateFutureVariation(snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: snapshot.id,
      version: 1,
      status: "approved",
      additions: [],
      omissions: [{ description: "Wrong sign", sellExGst: 100 }],
      substitutions: [],
    });
    check("S omission must be negative", badSign.ok === false);
    check("S variation tables were not created", !migration058.includes("create table if not exists public.variations"));
  }

  console.log("\nT. Future RFP boundary");
  if (accepted.result.ok) {
    const rfp = evaluateFutureRfp(accepted.result.snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: accepted.result.snapshot.id,
      workAreaIds: ["wa-deck"],
      snapshotLineIds: [accepted.result.snapshot.lines[0].id],
      invitedSubcontractorIds: ["sub-1"],
      responseRevision: 1,
      buyPricingInternal: true,
      changesClientQuote: false,
      explicitCostAdoption: false,
    });
    check("T RFP does not change the client quote", rfp.ok === true && rfp.clientQuoteUnchanged === true && rfp.costAdopted === false);
    const adopted = evaluateFutureRfp(accepted.result.snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: accepted.result.snapshot.id,
      workAreaIds: ["wa-deck"],
      snapshotLineIds: [],
      invitedSubcontractorIds: ["sub-1"],
      responseRevision: 2,
      buyPricingInternal: true,
      changesClientQuote: false,
      explicitCostAdoption: true,
    });
    check("T cost changes only with explicit adoption", adopted.ok === true && adopted.costAdopted === true);
    const leaked = evaluateFutureRfp(accepted.result.snapshot, {
      orgId: ORG,
      projectId: PROJECT,
      acceptedSnapshotId: accepted.result.snapshot.id,
      workAreaIds: [],
      snapshotLineIds: [],
      invitedSubcontractorIds: ["sub-1"],
      responseRevision: 1,
      buyPricingInternal: true,
      changesClientQuote: true,
      explicitCostAdoption: false,
    });
    check("T an RFP cannot rewrite the client quote", leaked.ok === false);
    check("T RFP tables were not created", !migration058.includes("create table if not exists public.subcontractor_rfps"));
  }

  console.log("\nU. Analytics read-helper behaviour");
  const analytics = readLifecycleAnalytics({
    events: [
      ...completed.store.events,
      ...(created.ok ? [created.event] : []),
    ],
    snapshots: completed.store.snapshots,
  });
  check("U counts quotes and acceptance", analytics.quoteCreatedCount === 1 && analytics.quoteAcceptedCount === 1 && analytics.quoteSentCount === 1);
  check("U conversion is accepted over sent", analytics.quoteConversion === 1);
  check("U accepted revenue uses snapshot sell and is not zero-filled", analytics.acceptedRevenueExGst === 18218.38);
  const emptyAnalytics = readLifecycleAnalytics({ events: [], snapshots: [] });
  check("U empty revenue and conversion stay null", emptyAnalytics.acceptedRevenueExGst === null && emptyAnalytics.quoteConversion === null);
  check("U duration is null until both ends exist", analytics.durations.every((row) => row.durationMs === null || row.durationMs > 0));
  check("U analytics do not expose a profit field", !("profit" in analytics) && !("margin" in analytics));

  console.log("\nV. No client exposure of internal COST");
  if (accepted.result.ok) {
    const facing = clientFacingAcceptedBaseline({
      ...accepted.result.snapshot,
      directCostTotal: 14574.7,
      targetMargin: 0.2,
    });
    const serialised = JSON.stringify(facing);
    check("V client copy has no cost or margin", !serialised.toLowerCase().includes("cost") && !serialised.toLowerCase().includes("margin"));
    check("V client copy uses plain acceptance wording", facing.message === "This quote is the accepted baseline." && !facing.message.includes("quote_accepted"));
  }
  check(
    "V action error copy hides internal terms",
    action.includes("That status change is not available.") &&
      !action.toLowerCase().includes("direct_cost")
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
