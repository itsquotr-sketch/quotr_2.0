/**
 * PLATFORM-02B — project lifecycle and accepted commercial snapshot.
 *
 * Existing responsibilities stay where they are:
 * - projects.business_status (010) is the pre-job pipeline
 *   (lead → site_visit → scoping → estimating → estimate_ready →
 *   quote_draft → quote_sent → won | lost | archived).
 * - projects.archived_at / deleted_at (007) are archive and soft-delete,
 *   not lifecycle stages.
 * - estimates stay editable working data.
 * - pricing_documents stay editable commercial preparation.
 * - quotes + quote_items are the customer document. Revisions are new
 *   quote rows (016). quote_events (041) record quote transactions.
 * - quote_acceptances (044) are immutable acceptance evidence.
 * - Hosted create, revision and send write quote_events inside the quote
 *   transaction (041/042). Migration 059 copies quote_created,
 *   quote_revision_created and quote_sent into this ledger in that same
 *   transaction. Resends stay on quote_deliveries and do not add quote_sent.
 *   Acceptance stays on the 058 snapshot trigger.
 *
 * This module adds a projection and a transition contract. It does not
 * replace those columns. An accepted commercial snapshot is a copy of the
 * accepted quote revision. project_lifecycle_events record that something
 * happened; they are not the commercial baseline.
 *
 * Builder and Business are billing plans (lib/billing). Both use the same
 * organisation ownership. This module does not add a second tenant boundary.
 *
 * No calculator, rate card, or estimate regeneration is imported here.
 */

