/**
 * FLOORING-06 — client-safe nested Flooring Quote wording.
 *
 * Reads canonical `flooring.portions` plus the authoritative Pricing result.
 * Does not rebuild quantities, COST, hours, or rate authority.
 * Legacy flat Flooring copy stays in quote-description.ts.
 */
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "@/lib/estimate/bathroom-identities";
import { flooringPortionIsInformationComplete } from "@/lib/estimate/flooring-clarify";
import {
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_LABOUR,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_REMOVE_LABOUR,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_LABOUR,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "@/lib/estimate/flooring-identities";
import { flooringPortionIsSpecialist } from "@/lib/estimate/flooring-information-contract";
import { physicalNetAreaM2 } from "@/lib/estimate/flooring-physical";
import {
  FLOORING_PORTIONS_FACT_KEY,
  parseFlooringPortions,
  type FlooringPortion,
} from "@/lib/estimate/flooring-portions";
import { FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY } from "@/lib/estimate/flooring-question-copy";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { round2 } from "@/lib/estimate/facts";

export const FLOORING_QUOTE_SPECIALIST_PENDING =
  "Specialist flooring works are excluded pending separate specification and pricing." as const;

export const FLOORING_QUOTE_SPECIALIST_INCLUDED =
  "subject to the selected product specification." as const;

export const FLOORING_QUOTE_CUSTOM_FINISH_EXCLUDED =
  "The specified custom flooring finish is excluded pending final selection and pricing." as const;

export const FLOORING_QUOTE_CUSTOM_FINISH_INCLUDED =
  "Supply and installation of the specified custom flooring is included." as const;

export const FLOORING_QUOTE_INCOMPLETE_SIBLING_PENDING =
  "Further flooring works remain excluded pending confirmation." as const;

export const FLOORING_QUOTE_INCOMPLETE_ONLY_PENDING =
  "Flooring works remain excluded pending confirmation of the remaining details." as const;

export const FLOORING_QUOTE_SHARED_EXCLUSIONS =
  "Excludes furniture removal, skirtings and trims, painting, waterproofing, moisture remediation, structural work, hazardous-material work and disposal unless separately listed." as const;

export const FLOORING_QUOTE_REMOVAL_EXCLUSIONS =
  "Removal excludes disposal, hazardous materials and structural remediation unless separately listed." as const;

export const FLOORING_QUOTE_FRAMING_EXCLUSIONS =
  "This framing allowance excludes structural engineering, structural design, consent work, beam or major joist replacement, foundations, major decay remediation, work beyond the selected allowance, and hidden conditions that cannot reasonably be determined from the brief." as const;

export const FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED =
  "Structural or specialist framing is excluded pending separate assessment and pricing." as const;

export const FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING =
  "Substrate material selection and pricing remain excluded pending confirmation." as const;

export const FLOORING_QUOTE_PLYWOOD_INCLUDED =
  "Includes installation of new 19 mm H3.2 plywood flooring substrate to the selected area." as const;

export type FlooringQuoteFact = {
  key: string;
  value: string;
};

export type FlooringQuotePricingItem = {
  label: string;
  component_key?: string | null;
  nested_item_id?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
  notes_internal?: string | null;
};

export function hasNestedFlooringPortionsFact(
  facts?: readonly FlooringQuoteFact[] | null
): boolean {
  return Boolean(facts?.some((row) => row.key === FLOORING_PORTIONS_FACT_KEY));
}

export function parseNestedFlooringQuotePortions(
  facts?: readonly FlooringQuoteFact[] | null
): FlooringPortion[] {
  const raw = facts?.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value;
  if (raw == null || raw === "") return [];
  return parseFlooringPortions(raw);
}

export function flooringPricingItemIsClientPriced(item: {
  component_key?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
}): boolean {
  const component = item.component_key ?? "";
  if (!component.startsWith("flooring.")) return true;
  if (Number(item.total_cost ?? 0) <= 0 && Number(item.total_sell ?? 0) <= 0) {
    return false;
  }
  return true;
}

function nestedIdOf(item: FlooringQuotePricingItem): string | null {
  if (item.nested_item_id?.trim()) return item.nested_item_id.trim();
  const meta = parseLineItemNotes(item.notes_internal).metadata;
  if (meta.nestedItemId?.trim()) return meta.nestedItemId.trim();
  const fromScope = meta.scopeKey?.split(":")[2];
  if (fromScope) return fromScope;
  const overlap = meta.overlapGroup ?? "";
  const prefix = "flooring.area:";
  if (overlap.startsWith(prefix)) return overlap.slice(prefix.length) || null;
  return null;
}

function itemIsAuthorised(item: FlooringQuotePricingItem): boolean {
  if (item.cost_known === false) return false;
  return Number(item.total_cost ?? 0) > 0;
}

function portionItems(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): FlooringQuotePricingItem[] {
  return (pricingItems ?? []).filter((item) => {
    const nested = nestedIdOf(item);
    if (nested) return nested === portion.id;
    return false;
  });
}

function componentIsPriced(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined,
  componentKey: string
): boolean {
  return portionItems(portion, pricingItems).some(
    (item) => item.component_key === componentKey && itemIsAuthorised(item)
  );
}

function anyComponentPriced(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined,
  keys: readonly string[]
): boolean {
  return keys.some((key) => componentIsPriced(portion, pricingItems, key));
}

export function formatFlooringQuoteAreaM2(areaM2: number): string {
  const rounded = round2(areaM2);
  return Number.isInteger(rounded) ? `${rounded} m²` : `${rounded} m²`;
}

function prefixLabel(label: string | null, sentence: string): string {
  const heading = label?.trim();
  if (!heading) return sentence;
  return `${heading}: ${sentence}`;
}

function areaPhrase(portion: FlooringPortion): string | null {
  const area = physicalNetAreaM2(portion);
  if (area == null) return null;
  return formatFlooringQuoteAreaM2(area);
}

function ordinaryFinishSentence(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): string | null {
  const area = areaPhrase(portion);
  if (!area) return null;
  const finish = portion.finish_type;
  if (finish === "carpet") {
    const packagePriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_CARPET_SUPPLY_INSTALL_M2
    );
    if (!packagePriced) return null;
    const underlayPriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2
    );
    if (portion.underlay_required === true && underlayPriced) {
      return `Supply and install ${area} of carpet flooring, including new underlay.`;
    }
    if (portion.underlay_required === false) {
      return `Supply and install ${area} of carpet flooring. New underlay is excluded.`;
    }
    return `Supply and install ${area} of carpet flooring.`;
  }
  if (finish === "vinyl_plank") {
    const packagePriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2
    );
    if (!packagePriced) return null;
    const prepPriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
    );
    if (portion.floor_preparation_required === true && prepPriced) {
      return `Supply and install ${area} of vinyl plank/LVT flooring, including an ordinary floor-preparation allowance.`;
    }
    if (portion.floor_preparation_required === false) {
      return `Supply and install ${area} of vinyl plank/LVT flooring. Floor preparation is excluded.`;
    }
    return `Supply and install ${area} of vinyl plank/LVT flooring.`;
  }
  if (finish === "tile") {
    const packagePriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_TILE_SUPPLY_INSTALL_M2
    );
    if (!packagePriced) return null;
    const width = portion.tile_width_mm;
    const length = portion.tile_length_mm;
    const size =
      width != null && length != null ? ` using ${width} × ${length} mm tiles` : "";
    const prepPriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
    );
    if (portion.floor_preparation_required === true && prepPriced) {
      return `Supply and install ${area} of tiled flooring${size}, including an ordinary floor-preparation allowance.`;
    }
    if (portion.floor_preparation_required === false) {
      return `Supply and install ${area} of tiled flooring${size}. Floor preparation is excluded.`;
    }
    return `Supply and install ${area} of tiled flooring${size}.`;
  }
  if (finish === "hardwood") {
    const packagePriced = componentIsPriced(
      portion,
      pricingItems,
      FLOORING_HARDWOOD_SUPPLY_INSTALL_M2
    );
    if (!packagePriced) return null;
    const width = portion.hardwood_board_width_mm;
    const boards =
      width != null
        ? ` using approximately ${width} mm wide boards`
        : "";
    return `Supply and install ${area} of hardwood/timber flooring${boards}.`;
  }
  return null;
}

