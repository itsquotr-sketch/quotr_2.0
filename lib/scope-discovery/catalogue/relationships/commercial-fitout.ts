import {
  anyOf,
  defineRelationship,
  parentAccepted,
} from "../relationship-helpers";
import type { ScopeRelationship } from "../types";

/**
 * Representative commercial fitout sample.
 * Parent may be commercial_fitout or common fitout WA types (partitions/ceilings/etc.).
 */
export const COMMERCIAL_FITOUT_RELATIONSHIPS: readonly ScopeRelationship[] =
  Object.freeze([
    defineRelationship({
      relationshipId: "fitout.strip_out",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "strip_out",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Soft strip / demolition",
      description: "Commercial fitouts commonly include strip-out consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("partitions"),
        parentAccepted("ceilings"),
        parentAccepted("demolition")
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.strip_out_required" },
        { op: "accepted_wa_exists", scopeType: "strip_out" },
        { op: "accepted_wa_exists", scopeType: "demolition" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.strip_out",
    }),

    defineRelationship({
      relationshipId: "fitout.waste_removal",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "waste_removal",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Waste removal",
      description: "Strip-out typically requires waste removal consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("demolition"),
        parentAccepted("strip_out"),
        {
          op: "fact_is_explicit_yes",
          factKey: "fitout.strip_out_required",
        }
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.waste_required" },
        { op: "accepted_wa_exists", scopeType: "waste_removal" }
      ),
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.strip_out.waste",
    }),

    defineRelationship({
      relationshipId: "fitout.make_good",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "make_good",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Make-good",
      description: "Strip-out commonly requires make-good consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("demolition"),
        parentAccepted("strip_out")
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.make_good_required" },
        { op: "accepted_wa_exists", scopeType: "make_good" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.strip_out.make_good",
    }),

    defineRelationship({
      relationshipId: "fitout.partitions.doors",
      parentScopeType: "partitions",
      candidateScopeType: "doors",
      suggestionKind: "DEPENDENCY",
      relationshipType: "LIKELY",
      title: "Doors / openings",
      description: "New partitions should consider doors/openings.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("partitions"),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.doors_required" },
        { op: "accepted_wa_exists", scopeType: "doors" }
      ),
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.partitions.doors",
    }),

    defineRelationship({
      relationshipId: "fitout.partitions.services",
      parentScopeType: "partitions",
      candidateScopeType: "services_coordination",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Services coordination",
      description: "Partitions typically need services coordination.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("partitions"),
      suppressConditions: {
        op: "accepted_wa_exists",
        scopeType: "services_coordination",
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.partitions.services",
    }),

    defineRelationship({
      relationshipId: "fitout.ceilings.services",
      parentScopeType: "ceilings",
      candidateScopeType: "services_coordination",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Services coordination (ceilings)",
      description: "Ceiling work should consider services coordination.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("ceilings"),
      suppressConditions: {
        op: "accepted_wa_exists",
        scopeType: "services_coordination",
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.ceilings.services",
    }),

    defineRelationship({
      relationshipId: "fitout.ceilings.seismic",
      parentScopeType: "ceilings",
      candidateScopeType: "seismic",
      suggestionKind: "CLARIFICATION_REQUIRED",
      relationshipType: "CLARIFICATION",
      title: "Seismic interfaces",
      description:
        "Ceiling scope should clarify seismic interfaces — not a compliance determination.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("ceilings"),
      suppressConditions: {
        op: "fact_is_explicit_no",
        factKey: "fitout.seismic_required",
      },
      clarification: {
        key: "fitout.seismic",
        promptKey: "fitout.seismic.clarify",
        relatedFactKeys: ["fitout.seismic_required"],
      },
      defaultConfidenceBand: "LOW",
      regions: ["NZ", "all"],
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.ceilings.seismic",
    }),

    defineRelationship({
      relationshipId: "fitout.fire_stopping",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "fire_stopping",
      suggestionKind: "CLARIFICATION_REQUIRED",
      relationshipType: "CLARIFICATION",
      title: "Fire stopping",
      description:
        "Services penetrations should clarify fire-stopping needs — not invent requirements.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("partitions"),
        parentAccepted("ceilings"),
        {
          op: "fact_is_explicit_yes",
          factKey: "fitout.services_penetrations",
        }
      ),
      suppressConditions: {
        op: "fact_is_explicit_no",
        factKey: "fitout.fire_stopping_required",
      },
      clarification: {
        key: "fitout.fire_stopping",
        promptKey: "fitout.fire_stopping.clarify",
        relatedFactKeys: [
          "fitout.services_penetrations",
          "fitout.fire_stopping_required",
        ],
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.penetrations.fire_stopping",
    }),

    defineRelationship({
      relationshipId: "fitout.flooring",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "flooring",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Flooring",
      description: "Commercial fitouts commonly include flooring.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("partitions")
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.flooring_required" },
        { op: "accepted_wa_exists", scopeType: "flooring" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.flooring",
    }),

    defineRelationship({
      relationshipId: "fitout.joinery",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "joinery",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "CONDITIONAL",
      title: "Joinery",
      description: "Joinery may be part of commercial fitout.",
      requirementLevel: "MAY_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        { op: "fact_is_explicit_yes", factKey: "fitout.joinery_required" }
      ),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.joinery_required" },
        { op: "accepted_wa_exists", scopeType: "joinery" }
      ),
      defaultConfidenceBand: "LOW",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.joinery",
    }),

    defineRelationship({
      relationshipId: "fitout.linings",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "linings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Linings",
      description: "Fitout partitions/walls typically include linings.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        parentAccepted("partitions")
      ),
      // Prefer WA-local baseline (fitout.partitions.wall_linings) when partitions exist.
      suppressConditions: anyOf(
        { op: "accepted_wa_exists", scopeType: "linings" },
        { op: "accepted_wa_exists", scopeType: "partitions" }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.linings",
    }),

    defineRelationship({
      relationshipId: "fitout.protection",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "protection",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Protection",
      description: "Occupied sites commonly need protection consideration.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("commercial_fitout"),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "fitout.protection_required" },
        { op: "accepted_wa_exists", scopeType: "protection" }
      ),
      defaultConfidenceBand: "LOW",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.protection",
    }),

    defineRelationship({
      relationshipId: "fitout.access_logistics",
      parentScopeType: "commercial_fitout",
      candidateScopeType: "access_logistics",
      suggestionKind: "CLARIFICATION_REQUIRED",
      relationshipType: "CLARIFICATION",
      title: "Access / logistics",
      description:
        "High-security or constrained access generates logistics clarification — not commercial assumptions.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: anyOf(
        parentAccepted("commercial_fitout"),
        {
          op: "constraint_equals",
          constraintKey: "site_access",
          value: "restricted",
        },
        {
          op: "constraint_equals",
          constraintKey: "site_access",
          value: "high_security",
        },
        {
          op: "constraint_equals",
          constraintKey: "site_access",
          value: "Difficult",
        },
        {
          op: "fact_is_explicit_yes",
          factKey: "fitout.high_security_site",
        }
      ),
      suppressConditions: null,
      clarification: {
        key: "fitout.access_logistics",
        promptKey: "fitout.access.clarify",
        relatedFactKeys: ["fitout.high_security_site"],
      },
      evidenceRequirements: {
        kind: "constraint",
        factKeys: ["fitout.high_security_site"],
        constraintKeys: ["site_access"],
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.access.logistics",
    }),

    // --- 7F-R6 CORE baselines (concise; cost-bearing; not giant lists) ---
    defineRelationship({
      relationshipId: "fitout.partitions.framing",
      parentScopeType: "partitions",
      candidateScopeType: "framing",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Wall framing",
      description:
        "Confirmed internal walls normally include framing / stud work.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("partitions"),
      suppressConditions: {
        op: "fact_equals",
        factKey: "internal_walls.framing_type",
        value: "Existing frame",
      },
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.partitions.framing",
    }),

    defineRelationship({
      relationshipId: "fitout.partitions.wall_linings",
      parentScopeType: "partitions",
      candidateScopeType: "linings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Wall lining / board",
      description:
        "Confirmed internal walls normally include wall lining / board.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("partitions"),
      suppressConditions: anyOf(
        { op: "fact_equals", factKey: "internal_walls.wall_lining_type", value: "None" },
        { op: "accepted_wa_exists", scopeType: "linings" }
      ),
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.partitions.linings",
    }),

    defineRelationship({
      relationshipId: "fitout.ceilings.system",
      parentScopeType: "ceilings",
      candidateScopeType: "linings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Ceiling system / installation",
      description:
        "Confirmed ceilings normally include ceiling system installation.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("ceilings"),
      suppressConditions: null,
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.ceilings.system",
    }),

    defineRelationship({
      relationshipId: "fitout.ceilings.trims",
      parentScopeType: "ceilings",
      candidateScopeType: "trims",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Perimeter / edge trims",
      description: "Ceiling installs commonly include perimeter/edge trims.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("ceilings"),
      suppressConditions: {
        op: "fact_equals",
        factKey: "ceilings.edge_lining_type",
        value: "None",
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.ceilings.trims",
    }),

    defineRelationship({
      relationshipId: "fitout.doors.hardware",
      parentScopeType: "doors",
      candidateScopeType: "fixtures",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Door hardware / ironmongery",
      description: "Door packages normally include hardware / ironmongery.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("doors"),
      suppressConditions: {
        op: "fact_is_explicit_no",
        factKey: "doors.hardware_install_included",
      },
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.doors.hardware",
    }),

    defineRelationship({
      relationshipId: "fitout.doors.frames",
      parentScopeType: "doors",
      candidateScopeType: "joinery",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Door frames",
      description: "Door packages should consider frames unless pre-hung.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("doors"),
      suppressConditions: anyOf(
        { op: "fact_is_explicit_no", factKey: "doors.frames_included" },
        {
          op: "fact_equals",
          factKey: "doors.prehung",
          value: "Yes",
        }
      ),
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.doors.frames",
    }),

    defineRelationship({
      relationshipId: "fitout.flooring.prep",
      parentScopeType: "flooring",
      candidateScopeType: "make_good",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Floor substrate / preparation",
      description: "Flooring installs commonly need substrate / floor prep.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("flooring"),
      suppressConditions: {
        op: "fact_equals",
        factKey: "flooring.supply_scope",
        value: "Removal only",
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.flooring.prep",
    }),

    defineRelationship({
      relationshipId: "fitout.flooring.finish",
      parentScopeType: "flooring",
      candidateScopeType: "coatings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Floor finish / installation",
      description: "Confirmed flooring normally includes finish installation.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("flooring"),
      suppressConditions: {
        op: "fact_equals",
        factKey: "flooring.supply_scope",
        value: "Removal only",
      },
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.flooring.finish",
    }),

    defineRelationship({
      relationshipId: "fitout.painting.prep",
      parentScopeType: "painting",
      candidateScopeType: "protection",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Surface preparation",
      description: "Painting packages normally include surface preparation.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("painting"),
      suppressConditions: null,
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.painting.prep",
    }),

    defineRelationship({
      relationshipId: "fitout.painting.finish_coats",
      parentScopeType: "painting",
      candidateScopeType: "coatings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Finish coats",
      description: "Painting packages normally include finish coat application.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("painting"),
      suppressConditions: null,
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.painting.finish",
    }),

    defineRelationship({
      relationshipId: "fitout.plastering.stopping",
      parentScopeType: "linings",
      candidateScopeType: "coatings",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Stopping / plastering",
      description:
        "Confirmed plastering normally includes stopping / plaster finish.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("linings"),
      suppressConditions: null,
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.plastering.stopping",
    }),

    defineRelationship({
      relationshipId: "fitout.plastering.sanding",
      parentScopeType: "linings",
      candidateScopeType: "protection",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Sanding / preparation",
      description: "Plastering packages commonly include sanding / prep.",
      requirementLevel: "SHOULD_CONSIDER",
      triggerConditions: parentAccepted("linings"),
      suppressConditions: {
        op: "fact_is_explicit_no",
        factKey: "plastering.sanding_included",
      },
      defaultConfidenceBand: "MEDIUM",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.plastering.sanding",
    }),

    defineRelationship({
      relationshipId: "fitout.demolition.handling",
      parentScopeType: "demolition",
      candidateScopeType: "strip_out",
      suggestionKind: "MISSING_SCOPE",
      relationshipType: "LIKELY",
      title: "Strip-out / loading handling",
      description:
        "Confirmed demolition normally includes strip-out and loading/handling.",
      requirementLevel: "MUST_CONSIDER",
      triggerConditions: parentAccepted("demolition"),
      suppressConditions: null,
      defaultConfidenceBand: "HIGH",
      trades: ["commercial_fitout"],
      rationaleCode: "fitout.demolition.handling",
    }),
  ]);
