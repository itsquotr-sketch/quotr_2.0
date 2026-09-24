/**
 * CLADDING-06 — client-safe nested Cladding Quote wording.
 *
 * Reads canonical cladding.portions and the authoritative Pricing result.
 * Does not rebuild quantities, COST, hours, margin or GST.
 */
import {
  CLADDING_PHYSICAL_COMPLETENESS,
  calculateCladdingPhysical,
  presentCladdingMeasure,
} from "@/lib/estimate/cladding-physical";
import {
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
} from "@/lib/estimate/cladding-identities";
import {
  CLADDING_PORTIONS_FACT_KEY,
  parseCladdingPortions,
  type CladdingPortion,
} from "@/lib/estimate/cladding-portions";
import type { CladdingPortionPhysical } from "@/lib/estimate/cladding-physical";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import type { EstimateFact } from "@/lib/estimate/types";

export const CLADDING_QUOTE_REMOVAL_EXCLUSIONS =
  "Removal excludes disposal, cartage, hazardous-material work, structural remediation and substrate repairs unless separately listed." as const;

export const CLADDING_QUOTE_OPENINGS =
  "Cladding quantities are based on the entered wall area less the confirmed openings." as const;

export const CLADDING_QUOTE_PAINTING =
  "Painting and protective coating systems are excluded from this Cladding scope unless separately listed in the quote." as const;

export const CLADDING_QUOTE_SCAFFOLD =
  "Scaffolding and specialist access equipment are excluded unless separately listed." as const;

export const CLADDING_QUOTE_SHARED_EXCLUSIONS =
  "Excludes scaffolding and specialist access equipment, building-wrap or rigid-air-barrier replacement, drained-cavity construction, trims, corners, flashings, painting, disposal, hazardous-material work, structural repairs and substrate remediation unless separately listed." as const;

export const CLADDING_QUOTE_CUSTOM_PENDING =
  "Custom cladding supply and installation are excluded pending final specification and pricing." as const;

export const CLADDING_QUOTE_SPECIALIST_PENDING =
  "Specialist cladding works are excluded pending separate specification and pricing." as const;

export const CLADDING_QUOTE_INCOMPLETE_SIBLING =
  "Further cladding work remains excluded pending confirmation of the remaining details." as const;

export const CLADDING_QUOTE_INCOMPLETE_ONLY =
  "Cladding work remains excluded pending confirmation of the required system, area and installation details." as const;

export const CLADDING_QUOTE_TRIMS_PENDING =
  "Cladding trims, corners and flashings remain excluded pending detailed selection and measurement." as const;

export const CLADDING_MANUAL_PRICING_COMPONENT_KEYS = [
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_SPECIALIST_CUSTOM,
] as const;

export type CladdingQuoteFact = {
  key: string;
  value: string;
};

export type CladdingQuotePricingItem = {
  label: string;
  component_key?: string | null;
  nested_item_id?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
  notes_internal?: string | null;
};

export function hasNestedCladdingPortionsFact(
  facts?: readonly CladdingQuoteFact[] | null
): boolean {
  return Boolean(facts?.some((row) => row.key === CLADDING_PORTIONS_FACT_KEY));
}

export function claddingPricingItemIsClientPriced(item: {
  component_key?: string | null;
  cost_known?: boolean;
  total_cost?: number;
  total_sell?: number;
}): boolean {
  const component = item.component_key ?? "";
  if (!component.startsWith("cladding.")) return true;
  if (Number(item.total_cost ?? 0) <= 0 && Number(item.total_sell ?? 0) <= 0) {
    return false;
  }
  return true;
}