function customFinishSentence(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): string {
  const priced = componentIsPriced(
    portion,
    pricingItems,
    FLOORING_CUSTOM_FINISH_COMPONENT
  );
  if (priced) {
    const desc = portion.other_description?.trim();
    return desc
      ? `${FLOORING_QUOTE_CUSTOM_FINISH_INCLUDED} ${desc}.`
      : FLOORING_QUOTE_CUSTOM_FINISH_INCLUDED;
  }
  return FLOORING_QUOTE_CUSTOM_FINISH_EXCLUDED;
}

function substrateSentence(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): string | null {
  if (portion.substrate_required !== true) return null;
  const materialPriced = componentIsPriced(
    portion,
    pricingItems,
    FLOORING_SUBSTRATE_MATERIAL_COMPONENT
  );
  const labourPriced = componentIsPriced(
    portion,
    pricingItems,
    FLOORING_SUBSTRATE_INSTALL_LABOUR
  );
  if (materialPriced) {
    if (portion.substrate_item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) {
      return FLOORING_QUOTE_PLYWOOD_INCLUDED;
    }
    const product =
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[portion.substrate_item_key ?? ""] ??
      portion.substrate_item_key;
    if (!product) return null;
    return `Includes installation of new ${product} to the selected area.`;
  }
  if (labourPriced) {
    return FLOORING_QUOTE_SUBSTRATE_MATERIAL_PENDING;
  }
  return null;
}

