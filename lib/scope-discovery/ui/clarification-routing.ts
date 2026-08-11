/**
 * Clarification classification and Scope Details question routing (3.1B.6R2).
 *
 * Catalogue rationale / relationship IDs map to canonical Fact keys.
 * Raw AI text never becomes a question or Fact.
 */

export type ClarificationKind =
  | "SCOPE_EXISTENCE"
  | "SCOPE_DETAIL"
  | "CONFLICT";

export type ClarificationRoute = {
  readonly kind: ClarificationKind;
  /** Canonical fact key for Scope Details, when mapped. */
  readonly factKey: string | null;
  /** True when the clarification can be answered via existing questions. */
  readonly mapped: boolean;
  readonly coverageGap?: string;
};

/**
 * Deterministic mapping: rationaleCode / relationshipId → fact key.
 * Only keys that exist in scope question templates should appear here.
 */
export const CLARIFICATION_FACT_ROUTES: Readonly<
  Record<string, { readonly kind: ClarificationKind; readonly factKey: string }>
> = Object.freeze({
  "deck.substructure.missing_condition": {
    kind: "SCOPE_DETAIL",
    factKey: "deck.substructure_condition",
  },
  "deck.substructure_condition.clarify": {
    kind: "SCOPE_DETAIL",
    factKey: "deck.substructure_condition",
  },
  "deck.balustrade.height": {
    kind: "SCOPE_EXISTENCE",
    factKey: "deck.balustrade_required",
  },
  "deck.stairs.clarify": {
    kind: "SCOPE_EXISTENCE",
    factKey: "deck.has_stairs",
  },
  "deck.fascia.included": {
    kind: "SCOPE_EXISTENCE",
    factKey: "deck.fascia_included",
  },
  "deck.finish.fascia": {
    kind: "SCOPE_DETAIL",
    factKey: "deck.vertical_face_boards_required",
  },
  "deck.fascia": {
    kind: "SCOPE_DETAIL",
    factKey: "deck.vertical_face_boards_required",
  },
  "deck.fascia.clarify": {
    kind: "SCOPE_DETAIL",
    factKey: "deck.vertical_face_boards_required",
  },
  "bathroom.framing.clarify": {
    kind: "SCOPE_DETAIL",
    factKey: "bathroom.framing_required",
  },
  "bathroom.existing_condition.clarify": {
    kind: "SCOPE_DETAIL",
    factKey: "bathroom.existing_condition",
  },
  "bathroom.ventilation": {
    kind: "SCOPE_DETAIL",
    factKey: "bathroom.ventilation_required",
  },
  // Existence / include decisions — no Scope Details questionnaire (7F-R6-R4.1).
  "fitout.ceilings.seismic": {
    kind: "SCOPE_EXISTENCE",
    factKey: "fitout.ceiling_seismic",
  },
  "fitout.ceilings.services": {
    kind: "SCOPE_EXISTENCE",
    factKey: "fitout.ceiling_services",
  },
});

/** Heuristic when no explicit map — still never fabricates a Fact key. */
export function classifyClarificationKind(params: {
  readonly rationaleCode: string | null | undefined;
  readonly suggestionKind: string;
  readonly proposalClass?: string;
  readonly title?: string | null;
}): ClarificationKind {
  const code = String(params.rationaleCode ?? "").toLowerCase();
  const title = String(params.title ?? "").toLowerCase();
  const mapped = CLARIFICATION_FACT_ROUTES[code];
  if (mapped) return mapped.kind;

  if (
    code.includes("conflict") ||
    title.includes("conflict") ||
    params.suggestionKind === "CONFLICT_WARNING"
  ) {
    return "CONFLICT";
  }
  if (
    code.includes("clarify") ||
    code.includes("missing") ||
    code.includes("condition") ||
    code.includes("size") ||
    code.includes("finish") ||
    title.includes("clarify") ||
    title.includes("condition")
  ) {
    return "SCOPE_DETAIL";
  }
  if (
    title.includes("include") ||
    title.includes("included") ||
    code.includes("included")
  ) {
    return "SCOPE_EXISTENCE";
  }
  return "SCOPE_DETAIL";
}

