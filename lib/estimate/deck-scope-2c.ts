/**
 * DECK-MATURITY-2C — remaining Deck scope ownership.
 *
 * PHYSICAL QUANTITY × PRODUCTIVITY = HOURS
 * HOURS × LABOUR $/HR = LABOUR COST
 *
 * NORMAL HANDLING = productivity (ordinary positioning, measuring, cutting,
 * moving materials at the workface, installation).
 * ABNORMAL ACCESS/CARRY = Project Condition adjustment, applied once.
 * Do not inflate productivity and also apply access for the same issue.
 */
import { getBooleanFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import { pileConditionTextIsPending } from "@/lib/estimate/scope-intent";
import type { EstimateFact } from "@/lib/estimate/types";

function factRows(facts: readonly EstimateFact[]): EstimateFact[] {
  return [...facts];
}

export const DECK_NORMAL_HANDLING_CONTRACT =
  "NORMAL HANDLING = productivity";
export const DECK_ABNORMAL_ACCESS_CONTRACT =
  "ABNORMAL ACCESS/CARRY = Project Condition adjustment.";

export const DECK_STEPS_INCLUDED_FACT_KEY = "deck.steps_included";
export const DECK_CONCRETE_TO_SUPPORTS_FACT_KEY = "deck.concrete_to_supports";
export const DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY =
  "deck.concrete_bags_per_hole";

/**
 * Retired as a takeoff. An explicit company bags-per-hole fact is a specified
 * quantity. Hole volume and the 20 kg yield decide the bags when that fact is absent.
 */
export const DECK_CONCRETE_BAGS_PER_HOLE_DEFAULT = 2.5;
export const DECK_CONCRETE_BAG_KG = 20;
export const DECK_CONCRETE_MATERIAL_ITEM_KEY = "deck.concrete.premix.20kg.bag";
/** Canonical detailed Deck concrete-placement driver: labour-h / purchased bag. */
export const DECK_CONCRETE_PRODUCTIVITY_KEY =
  "deck.post_hole_concrete.place.hours_per_bag";
/**
 * Legacy leftover. Company hours/hole must never be reinterpreted as hours/bag.
 * Not consumed for detailed Deck concrete labour.
 */
export const DECK_CONCRETE_PRODUCTIVITY_HOLE_LEGACY_KEY =
  "deck.concrete.place.hours_per_hole";
/**
 * Owner row 61: 1 person for 4 minutes per bag. The old 0.16 h/bag starter
 * (0.4 h/hole ÷ 2.5 bags) is not the approved rate.
 * Hole excavation is a separate operation with its own hours.
 */
export const DECK_CONCRETE_PLACE_HOURS_PER_BAG = 4 / 60;
export const DECK_CONCRETE_LEGACY_HOURS_PER_HOLE = 0.4;
export const DECK_CONCRETE_PRODUCTIVITY_CLASS = "LOW_CONFIDENCE" as const;
export const DECK_CONCRETE_MATERIAL_LABEL = "Post-hole concrete";
export const DECK_CONCRETE_PLACE_LABEL = "Concrete placement";

export const DECKING_LINE_LABEL = "Decking";
export const DECKING_PACKAGE_LINE_LABEL = "Decking package";

export function newSubstructureIncluded(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return getBooleanFact(factRows(facts), workAreaId, "deck.substructure_included") ?? true;
}

/**
 * Replacement is only for an EXISTING support system that may be reused.
 * A complete new support layout (new substructure) already owns new piles.
 */
export function pileReplacementApplicable(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  const facts = factRows(params.facts);
  const substructure = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.substructure_included"
  );
  const explicit = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.pile_or_post_replacement_required"
  );
  if (explicit === true && substructure !== true) return true;
  const newLayout = substructure ?? true;
  if (newLayout) return false;
  if (explicit === true) return true;

  const removal = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.existing_deck_removal"
  );
  if (removal === true) return false;

  return true;
}

