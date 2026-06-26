import { round2 } from "@/lib/estimate/facts";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type PricingOwner =
  | "in_house_labour"
  | "contractor_material"
  | "subcontractor_allowance"
  | "client_supplied"
  | "excluded"
  | "internal_build_up";

export type PricingSource = "calculator" | "benchmark" | "company_rate" | "user_override";

export type PricingOwnershipMetadata = {
  pricingOwner: PricingOwner;
  scopeKey?: string;
  overlapGroup?: string;
  includedInTotal: boolean;
  clientVisible: boolean;
  pricingSource: PricingSource;
};

export type EstimateLineItemWithOwnership = EstimateLineItemInput &
  Partial<PricingOwnershipMetadata>;

export const PRICING_OWNER_LABELS: Record<PricingOwner, string> = {
  in_house_labour: "Labour",
  contractor_material: "Material",
  subcontractor_allowance: "Subcontractor allowance",
  client_supplied: "Client supplied",
  excluded: "Excluded",
  internal_build_up: "Internal build-up",
};

const BROAD_LABOUR_LABELS = new Set([
  "bathroom labour",
  "kitchen labour",
]);

const DISPOSAL_LABEL_PATTERNS = [
  /disposal/i,
  /cartage/i,
  /carting/i,
  /skip/i,
  /waste removal/i,
];

export function defaultPricingSource(
  rateSource?: string | null
): PricingSource {
  if (!rateSource) return "calculator";
  const lower = rateSource.toLowerCase();
  if (lower.includes("benchmark")) return "benchmark";
  if (lower.includes("company") || lower.includes("your rate")) {
    return "company_rate";
  }
  return "calculator";
}

export function withPricingOwnership(
  item: EstimateLineItemInput,
  ownership: Partial<PricingOwnershipMetadata> & Pick<PricingOwnershipMetadata, "pricingOwner">
): EstimateLineItemWithOwnership {
  return {
    ...item,
    pricingOwner: ownership.pricingOwner,
    scopeKey: ownership.scopeKey,
    overlapGroup: ownership.overlapGroup,
    includedInTotal: ownership.includedInTotal ?? true,
    clientVisible: ownership.clientVisible ?? ownership.pricingOwner !== "internal_build_up",
    pricingSource:
      ownership.pricingSource ?? defaultPricingSource(item.rateSource),
  };
}

export function ownershipFromCategory(
  category: EstimateLineItemInput["category"],
  overrides?: Partial<PricingOwnershipMetadata>
): PricingOwnershipMetadata {
  const pricingOwner: PricingOwner =
    overrides?.pricingOwner ??
    (category === "labour"
      ? "in_house_labour"
      : category === "materials"
        ? "contractor_material"
        : category === "subcontractor" || category === "allowance"
          ? "subcontractor_allowance"
          : "in_house_labour");

  return {
    pricingOwner,
    scopeKey: overrides?.scopeKey,
    overlapGroup: overrides?.overlapGroup,
    includedInTotal: overrides?.includedInTotal ?? true,
    clientVisible: overrides?.clientVisible ?? pricingOwner !== "internal_build_up",
    pricingSource: overrides?.pricingSource ?? "calculator",
  };
}

function isDisposalLine(item: EstimateLineItemInput): boolean {
  return DISPOSAL_LABEL_PATTERNS.some((pattern) => pattern.test(item.label));
}

function isBroadPackageLabour(item: EstimateLineItemInput): boolean {
  return BROAD_LABOUR_LABELS.has(item.label.trim().toLowerCase());
}

function hasSpecialistBathroomLines(items: EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.workAreaName.toLowerCase().includes("bathroom") &&
      /waterproofing|tiling|plumbing|electrical|demolition|strip-out/i.test(
        item.label
      )
  );
}

function hasSpecialistKitchenLines(items: EstimateLineItemInput[]): boolean {
  return items.some(
    (item) =>
      item.workAreaName.toLowerCase().includes("kitchen") &&
      /cabinetry|benchtop|splashback|plumbing|electrical|demolition|strip-out/i.test(
        item.label
      )
  );
}

function zeroPricedItem(item: EstimateLineItemInput): EstimateLineItemInput {
  return {
    ...item,
    recommendedCost: 0,
    recommendedSell: 0,
    grossProfit: 0,
    marginPercent: 0,
    markupPercent: 0,
    costLow: 0,
    costHigh: 0,
    sellLow: 0,
    sellHigh: 0,
    includedInTotal: false,
  };
}

/**
 * Prevents obvious double-counting across calculator outputs.
 * Applied to newly generated estimates only.
 */
