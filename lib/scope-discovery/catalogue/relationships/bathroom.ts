import {
  allOf,
  anyOf,
  defineRelationship,
  parentAccepted,
} from "../relationship-helpers";
import type { ScopeRelationship } from "../types";

/**
 * Representative bathroom relationship sample.
 * Fact keys align with lib/scopes/templates/bathroom.ts where applicable.
 */
export const BATHROOM_RELATIONSHIPS: readonly ScopeRelationship[] =
  Object.freeze([
    defineRelationship({
      relationshipId: "bathroom.demolition",
      parentScopeType: "bathroom",
      candidateScopeType: "demolition",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Demolition / strip-out",
      description: "Bathroom renovations commonly include demolition consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        anyOf(
          {
            op: "fact_is_explicit_yes",
            factKey: "bathroom.demolition_required",
          },
          { op: "fact_missing", factKey: "bathroom.demolition_required" }
        )
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "bathroom.demolition_required" },
        { op: "accepted_wa_exists", scopeType: "demolition" }
      ),
      clarifyWhenEvidenceMissing: true,
      clarification: {
        key: "bathroom.demolition_required",
        promptKey: "bathroom.demolition.clarify",
        relatedFactKeys: ["bathroom.demolition_required"],
      },
      evidenceRequirements: {
        kind: "user_fact",
        factKeys: ["bathroom.demolition_required"],
        constraintKeys: [],
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.demolition",
    }),

    defineRelationship({
      relationshipId: "bathroom.waste_removal",
      parentScopeType: "bathroom",
      candidateScopeType: "waste_removal",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Waste removal",
      description: "Demolition typically needs waste removal consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        anyOf(
          {
            op: "fact_is_explicit_yes",
            factKey: "bathroom.demolition_required",
          },
          { op: "accepted_wa_exists", scopeType: "demolition" }
        )
      ),
      suppressConditions: anyOf(
        {
          op: "fact_is_explicit_no",
          factKey: "bathroom.waste_removal_required",
        },
        { op: "accepted_wa_exists", scopeType: "waste_removal" }
      ),
      defaultConfidenceBand: "HIGH",
      trades: ["bathroom"],
      rationaleCode: "bathroom.demolition.waste",
    }),

    defineRelationship({
      relationshipId: "bathroom.plumbing",
      parentScopeType: "bathroom",
      candidateScopeType: "plumbing",
      suggestionKind: "DEPENDENCY",
      relationshipType: "REQUIRED",
      title: "Plumbing",
      description: "Bathroom renovations must consider plumbing.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: { op: "accepted_wa_exists", scopeType: "plumbing" },
      defaultConfidenceBand: "HIGH",
      trades: ["bathroom"],
      rationaleCode: "bathroom.plumbing",
    }),

    defineRelationship({
      relationshipId: "bathroom.electrical",
      parentScopeType: "bathroom",
      candidateScopeType: "electrical",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Electrical",
      description: "Bathroom renovations commonly include electrical consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: anyOf(
        {
          op: "fact_is_explicit_no",
          factKey: "bathroom.electrical_required",
        },
        { op: "accepted_wa_exists", scopeType: "electrical" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.electrical",
    }),

    defineRelationship({
      relationshipId: "bathroom.framing",
      parentScopeType: "bathroom",
      candidateScopeType: "framing",
      suggestionKind: "CLARIFICATION_REQUIRED",
      relationshipType: "CLARIFICATION",
      title: "Framing / structural clarification",
      description:
        "Wall removal may require structural clarification — do not auto-add structural scope.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        {
          op: "fact_is_explicit_yes",
          factKey: "bathroom.wall_removal_required",
        }
      ),
      suppressConditions: {
        op: "fact_is_explicit_no",
        factKey: "bathroom.wall_removal_required",
      },
      clarification: {
        key: "bathroom.framing",
        promptKey: "bathroom.framing.clarify",
        relatedFactKeys: ["bathroom.wall_removal_required"],
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.framing.clarify",
    }),

    defineRelationship({
      relationshipId: "bathroom.linings",
      parentScopeType: "bathroom",
      candidateScopeType: "linings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Wall / floor linings",
      description: "Bathroom renovations commonly include lining works.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: { op: "accepted_wa_exists", scopeType: "linings" },
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.linings",
    }),

    defineRelationship({
      relationshipId: "bathroom.waterproofing",
      parentScopeType: "bathroom",
      candidateScopeType: "waterproofing",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "REQUIRED",
      title: "Waterproofing",
      description:
        "Tiling / wet-area bathroom scope must consider waterproofing.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        anyOf(
          { op: "fact_is_explicit_yes", factKey: "bathroom.tiling_included" },
          {
            op: "fact_is_explicit_yes",
            factKey: "bathroom.waterproofing_included",
          },
          { op: "numeric_gt", factKey: "bathroom.floor_tiling_area_m2", value: 0 },
          { op: "numeric_gt", factKey: "bathroom.wall_tiling_area_m2", value: 0 }
        )
      ),
      suppressConditions: anyOf(
        {
          op: "fact_is_explicit_no",
          factKey: "bathroom.waterproofing_included",
        },
        { op: "accepted_wa_exists", scopeType: "waterproofing" }
      ),
      clarifyWhenEvidenceMissing: true,
      clarification: {
        key: "bathroom.waterproofing_included",
        promptKey: "bathroom.waterproofing.clarify",
        relatedFactKeys: [
          "bathroom.waterproofing_included",
          "bathroom.tiling_included",
        ],
      },
      evidenceRequirements: {
        kind: "user_fact",
        factKeys: ["bathroom.waterproofing_included", "bathroom.tiling_included"],
        constraintKeys: [],
      },
      defaultConfidenceBand: "HIGH",
      trades: ["bathroom"],
      rationaleCode: "bathroom.tiling.waterproofing",
    }),

    defineRelationship({
      relationshipId: "bathroom.tiling",
      parentScopeType: "bathroom",
      candidateScopeType: "tiling",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "CONDITIONAL",
      title: "Tiling",
      description: "Bathroom renovations often include tiling.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        anyOf(
          { op: "fact_is_explicit_yes", factKey: "bathroom.tiling_included" },
          { op: "fact_missing", factKey: "bathroom.tiling_included" }
        )
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "bathroom.tiling_included" },
        { op: "accepted_wa_exists", scopeType: "tiling" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.tiling",
    }),

    defineRelationship({
      relationshipId: "bathroom.fixtures",
      parentScopeType: "bathroom",
      candidateScopeType: "fixtures",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Fixtures",
      description: "Bathroom renovations typically include fixture consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: { op: "accepted_wa_exists", scopeType: "fixtures" },
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.fixtures",
    }),

    defineRelationship({
      relationshipId: "bathroom.fit_off",
      parentScopeType: "bathroom",
      candidateScopeType: "fit_off",
      suggestionKind: "DEPENDENCY",
      relationshipType: "LIKELY",
      title: "Fit-off / installation",
      description:
        "Client-supplied fixtures still require installation/fit-off consideration.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        anyOf(
          {
            op: "fact_is_explicit_yes",
            factKey: "bathroom.fixtures_client_supplied",
          },
          { op: "fact_exists", factKey: "bathroom.fixtures_included" },
          parentAccepted("bathroom")
        )
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "bathroom.fit_off_required" },
        { op: "accepted_wa_exists", scopeType: "fit_off" }
      ),
      defaultConfidenceBand: "HIGH",
      trades: ["bathroom"],
      rationaleCode: "bathroom.fit_off.client_supplied",
    }),

    defineRelationship({
      relationshipId: "bathroom.painting",
      parentScopeType: "bathroom",
      candidateScopeType: "painting",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Painting",
      description: "Bathroom renovations commonly include painting.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "bathroom.painting_required" },
        { op: "accepted_wa_exists", scopeType: "painting" }
      ),
      defaultConfidenceBand: "LOW",
      trades: ["bathroom"],
      rationaleCode: "bathroom.painting",
    }),

    defineRelationship({
      relationshipId: "bathroom.ventilation",
      parentScopeType: "bathroom",
      candidateScopeType: "ventilation",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Ventilation",
      description: "Bathroom renovations should consider ventilation.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("bathroom"),
      suppressConditions: anyOf(
        {
          op: "fact_is_explicit_no",
          factKey: "bathroom.ventilation_required",
        },
        { op: "accepted_wa_exists", scopeType: "ventilation" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.ventilation",
    }),

    defineRelationship({
      relationshipId: "bathroom.existing_condition.clarify",
      parentScopeType: "bathroom",
      candidateScopeType: "bathroom",
      suggestionKind: "CLARIFICATION_REQUIRED",
      relationshipType: "CLARIFICATION",
      title: "Clarify existing bathroom condition",
      description:
        "Missing existing-condition evidence needs clarification before assuming scope.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: allOf(
        parentAccepted("bathroom"),
        { op: "fact_missing", factKey: "bathroom.existing_condition" }
      ),
      suppressConditions: {
        op: "fact_exists",
        factKey: "bathroom.existing_condition",
      },
      clarification: {
        key: "bathroom.existing_condition",
        promptKey: "bathroom.existing_condition.clarify",
        relatedFactKeys: ["bathroom.existing_condition"],
      },
      evidenceRequirements: {
        kind: "user_fact",
        factKeys: ["bathroom.existing_condition"],
        constraintKeys: [],
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["bathroom"],
      rationaleCode: "bathroom.existing_condition.clarify",
      clarifyWhenEvidenceMissing: true,
    }),
  ]);