export function pileRetentionPending(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  return pileConditionTextIsPending(
    getStringFact(
      factRows(params.facts),
      params.workAreaId,
      "deck.substructure_condition"
    )
  );
}

export const PILE_ALLOWANCE_COVERAGE_GAP =
  "The pile/post replacement allowance does not name work outside new support material, installation, excavation, concrete, or existing-deck removal. Its coverage is unresolved, so this is not a complete price.";

export const DECK_SUPPORT_DESIGN_UNRESOLVED =
  "Concrete footings are excluded. The support method, post count and associated excavation stay unresolved and are not priced. Decking, framing and fixings do not establish a complete or structurally adequate support design.";

export const PILE_SUPPORTS_UNRESOLVED_PENDING =
  "New support material, pile installation, hole excavation and concrete stay unresolved while existing piles are left until inspection. New framing is priced separately and does not decide those piles.";

export const PILE_SUPPORTS_RETAINED =
  "Existing piles are retained as a scope decision. That is not proof they are structurally adequate. New support material, installation, excavation and concrete are not included. New framing is priced separately.";

export const PILE_CONFIRMED_NEW_WHILE_PENDING =
  "The confirmed support layout is priced as new supports. Existing piles are not deducted and are not assumed to be replaced.";

export const PILE_CONFIRMED_NEW_WHILE_RETAINED =
  "Existing piles are retained as a scope decision, which is not proof they are structurally adequate. The confirmed support layout is new supports and is not a replacement of those piles.";

export type DeckSupportPriceTreatment =
  | "confirmed_new"
  | "explicit_replacement"
  | "replacement_unquantified"
  | "withheld_pending"
  | "withheld_retained"
  | "derived_new";

/**
 * Confirmed bearer layout is a new support quantity.
 * A stated pile count is replacement quantity only.
 * Spacing is not a decision about existing piles.
 */
export function deckSupportPriceTreatment(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  supportCountSource: "stated" | "spacing_layout" | "confirmed_layout";
  statedSupportCount: number | null;
}): DeckSupportPriceTreatment {
  if (params.supportCountSource === "confirmed_layout") return "confirmed_new";
  const replacement = getBooleanFact(
    factRows(params.facts),
    params.workAreaId,
    "deck.pile_or_post_replacement_required"
  );
  if (replacement === true) {
    return params.statedSupportCount != null && params.statedSupportCount > 0
      ? "explicit_replacement"
      : "replacement_unquantified";
  }
  if (replacement === false) return "withheld_retained";
  if (pileRetentionPending(params)) return "withheld_pending";
  return "derived_new";
}

export function deckSupportsArePriced(
  treatment: DeckSupportPriceTreatment
): boolean {
  return (
    treatment === "confirmed_new" ||
    treatment === "explicit_replacement" ||
    treatment === "derived_new"
  );
}

export const PILE_INSPECTION_CONDITION_LABEL =
  "Existing piles may be retained if sound after inspection";
export const PILE_LEFT_UNTIL_INSPECTION_LABEL =
  "Existing piles left until inspection";
export const PILE_TREATMENT_OPTIONS = [
  "Leave until inspection",
  "Assume replaced",
  "Assume retained",
] as const;

/** Details treatment labels for a pending inspection. Not a new fact. */
export function pileTreatmentChoiceValue(
  choice: unknown
): boolean | "Not sure" | null {
  if (typeof choice !== "string") return null;
  const trimmed = choice.trim();
  if (trimmed === "Assume replaced") return true;
  if (trimmed === "Assume retained") return false;
  if (trimmed === "Leave until inspection") return "Not sure";
  return null;
}

export function shouldAskPileReplacement(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  const known = getBooleanFact(
    factRows(params.facts),
    params.workAreaId,
    "deck.pile_or_post_replacement_required"
  );
  if (known != null) return false;
  if (pileRetentionPending(params)) return true;
  if (!pileReplacementApplicable(params)) return false;
  return true;
}

