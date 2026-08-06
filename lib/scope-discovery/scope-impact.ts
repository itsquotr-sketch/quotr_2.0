/**
 * Scope-impact classification for Fact/Question changes (3.1B.6R3).
 *
 * Detail-only answers must not stale the Scope Review run.
 * Scope-adding / excluding produce recommendations, not full reanalysis.
 */

export type ScopeImpactClass =
  | "DETAIL_ONLY"
  | "SCOPE_SUPPORTING"
  | "SCOPE_EXCLUDING"
  | "SCOPE_ADDING"
  | "FULL_REANALYSIS_REQUIRED";

export type ScopeImpactEvaluation = {
  readonly classification: ScopeImpactClass;
  readonly factKey: string;
  readonly relatedScopeItemType: string | null;
  readonly suggestedState: "INCLUDED" | "NOT_REQUIRED" | null;
  readonly explanation: string;
};

function truthy(value: unknown): boolean {
  if (value === true || value === "true" || value === "yes" || value === "Yes") {
    return true;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "yes" || v === "true" || v === "required" || v === "y";
  }
  return false;
}

function falsy(value: unknown): boolean {
  if (value === false || value === "false" || value === "no" || value === "No") {
    return true;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "no" || v === "false" || v === "none" || v === "n" || v === "not required";
  }
  return false;
}

/** Fact keys that only refine quantities / finishes — never full reanalysis. */
export const DETAIL_ONLY_FACT_KEYS = Object.freeze(
  new Set([
    "deck.length_m",
    "deck.width_m",
    "deck.area_m2",
    "deck.height_m",
    "deck.board_width_mm",
    "deck.joist_centres_mm",
    "deck.substructure_condition",
    "deck.finish_level",
    "pergola.length_m",
    "pergola.width_m",
    "pergola.area_m2",
    "pergola.height_m",
    "bathroom.floor_tiling_area_m2",
    "bathroom.wall_tiling_area_m2",
    "bathroom.total_tiling_area_m2",
    "bathroom.existing_condition",
    "internal_walls.length_lm",
    "internal_walls.height_m",
    "internal_walls.area_m2",
    "retaining_wall.length_m",
    "retaining_wall.height_m",
    "retaining_wall.height_high_m",
    "retaining_wall.height_low_m",
    "retaining_wall.backfill_volume_m3",
    "external_stairs.risers_count",
    "external_stairs.total_rise_m",
    "external_stairs.approximate_riser_count",
    "external_stairs.approximate_total_rise_m",
  ])
);

/** Fact keys that may add/remove scope items. */
export const SCOPE_SIGNAL_FACT_KEYS: Readonly<
  Record<
    string,
    {
      readonly scopeItemType: string;
      readonly yesMeans: "ADDING" | "EXCLUDING" | "SUPPORTING";
      readonly noMeans: "ADDING" | "EXCLUDING" | "SUPPORTING";
    }
  >
> = Object.freeze({
  "deck.existing_deck_removal": {
    scopeItemType: "demolition",
    yesMeans: "ADDING",
    noMeans: "EXCLUDING",
  },
  "deck.balustrade_required": {
    scopeItemType: "balustrade",
    yesMeans: "ADDING",
    noMeans: "EXCLUDING",
  },
  "deck.has_stairs": {
    scopeItemType: "stairs",
    yesMeans: "ADDING",
    noMeans: "EXCLUDING",
  },
  "deck.handrail_required": {
    scopeItemType: "handrail",
    yesMeans: "ADDING",
    noMeans: "EXCLUDING",
  },
  "deck.waste_removal_required": {
    scopeItemType: "waste_removal",
    yesMeans: "ADDING",
    noMeans: "EXCLUDING",
  },
});

/**
 * Classify a Fact change for Scope Review staleness / recommendations.
 */
export function classifyFactScopeImpact(params: {
  readonly factKey: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}): ScopeImpactEvaluation {
  const key = params.factKey;

  if (DETAIL_ONLY_FACT_KEYS.has(key)) {
    return {
      classification: "DETAIL_ONLY",
      factKey: key,
      relatedScopeItemType: null,
      suggestedState: null,
      explanation:
        "This answer refines measurements or details for included scope.",
    };
  }

  const signal = SCOPE_SIGNAL_FACT_KEYS[key];
  if (signal) {
    const becameYes = truthy(params.newValue) && !truthy(params.oldValue);
    const becameNo = falsy(params.newValue) && !falsy(params.oldValue);

    if (becameYes && signal.yesMeans === "ADDING") {
      return {
        classification: "SCOPE_ADDING",
        factKey: key,
        relatedScopeItemType: signal.scopeItemType,
        suggestedState: "INCLUDED",
        explanation: `Your answer indicates that ${humanScopeItem(signal.scopeItemType)} may now be required.`,
      };
    }
    if (becameNo && signal.noMeans === "EXCLUDING") {
      return {
        classification: "SCOPE_EXCLUDING",
        factKey: key,
        relatedScopeItemType: signal.scopeItemType,
        suggestedState: "NOT_REQUIRED",
        explanation: `Your answer indicates that ${humanScopeItem(signal.scopeItemType)} may no longer be required.`,
      };
    }
    if (becameYes && signal.yesMeans === "SUPPORTING") {
      return {
        classification: "SCOPE_SUPPORTING",
        factKey: key,
        relatedScopeItemType: signal.scopeItemType,
        suggestedState: null,
        explanation: `Your answer supports including ${humanScopeItem(signal.scopeItemType)}.`,
      };
    }
    return {
      classification: "SCOPE_SUPPORTING",
      factKey: key,
      relatedScopeItemType: signal.scopeItemType,
      suggestedState: null,
      explanation: "This answer confirms existing scope decisions.",
    };
  }

  // Unknown dotted fact keys are treated as detail unless they look project-wide
  if (key.includes(".")) {
    return {
      classification: "DETAIL_ONLY",
      factKey: key,
      relatedScopeItemType: null,
      suggestedState: null,
      explanation: "This answer updates project detail for an existing work area.",
    };
  }

  return {
    classification: "FULL_REANALYSIS_REQUIRED",
    factKey: key,
    relatedScopeItemType: null,
    suggestedState: null,
    explanation:
      "This change may introduce unclassified project scope and needs a fresh scope review.",
  };
}

