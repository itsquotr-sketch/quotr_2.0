import type { EstimateFact } from "@/lib/estimate/types";
import { effectiveJobPlanBoolean } from "@/lib/assistant/job-plan/exclusion-provenance";
import {
  jobPlanNumber,
  jobPlanString,
  presentationFromBoolean,
} from "@/lib/assistant/job-plan/facts";
import { deckStepsCommerciallyIncluded } from "@/lib/estimate/deck-scope-2c";
import type {
  JobPlanAdapterContext,
  JobPlanScopeItem,
  JobPlanSpecChip,
  JobPlanWorkAreaAdapter,
  JobPlanWorkAreaCard,
  JobPlanWorkAreaInput,
} from "@/lib/assistant/job-plan/types";

const ELEVATED_HEIGHT_M = 1;

function booleanItem(params: {
  id: string;
  workAreaId: string;
  label: string;
  factKey: string;
  facts: readonly EstimateFact[];
  briefText: string | null;
  togglable?: boolean;
  surfaceReason: string;
}): JobPlanScopeItem {
  const value = effectiveJobPlanBoolean(
    params.facts,
    params.workAreaId,
    params.factKey,
    params.briefText
  );
  return {
    id: params.id,
    workAreaId: params.workAreaId,
    label: params.label,
    presentation: presentationFromBoolean(value),
    kind: "user_scope",
    togglable: params.togglable !== false,
    write: {
      factKey: params.factKey,
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: params.label,
    },
    sourceFactKey: params.factKey,
    surfaceReason: params.surfaceReason,
  };
}

function stepsItem(
  workAreaId: string,
  facts: readonly EstimateFact[],
  briefText: string | null
): JobPlanScopeItem {
  const explicit = effectiveJobPlanBoolean(
    facts,
    workAreaId,
    "deck.steps_included",
    briefText
  );
  const commercial =
    explicit ??
    (deckStepsCommerciallyIncluded({ facts, workAreaId }) ? true : null);
  return {
    id: "steps",
    workAreaId,
    label: "Steps",
    presentation: presentationFromBoolean(commercial),
    kind: "user_scope",
    togglable: true,
    write: {
      factKey: "deck.steps_included",
      valueType: "boolean",
      includeValue: true,
      excludeValue: false,
      label: "Steps",
    },
    sourceFactKey: "deck.steps_included",
    surfaceReason:
      "Commercial Steps when the brief or builder includes them, or when Stair set / has_stairs is already canonical — height and Single step/step-down do not auto-include",
  };
}

function isElevated(facts: readonly EstimateFact[], workAreaId: string): boolean {
  const height = jobPlanNumber(facts, workAreaId, "deck.height_m");
  const level = jobPlanString(facts, workAreaId, "deck.level")?.toLowerCase() ?? "";
  if (level.includes("elevated")) return true;
  if (height != null && height > ELEVATED_HEIGHT_M) return true;
  return false;
}

function isLowLevel(facts: readonly EstimateFact[], workAreaId: string): boolean {
  const height = jobPlanNumber(facts, workAreaId, "deck.height_m");
  const level = jobPlanString(facts, workAreaId, "deck.level")?.toLowerCase() ?? "";
  if (level.includes("elevated")) return false;
  if (height != null && height <= ELEVATED_HEIGHT_M) return true;
  return level.includes("ground");
}

/** User-facing material name. Internal family (Hardwood-class) stays internal. */
export function userFacingDeckMaterial(
  facts: readonly EstimateFact[],
  workAreaId: string,
  briefText: string | null
): string | null {
  const material = jobPlanString(facts, workAreaId, "deck.board_material");
  const brief = briefText ?? "";
  if (material) {
    const lower = material.toLowerCase();
    if (lower === "hardwood") {
      if (/\bvitex\b/i.test(brief)) return "Vitex";
      if (/\bkwila\b/i.test(brief)) return "Kwila";
      return "Hardwood";
    }
    return material;
  }
  if (/\bvitex\b/i.test(brief)) return "Vitex";
  if (/\bkwila\b/i.test(brief)) return "Kwila";
  return null;
}

