/**
 * A priced-lines subtotal is not a complete client price while scope or
 * prices are unresolved. An entered override keeps its stored amount.
 */

export const PRICED_WORK_SO_FAR = "Priced work so far";

export type ClientPriceBasis = "complete" | "priced_lines" | "entered";

export function clientPriceBasis(input: {
  readonly scopeUnresolved: boolean;
  readonly pricesUnresolved: boolean;
  readonly enteredOverride: boolean;
}): ClientPriceBasis {
  if (input.enteredOverride) return "entered";
  if (input.scopeUnresolved || input.pricesUnresolved) return "priced_lines";
  return "complete";
}

export function clientPriceCopy(basis: ClientPriceBasis): {
  readonly totalLabel: string;
  readonly heading: string;
  readonly detail: string;
  readonly fieldLabel: string;
} {
  if (basis === "entered") {
    return {
      totalLabel: "Entered price",
      heading: "Entered price",
      detail:
        "This is the price you entered. It stays when the recommendation changes. It is not a complete job price while scope or prices are still unresolved.",
      fieldLabel: "Entered price",
    };
  }
  if (basis === "priced_lines") {
    return {
      totalLabel: PRICED_WORK_SO_FAR,
      heading: PRICED_WORK_SO_FAR,
      detail:
        "This is the subtotal of priced work. It is not the complete job price while scope or prices are unresolved.",
      fieldLabel: PRICED_WORK_SO_FAR,
    };
  }
  return {
    totalLabel: "Your final price",
    heading: "Final client price",
    detail:
      "The estimate is Quotr’s working recommendation. Pricing is what you intend to charge. The quote will use this price.",
    fieldLabel: "Final price",
  };
}