/** Ask for a count only after replacement is an explicit assumption. */
export function shouldAskPileCount(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  const facts = factRows(params.facts);
  if (
    getBooleanFact(
      facts,
      params.workAreaId,
      "deck.pile_or_post_replacement_required"
    ) !== true
  ) {
    return false;
  }
  const count = getNumberFact(
    facts,
    params.workAreaId,
    "deck.pile_or_post_count"
  );
  return count == null || !(count > 0);
}

/**
 * Commercial Steps are builder/brief scope — not deck height and not
 * logistics access_type "Single step or step-down".
 */
export function deckStepsCommerciallyIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  const facts = factRows(params.facts);
  const included = getBooleanFact(
    facts,
    params.workAreaId,
    DECK_STEPS_INCLUDED_FACT_KEY
  );
  if (included === true) return true;
  if (included === false) return false;

  const hasStairs = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.has_stairs"
  );
  if (hasStairs === true) return true;
  if (hasStairs === false) return false;

  const access = getStringFact(
    facts,
    params.workAreaId,
    "deck.access_type"
  )
    ?.trim()
    .toLowerCase();
  if (!access || access === "none") return false;
  if (access.includes("stair set") || access === "stair set") return true;
  return false;
}

export function concreteToSupportsIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  supportsActive: boolean;
}): boolean {
  if (!params.supportsActive) return false;
  return (
    getBooleanFact(
      factRows(params.facts),
      params.workAreaId,
      DECK_CONCRETE_TO_SUPPORTS_FACT_KEY
    ) === true
  );
}

/** Company-specified bags per hole. Absent means the volume takeoff is used. */
export function concreteBagsPerHole(
  facts: readonly EstimateFact[],
  workAreaId: string
): number | null {
  const explicit = getNumberFact(
    factRows(facts),
    workAreaId,
    DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY
  );
  if (explicit != null && explicit > 0) return explicit;
  return null;
}

export function purchasedConcreteBags(
  supportCount: number,
  bagsPerHole: number
): number {
  if (!(supportCount > 0) || !(bagsPerHole > 0)) return 0;
  return Math.ceil(round2(supportCount * bagsPerHole) - 1e-9);
}

export const DECK_CONCRETE_BAGS_COMPONENT_KEY = "deck.concrete.bags";
export const DECK_CONCRETE_PLACE_COMPONENT_KEY = "deck.concrete.place";
export const DECK_STEPS_TREADS_COMPONENT_KEY = "deck.steps.treads";
export const DECK_STEPS_FRAMING_COMPONENT_KEY = "deck.steps.framing";
export const DECK_STEPS_INSTALL_COMPONENT_KEY = "deck.steps.install";

export function formatDeckIdentityLine(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function formatMaterialIdentityDisplay(identity: {
  originalDescription?: string | null;
  section?: string | null;
  grade?: string | null;
  treatment?: string | null;
  processing?: string | null;
} | null | undefined): string | null {
  if (!identity) return null;
  if (identity.originalDescription?.trim()) {
    return identity.originalDescription.trim();
  }
  const composed = [identity.section, identity.grade, identity.treatment, identity.processing]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return composed || null;
}

export function formatPilePurchaseIdentity(params: {
  identityDisplay: string | null;
  supportCount: number;
  purchaseLengthEachM: number | null;
  purchaseLm: number | null;
}): string {
  const qty =
    params.purchaseLengthEachM != null && params.purchaseLm != null
      ? `${params.supportCount} ea · ${params.purchaseLengthEachM.toFixed(2)} m each · ${params.purchaseLm.toFixed(2)} lm purchased`
      : `${params.supportCount} ea`;
  return formatDeckIdentityLine([params.identityDisplay, qty]);
}

export function deckSupportsActive(params: {
  substructureIncluded: boolean;
  supportCount: number | null | undefined;
}): boolean {
  return params.substructureIncluded && (params.supportCount ?? 0) > 0;
}
