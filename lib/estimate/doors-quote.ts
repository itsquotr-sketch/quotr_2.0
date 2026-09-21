/**
 * DOORS-06 — client-safe nested Doors Quote wording.
 *
 * Reads structured `doors.portions`. Does not use legacy allowance labels,
 * rate-source strings, Builder Review diagnostics, or commercial COST.
 * Legacy flat `doors.count` copy stays in quote-description.ts.
 */
import { doorPortionIsInformationComplete } from "@/lib/estimate/doors-clarify";
import { DOORS_CUSTOM_LEAF_COMPONENT } from "@/lib/estimate/doors-identities";
import {
  doorPortionIsUnsupported,
  parseDoorsPortions,
  type DoorPortion,
} from "@/lib/estimate/doors-portions";

export const DOORS_QUOTE_SPECIALIST_PENDING =
  "Specialist door system is excluded pending separate specification and pricing." as const;

export const DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED =
  "Installation of the specified custom door leaf is included." as const;

export const DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED =
  "Supply of the custom door leaf is excluded pending final selection and pricing." as const;

export const DOORS_QUOTE_INCOMPLETE_SIBLING_PENDING =
  "Further door works remain excluded pending confirmation." as const;

export const DOORS_QUOTE_INCOMPLETE_ONLY_PENDING =
  "Door works remain excluded pending confirmation of remaining details." as const;

export const DOORS_QUOTE_SHARED_EXCLUSIONS =
  "Excludes opening formation or alteration, architraves, stopping and removal/disposal unless separately listed." as const;

export const DOORS_QUOTE_FINISHING_OWNERSHIP =
  "Door finishing is excluded from this Doors scope unless separately listed in the quote." as const;

export type DoorsQuoteFact = {
  key: string;
  value: string;
};

export type DoorsQuotePricingItem = {
  label: string;
  component_key?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
};

export function hasNestedDoorsPortionsFact(
  facts?: readonly DoorsQuoteFact[] | null
): boolean {
  return Boolean(facts?.some((row) => row.key === "doors.portions"));
}

export function parseNestedDoorsQuotePortions(
  facts?: readonly DoorsQuoteFact[] | null
): DoorPortion[] {
  const raw = facts?.find((row) => row.key === "doors.portions")?.value;
  if (raw == null || raw === "") return [];
  return parseDoorsPortions(raw);
}

export function doorsPricingItemIsClientPriced(item: {
  component_key?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
}): boolean {
  const component = item.component_key ?? "";
  const isDoors =
    component.startsWith("doors.") || component.startsWith("door.");
  if (!isDoors) return true;
  if (Number(item.total_cost ?? 0) <= 0 && Number(item.total_sell ?? 0) <= 0) {
    return false;
  }
  return true;
}

export function customDoorLeafSupplyIsPriced(
  pricingItems?: readonly DoorsQuotePricingItem[] | null
): boolean {
  return (pricingItems ?? []).some(
    (item) =>
      item.component_key === DOORS_CUSTOM_LEAF_COMPONENT &&
      item.cost_known === true &&
      Number(item.total_cost ?? 0) > 0
  );
}

function locationNoun(label: string | null, quantity: number | null): string | null {
  const raw = label?.trim();
  if (!raw) return null;
  const hadPluralDoors = /doors\s*$/i.test(raw);
  let loc = raw.replace(/\s+doors?\s*$/i, "").trim();
  if (!loc || /^doors?$/i.test(loc)) return null;
  loc = loc.toLowerCase();
  if (hadPluralDoors && quantity != null && quantity !== 1 && !loc.endsWith("s")) {
    loc = `${loc}s`;
  }
  if (/^the\s+/i.test(loc)) return loc;
  return `the ${loc}`;
}

function toLocationClause(label: string | null, quantity: number | null): string {
  const noun = locationNoun(label, quantity);
  return noun ? ` to ${noun}` : "";
}

function leafPhrase(portion: DoorPortion): string {
  if (portion.leaf_construction === "hollow_core") return "hollow-core";
  if (portion.leaf_construction === "solid_core") return "solid-core";
  const custom = portion.other_description?.trim();
  if (custom) return custom;
  return "custom";
}

function dimensionsPhrase(portion: DoorPortion): string | null {
  if (portion.height_mm == null || portion.width_mm == null) return null;
  return `${portion.height_mm} × ${portion.width_mm} mm`;
}

function plural(qty: number, singular: string, pluralForm: string): string {
  return qty === 1 ? singular : pluralForm;
}

function hardwareIncludedSentence(quantity: number): string {
  if (quantity === 1) {
    return "Includes a standard latch/lever hardware allowance and installation.";
  }
  return "Includes a standard latch/lever hardware allowance and installation for each door.";
}

function prefixLabel(label: string | null, sentence: string): string {
  const heading = label?.trim();
  if (!heading) return sentence;
  return `${heading}: ${sentence}`;
}