export const LIFECYCLE_STAGES = [
  "draft",
  "pricing",
  "quote_draft",
  "quote_sent",
  "quote_accepted",
  "active_job",
  "completed",
  "cancelled",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_STAGE_LABEL: Record<LifecycleStage, string> = {
  draft: "Draft",
  pricing: "Pricing",
  quote_draft: "Quote draft",
  quote_sent: "Quote sent",
  quote_accepted: "Quote accepted",
  active_job: "Active job",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const LIFECYCLE_EVENT_TYPES = [
  "estimate_ready",
  "pricing_confirmed",
  "quote_created",
  "quote_sent",
  "quote_accepted",
  "project_activated",
  "project_completed",
  "project_cancelled",
] as const;

export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPES)[number];

export const LIFECYCLE_EVENT_COPY: Record<LifecycleEventType, string> = {
  estimate_ready: "Estimate ready",
  pricing_confirmed: "Pricing confirmed",
  quote_created: "Quote created",
  quote_sent: "Quote sent",
  quote_accepted: "Quote accepted",
  project_activated: "Job started",
  project_completed: "Job completed",
  project_cancelled: "Project cancelled",
};

export const LIFECYCLE_EVENT_SCHEMA_VERSION = 1;

/** Explicit edges. Completed and cancelled have no ordinary exit. */
export const LIFECYCLE_TRANSITIONS: Record<
  LifecycleStage,
  readonly LifecycleStage[]
> = {
  draft: ["pricing", "cancelled"],
  pricing: ["quote_draft", "cancelled"],
  quote_draft: ["quote_sent", "cancelled"],
  quote_sent: ["quote_accepted", "cancelled"],
  quote_accepted: ["active_job", "cancelled"],
  active_job: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const PIPELINE_DRAFT = new Set([
  "lead",
  "site_visit",
  "scoping",
  "estimating",
]);

const BLOCKED_METADATA_KEY =
  /^(prompt|password|token|secret|authorization|cost|direct_?cost|margin|notes?|email|phone)$/i;

export type LifecycleFailureCode =
  | "NOT_AUTHENTICATED"
  | "CROSS_TENANT"
  | "CROSS_PROJECT"
  | "INVALID_TRANSITION"
  | "QUOTE_VERSION_REQUIRED"
  | "STALE_QUOTE_VERSION"
  | "ACCEPTED_BASELINE_EXISTS"
  | "MISSING_MONEY"
  | "IMMUTABLE"
  | "NOT_FOUND"
  | "INVALID_VARIATION"
  | "INVALID_RFP"
  | "UNSAFE_METADATA";

export type LifecycleFailure = {
  ok: false;
  error: LifecycleFailureCode;
};

export type AuthorisedQuoteItem = {
  id: string;
  orgId: string;
  projectId: string;
  workAreaId: string | null;
  pricingItemId: string | null;
  estimateLineItemId: string | null;
  stableItemKey: string | null;
  clientDescription: string;
  quantity: number | null;
  unit: string | null;
  unitSell: number | null;
  lineSellExGst: number | null;
  lineGst: number | null;
  sortOrder: number;
};

/** Server-loaded quote revision. Client totals and org ids are not fields. */
export type AuthorisedQuoteRevision = {
  id: string;
  orgId: string;
  projectId: string;
  revisionNumber: number | null;
  status: string;
  supersededByQuoteId: string | null;
  currency: string | null;
  gstRate: number | null;
  taxTreatment: string | null;
  subtotal: number | null;
  gstAmount: number | null;
  totalInclGst: number | null;
  directCostTotal: number | null;
  targetMargin: number | null;
  effectiveMargin: number | null;
  inclusions: unknown;
  exclusions: unknown;
  scopeSummary: string | null;
  items: AuthorisedQuoteItem[];
};

export type AcceptQuoteCommand = {
  authenticated: boolean;
  actorUserId: string | null;
  authOrgId: string | null;
  projectId: string;
  acceptanceSource: "client" | "manual";
  acceptingPartyLabel: string | null;
  acceptedAt: string;
  quote: AuthorisedQuoteRevision;
};

export type AcceptedSnapshotLine = {
  id: string;
  snapshotId: string;
  orgId: string;
  projectId: string;
  workAreaId: string | null;
  sourceQuoteItemId: string;
  pricingItemId: string | null;
  estimateLineItemId: string | null;
  stableItemKey: string | null;
  clientDescription: string;
  quantity: number | null;
  unit: string | null;
  unitSell: number | null;
  lineSellExGst: number;
  lineGst: number | null;
  sortOrder: number;
};

export type AcceptedCommercialSnapshot = {
  id: string;
  orgId: string;
  projectId: string;
  quoteId: string;
  revisionNumber: number;
  currency: string;
  gstRate: number;
  taxTreatment: string;
  directCostTotal: number | null;
  sellExGst: number;
  gstAmount: number;
  sellInclGst: number;
  targetMargin: number | null;
  effectiveMargin: number | null;
  acceptedAt: string;
  acceptingPartyLabel: string | null;
  acceptanceSource: "client" | "manual";
  inclusions: unknown;
  exclusions: unknown;
  scopeSummary: string | null;
  lines: AcceptedSnapshotLine[];
};

export type ProjectLifecycleEvent = {
  id: string;
  orgId: string;
  projectId: string;
  actorUserId: string | null;
  eventType: LifecycleEventType;
  displayCopy: string;
  occurredAt: string;
  sourceEntityType: string;
  sourceEntityId: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  schemaVersion: number;
};

export type LifecyclePosition = {
  orgId: string;
  projectId: string;
  stage: LifecycleStage;
  acceptedSnapshotId: string | null;
};

export type LifecycleStore = {
  version: number;
  snapshots: AcceptedCommercialSnapshot[];
  events: ProjectLifecycleEvent[];
  positions: LifecyclePosition[];
};

export function emptyLifecycleStore(): LifecycleStore {
  return { version: 0, snapshots: [], events: [], positions: [] };
}

export function commercialDocumentResponsibilities(): {
  estimate: string;
  pricing: string;
  quote: string;
  acceptedSnapshot: string;
} {
  return {
    estimate: "generate → stale → regenerate in place",
    pricing: "draft → reviewed → converted_to_quote | archived",
    quote: "create → send/accept/decline → revise (supersede)",
    acceptedSnapshot: "insert once from the accepted quote revision",
  };
}

/**
 * Read model only. Does not write a stage and does not create a snapshot.
 * Archived projects stay unprojected so archive is not treated as cancelled.
 */
export function projectExistingLifecycle(input: {
  businessStatus: string | null;
  quoteStatus?: string | null;
  explicitStage?: LifecycleStage | null;
}): LifecycleStage | null {
  if (input.explicitStage) return input.explicitStage;
  const business = input.businessStatus;
  const quote = input.quoteStatus ?? null;
  if (business === "archived") return null;
  if (business === "lost") return "cancelled";
  if (business === "won") return "quote_accepted";
  if (business === "quote_sent") return "quote_sent";
  if (business === "quote_draft") return "quote_draft";
  if (business === "estimate_ready") return "pricing";
  if (business && PIPELINE_DRAFT.has(business)) return "draft";
  if (quote === "accepted") return "quote_accepted";
  if (quote === "sent" || quote === "viewed") return "quote_sent";
  if (quote === "draft") return "quote_draft";
  return null;
}

export function assertLifecycleTransition(input: {
  from: LifecycleStage | null;
  to: LifecycleStage;
  quoteId?: string | null;
  revisionNumber?: number | null;
  hasAcceptedSnapshot?: boolean;
}): { ok: true } | LifecycleFailure {
  if (!input.from || !LIFECYCLE_TRANSITIONS[input.from].includes(input.to)) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (input.to === "quote_accepted") {
    if (
      !input.quoteId ||
      input.revisionNumber == null ||
      input.hasAcceptedSnapshot !== true
    ) {
      return { ok: false, error: "QUOTE_VERSION_REQUIRED" };
    }
  }
  if (
    (input.to === "active_job" || input.to === "completed") &&
    input.hasAcceptedSnapshot !== true
  ) {
    return { ok: false, error: "QUOTE_VERSION_REQUIRED" };
  }
  return { ok: true };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function eventTypeForTarget(target: LifecycleStage): LifecycleEventType | null {
  switch (target) {
    case "pricing":
      return "estimate_ready";
    case "quote_draft":
      return "pricing_confirmed";
    case "quote_sent":
      return "quote_sent";
    case "quote_accepted":
      return "quote_accepted";
    case "active_job":
      return "project_activated";
    case "completed":
      return "project_completed";
    case "cancelled":
      return "project_cancelled";
    default:
      return null;
  }
}

function metadataIsSafe(metadata: Record<string, unknown>): boolean {
  return Object.keys(metadata).every((key) => !BLOCKED_METADATA_KEY.test(key));
}

export function buildLifecycleEvent(input: {
  orgId: string;
  projectId: string;
  actorUserId: string | null;
  eventType: LifecycleEventType;
  occurredAt: string;
  sourceEntityType: string;
  sourceEntityId: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  allowNullActor?: boolean;
}): { ok: true; event: ProjectLifecycleEvent } | LifecycleFailure {
  if (!input.idempotencyKey || !input.orgId || !input.projectId) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (!input.actorUserId && input.allowNullActor !== true) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  if (!metadataIsSafe(input.metadata)) {
    return { ok: false, error: "UNSAFE_METADATA" };
  }
  return {
    ok: true,
    event: {
      id: `event:${input.idempotencyKey}`,
      orgId: input.orgId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      displayCopy: LIFECYCLE_EVENT_COPY[input.eventType],
      occurredAt: input.occurredAt,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      idempotencyKey: input.idempotencyKey,
      metadata: { ...input.metadata },
      schemaVersion: LIFECYCLE_EVENT_SCHEMA_VERSION,
    },
  };
}

function appendEvent(
  store: LifecycleStore,
  event: ProjectLifecycleEvent
): LifecycleStore {
  if (
    store.events.some(
      (row) =>
        row.orgId === event.orgId && row.idempotencyKey === event.idempotencyKey
    )
  ) {
    return store;
  }
  return { ...store, events: [...store.events, event] };
}

export function rejectOrdinaryEventMutation(): LifecycleFailure {
  return { ok: false, error: "IMMUTABLE" };
}

function snapshotIdFor(quoteId: string): string {
  return `snapshot:${quoteId}`;
}

function lineIdFor(quoteItemId: string): string {
  return `line:${quoteItemId}`;
}

export function acceptQuoteBaseline(
  store: LifecycleStore,
  command: AcceptQuoteCommand
): { store: LifecycleStore; result: AcceptQuoteResult } {
  const prepared = prepareAcceptance(store, command);
  if (!prepared.ok) return { store, result: prepared };
  return commitPreparedAcceptance(store, prepared, store.version);
}

export type PreparedAcceptance =
  | {
      ok: true;
      expectedVersion: number;
      snapshot: AcceptedCommercialSnapshot;
      event: ProjectLifecycleEvent;
    }
  | ({ ok: false } & LifecycleFailure);

export type AcceptQuoteResult =
  | {
      ok: true;
      idempotent: boolean;
      snapshot: AcceptedCommercialSnapshot;
    }
  | LifecycleFailure;

export function prepareAcceptance(
  store: LifecycleStore,
  command: AcceptQuoteCommand
): PreparedAcceptance {
  if (!command.authenticated || !command.authOrgId) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  if (command.acceptanceSource === "manual" && !command.actorUserId) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }
  const quote = command.quote;
  if (command.authOrgId !== quote.orgId) {
    return { ok: false, error: "CROSS_TENANT" };
  }
  if (command.projectId !== quote.projectId) {
    return { ok: false, error: "CROSS_PROJECT" };
  }
  if (quote.revisionNumber == null) {
    return { ok: false, error: "QUOTE_VERSION_REQUIRED" };
  }
  if (quote.supersededByQuoteId || quote.status === "superseded") {
    return { ok: false, error: "STALE_QUOTE_VERSION" };
  }
  const existingForQuote = store.snapshots.find(
    (row) => row.quoteId === quote.id && row.orgId === quote.orgId
  );
  if (existingForQuote) {
    return {
      ok: true,
      expectedVersion: store.version,
      snapshot: existingForQuote,
      event: store.events.find((row) => row.idempotencyKey === `quote_accepted:${quote.id}`) ??
        buildRequiredEvent(existingForQuote, command),
    };
  }
  if (!["sent", "viewed"].includes(quote.status)) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  const otherBaseline = store.snapshots.find(
    (row) => row.projectId === quote.projectId && row.quoteId !== quote.id
  );
  if (otherBaseline) {
    return { ok: false, error: "ACCEPTED_BASELINE_EXISTS" };
  }
  if (
    !isFiniteNumber(quote.subtotal) ||
    !isFiniteNumber(quote.gstAmount) ||
    !isFiniteNumber(quote.totalInclGst) ||
    !isFiniteNumber(quote.gstRate) ||
    !quote.currency
  ) {
    return { ok: false, error: "MISSING_MONEY" };
  }
  for (const item of quote.items) {
    if (item.orgId !== quote.orgId || item.projectId !== quote.projectId) {
      return { ok: false, error: "CROSS_PROJECT" };
    }
    if (!isFiniteNumber(item.lineSellExGst)) {
      return { ok: false, error: "MISSING_MONEY" };
    }
  }

  const snapshotId = snapshotIdFor(quote.id);
  const snapshot: AcceptedCommercialSnapshot = {
    id: snapshotId,
    orgId: quote.orgId,
    projectId: quote.projectId,
    quoteId: quote.id,
    revisionNumber: quote.revisionNumber,
    currency: quote.currency,
    gstRate: quote.gstRate,
    taxTreatment: quote.taxTreatment ?? "exclusive",
    directCostTotal: isFiniteNumber(quote.directCostTotal)
      ? quote.directCostTotal
      : null,
    sellExGst: quote.subtotal,
    gstAmount: quote.gstAmount,
    sellInclGst: quote.totalInclGst,
    targetMargin: isFiniteNumber(quote.targetMargin) ? quote.targetMargin : null,
    effectiveMargin: isFiniteNumber(quote.effectiveMargin)
      ? quote.effectiveMargin
      : null,
    acceptedAt: command.acceptedAt,
    acceptingPartyLabel: command.acceptingPartyLabel,
    acceptanceSource: command.acceptanceSource,
    inclusions: quote.inclusions,
    exclusions: quote.exclusions,
    scopeSummary: quote.scopeSummary,
    lines: quote.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: lineIdFor(item.id),
        snapshotId,
        orgId: quote.orgId,
        projectId: quote.projectId,
        workAreaId: item.workAreaId,
        sourceQuoteItemId: item.id,
        pricingItemId: item.pricingItemId,
        estimateLineItemId: item.estimateLineItemId,
        stableItemKey: item.stableItemKey,
        clientDescription: item.clientDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitSell: item.unitSell,
        lineSellExGst: item.lineSellExGst as number,
        lineGst: isFiniteNumber(item.lineGst) ? item.lineGst : null,
        sortOrder: item.sortOrder,
      })),
  };

  const built = buildLifecycleEvent({
    orgId: quote.orgId,
    projectId: quote.projectId,
    actorUserId: command.actorUserId,
    eventType: "quote_accepted",
    occurredAt: command.acceptedAt,
    sourceEntityType: "quote",
    sourceEntityId: quote.id,
    idempotencyKey: `quote_accepted:${quote.id}`,
    metadata: {
      quoteId: quote.id,
      revisionNumber: quote.revisionNumber,
    },
    allowNullActor: command.acceptanceSource === "client",
  });
  if (!built.ok) return built;
  return {
    ok: true,
    expectedVersion: store.version,
    snapshot,
    event: built.event,
  };
}