function framingSentence(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): string | null {
  if (portion.framing_required !== true) return null;
  if (portion.specialist_kind === "structural") {
    return FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED;
  }
  if (
    componentIsPriced(
      portion,
      pricingItems,
      FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2
    )
  ) {
    return "Includes an allowance for minor local packing, blocking and below-substrate framing adjustments.";
  }
  if (
    componentIsPriced(
      portion,
      pricingItems,
      FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2
    )
  ) {
    return "Includes an allowance for standard below-substrate framing remediation across the selected area.";
  }
  if (
    componentIsPriced(
      portion,
      pricingItems,
      FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2
    )
  ) {
    return "Includes a major non-engineered below-substrate framing remediation allowance.";
  }
  if (portion.framing_allowance_level == null) {
    return FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED;
  }
  return null;
}

function removalSentences(
  portion: FlooringPortion,
  pricingItems: readonly FlooringQuotePricingItem[] | null | undefined
): string[] {
  const sentences: string[] = [];
  if (
    componentIsPriced(portion, pricingItems, FLOORING_CARPET_REMOVE_LABOUR)
  ) {
    sentences.push("Includes removal of the existing carpet flooring.");
  }
  if (
    componentIsPriced(portion, pricingItems, FLOORING_VINYL_PLANK_REMOVE_LABOUR)
  ) {
    sentences.push("Includes removal of the existing vinyl flooring.");
  }
  if (componentIsPriced(portion, pricingItems, FLOORING_TILE_REMOVE_LABOUR)) {
    sentences.push("Includes removal of the existing tiled flooring.");
  }
  if (
    componentIsPriced(portion, pricingItems, FLOORING_HARDWOOD_REMOVE_LABOUR)
  ) {
    sentences.push("Includes removal of the existing hardwood/timber flooring.");
  }
  if (
    componentIsPriced(portion, pricingItems, FLOORING_SUBSTRATE_REMOVE_LABOUR)
  ) {
    sentences.push("Includes removal of the existing floor substrate.");
  }
  return sentences;
}

function specialistSentence(portion: FlooringPortion): string {
  if (portion.specialist_kind === "structural") {
    return prefixLabel(
      portion.label,
      `${FLOORING_QUOTE_SPECIALIST_PENDING} ${FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED}`
    );
  }
  return prefixLabel(portion.label, FLOORING_QUOTE_SPECIALIST_PENDING);
}

function specialistIncludedSentence(portion: FlooringPortion): string {
  const area = areaPhrase(portion);
  const kind =
    portion.specialist_kind === "laminate"
      ? "laminate flooring"
      : portion.specialist_kind === "engineered_timber"
        ? "engineered timber flooring"
        : portion.specialist_kind === "sheet_vinyl"
          ? "sheet vinyl flooring"
          : portion.other_description?.trim() || "specialist flooring";
  const body =
    area != null
      ? `Supply and install ${area} of the specified ${kind}, ${FLOORING_QUOTE_SPECIALIST_INCLUDED}`
      : `Supply and install the specified ${kind}, ${FLOORING_QUOTE_SPECIALIST_INCLUDED}`;
  return prefixLabel(portion.label, body);
}