function ordinaryPrehungSentence(portion: DoorPortion): string {
  const qty = portion.quantity ?? 1;
  const dims = dimensionsPhrase(portion);
  const leaf = leafPhrase(portion);
  const location = toLocationClause(portion.label, qty);
  const product = plural(qty, "prehung internal door set", "prehung internal door sets");
  const qtyDims = dims ? `${qty} × ${dims} ${leaf}` : `${qty} × ${leaf}`;
  let sentence = `Supply and install ${qtyDims} ${product}${location}, including standard timber jambs, stops and hinges.`;
  if (portion.hardware_included === true) {
    sentence += ` ${hardwareIncludedSentence(qty)}`;
  } else if (portion.hardware_included === false) {
    sentence += " Door hardware is excluded.";
  }
  return prefixLabel(portion.label, sentence);
}

function ordinaryReplacementSentence(portion: DoorPortion): string {
  const qty = portion.quantity ?? 1;
  const dims = dimensionsPhrase(portion);
  const leaf = leafPhrase(portion);
  const location = toLocationClause(portion.label, qty);
  const product = plural(
    qty,
    "replacement internal door leaf",
    "replacement internal door leaves"
  );
  const qtyDims = dims ? `${qty} × ${dims} ${leaf}` : `${qty} × ${leaf}`;
  let sentence = `Supply and fit ${qtyDims} ${product}${location} to the existing retained frame/jamb.`;
  if (portion.hardware_included === true) {
    sentence += ` ${hardwareIncludedSentence(qty)}`;
  } else if (portion.hardware_included === false) {
    sentence += " Existing door hardware will be reused.";
  }
  return prefixLabel(portion.label, sentence);
}

function customOrdinarySentence(
  portion: DoorPortion,
  supplyPriced: boolean
): string {
  const qty = portion.quantity ?? 1;
  let sentence = supplyPriced
    ? "Supply and installation of the specified custom door leaf is included."
    : `${DOORS_QUOTE_CUSTOM_INSTALL_INCLUDED} ${DOORS_QUOTE_CUSTOM_SUPPLY_EXCLUDED}`;
  if (portion.installation_type === "replacement_leaf") {
    sentence += " Existing frame/jamb is retained.";
  }
  if (portion.hardware_included === true) {
    sentence += ` ${hardwareIncludedSentence(qty)}`;
  } else if (portion.hardware_included === false) {
    sentence +=
      portion.installation_type === "replacement_leaf"
        ? " Existing door hardware will be reused."
        : " Door hardware is excluded.";
  }
  return prefixLabel(portion.label, sentence);
}

function specialistSentence(portion: DoorPortion): string {
  const location = toLocationClause(portion.label, portion.quantity);
  const sentence = location
    ? `Specialist door system${location} is excluded pending separate specification and pricing.`
    : DOORS_QUOTE_SPECIALIST_PENDING;
  return prefixLabel(portion.label, sentence);
}

export function doorsIncludedQuoteScopeCount(
  facts?: readonly DoorsQuoteFact[] | null
): number {
  return parseNestedDoorsQuotePortions(facts).filter((portion) => {
    if (doorPortionIsUnsupported(portion)) return false;
    if (!doorPortionIsInformationComplete(portion)) return false;
    return (
      portion.installation_type === "prehung_internal" ||
      portion.installation_type === "replacement_leaf"
    );
  }).length;
}

export function buildNestedDoorsQuoteDraft(
  facts?: readonly DoorsQuoteFact[] | null,
  pricingItems?: readonly DoorsQuotePricingItem[] | null
): string {
  const portions = parseNestedDoorsQuotePortions(facts);
  const supplyPriced = customDoorLeafSupplyIsPriced(pricingItems);
  const included: string[] = [];
  let incompleteCount = 0;
  let specialistCount = 0;
  let ordinaryIncluded = 0;

  for (const portion of portions) {
    if (doorPortionIsUnsupported(portion)) {
      specialistCount += 1;
      included.push(specialistSentence(portion));
      continue;
    }
    if (!doorPortionIsInformationComplete(portion)) {
      incompleteCount += 1;
      continue;
    }
    if (
      portion.installation_type !== "prehung_internal" &&
      portion.installation_type !== "replacement_leaf"
    ) {
      incompleteCount += 1;
      continue;
    }
    ordinaryIncluded += 1;
    if (portion.leaf_construction === "other") {
      included.push(customOrdinarySentence(portion, supplyPriced));
      continue;
    }
    if (portion.installation_type === "prehung_internal") {
      included.push(ordinaryPrehungSentence(portion));
      continue;
    }
    included.push(ordinaryReplacementSentence(portion));
  }

  if (incompleteCount > 0) {
    if (ordinaryIncluded > 0 || specialistCount > 0) {
      included.push(DOORS_QUOTE_INCOMPLETE_SIBLING_PENDING);
    } else {
      included.push(DOORS_QUOTE_INCOMPLETE_ONLY_PENDING);
    }
  }

  if (included.length === 0) {
    included.push(DOORS_QUOTE_INCOMPLETE_ONLY_PENDING);
  }

  let draft = included.join(" ");
  if (ordinaryIncluded > 0) {
    draft = `${draft} ${DOORS_QUOTE_SHARED_EXCLUSIONS} ${DOORS_QUOTE_FINISHING_OWNERSHIP}`;
  }
  return draft.replace(/\s+/g, " ").trim();
}