function buildRequiredEvent(
  snapshot: AcceptedCommercialSnapshot,
  command: AcceptQuoteCommand
): ProjectLifecycleEvent {
  const built = buildLifecycleEvent({
    orgId: snapshot.orgId,
    projectId: snapshot.projectId,
    actorUserId: command.actorUserId,
    eventType: "quote_accepted",
    occurredAt: snapshot.acceptedAt,
    sourceEntityType: "quote",
    sourceEntityId: snapshot.quoteId,
    idempotencyKey: `quote_accepted:${snapshot.quoteId}`,
    metadata: {
      quoteId: snapshot.quoteId,
      revisionNumber: snapshot.revisionNumber,
    },
    allowNullActor: true,
  });
  if (!built.ok) {
    throw new Error("existing acceptance event could not be rebuilt");
  }
  return built.event;
}

/**
 * Commits against the store version observed at prepare time.
 * A stale writer re-reads and cannot insert a second baseline.
 */
export function commitPreparedAcceptance(
  store: LifecycleStore,
  prepared: PreparedAcceptance,
  expectedVersion: number
): { store: LifecycleStore; result: AcceptQuoteResult } {
  if (!prepared.ok) return { store, result: prepared };
  if (store.version !== expectedVersion) {
    const current = store.snapshots.find(
      (row) => row.quoteId === prepared.snapshot.quoteId
    );
    if (current) {
      return { store, result: { ok: true, idempotent: true, snapshot: current } };
    }
    const other = store.snapshots.find(
      (row) => row.projectId === prepared.snapshot.projectId
    );
    if (other) return { store, result: { ok: false, error: "ACCEPTED_BASELINE_EXISTS" } };
    return { store, result: { ok: false, error: "STALE_QUOTE_VERSION" } };
  }

  const same = store.snapshots.find(
    (row) => row.quoteId === prepared.snapshot.quoteId
  );
  if (same) {
    return { store, result: { ok: true, idempotent: true, snapshot: same } };
  }
  const other = store.snapshots.find(
    (row) =>
      row.projectId === prepared.snapshot.projectId &&
      row.quoteId !== prepared.snapshot.quoteId
  );
  if (other) {
    return { store, result: { ok: false, error: "ACCEPTED_BASELINE_EXISTS" } };
  }

  const withEvent = appendEvent(store, prepared.event);
  const position: LifecyclePosition = {
    orgId: prepared.snapshot.orgId,
    projectId: prepared.snapshot.projectId,
    stage: "quote_accepted",
    acceptedSnapshotId: prepared.snapshot.id,
  };
  const positions = withEvent.positions.some(
    (row) => row.projectId === prepared.snapshot.projectId
  )
    ? withEvent.positions.map((row) =>
        row.projectId === prepared.snapshot.projectId &&
        row.stage !== "active_job" &&
        row.stage !== "completed" &&
        row.stage !== "cancelled"
          ? position
          : row
      )
    : [...withEvent.positions, position];

  return {
    store: {
      ...withEvent,
      version: withEvent.version + 1,
      snapshots: [...withEvent.snapshots, prepared.snapshot],
      positions,
    },
    result: { ok: true, idempotent: false, snapshot: prepared.snapshot },
  };
}

