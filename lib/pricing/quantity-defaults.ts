/** Default quantity and unit when a line item has no natural measure. */
export const DEFAULT_ALLOWANCE_QUANTITY = 1;
export const DEFAULT_ALLOWANCE_UNIT = "allow";

export function resolveLineItemQuantityUnit(input: {
  quantity?: number | null;
  unit?: string | null;
  isAllowance?: boolean;
}): { quantity: number; unit: string } {
  if (input.quantity != null && input.quantity > 0 && input.unit) {
    return { quantity: input.quantity, unit: input.unit };
  }

  if (input.quantity != null && input.quantity > 0) {
    return {
      quantity: input.quantity,
      unit: input.unit ?? (input.isAllowance ? DEFAULT_ALLOWANCE_UNIT : "item"),
    };
  }

  if (input.isAllowance) {
    return {
      quantity: DEFAULT_ALLOWANCE_QUANTITY,
      unit: DEFAULT_ALLOWANCE_UNIT,
    };
  }

  return {
    quantity: DEFAULT_ALLOWANCE_QUANTITY,
    unit: input.unit ?? "item",
  };
}

export function ensurePricingItemQuantityUnit(input: {
  quantity?: number | null;
  unit?: string | null;
  itemType?: string;
  calculationMode?: string;
}): { quantity: number; unit: string } {
  const isAllowance =
    input.itemType === "allowance" ||
    input.itemType === "contingency" ||
    input.calculationMode === "lump_sum";

  return resolveLineItemQuantityUnit({
    quantity: input.quantity,
    unit: input.unit,
    isAllowance,
  });
}

export function ensureQuoteItemQuantityUnit(input: {
  quantity?: number | null;
  unit?: string | null;
  itemType?: string;
  calculationMode?: string;
}): { quantity: number; unit: string } {
  return ensurePricingItemQuantityUnit(input);
}
