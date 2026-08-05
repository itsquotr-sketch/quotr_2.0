import {
  allOf,
  anyOf,
  defineRelationship,
  parentAccepted,
} from "../relationship-helpers";
import type { ScopeRelationship } from "../types";

/**
 * Representative deck relationship sample — not a full encyclopaedia.
 * Fact keys align with lib/scopes/templates/deck.ts where applicable.
 */
export const DECK_RELATIONSHIPS: readonly ScopeRelationship[] = Object.freeze([
  defineRelationship({
    relationshipId: "deck.demolition",
    parentScopeType: "deck",
    candidateScopeType: "demolition",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "CONDITIONAL",
    title: "Demolition / existing deck removal",
    description:
      "Existing deck replacement typically requires demolition consideration.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_explicit_yes", factKey: "deck.existing_deck_removal" },
        {
          op: "fact_equals",
          factKey: "deck.existing_deck_removal",
          value: true,
        }
      )
    ),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.existing_deck_removal" },
      { op: "accepted_wa_exists", scopeType: "demolition" }
    ),
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.existing_deck_removal"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.replacement.demolition",
  }),

  defineRelationship({
    relationshipId: "deck.waste_removal",
    parentScopeType: "deck",
    candidateScopeType: "waste_removal",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "LIKELY",
    title: "Waste removal",
    description:
      "Demolition or existing deck removal typically needs waste/disposal consideration.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_explicit_yes", factKey: "deck.existing_deck_removal" },
        { op: "accepted_wa_exists", scopeType: "demolition" }
      )
    ),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.waste_removal_required" },
      { op: "accepted_wa_exists", scopeType: "waste_removal" }
    ),
    evidenceRequirements: {
      kind: "accepted_parent",
      factKeys: ["deck.existing_deck_removal"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.demolition.waste",
  }),

  defineRelationship({
    relationshipId: "deck.substructure_condition.clarify",
    parentScopeType: "deck",
    candidateScopeType: "substructure",
    suggestionKind: "CLARIFICATION_REQUIRED",
    relationshipType: "CLARIFICATION",
    title: "Clarify existing substructure condition",
    description:
      "Substructure condition is unanswered — unknown is not the same as none.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      { op: "fact_missing", factKey: "deck.substructure_condition" }
    ),
    suppressConditions: { op: "fact_exists", factKey: "deck.substructure_condition" },
    clarification: {
      key: "deck.substructure_condition",
      promptKey: "deck.substructure_condition.clarify",
      relatedFactKeys: ["deck.substructure_condition"],
    },
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.substructure_condition"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.substructure.missing_condition",
    clarifyWhenEvidenceMissing: true,
  }),

  defineRelationship({
    relationshipId: "deck.substructure.new",
    parentScopeType: "deck",
    candidateScopeType: "substructure",
    suggestionKind: "DEPENDENCY",
    relationshipType: "LIKELY",
    title: "New substructure / framing",
    description:
      "Deliberate none means no existing substructure — new substructure may still be required for a new or replaced deck.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_none", factKey: "deck.substructure_condition" },
        {
          op: "fact_equals",
          factKey: "deck.substructure_condition",
          value: "full_replacement",
        },
        { op: "fact_is_explicit_yes", factKey: "deck.substructure_included" }
      )
    ),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.substructure_included" },
      { op: "accepted_wa_exists", scopeType: "substructure" }
    ),
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.substructure_condition", "deck.substructure_included"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.substructure.new_consideration",
  }),

  defineRelationship({
    relationshipId: "deck.piles_posts",
    parentScopeType: "deck",
    candidateScopeType: "piles_posts",
    suggestionKind: "SUB_SCOPE",
    relationshipType: "LIKELY",
    title: "Piles / posts",
    description: "New or replaced deck substructure typically includes piles/posts.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_none", factKey: "deck.substructure_condition" },
        {
          op: "fact_equals",
          factKey: "deck.substructure_condition",
          value: "full_replacement",
        },
        {
          op: "fact_equals",
          factKey: "deck.substructure_condition",
          value: "partial_replacement",
        },
        {
          op: "fact_is_explicit_yes",
          factKey: "deck.pile_or_post_replacement_required",
        }
      )
    ),
    suppressConditions: anyOf(
      {
        op: "fact_is_explicit_no",
        factKey: "deck.pile_or_post_replacement_required",
      },
      {
        op: "fact_equals",
        factKey: "deck.substructure_condition",
        value: "good_existing",
      },
      { op: "accepted_wa_exists", scopeType: "piles_posts" }
    ),
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.substructure_condition"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.substructure.piles_posts",
  }),

  defineRelationship({
    relationshipId: "deck.bearers",
    parentScopeType: "deck",
    candidateScopeType: "bearers",
    suggestionKind: "SUB_SCOPE",
    relationshipType: "LIKELY",
    title: "Bearers",
    description: "Framing stack typically includes bearers.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_none", factKey: "deck.substructure_condition" },
        { op: "fact_is_explicit_yes", factKey: "deck.substructure_included" }
      )
    ),
    suppressConditions: {
      op: "fact_is_explicit_no",
      factKey: "deck.substructure_included",
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.framing.bearers",
  }),

  defineRelationship({
    relationshipId: "deck.joists",
    parentScopeType: "deck",
    candidateScopeType: "joists",
    suggestionKind: "SUB_SCOPE",
    relationshipType: "LIKELY",
    title: "Joists",
    description: "Framing stack typically includes joists.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_is_none", factKey: "deck.substructure_condition" },
        { op: "fact_is_explicit_yes", factKey: "deck.substructure_included" }
      )
    ),
    suppressConditions: {
      op: "fact_is_explicit_no",
      factKey: "deck.substructure_included",
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.framing.joists",
  }),

  defineRelationship({
    relationshipId: "deck.decking",
    parentScopeType: "deck",
    candidateScopeType: "decking",
    suggestionKind: "DEPENDENCY",
    relationshipType: "REQUIRED",
    title: "Decking surface",
    description: "Deck scope must consider the decking surface itself.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: parentAccepted("deck"),
    suppressConditions: { op: "accepted_wa_exists", scopeType: "decking" },
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.finish.decking",
  }),

  defineRelationship({
    relationshipId: "deck.fascia",
    parentScopeType: "deck",
    candidateScopeType: "fascia",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "LIKELY",
    title: "Fascia / face boards",
    description: "Vertical face boards/fascia are commonly part of deck finish.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        {
          op: "fact_is_explicit_yes",
          factKey: "deck.vertical_face_boards_required",
        },
        { op: "fact_missing", factKey: "deck.vertical_face_boards_required" }
      )
    ),
    suppressConditions: anyOf(
      {
        op: "fact_is_explicit_no",
        factKey: "deck.vertical_face_boards_required",
      },
      { op: "accepted_wa_exists", scopeType: "fascia" }
    ),
    clarifyWhenEvidenceMissing: true,
    clarification: {
      key: "deck.vertical_face_boards_required",
      promptKey: "deck.fascia.clarify",
      relatedFactKeys: ["deck.vertical_face_boards_required"],
    },
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.vertical_face_boards_required"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.finish.fascia",
  }),

  defineRelationship({
    relationshipId: "deck.stairs",
    parentScopeType: "deck",
    candidateScopeType: "stairs",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "CONDITIONAL",
    title: "Stairs / access steps",
    description: "Elevated decks or stair access types require stairs consideration.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "numeric_gte", factKey: "deck.height_m", value: 1 },
        {
          op: "fact_equals",
          factKey: "deck.access_type",
          value: "Stair set",
        },
        {
          op: "fact_equals",
          factKey: "deck.access_type",
          value: "Single step or step-down",
        },
        {
          op: "fact_equals",
          factKey: "deck.access_type",
          value: "Multiple sides step-down",
        }
      )
    ),
    suppressConditions: anyOf(
      { op: "fact_equals", factKey: "deck.access_type", value: "None" },
      { op: "fact_is_explicit_no", factKey: "deck.stairs_required" },
      { op: "accepted_wa_exists", scopeType: "stairs" },
      { op: "accepted_wa_exists", scopeType: "external_stairs" }
    ),
    clarifyWhenEvidenceMissing: true,
    clarification: {
      key: "deck.stairs",
      promptKey: "deck.stairs.clarify",
      relatedFactKeys: ["deck.height_m", "deck.access_type"],
    },
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.height_m", "deck.access_type"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.height.stairs",
  }),

  defineRelationship({
    relationshipId: "deck.balustrade",
    parentScopeType: "deck",
    candidateScopeType: "balustrade",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "CONDITIONAL",
    title: "Balustrade",
    description:
      "Elevated decks commonly need balustrade consideration — incomplete facts need clarification, not legal determination.",
    requirementLevel: "MUST_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "numeric_gte", factKey: "deck.height_m", value: 1 },
        { op: "fact_is_explicit_yes", factKey: "deck.balustrade_required" },
        { op: "fact_missing", factKey: "deck.balustrade_required" }
      )
    ),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.balustrade_required" },
      { op: "accepted_wa_exists", scopeType: "balustrade" }
    ),
    clarifyWhenEvidenceMissing: true,
    clarification: {
      key: "deck.balustrade_required",
      promptKey: "deck.balustrade.clarify",
      relatedFactKeys: ["deck.balustrade_required", "deck.height_m"],
    },
    evidenceRequirements: {
      kind: "user_fact",
      factKeys: ["deck.balustrade_required", "deck.height_m"],
      constraintKeys: [],
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.height.balustrade",
  }),

  defineRelationship({
    relationshipId: "deck.handrail",
    parentScopeType: "deck",
    candidateScopeType: "handrail",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "CONDITIONAL",
    title: "Handrail",
    description: "Handrail may be required without a full balustrade.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      { op: "fact_is_explicit_yes", factKey: "deck.handrail_required" }
    ),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.handrail_required" },
      { op: "accepted_wa_exists", scopeType: "handrail" }
    ),
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.handrail",
  }),

  defineRelationship({
    relationshipId: "deck.coatings",
    parentScopeType: "deck",
    candidateScopeType: "coatings",
    suggestionKind: "MISSING_SCOPE",
    relationshipType: "LIKELY",
    title: "Coatings / oiling",
    description: "Deck finishes commonly include coating or oiling consideration.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: parentAccepted("deck"),
    suppressConditions: anyOf(
      { op: "fact_is_explicit_no", factKey: "deck.coating_required" },
      { op: "accepted_wa_exists", scopeType: "coatings" }
    ),
    defaultConfidenceBand: "LOW",
    trades: ["deck"],
    rationaleCode: "deck.finish.coatings",
  }),

  defineRelationship({
    relationshipId: "deck.access_logistics",
    parentScopeType: "deck",
    candidateScopeType: "access_logistics",
    suggestionKind: "CLARIFICATION_REQUIRED",
    relationshipType: "CLARIFICATION",
    title: "Access / logistics",
    description: "Difficult access should be clarified for logistics planning.",
    requirementLevel: "SHOULD_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      anyOf(
        { op: "fact_equals", factKey: "deck.access", value: "Difficult" },
        { op: "constraint_equals", constraintKey: "site_access", value: "difficult" },
        { op: "constraint_equals", constraintKey: "site_access", value: "Difficult" }
      )
    ),
    suppressConditions: null,
    clarification: {
      key: "deck.access_logistics",
      promptKey: "deck.access.clarify",
      relatedFactKeys: ["deck.access"],
    },
    evidenceRequirements: {
      kind: "constraint",
      factKeys: ["deck.access"],
      constraintKeys: ["site_access"],
    },
    defaultConfidenceBand: "MEDIUM",
    trades: ["deck"],
    rationaleCode: "deck.access.logistics",
  }),

  defineRelationship({
    relationshipId: "deck.step.optional",
    parentScopeType: "deck",
    candidateScopeType: "stairs",
    suggestionKind: "POSSIBLE_EXCLUSION",
    relationshipType: "EXCLUSION_CANDIDATE",
    title: "Optional step / no stairs",
    description: "Explicit no stairs/step suppresses stair inclusion.",
    requirementLevel: "MAY_CONSIDER",
    triggerConditions: allOf(
      parentAccepted("deck"),
      { op: "fact_equals", factKey: "deck.access_type", value: "None" }
    ),
    suppressConditions: null,
    defaultConfidenceBand: "HIGH",
    trades: ["deck"],
    rationaleCode: "deck.stairs.explicit_none",
  }),
]);