export function raceAcceptances(
  store: LifecycleStore,
  commands: AcceptQuoteCommand[]
): { store: LifecycleStore; results: AcceptQuoteResult[] } {
  const prepared = commands.map((command) => prepareAcceptance(store, command));
  let current = store;
  const results: AcceptQuoteResult[] = [];
  for (const attempt of prepared) {
    const committed = commitPreparedAcceptance(
      current,
      attempt,
      attempt.ok ? attempt.expectedVersion : current.version
    );
    current = committed.store;
    results.push(committed.result);
  }
  return { store: current, results };
}

export function rejectOrdinarySnapshotMutation(
  store: LifecycleStore,
  snapshotId: string,
  op: "update" | "delete"
): LifecycleFailure {
  const present = store.snapshots.some((row) => row.id === snapshotId);
  if ((op === "update" || op === "delete") && (present || snapshotId.length > 0)) {
    return { ok: false, error: "IMMUTABLE" };
  }
  return { ok: false, error: "IMMUTABLE" };
}

export function transitionLifecycle(
  store: LifecycleStore,
  input: {
    authenticated: boolean;
    actorUserId: string | null;
    authOrgId: string | null;
    projectId: string;
    orgId: string;
    from: LifecycleStage | null;
    to: LifecycleStage;
    occurredAt: string;
    quoteId?: string | null;
    revisionNumber?: number | null;
  }
): { store: LifecycleStore; result: { ok: true; idempotent: boolean } | LifecycleFailure } {
  if (!input.authenticated || !input.actorUserId || !input.authOrgId) {
    return { store, result: { ok: false, error: "NOT_AUTHENTICATED" } };
  }
  if (input.authOrgId !== input.orgId) {
    return { store, result: { ok: false, error: "CROSS_TENANT" } };
  }
  const position = store.positions.find(
    (row) => row.projectId === input.projectId && row.orgId === input.orgId
  );
  if (position && position.orgId !== input.authOrgId) {
    return { store, result: { ok: false, error: "CROSS_TENANT" } };
  }
  const from = position?.stage ?? input.from;
  if (from === input.to) {
    return { store, result: { ok: true, idempotent: true } };
  }
  const snapshot = store.snapshots.find(
    (row) => row.projectId === input.projectId && row.orgId === input.orgId
  );
  const decision = assertLifecycleTransition({
    from,
    to: input.to,
    quoteId: input.quoteId ?? snapshot?.quoteId ?? null,
    revisionNumber: input.revisionNumber ?? snapshot?.revisionNumber ?? null,
    hasAcceptedSnapshot: Boolean(snapshot),
  });
  if (!decision.ok) return { store, result: decision };

  const eventType = eventTypeForTarget(input.to);
  if (!eventType) {
    return { store, result: { ok: false, error: "INVALID_TRANSITION" } };
  }
  const built = buildLifecycleEvent({
    orgId: input.orgId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    eventType,
    occurredAt: input.occurredAt,
    sourceEntityType: "project",
    sourceEntityId: input.projectId,
    idempotencyKey: `${eventType}:${input.projectId}`,
    metadata: { stage: input.to },
  });
  if (!built.ok) return { store, result: built };
  const withEvent = appendEvent(store, built.event);
  const next: LifecyclePosition = {
    orgId: input.orgId,
    projectId: input.projectId,
    stage: input.to,
    acceptedSnapshotId: snapshot?.id ?? position?.acceptedSnapshotId ?? null,
  };
  const positions = position
    ? withEvent.positions.map((row) =>
        row.projectId === input.projectId ? next : row
      )
    : [...withEvent.positions, next];
  return {
    store: { ...withEvent, positions },
    result: { ok: true, idempotent: false },
  };
}

