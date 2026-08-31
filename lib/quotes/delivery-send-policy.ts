export type QuoteSendProviderDecision =
  | "wait"
  | "finalize_only"
  | "already_submitted"
  | "submit";

export function decideQuoteSendProviderAction(prepared: {
  skipProvider?: boolean;
  needsFinalize?: boolean;
  inProgress?: boolean;
  skipSubmit?: boolean;
}): QuoteSendProviderDecision {
  if (prepared.needsFinalize) return "finalize_only";
  if (prepared.inProgress) return "wait";
  if (prepared.skipSubmit) return "already_submitted";
  if (prepared.skipProvider) return "wait";
  return "submit";
}

export type SimulatedQuoteSendState = {
  quoteStatus: "draft" | "sent";
  sendLock: boolean;
  quoteSentCount: number;
  sentAt: string | null;
  providerSubmitCount: number;
  deliveries: Array<{
    key: string;
    kind: "send" | "resend";
    status: "preparing" | "accepted" | "submitted" | "failed";
    providerMessageId: string | null;
  }>;
  lastError: string | null;
  needsFinalize: boolean;
};

const PROVIDER_FAIL_MESSAGE =
  "Quote email could not be sent. Please try again.";
const FINALISING_MESSAGE = "Email submitted — finalising Quote status.";

export function createSimulatedQuoteSendState(): SimulatedQuoteSendState {
  return {
    quoteStatus: "draft",
    sendLock: false,
    quoteSentCount: 0,
    sentAt: null,
    providerSubmitCount: 0,
    deliveries: [],
    lastError: null,
    needsFinalize: false,
  };
}

/**
 * Deterministic model of prepare → provider → finalize.
 * Used by the delivery verifier; not a second production path.
 */
export function simulateQuoteSendAttempt(
  state: SimulatedQuoteSendState,
  input: {
    key: string;
    kind: "send" | "resend";
    providerAccepts: boolean;
    finalizeSucceeds?: boolean;
  }
): SimulatedQuoteSendState {
  const next: SimulatedQuoteSendState = {
    ...state,
    deliveries: state.deliveries.map((row) => ({ ...row })),
    lastError: null,
    needsFinalize: false,
  };

  if (input.kind === "send" && next.quoteStatus !== "draft") {
    next.lastError = "invalid_transition";
    return next;
  }
  if (input.kind === "resend" && next.quoteStatus !== "sent") {
    next.lastError = "invalid_transition";
    return next;
  }

  let delivery = next.deliveries.find((row) => row.key === input.key);
  const activeSend = next.deliveries.find(
    (row) =>
      row.kind === "send" &&
      (row.status === "preparing" || row.status === "accepted")
  );
  if (
    input.kind === "send" &&
    activeSend &&
    activeSend.key !== input.key
  ) {
    next.lastError = "send_in_progress";
    return next;
  }

  if (!delivery) {
    if (input.kind === "send" && next.sendLock && activeSend) {
      delivery = activeSend;
    } else {
      delivery = {
        key: input.key,
        kind: input.kind,
        status: "preparing",
        providerMessageId: null,
      };
      next.deliveries.push(delivery);
      if (input.kind === "send") next.sendLock = true;
    }
  }

  if (delivery.status === "submitted") {
    return next;
  }
  if (delivery.status === "accepted") {
    return finalizeSimulatedDelivery(next, delivery, input.finalizeSucceeds !== false);
  }
  if (delivery.status === "preparing" && delivery.providerMessageId) {
    return finalizeSimulatedDelivery(next, delivery, input.finalizeSucceeds !== false);
  }

  next.providerSubmitCount += 1;
  if (!input.providerAccepts) {
    delivery.status = "failed";
    if (input.kind === "send") next.sendLock = false;
    next.lastError = PROVIDER_FAIL_MESSAGE;
    return next;
  }
  delivery.providerMessageId = `msg_${next.providerSubmitCount}`;
  delivery.status = "accepted";

  return finalizeSimulatedDelivery(
    next,
    delivery,
    input.finalizeSucceeds !== false
  );
}

function finalizeSimulatedDelivery(
  state: SimulatedQuoteSendState,
  delivery: SimulatedQuoteSendState["deliveries"][number],
  finalizeSucceeds: boolean
): SimulatedQuoteSendState {
  if (!delivery.providerMessageId) {
    state.lastError = PROVIDER_FAIL_MESSAGE;
    return state;
  }
  if (!finalizeSucceeds) {
    delivery.status = "accepted";
    state.needsFinalize = true;
    state.lastError = FINALISING_MESSAGE;
    return state;
  }
  if (delivery.kind === "send" && state.quoteStatus === "draft") {
    state.quoteStatus = "sent";
    state.quoteSentCount += 1;
    state.sentAt = state.sentAt ?? "2026-09-01T00:00:00.000Z";
  }
  delivery.status = "submitted";
  state.sendLock = false;
  state.needsFinalize = false;
  return state;
}

export const QUOTE_SEND_PROVIDER_FAIL_MESSAGE = PROVIDER_FAIL_MESSAGE;
export const QUOTE_SEND_FINALISING_MESSAGE = FINALISING_MESSAGE;
