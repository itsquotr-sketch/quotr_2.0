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

export const DECK_CONCRETE_BAGS_PER_HOLE_DEFAULT = 2.5;
export const DECK_CONCRETE_BAG_KG = 20;
export const DECK_CONCRETE_MATERIAL_ITEM_KEY = "deck.concrete.premix.20kg.bag";
export const DECK_CONCRETE_PRODUCTIVITY_KEY =
  "deck.concrete.place.hours_per_hole";
export const DECK_CONCRETE_PRODUCTIVITY_CLASS = "NEEDS_OWNER_BENCHMARK" as const;

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
  const newLayout = substructure ?? true;
  if (newLayout) return false;

  const explicit = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.pile_or_post_replacement_required"
  );
  if (explicit === true) return true;

  const removal = getBooleanFact(
    facts,
    params.workAreaId,
    "deck.existing_deck_removal"
  );
  if (removal === true) return false;

  return true;
}

export function shouldAskPileReplacement(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  if (!pileReplacementApplicable(params)) return false;
  const known = getBooleanFact(
    factRows(params.facts),
    params.workAreaId,
    "deck.pile_or_post_replacement_required"
  );
  return known == null;
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

export function concreteBagsPerHole(
  facts: readonly EstimateFact[],
  workAreaId: string
): number {
  const explicit = getNumberFact(
    factRows(facts),
    workAreaId,
    DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY
  );
  if (explicit != null && explicit > 0) return explicit;
  return DECK_CONCRETE_BAGS_PER_HOLE_DEFAULT;
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