export function flooringIncludedQuoteScopeCount(
  facts?: readonly FlooringQuoteFact[] | null,
  pricingItems?: readonly FlooringQuotePricingItem[] | null
): number {
  return parseNestedFlooringQuotePortions(facts).filter((portion) => {
    if (flooringPortionIsSpecialist(portion)) return false;
    if (!flooringPortionIsInformationComplete(portion)) return false;
    if (portion.finish_type === "other") {
      return componentIsPriced(
        portion,
        pricingItems,
        FLOORING_CUSTOM_FINISH_COMPONENT
      );
    }
    return anyComponentPriced(portion, pricingItems, [
      FLOORING_CARPET_SUPPLY_INSTALL_M2,
      FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
      FLOORING_TILE_SUPPLY_INSTALL_M2,
      FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
    ]);
  }).length;
}

export function buildNestedFlooringQuoteDraft(
  facts?: readonly FlooringQuoteFact[] | null,
  pricingItems?: readonly FlooringQuotePricingItem[] | null
): string {
  const portions = parseNestedFlooringQuotePortions(facts);
  const included: string[] = [];
  let incompleteCount = 0;
  let specialistCount = 0;
  let ordinaryIncluded = 0;
  let framingIncluded = false;
  let removalIncluded = false;

  for (const portion of portions) {
    if (flooringPortionIsSpecialist(portion)) {
      const priced = componentIsPriced(
        portion,
        pricingItems,
        FLOORING_SPECIALIST_COMPONENT
      );
      if (priced) {
        ordinaryIncluded += 1;
        included.push(specialistIncludedSentence(portion));
      } else {
        specialistCount += 1;
        included.push(specialistSentence(portion));
      }
      continue;
    }
    if (!flooringPortionIsInformationComplete(portion)) {
      incompleteCount += 1;
      continue;
    }

    const clauses: string[] = [];
    if (portion.finish_type === "other") {
      clauses.push(customFinishSentence(portion, pricingItems));
    } else {
      const finish = ordinaryFinishSentence(portion, pricingItems);
      if (finish) clauses.push(finish);
    }
    const substrate = substrateSentence(portion, pricingItems);
    if (substrate) clauses.push(substrate);
    const framing = framingSentence(portion, pricingItems);
    if (framing) {
      clauses.push(framing);
      if (framing !== FLOORING_QUOTE_STRUCTURAL_FRAMING_EXCLUDED) {
        framingIncluded = true;
      }
    }
    const removals = removalSentences(portion, pricingItems);
    if (removals.length > 0) {
      clauses.push(...removals);
      removalIncluded = true;
    }

    if (clauses.length === 0) {
      incompleteCount += 1;
      continue;
    }
    ordinaryIncluded += 1;
    const body = clauses.join(" ");
    included.push(prefixLabel(portion.label, body));
  }

  if (incompleteCount > 0) {
    if (ordinaryIncluded > 0 || specialistCount > 0) {
      included.push(FLOORING_QUOTE_INCOMPLETE_SIBLING_PENDING);
    } else {
      included.push(FLOORING_QUOTE_INCOMPLETE_ONLY_PENDING);
    }
  }

  if (included.length === 0) {
    included.push(FLOORING_QUOTE_INCOMPLETE_ONLY_PENDING);
  }

  let draft = included.join(" ");
  if (framingIncluded) {
    draft = `${draft} ${FLOORING_QUOTE_FRAMING_EXCLUSIONS}`;
  }
  if (removalIncluded) {
    draft = `${draft} ${FLOORING_QUOTE_REMOVAL_EXCLUSIONS}`;
  }
  if (ordinaryIncluded > 0) {
    draft = `${draft} ${FLOORING_QUOTE_SHARED_EXCLUSIONS}`;
  }
  return draft.replace(/\s+/g, " ").trim();
}

export function flooringQuoteLeaksInternal(text: string): boolean {
  return (
    /FITOUT/i.test(text) ||
    /UNSUPPORTED_SPECIALIST/.test(text) ||
    /Pricing Required/i.test(text) ||
    /flooring\.[a-z0-9_.]+/.test(text) ||
    /labour\.carpenter/.test(text) ||
    /scope\.flooring/.test(text) ||
    /person-hours/i.test(text) ||
    /Quotr benchmark/i.test(text) ||
    /overlapGroup/.test(text) ||
    /\$\s*120/.test(text) ||
    /0\.8 h/.test(text)
  );
}