export function claddingLineIsManualPricingEligible(item: {
  componentKey?: string | null;
  rateSourceType?: string | null;
  quantity?: number | null;
  recommendedCost?: number | null;
}): boolean {
  const key = item.componentKey ?? "";
  if (key === CLADDING_TRIMS_UNRESOLVED) return false;
  if (item.rateSourceType !== "missing") return false;
  if (item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (item.recommendedCost != null && item.recommendedCost > 0) return false;
  return (CLADDING_MANUAL_PRICING_COMPONENT_KEYS as readonly string[]).includes(key);
}

function nestedIdOf(item: CladdingQuotePricingItem): string | null {
  if (item.nested_item_id?.trim()) return item.nested_item_id.trim();
  const meta = parseLineItemNotes(item.notes_internal).metadata;
  if (meta.nestedItemId?.trim()) return meta.nestedItemId.trim();
  const fromScope = meta.scopeKey?.split(":")[2];
  return fromScope || null;
}

function itemIsPriced(item: CladdingQuotePricingItem): boolean {
  if (item.cost_known === false) return false;
  return Number(item.total_cost ?? 0) > 0;
}

function componentPriced(
  portionId: string,
  items: readonly CladdingQuotePricingItem[] | null | undefined,
  componentKey: string
): boolean {
  return (items ?? []).some(
    (item) =>
      nestedIdOf(item) === portionId &&
      item.component_key === componentKey &&
      itemIsPriced(item)
  );
}

function anyPriced(
  items: readonly CladdingQuotePricingItem[] | null | undefined,
  predicate: (item: CladdingQuotePricingItem) => boolean
): boolean {
  return (items ?? []).some((item) => itemIsPriced(item) && predicate(item));
}

function prefix(label: string | null, body: string): string {
  const heading = label?.trim();
  if (!heading) return body;
  return `${heading}: ${body}`;
}

function areaText(net: number): string {
  return `${presentCladdingMeasure(net)} m²`;
}

function sizePair(width: number | null, thickness: number | null): string | null {
  if (width == null) return null;
  if (thickness == null) return `${width} mm`;
  return `${width} × ${thickness} mm`;
}

function ordinarySentence(portion: CladdingPortion, net: number): string | null {
  const area = areaText(net);
  const system = portion.cladding_system;
  const orientation = portion.orientation === "vertical" ? "vertical" : "horizontal";
  if (system === "timber_bevelback") {
    const size = sizePair(portion.nominal_width_mm, portion.nominal_thickness_mm);
    if (!size) return null;
    return `Supply and install ${area} of ${orientation} timber bevelback cladding using ${size} weatherboards.`;
  }
  if (system === "timber_rusticated") {
    const size = sizePair(portion.nominal_width_mm, portion.nominal_thickness_mm);
    if (!size) return null;
    return `Supply and install ${area} of ${orientation} timber rusticated cladding using ${size} weatherboards.`;
  }
  if (system === "timber_vertical_shiplap") {
    const size = sizePair(portion.nominal_width_mm, portion.nominal_thickness_mm);
    if (!size) return null;
    return `Supply and install ${area} of vertical timber shiplap cladding using ${size} boards.`;
  }
  if (
    system === "fibre_cement_horizontal_weatherboard" ||
    portion.cladding_family === "fibre_cement"
  ) {
    const width = portion.nominal_width_mm;
    if (width == null) return null;
    return `Supply and install ${area} of horizontal ${width} mm fibre-cement weatherboard cladding.`;
  }
  if (system === "timber_sheet_board_and_batten") {
    const batten = sizePair(portion.batten_width_mm, portion.batten_thickness_mm);
    if (!batten) return null;
    return `Supply and install ${area} of timber board-and-batten cladding, comprising sheet-board cladding and ${batten} vertical battens.`;
  }
  return null;
}

function removalType(portion: CladdingPortion): string {
  if (portion.cladding_system === "timber_bevelback") return "timber bevelback";
  if (portion.cladding_system === "timber_rusticated") return "timber rusticated";
  if (portion.cladding_system === "timber_vertical_shiplap") return "timber shiplap";
  if (portion.cladding_family === "fibre_cement") return "fibre-cement weatherboard";
  if (portion.cladding_system === "timber_sheet_board_and_batten") return "board-and-batten";
  return "";
}

function accessorySentences(
  portion: CladdingPortion,
  items: readonly CladdingQuotePricingItem[] | null | undefined
): string[] {
  const lines: string[] = [];
  if (portion.cavity_included === true) {
    lines.push(
      componentPriced(portion.id, items, CLADDING_CAVITY_UNRESOLVED_M2)
        ? "Includes a drained cavity system to the selected cladding area."
        : "A drained cavity is excluded pending confirmation and pricing."
    );
  }
  if (portion.wall_underlay_or_rab_included === true) {
    lines.push(
      componentPriced(portion.id, items, CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2)
        ? "Includes the specified wall-underlay or rigid-air-barrier system."
        : "Wall underlay or a rigid air barrier is excluded pending selection and pricing."
    );
  }
  if (portion.trims_flashings_corners_included === true) {
    lines.push(
      componentPriced(portion.id, items, CLADDING_TRIMS_UNRESOLVED)
        ? "Includes cladding trims, corners and flashings."
        : CLADDING_QUOTE_TRIMS_PENDING
    );
  }
  return lines;
}

function isCustom(portion: CladdingPortion, physical: CladdingPortionPhysical): boolean {
  return (
    portion.specialist_kind === "custom_profile" ||
    physical.components.some((row) =>
      row.componentKey === CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM ||
      row.componentKey === CLADDING_CUSTOM_INSTALL_HOURS_PER_LM ||
      row.componentKey === CLADDING_CUSTOM_REMOVE_HOURS_PER_M2
    )
  );
}

function customSentence(
  portion: CladdingPortion,
  physical: CladdingPortionPhysical,
  items: readonly CladdingQuotePricingItem[] | null | undefined
): string {
  const material = componentPriced(
    portion.id,
    items,
    CLADDING_CUSTOM_WEATHERBOARD_INFORMATIONAL_LM
  );
  const install = componentPriced(portion.id, items, CLADDING_CUSTOM_INSTALL_HOURS_PER_LM);
  const description = portion.other_description?.trim();
  const area = physical.netAreaM2 != null ? areaText(physical.netAreaM2) : null;
  if (material && install) {
    const named = description ? ` of ${description}` : "";
    const sized = area ? ` ${area}` : "";
    return `Supply and install${sized}${named}.`;
  }
  if (material && !install) {
    const named = description ? ` ${description}` : " the specified custom cladding";
    const sized = area ? ` for ${area}` : "";
    return `Supply of${named}${sized} is included. Custom cladding installation is excluded pending final specification and pricing.`;
  }
  if (!material && install) {
    return "Installation of the specified owner-selected cladding is included. Custom cladding material supply is excluded pending selection and pricing.";
  }
  return CLADDING_QUOTE_CUSTOM_PENDING;
}

function specialistSentence(
  portion: CladdingPortion,
  physical: CladdingPortionPhysical,
  items: readonly CladdingQuotePricingItem[] | null | undefined
): string {
  const key =
    physical.components.find((row) =>
      row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER ||
      row.componentKey === CLADDING_SPECIALIST_MASONRY ||
      row.componentKey === CLADDING_SPECIALIST_CUSTOM
    )?.componentKey ?? CLADDING_SPECIALIST_CUSTOM;
  if (!componentPriced(portion.id, items, key)) return CLADDING_QUOTE_SPECIALIST_PENDING;
  const description = portion.other_description?.trim() || "the specified specialist cladding";
  const area = physical.netAreaM2 != null ? `${areaText(physical.netAreaM2)} of ` : "";
  return `Supply and install ${area}${description}.`;
}

function sharedExclusions(
  items: readonly CladdingQuotePricingItem[] | null | undefined
): string {
  const cavity = anyPriced(items, (item) => item.component_key === CLADDING_CAVITY_UNRESOLVED_M2);
  const underlay = anyPriced(
    items,
    (item) => item.component_key === CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2
  );
  const trims = anyPriced(items, (item) => item.component_key === CLADDING_TRIMS_UNRESOLVED);
  const scaffold = anyPriced(
    items,
    (item) => /scaffold/i.test(item.component_key ?? "") || /scaffold/i.test(item.label)
  );
  if (!cavity && !underlay && !trims && !scaffold) return CLADDING_QUOTE_SHARED_EXCLUSIONS;
  const parts = [
    scaffold ? null : "scaffolding and specialist access equipment",
    underlay ? null : "building-wrap or rigid-air-barrier replacement",
    cavity ? null : "drained-cavity construction",
    trims ? null : "trims, corners, flashings",
    "painting, disposal, hazardous-material work, structural repairs and substrate remediation",
  ].filter((part): part is string => Boolean(part));
  return `Excludes ${parts.join(", ")} unless separately listed.`;
}

export function buildNestedCladdingQuoteDraft(
  facts?: readonly CladdingQuoteFact[] | null,
  pricingItems?: readonly CladdingQuotePricingItem[] | null
): string {
  const raw = facts?.find((row) => row.key === CLADDING_PORTIONS_FACT_KEY)?.value;
  if (raw == null || raw === "") return "";
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return "";
    }
  }
  const stored = parseCladdingPortions(parsed);
  if (stored.length === 0) return "";
  const physical = calculateCladdingPhysical({
    facts: [
      {
        key: CLADDING_PORTIONS_FACT_KEY,
        work_area_id: "quote",
        value: stored,
        source: "user",
      } as EstimateFact,
    ],
    workArea: { id: "quote", type: "cladding" },
  });
  const byId = new Map(physical.portions.map((row) => [row.nestedItemId, row]));
  const sections: string[] = [];
  let incomplete = 0;
  let ordinaryIncluded = 0;
  let removalClaimed = false;

  for (const portion of stored) {
    const built = byId.get(portion.id);
    if (!built || built.completeness === CLADDING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED) {
      incomplete += 1;
      continue;
    }
    if (built.netAreaM2 == null) {
      incomplete += 1;
      continue;
    }
    const custom = isCustom(portion, built);
    const specialist =
      !custom &&
      (built.completeness === CLADDING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST ||
        portion.cladding_family === "brick_veneer" ||
        portion.cladding_family === "masonry");
    if (custom) {
      sections.push(prefix(portion.label, customSentence(portion, built, pricingItems)));
      continue;
    }
    if (specialist) {
      sections.push(prefix(portion.label, specialistSentence(portion, built, pricingItems)));
      continue;
    }

    const materialPriced = built.components.some(
      (row) =>
        row.materialKey != null &&
        componentPriced(portion.id, pricingItems, row.componentKey)
    );
    const installPriced = built.components.some(
      (row) =>
        row.componentKey.includes(".install.") &&
        componentPriced(portion.id, pricingItems, row.componentKey)
    );
    const removalPriced = built.components.some(
      (row) =>
        row.componentKey.includes(".remove.") &&
        componentPriced(portion.id, pricingItems, row.componentKey)
    );
    const body: string[] = [];
    if (portion.scope_intent === "removal_only") {
      if (!removalPriced) {
        incomplete += 1;
        continue;
      }
      const type = removalType(portion);
      body.push(
        `Remove the existing ${type ? `${type} ` : ""}cladding from the selected area.`
      );
      removalClaimed = true;
    } else if (materialPriced && installPriced) {
      const sentence = ordinarySentence(portion, built.netAreaM2);
      if (!sentence) {
        incomplete += 1;
        continue;
      }
      body.push(
        removalPriced ? sentence.replace("Supply and install", "Remove the existing cladding and supply and install") : sentence
      );
      if (portion.existing_cladding_removal_required === true && !removalPriced) {
        body.push("Existing-cladding removal is excluded pending confirmation and pricing.");
      }
      if (removalPriced) removalClaimed = true;
      ordinaryIncluded += 1;
    } else if (materialPriced) {
      const sentence = ordinarySentence(portion, built.netAreaM2);
      if (!sentence) {
        incomplete += 1;
        continue;
      }
      body.push(sentence.replace("Supply and install", "Supply"));
      body.push("Installation is excluded pending confirmation and pricing.");
      ordinaryIncluded += 1;
    } else {
      incomplete += 1;
      continue;
    }
    if (
      portion.openings_already_deducted === false &&
      built.grossAreaM2 != null &&
      built.netAreaM2 < built.grossAreaM2
    ) {
      body.push(CLADDING_QUOTE_OPENINGS);
    }
    body.push(...accessorySentences(portion, pricingItems));
    sections.push(prefix(portion.label, body.join(" ")));
  }

  if (incomplete > 0) {
    sections.push(
      ordinaryIncluded > 0 || sections.length > 0
        ? CLADDING_QUOTE_INCOMPLETE_SIBLING
        : CLADDING_QUOTE_INCOMPLETE_ONLY
    );
  }
  if (sections.length === 0) return CLADDING_QUOTE_INCOMPLETE_ONLY;

  const tail: string[] = [];
  if (removalClaimed) tail.push(CLADDING_QUOTE_REMOVAL_EXCLUSIONS);
  if (ordinaryIncluded > 0 || removalClaimed) {
    tail.push(CLADDING_QUOTE_PAINTING);
    const scaffoldPriced = anyPriced(
      pricingItems,
      (item) => /scaffold/i.test(item.component_key ?? "") || /scaffold/i.test(item.label)
    );
    if (!scaffoldPriced) tail.push(CLADDING_QUOTE_SCAFFOLD);
    tail.push(sharedExclusions(pricingItems));
  }
  return [...sections, ...tail].join(" ").replace(/\s+/g, " ").trim();
}