export function clientFacingAcceptedBaseline(snapshot: AcceptedCommercialSnapshot): {
  message: string;
  currency: string;
  gstRate: number;
  sellExGst: number;
  gstAmount: number;
  sellInclGst: number;
  acceptedAt: string;
  inclusions: unknown;
  exclusions: unknown;
  lines: Array<{
    description: string;
    quantity: number | null;
    unit: string | null;
    unitSell: number | null;
    lineSellExGst: number;
    sortOrder: number;
  }>;
} {
  return {
    message: "This quote is the accepted baseline.",
    currency: snapshot.currency,
    gstRate: snapshot.gstRate,
    sellExGst: snapshot.sellExGst,
    gstAmount: snapshot.gstAmount,
    sellInclGst: snapshot.sellInclGst,
    acceptedAt: snapshot.acceptedAt,
    inclusions: snapshot.inclusions,
    exclusions: snapshot.exclusions,
    lines: snapshot.lines.map((line) => ({
      description: line.clientDescription,
      quantity: line.quantity,
      unit: line.unit,
      unitSell: line.unitSell,
      lineSellExGst: line.lineSellExGst,
      sortOrder: line.sortOrder,
    })),
  };
}

export type FutureVariationLine = {
  description: string;
  sellExGst: number;
};

export type FutureVariationIntent = {
  orgId: string;
  projectId: string;
  acceptedSnapshotId: string;
  version: number;
  status: "draft" | "submitted" | "approved";
  additions: FutureVariationLine[];
  omissions: FutureVariationLine[];
  substitutions: FutureVariationLine[];
};