function humanScopeItem(type: string): string {
  return type.replace(/_/g, " ");
}

/**
 * Facts that participate in discovery-run stale fingerprints.
 * Detail / scope-signal facts are excluded — they use recommendations instead.
 */
export function isFactMaterialForDiscoveryStale(factKey: string): boolean {
  const impact = classifyFactScopeImpact({
    factKey,
    oldValue: null,
    newValue: "probe",
  });
  return impact.classification === "FULL_REANALYSIS_REQUIRED";
}

export type ScopeChangeRecommendation = {
  readonly id: string;
  readonly workAreaId: string | null;
  readonly workAreaLabel: string;
  readonly scopeItemType: string;
  readonly scopeItemTitle: string;
  readonly factKey: string;
  readonly triggeringSummary: string;
  readonly previousState: "INCLUDED" | "NOT_REQUIRED" | "UNDECIDED";
  readonly suggestedState: "INCLUDED" | "NOT_REQUIRED";
  readonly explanation: string;
  readonly suggestionId: string | null;
};

/**
 * Build recommendations by comparing current Facts to scope-item decision state.
 * Deterministic — no provider call.
 */
export function buildScopeChangeRecommendations(params: {
  readonly facts: readonly {
    readonly key: string;
    readonly value: unknown;
    readonly work_area_id: string | null;
  }[];
  readonly workAreas: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string | null;
  }[];
  readonly scopeItemStates: readonly {
    readonly suggestionId: string;
    readonly proposedWorkAreaType: string | null;
    readonly proposedTitle: string;
    readonly decisionState: string;
    readonly relatedWorkAreaId: string | null;
  }[];
  /** Recommendation ids previously dismissed (Keep current). */
  readonly dismissedIds?: ReadonlySet<string>;
}): readonly ScopeChangeRecommendation[] {
  const dismissed = params.dismissedIds ?? new Set<string>();
  const waById = new Map(params.workAreas.map((w) => [w.id, w]));
  const results: ScopeChangeRecommendation[] = [];
  const seen = new Set<string>();

  for (const fact of params.facts) {
    const signal = SCOPE_SIGNAL_FACT_KEYS[fact.key];
    if (!signal) continue;

    const impact = classifyFactScopeImpact({
      factKey: fact.key,
      oldValue: null,
      newValue: fact.value,
    });

    let suggested: "INCLUDED" | "NOT_REQUIRED" | null = null;
    if (truthy(fact.value) && signal.yesMeans === "ADDING") {
      suggested = "INCLUDED";
    } else if (falsy(fact.value) && signal.noMeans === "EXCLUDING") {
      suggested = "NOT_REQUIRED";
    }
    if (!suggested) continue;

    const match = params.scopeItemStates.find(
      (s) =>
        s.proposedWorkAreaType === signal.scopeItemType &&
        (fact.work_area_id == null ||
          s.relatedWorkAreaId === fact.work_area_id ||
          s.relatedWorkAreaId == null)
    );

    const currentState: "INCLUDED" | "NOT_REQUIRED" | "UNDECIDED" = match
      ? match.decisionState === "ACCEPTED" || match.decisionState === "MODIFIED"
        ? "INCLUDED"
        : match.decisionState === "REJECTED"
          ? "NOT_REQUIRED"
          : "UNDECIDED"
      : "UNDECIDED";

    if (suggested === "INCLUDED" && currentState === "INCLUDED") continue;
    if (suggested === "NOT_REQUIRED" && currentState === "NOT_REQUIRED") continue;
    // Only recommend when there's a mismatch with decided or undecided that should change
    if (suggested === "INCLUDED" && currentState === "UNDECIDED") {
      // optional — skip if never decided; batch confirm handles open items
      continue;
    }
    if (suggested === "NOT_REQUIRED" && currentState === "UNDECIDED") {
      continue;
    }

    const wa =
      (fact.work_area_id && waById.get(fact.work_area_id)) ||
      params.workAreas.find((w) => w.type === "deck") ||
      null;
    const id = `${fact.key}:${signal.scopeItemType}:${suggested}:${fact.work_area_id ?? "project"}`;
    if (seen.has(id) || dismissed.has(id)) continue;
    seen.add(id);

    results.push({
      id,
      workAreaId: wa?.id ?? fact.work_area_id,
      workAreaLabel: wa?.name ?? wa?.type ?? "Work area",
      scopeItemType: signal.scopeItemType,
      scopeItemTitle:
        match?.proposedTitle ?? humanScopeItem(signal.scopeItemType),
      factKey: fact.key,
      triggeringSummary: formatTrigger(fact.key, fact.value),
      previousState: currentState,
      suggestedState: suggested,
      explanation: impact.explanation,
      suggestionId: match?.suggestionId ?? null,
    });
  }

  return results;
}

function formatTrigger(factKey: string, value: unknown): string {
  const label = factKey.split(".").pop()?.replace(/_/g, " ") ?? factKey;
  return `${label}: ${String(value)}`;
}