function compactSummary(
  facts: readonly EstimateFact[],
  workAreaId: string,
  briefText: string | null
): { summary: string; chips: JobPlanSpecChip[] } {
  const chips: JobPlanSpecChip[] = [];
  const length = jobPlanNumber(facts, workAreaId, "deck.length_m");
  const width = jobPlanNumber(facts, workAreaId, "deck.width_m");
  const area =
    jobPlanNumber(facts, workAreaId, "deck.area_m2") ??
    (length != null && width != null ? Math.round(length * width * 100) / 100 : null);
  if (area != null) {
    chips.push({
      key: "area",
      label: "Area",
      value: `${area}m²`,
      advanced: false,
    });
  }
  const material = userFacingDeckMaterial(facts, workAreaId, briefText);
  if (material) {
    chips.push({
      key: "material",
      label: "Decking",
      value: material,
      advanced: false,
    });
  }
  const boardWidth = jobPlanNumber(facts, workAreaId, "deck.board_width_mm");
  if (boardWidth != null) {
    chips.push({
      key: "board_width",
      label: "Boards",
      value: `${boardWidth}mm`,
      advanced: false,
    });
  }
  if (isLowLevel(facts, workAreaId)) {
    chips.push({
      key: "height",
      label: "Height",
      value: "Low-level",
      advanced: false,
    });
  } else if (isElevated(facts, workAreaId)) {
    chips.push({
      key: "height",
      label: "Height",
      value: "Elevated",
      advanced: false,
    });
  }

  const joist = jobPlanString(facts, workAreaId, "deck.joist_section");
  const centres = jobPlanNumber(facts, workAreaId, "deck.joist_centres_mm");
  if (joist) {
    chips.push({
      key: "joist_section",
      label: "Joists",
      value: joist,
      advanced: true,
    });
  }
  if (centres != null) {
    chips.push({
      key: "joist_centres",
      label: "Centres",
      value: `${centres}mm`,
      advanced: true,
    });
  }

  const quick = chips.filter((c) => !c.advanced).map((c) => c.value);
  return { summary: quick.join(" · "), chips };
}

export const deckJobPlanAdapter: JobPlanWorkAreaAdapter = {
  workAreaType: "deck",
  project(workArea: JobPlanWorkAreaInput, context: JobPlanAdapterContext): JobPlanWorkAreaCard {
    const facts = context.facts;
    const id = workArea.id;
    const { summary, chips } = compactSummary(facts, id, context.briefText);

    const decking: JobPlanScopeItem = {
      id: "decking",
      workAreaId: id,
      label: "Decking",
      presentation: "INCLUDED",
      kind: "user_scope",
      togglable: false,
      write: null,
      sourceFactKey: null,
      surfaceReason: "Deterministic: Deck Work Area includes decking",
    };

    const substructure = booleanItem({
      id: "substructure",
      workAreaId: id,
      label: "New framing / substructure",
      factKey: "deck.substructure_included",
      facts,
      briefText: context.briefText,
      surfaceReason: "User-facing scope — implies joists/bearers/fixings internally",
    });

    const removal = booleanItem({
      id: "removal",
      workAreaId: id,
      label: "Existing deck removal",
      factKey: "deck.existing_deck_removal",
      facts,
      briefText: context.briefText,
      surfaceReason: "Commercially meaningful unresolved demolition",
    });

    const fascia = booleanItem({
      id: "fascia",
      workAreaId: id,
      label: "Fascia / edge boards",
      factKey: "deck.vertical_face_boards_required",
      facts,
      briefText: context.briefText,
      surfaceReason: "Commercially meaningful unresolved edge finish",
    });

    const skirting = booleanItem({
      id: "skirting",
      workAreaId: id,
      label: "Full-height deck skirting / screening",
      factKey: "deck.skirting_included",
      facts,
      briefText: context.briefText,
      surfaceReason: "Optional full-height screening — not inferred from fascia, elevation, or height",
    });

    const steps = stepsItem(id, facts, context.briefText);

    const substructureValue = effectiveJobPlanBoolean(
      facts,
      id,
      "deck.substructure_included",
      context.briefText
    );
    const showConcrete = substructureValue !== false;
    const concrete = booleanItem({
      id: "concrete_to_supports",
      workAreaId: id,
      label: "Concrete to supports",
      factKey: "deck.concrete_to_supports",
      facts,
      briefText: context.briefText,
      surfaceReason: "Optional pile/post concrete — not forced for every Deck",
    });

    const balustradeValue = effectiveJobPlanBoolean(
      facts,
      id,
      "deck.balustrade_required",
      context.briefText
    );
    const elevated = isElevated(facts, id);
    const showBalustrade = balustradeValue !== null || elevated;
    const balustrade = booleanItem({
      id: "balustrade",
      workAreaId: id,
      label: "Balustrade",
      factKey: "deck.balustrade_required",
      facts,
      briefText: context.briefText,
      surfaceReason: elevated
        ? "Elevated deck — balustrade is material to confirm"
        : "Explicit balustrade fact",
    });

    const items = [
      decking,
      substructure,
      removal,
      fascia,
      skirting,
      steps,
      ...(showConcrete ? [concrete] : []),
      ...(showBalustrade ? [balustrade] : []),
    ];

    const included = items.filter((i) => i.presentation === "INCLUDED");
    const notIncluded = items.filter((i) => i.presentation === "NOT_INCLUDED");
    const notConfirmed = items.filter((i) => i.presentation === "NOT_CONFIRMED");

    return {
      workAreaId: id,
      workAreaType: "deck",
      name: workArea.name,
      status: workArea.status,
      summary,
      specChips: chips.filter((c) => !c.advanced),
      included,
      notIncluded,
      notConfirmed,
      editAvailable: showBalustrade ? [] : [balustrade],
      confirmCount: notConfirmed.length,
    };
  },
};