function signedLines(
  lines: FutureVariationLine[],
  sign: "positive" | "negative" | "any"
): number | null {
  let total = 0;
  for (const line of lines) {
    if (!isFiniteNumber(line.sellExGst)) return null;
    if (sign === "positive" && line.sellExGst < 0) return null;
    if (sign === "negative" && line.sellExGst > 0) return null;
    total += line.sellExGst;
  }
  return total;
}

/**
 * Proves the future variation boundary without storing a variation table.
 * Draft and submitted intents do not change revised contract value.
 * The returned snapshot is the same object the caller passed in.
 */
export function evaluateFutureVariation(
  snapshot: AcceptedCommercialSnapshot,
  intent: FutureVariationIntent
):
  | {
      ok: true;
      snapshot: AcceptedCommercialSnapshot;
      revisedSellExGst: number | null;
    }
  | LifecycleFailure {
  if (intent.orgId !== snapshot.orgId) {
    return { ok: false, error: "CROSS_TENANT" };
  }
  if (
    intent.projectId !== snapshot.projectId ||
    intent.acceptedSnapshotId !== snapshot.id
  ) {
    return { ok: false, error: "CROSS_PROJECT" };
  }
  if (!Number.isInteger(intent.version) || intent.version < 1) {
    return { ok: false, error: "INVALID_VARIATION" };
  }
  const additions = signedLines(intent.additions, "positive");
  const omissions = signedLines(intent.omissions, "negative");
  const substitutions = signedLines(intent.substitutions, "any");
  if (additions == null || omissions == null || substitutions == null) {
    return { ok: false, error: "INVALID_VARIATION" };
  }
  if (intent.status !== "approved") {
    return { ok: true, snapshot, revisedSellExGst: null };
  }
  return {
    ok: true,
    snapshot,
    revisedSellExGst: snapshot.sellExGst + additions + omissions + substitutions,
  };
}

