/**
 * Work Area vs Scope Item classification for Intelligent Scope Discovery (3.1B.6R1).
 *
 * Catalogue relationships mostly produce Scope Items under a parent Work Area.
 * Only genuine high-level packages use the Work Area acceptance RPC.
 */

import { isSupportedWorkAreaType } from "./decisions/schemas";

export const SCOPE_PROPOSAL_CLASSES = [
  "HIGH_LEVEL_WORK_AREA",
  "SCOPE_ITEM",
  "CLARIFICATION",
  "WARNING",
  "EXCLUSION",
] as const;

export type ScopeProposalClass = (typeof SCOPE_PROPOSAL_CLASSES)[number];

export type DecisionActionFamily =
  | "work_area"
  | "scope_item"
  | "clarification"
  | "warning"
  | "none";

/** Catalogue / product high-level packages (Analyse Job style). */
export const HIGH_LEVEL_WORK_AREA_TYPES = Object.freeze(
  new Set([
    "deck",
    "bathroom",
    "kitchen",
    "fence",
    "pergola",
    "retaining_wall",
    "external_stairs",
    "demolition",
    "internal_walls",
    "ceilings",
    "doors",
    "flooring",
    "painting",
    "plastering",
    "commercial_fitout",
  ])
);

/** Abstract catalogue candidates that must never become top-level Work Areas. */
export const SCOPE_ITEM_TYPES = Object.freeze(
  new Set([
    "waste_removal",
    "substructure",
    "piles_posts",
    "bearers",
    "joists",
    "bracing",
    "framing",
    "decking",
    "fascia",
    "stairs",
    "balustrade",
    "handrail",
    "coatings",
    "trims",
    "drainage",
    "access_logistics",
    "scaffold_access",
    "plumbing",
    "electrical",
    "waterproofing",
    "tiling",
    "linings",
    "fixtures",
    "fit_off",
    "ventilation",
    "partitions",
    "joinery",
    "fire_stopping",
    "seismic",
    "services_coordination",
    "protection",
    "make_good",
    "strip_out",
    "excavation",
  ])
);

export function isHighLevelWorkAreaType(type: string | null | undefined): boolean {
  if (!type) return false;
  return HIGH_LEVEL_WORK_AREA_TYPES.has(type);
}

export function isAbstractScopeItemType(type: string | null | undefined): boolean {
  if (!type) return false;
  return SCOPE_ITEM_TYPES.has(type);
}

/**
 * Classify a persisted / emitted suggestion for UI and decision routing.
 *
 * WORK_AREA + supported high-level type → Work Area lifecycle.
 * SUB_SCOPE / MISSING_SCOPE / DEPENDENCY → Scope Item (even if type overlaps catalogue).
 * Abstract types never use Work Area RPC.
 */
export function classifyScopeProposal(params: {
  readonly suggestionKind: string;
  readonly proposedWorkAreaType: string | null;
  readonly relatedWorkAreaId?: string | null;
}): ScopeProposalClass {
  const kind = String(params.suggestionKind ?? "").toUpperCase();
  const type = params.proposedWorkAreaType;

  if (kind === "CLARIFICATION_REQUIRED") return "CLARIFICATION";
  if (kind === "CONFLICT_WARNING" || kind === "DUPLICATE_WARNING") {
    return "WARNING";
  }
  if (kind === "POSSIBLE_EXCLUSION") return "EXCLUSION";

  if (kind === "SUB_SCOPE" || kind === "MISSING_SCOPE" || kind === "DEPENDENCY") {
    return "SCOPE_ITEM";
  }

  if (kind === "WORK_AREA") {
    if (type && isAbstractScopeItemType(type)) return "SCOPE_ITEM";
    if (
      type &&
      isSupportedWorkAreaType(type) &&
      isHighLevelWorkAreaType(type)
    ) {
      return "HIGH_LEVEL_WORK_AREA";
    }
    if (params.relatedWorkAreaId) return "SCOPE_ITEM";
    return "WARNING";
  }

  return "WARNING";
}

export function actionFamilyForClass(
  proposalClass: ScopeProposalClass
): DecisionActionFamily {
  switch (proposalClass) {
    case "HIGH_LEVEL_WORK_AREA":
      return "work_area";
    case "SCOPE_ITEM":
    case "EXCLUSION":
      return "scope_item";
    case "CLARIFICATION":
      return "clarification";
    case "WARNING":
      return "warning";
    default:
      return "none";
  }
}

export function canCreateWorkAreaFromProposal(params: {
  readonly suggestionKind: string;
  readonly proposedWorkAreaType: string | null;
  readonly relatedWorkAreaId?: string | null;
}): boolean {
  return (
    classifyScopeProposal(params) === "HIGH_LEVEL_WORK_AREA" &&
    Boolean(params.proposedWorkAreaType) &&
    isSupportedWorkAreaType(params.proposedWorkAreaType as string)
  );
}

export type Decidability = {
  readonly canDecide: boolean;
  readonly canCreateWorkArea: boolean;
  readonly canIncludeInScope: boolean;
  readonly canReject: boolean;
  readonly reason: string | null;
  readonly proposalClass: ScopeProposalClass;
  readonly actionFamily: DecisionActionFamily;
};

export function evaluateDecidability(params: {
  readonly suggestionKind: string;
  readonly proposedWorkAreaType: string | null;
  readonly relatedWorkAreaId?: string | null;
  readonly decisionState: string;
  readonly proposedTitle?: string | null;
}): Decidability {
  const proposalClass = classifyScopeProposal(params);
  const actionFamily = actionFamilyForClass(proposalClass);
  const state = String(params.decisionState ?? "").toUpperCase();

  if (state !== "PROPOSED") {
    return {
      canDecide: false,
      canCreateWorkArea: false,
      canIncludeInScope: false,
      canReject: false,
      reason: "This suggestion has already been decided.",
      proposalClass,
      actionFamily,
    };
  }

  if (proposalClass === "HIGH_LEVEL_WORK_AREA") {
    const titleOk = Boolean(params.proposedTitle?.trim());
    const typeOk =
      Boolean(params.proposedWorkAreaType) &&
      isSupportedWorkAreaType(params.proposedWorkAreaType as string);
    if (!titleOk || !typeOk) {
      return {
        canDecide: false,
        canCreateWorkArea: false,
        canIncludeInScope: false,
        canReject: true,
        reason:
          "This work area suggestion is incomplete and cannot be added as a work area.",
        proposalClass,
        actionFamily,
      };
    }
    return {
      canDecide: true,
      canCreateWorkArea: true,
      canIncludeInScope: false,
      canReject: true,
      reason: null,
      proposalClass,
      actionFamily,
    };
  }

  if (proposalClass === "SCOPE_ITEM" || proposalClass === "EXCLUSION") {
    return {
      canDecide: true,
      canCreateWorkArea: false,
      canIncludeInScope: proposalClass === "SCOPE_ITEM",
      canReject: true,
      reason: null,
      proposalClass,
      actionFamily,
    };
  }

  if (proposalClass === "CLARIFICATION") {
    return {
      canDecide: true,
      canCreateWorkArea: false,
      canIncludeInScope: false,
      canReject: true,
      reason: null,
      proposalClass,
      actionFamily,
    };
  }

  // WARNING
  return {
    canDecide: true,
    canCreateWorkArea: false,
    canIncludeInScope: false,
    canReject: true,
    reason: null,
    proposalClass,
    actionFamily,
  };
}