/**
 * Deterministic title → Fact key fallbacks when rationale is missing.
 * Only catalogue-aligned Deck / bathroom patterns — never invents keys.
 */
function routeByTitleHeuristic(title: string | null | undefined): {
  readonly kind: ClarificationKind;
  readonly factKey: string;
} | null {
  const t = String(title ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("substructure") && t.includes("condition")) {
    return {
      kind: "SCOPE_DETAIL",
      factKey: "deck.substructure_condition",
    };
  }
  if (
    t.includes("fascia") ||
    t.includes("face board") ||
    t.includes("faceboards")
  ) {
    return {
      kind: "SCOPE_DETAIL",
      factKey: "deck.vertical_face_boards_required",
    };
  }
  if (t.includes("balustrade") && (t.includes("height") || t.includes("include"))) {
    return {
      kind: "SCOPE_EXISTENCE",
      factKey: "deck.balustrade_required",
    };
  }
  return null;
}

export function routeClarificationToScopeDetails(params: {
  readonly rationaleCode: string | null | undefined;
  readonly suggestionKind: string;
  readonly proposalClass?: string;
  readonly title?: string | null;
}): ClarificationRoute {
  const code = String(params.rationaleCode ?? "");
  const mapped = CLARIFICATION_FACT_ROUTES[code];
  if (mapped) {
    return {
      kind: mapped.kind,
      factKey: mapped.factKey,
      mapped: true,
    };
  }
  const byTitle = routeByTitleHeuristic(params.title);
  if (byTitle) {
    return {
      kind: byTitle.kind,
      factKey: byTitle.factKey,
      mapped: true,
    };
  }
  const kind = classifyClarificationKind(params);
  return {
    kind,
    factKey: null,
    mapped: false,
    coverageGap: code
      ? `Unmapped clarification rationale: ${code}`
      : "Unmapped clarification without rationale code",
  };
}

/**
 * Fact keys that should surface in Scope Details from routed clarifications.
 * Caller filters against existing Facts (known → skip) and exclusions.
 */
export function collectRoutedClarificationFactKeys(
  suggestions: readonly {
    readonly suggestionKind: string;
    readonly proposalClass?: string;
    readonly rationaleCode?: string | null;
    readonly decisionState: string;
    readonly reasonCode?: string | null;
  }[]
): readonly string[] {
  const keys = new Set<string>();
  for (const s of suggestions) {
    const kind = String(s.suggestionKind ?? "").toUpperCase();
    const cls = String(s.proposalClass ?? "");
    if (kind !== "CLARIFICATION_REQUIRED" && cls !== "CLARIFICATION") continue;
    const state = String(s.decisionState).toUpperCase();
    const reason = String(s.reasonCode ?? "");
    // Not required → do not queue
    if (state === "REJECTED" && !reason.includes("routed") && !reason.includes("pending")) {
      continue;
    }
    // Only queue when routed / pending detail / still open
    const shouldQueue =
      state === "PROPOSED" ||
      reason.includes("routed_to_scope_details") ||
      reason.includes("included_pending_detail") ||
      reason.includes("answer_in_scope_details");
    if (!shouldQueue && state !== "ACCEPTED" && state !== "MODIFIED") continue;
    if (
      state === "ACCEPTED" &&
      !reason.includes("pending") &&
      !reason.includes("routed")
    ) {
      // Plain include of existence clarification — no forced detail question
      const route = routeClarificationToScopeDetails({
        rationaleCode: s.rationaleCode,
        suggestionKind: s.suggestionKind,
        proposalClass: s.proposalClass,
      });
      if (route.kind !== "SCOPE_DETAIL") continue;
    }
    const route = routeClarificationToScopeDetails({
      rationaleCode: s.rationaleCode,
      suggestionKind: s.suggestionKind,
      proposalClass: s.proposalClass,
    });
    if (route.mapped && route.factKey) keys.add(route.factKey);
  }
  return [...keys];
}