export type FutureRfpIntent = {
  orgId: string;
  projectId: string;
  acceptedSnapshotId: string | null;
  workAreaIds: string[];
  snapshotLineIds: string[];
  invitedSubcontractorIds: string[];
  responseRevision: number;
  buyPricingInternal: boolean;
  changesClientQuote: boolean;
  explicitCostAdoption: boolean;
};

export function evaluateFutureRfp(
  snapshot: AcceptedCommercialSnapshot | null,
  intent: FutureRfpIntent
): { ok: true; clientQuoteUnchanged: true; costAdopted: boolean } | LifecycleFailure {
  if (snapshot && intent.orgId !== snapshot.orgId) {
    return { ok: false, error: "CROSS_TENANT" };
  }
  if (snapshot && intent.projectId !== snapshot.projectId) {
    return { ok: false, error: "CROSS_PROJECT" };
  }
  if (intent.acceptedSnapshotId && snapshot && intent.acceptedSnapshotId !== snapshot.id) {
    return { ok: false, error: "CROSS_PROJECT" };
  }
  if (!intent.buyPricingInternal || intent.changesClientQuote) {
    return { ok: false, error: "INVALID_RFP" };
  }
  if (!Number.isInteger(intent.responseRevision) || intent.responseRevision < 1) {
    return { ok: false, error: "INVALID_RFP" };
  }
  if (intent.invitedSubcontractorIds.length < 1) {
    return { ok: false, error: "INVALID_RFP" };
  }
  return {
    ok: true,
    clientQuoteUnchanged: true,
    costAdopted: intent.explicitCostAdoption === true,
  };
}

export type LifecycleAnalytics = {
  estimateReadyCount: number;
  quoteCreatedCount: number;
  quoteSentCount: number;
  /** One quote_sent milestone per revision. Resends are not included. */
  firstSendCount: number;
  /** Projects with at least one quote_sent milestone. Conversion denominator. */
  sentProjectCount: number;
  quoteAcceptedCount: number;
  /** Distinct projects that have an accepted commercial snapshot. */
  acceptedBaselineCount: number;
  /**
   * Accepted project baselines divided by projects that have been sent.
   * A second revision send does not increase the denominator. A resend
   * does not create another quote_sent event.
   */
  quoteConversion: number | null;
  acceptedRevenueExGst: number | null;
  durations: Array<{ projectId: string; durationMs: number | null }>;
};

export const QUOTE_CONVERSION_DEFINITION =
  "accepted unique project baselines / projects with at least one quote_sent milestone";

/** quote_events types that become one lifecycle milestone per quote revision. */
export function lifecycleMilestoneForQuoteEvent(
  quoteEventType: string
): "quote_created" | "quote_sent" | null {
  if (
    quoteEventType === "quote_created" ||
    quoteEventType === "quote_revision_created"
  ) {
    return "quote_created";
  }
  if (quoteEventType === "quote_sent") return "quote_sent";
  return null;
}