export function dedupePricedItemsByScopeOwnership(
  items: EstimateLineItemInput[]
): EstimateLineItemInput[] {
  const bathroomSpecialist = hasSpecialistBathroomLines(items);
  const kitchenSpecialist = hasSpecialistKitchenLines(items);

  let next: EstimateLineItemInput[] = items
    .map((item) => {
    const ownership = item.pricingOwner;
    if (ownership === "internal_build_up") {
      return zeroPricedItem({
        ...item,
        pricingOwner: "internal_build_up",
        includedInTotal: false,
        clientVisible: false,
      });
    }
    if (ownership === "excluded" || ownership === "client_supplied") {
      if (item.includedInTotal === false || ownership === "excluded") {
        return zeroPricedItem({
          ...item,
          pricingOwner: ownership,
          includedInTotal: false,
        });
      }
    }
    if (isBroadPackageLabour(item)) {
      const isBathroom = item.label.toLowerCase().includes("bathroom");
      const isKitchen = item.label.toLowerCase().includes("kitchen");
      if ((isBathroom && bathroomSpecialist) || (isKitchen && kitchenSpecialist)) {
        return null;
      }
    }
    return item;
    })
    .filter((item): item is EstimateLineItemInput => item != null);

  const disposalIndexes: number[] = [];
  for (let i = 0; i < next.length; i++) {
    if (isDisposalLine(next[i]!) && next[i]!.includedInTotal !== false) {
      disposalIndexes.push(i);
    }
  }
  if (disposalIndexes.length > 1) {
    const preferred =
      disposalIndexes.find((index) =>
        /demolition|strip-out|flooring removal/i.test(next[index]!.label)
      ) ?? disposalIndexes[0]!;
    next = next.map((item, index) => {
      if (!disposalIndexes.includes(index) || index === preferred) {
        return item;
      }
      return zeroPricedItem({
        ...item,
        pricingOwner: item.pricingOwner ?? "excluded",
        includedInTotal: false,
        notes: [item.notes, "Duplicate disposal/cartage — excluded from total."]
          .filter(Boolean)
          .join(" · "),
      });
    });
  }

  const overlapWinners = new Map<string, number>();
  for (let i = 0; i < next.length; i++) {
    const item = next[i]!;
    const group = item.overlapGroup;
    const scopeKey = item.scopeKey;
    if (!group || !scopeKey || item.includedInTotal === false) continue;
    const winnerKey = `${group}|${scopeKey}`;
    if (!overlapWinners.has(winnerKey)) {
      overlapWinners.set(winnerKey, i);
      continue;
    }
    const winnerIndex = overlapWinners.get(winnerKey)!;
    const winner = next[winnerIndex]!;
    const winnerIsGeneric = isBroadPackageLabour(winner);
    const currentIsGeneric = isBroadPackageLabour(item);
    if (currentIsGeneric && !winnerIsGeneric) {
      next[winnerIndex] = zeroPricedItem({
        ...winner,
        pricingOwner: "excluded",
        includedInTotal: false,
      });
      overlapWinners.set(winnerKey, i);
    } else if (!currentIsGeneric) {
      next[i] = zeroPricedItem({
        ...item,
        pricingOwner: "excluded",
        includedInTotal: false,
        notes: [item.notes, `Overlap with ${winner.label} — excluded from total.`]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  return next;
}

export function sumIncludedLineItems(lineItems: EstimateLineItemInput[]) {
  const included = lineItems.filter((item) => item.includedInTotal !== false);
  return included.reduce(
    (totals, item) => ({
      costLow: totals.costLow + item.costLow,
      costHigh: totals.costHigh + item.costHigh,
      sellLow: totals.sellLow + item.sellLow,
      sellHigh: totals.sellHigh + item.sellHigh,
      recommendedCost: totals.recommendedCost + item.recommendedCost,
      recommendedSell: totals.recommendedSell + item.recommendedSell,
    }),
    {
      costLow: 0,
      costHigh: 0,
      sellLow: 0,
      sellHigh: 0,
      recommendedCost: 0,
      recommendedSell: 0,
    }
  );
}

export function totalLabourHours(items: EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((item) => item.includedInTotal !== false)
      .reduce((sum, item) => sum + (item.labourHours ?? 0), 0)
  );
}

export function countOverlapGroups(
  items: EstimateLineItemInput[],
  group: string
): number {
  return items.filter(
    (item) =>
      item.overlapGroup === group &&
      item.includedInTotal !== false &&
      item.recommendedSell > 0
  ).length;
}

export function pricingOwnerToDeliveryMethod(
  owner: PricingOwner | undefined,
  itemType: string
): import("@/lib/pricing/types").DeliveryMethod {
  switch (owner) {
    case "in_house_labour":
    case "contractor_material":
      return "in_house";
    case "subcontractor_allowance":
      return "subcontracted";
    case "client_supplied":
      return "in_house";
    case "excluded":
    case "internal_build_up":
      return "not_sure";
    default:
      if (itemType === "subcontractor") return "subcontracted";
      if (itemType === "allowance" || itemType === "contingency") {
        return "allowance";
      }
      return "in_house";
  }
}