export function quoteLifecycleIdempotencyKey(
  milestone: "quote_created" | "quote_sent",
  quoteId: string
): string {
  return `${milestone}:${quoteId}`;
}

/**
 * Copies a successful quote transaction event into the lifecycle ledger.
 * A failed transaction must pass succeeded: false and leaves the ledger unchanged.
 */
export function adoptHostedQuoteMilestone(
  events: ProjectLifecycleEvent[],
  input: {
    succeeded: boolean;
    quoteEventType: string;
    orgId: string;
    projectId: string;
    quoteId: string;
    revisionNumber: number;
    actorUserId: string | null;
    occurredAt: string;
  }
): ProjectLifecycleEvent[] {
  if (!input.succeeded) return events;
  const milestone = lifecycleMilestoneForQuoteEvent(input.quoteEventType);
  if (!milestone) return events;
  const idempotencyKey = quoteLifecycleIdempotencyKey(milestone, input.quoteId);
  if (events.some((row) => row.orgId === input.orgId && row.idempotencyKey === idempotencyKey)) {
    return events;
  }
  const built = buildLifecycleEvent({
    orgId: input.orgId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    eventType: milestone,
    occurredAt: input.occurredAt,
    sourceEntityType: "quote",
    sourceEntityId: input.quoteId,
    idempotencyKey,
    metadata: {
      quoteId: input.quoteId,
      revisionNumber: input.revisionNumber,
    },
    allowNullActor: false,
  });
  if (!built.ok) return events;
  return [...events, built.event];
}

function countEvents(
  events: ProjectLifecycleEvent[],
  eventType: LifecycleEventType
): number {
  return events.filter((row) => row.eventType === eventType).length;
}

/** Counts and accepted revenue. Does not derive profit from client sell. */
export function readLifecycleAnalytics(input: {
  events: ProjectLifecycleEvent[];
  snapshots: AcceptedCommercialSnapshot[];
}): LifecycleAnalytics {
  const quoteSentCount = countEvents(input.events, "quote_sent");
  const quoteAcceptedCount = countEvents(input.events, "quote_accepted");
  const sentProjectCount = new Set(
    input.events
      .filter((row) => row.eventType === "quote_sent")
      .map((row) => row.projectId)
  ).size;
  const acceptedBaselineCount = new Set(
    input.snapshots.map((row) => row.projectId)
  ).size;
  const missingSell = input.snapshots.some((row) => !isFiniteNumber(row.sellExGst));
  const acceptedRevenueExGst =
    input.snapshots.length === 0 || missingSell
      ? null
      : input.snapshots.reduce((sum, row) => sum + row.sellExGst, 0);

  const projectIds = new Set(input.events.map((row) => row.projectId));
  const durations = [...projectIds].map((projectId) => {
    const start = input.events.find(
      (row) => row.projectId === projectId && row.eventType === "estimate_ready"
    );
    const end = input.events.find(
      (row) => row.projectId === projectId && row.eventType === "project_completed"
    );
    if (!start || !end) return { projectId, durationMs: null };
    const durationMs = Date.parse(end.occurredAt) - Date.parse(start.occurredAt);
    return {
      projectId,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
    };
  });

  return {
    estimateReadyCount: countEvents(input.events, "estimate_ready"),
    quoteCreatedCount: countEvents(input.events, "quote_created"),
    quoteSentCount,
    firstSendCount: quoteSentCount,
    sentProjectCount,
    quoteAcceptedCount,
    acceptedBaselineCount,
    quoteConversion:
      sentProjectCount > 0 ? acceptedBaselineCount / sentProjectCount : null,
    acceptedRevenueExGst,
    durations,
  };
}

export function quoteCreatedEvent(input: {
  orgId: string;
  projectId: string;
  actorUserId: string;
  quoteId: string;
  occurredAt: string;
}): { ok: true; event: ProjectLifecycleEvent } | LifecycleFailure {
  return buildLifecycleEvent({
    orgId: input.orgId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    eventType: "quote_created",
    occurredAt: input.occurredAt,
    sourceEntityType: "quote",
    sourceEntityId: input.quoteId,
    idempotencyKey: `quote_created:${input.quoteId}`,
    metadata: { quoteId: input.quoteId },
  });
}
