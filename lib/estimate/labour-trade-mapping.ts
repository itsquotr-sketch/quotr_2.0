/**
 * Carpenter vs labourer labour-rate authority (ONBOARDING-01).
 *
 * resolveLabourRate is unchanged:
 *   no trade / carpenter → labour.carpenter.hour, then labour.general.hour
 *   labourer             → labour.labourer.hour, then labour.general.hour, then carpenter
 *   apprentice           → labour.apprentice.hour, then labour.general.hour, then carpenter
 *
 * Onboarding stores both carpenter and labourer company costs. It does not
 * backfill existing organisations and does not rewrite Quote, accepted
 * snapshot, or Variation money.
 *
 * Priced Work Areas below still cannot split the two trades. They resolve the
 * carpenter path (or an explicit carpenter key). A stored labourer cost does
 * not change those calculations. labour.general.hour remains a fallback only
 * when the preferred trade row is missing.
 */

export const CARPENTER_LABOUR_RATE_KEY = "labour.carpenter.hour";
export const LABOURER_LABOUR_RATE_KEY = "labour.labourer.hour";
export const GENERAL_LABOUR_RATE_KEY = "labour.general.hour";
export const APPRENTICE_LABOUR_RATE_KEY = "labour.apprentice.hour";

export function labourRateKeyOrder(trade?: string | null): readonly string[] {
  if (trade === "labourer") {
    return [
      LABOURER_LABOUR_RATE_KEY,
      GENERAL_LABOUR_RATE_KEY,
      CARPENTER_LABOUR_RATE_KEY,
    ];
  }
  if (trade === "apprentice") {
    return [
      APPRENTICE_LABOUR_RATE_KEY,
      GENERAL_LABOUR_RATE_KEY,
      CARPENTER_LABOUR_RATE_KEY,
    ];
  }
  return [CARPENTER_LABOUR_RATE_KEY, GENERAL_LABOUR_RATE_KEY];
}

export type WorkAreaLabourAuthority = {
  workArea: string;
  /** What priced calculations use today. */
  pricedAuthority: "carpenter_then_general";
  distinguishesLabourer: false;
  note: string;
};

export const WORK_AREA_LABOUR_AUTHORITY: readonly WorkAreaLabourAuthority[] = [
  {
    workArea: "deck",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Deck calculators call resolveLabourRate with no trade.",
  },
  {
    workArea: "fence",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Fence calculators call resolveLabourRate with no trade.",
  },
  {
    workArea: "retaining_wall",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Retaining wall calculators call resolveLabourRate with no trade.",
  },
  {
    workArea: "pergola",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Pergola calls resolveLabourRate with no trade.",
  },
  {
    workArea: "bathroom",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Priced bathroom labour uses the carpenter path. Some demolition requirement rows are labelled labourer but still take that carpenter rate key.",
  },
  {
    workArea: "kitchen",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Kitchen calls resolveLabourRate with no trade.",
  },
  {
    workArea: "external_stairs",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "External stairs call resolveLabourRate with no trade.",
  },
  {
    workArea: "demolition",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Demolition calls resolveLabourRate with no trade.",
  },
  {
    workArea: "internal_walls",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Framing, lining, finish and fit-out labour use resolveLabourRate with no trade.",
  },
  {
    workArea: "ceilings",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Ceilings call resolveLabourRate with no trade.",
  },
  {
    workArea: "painting",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Painting labour in fit-out uses resolveLabourRate with no trade.",
  },
  {
    workArea: "doors",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Doors pass trade carpenter. Labourer and general rows are not the priced identity.",
  },
  {
    workArea: "flooring",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Priced flooring passes trade carpenter. Unpriced physical rows can name labour.labourer.hour but do not apply an hourly cost.",
  },
  {
    workArea: "cladding",
    pricedAuthority: "carpenter_then_general",
    distinguishesLabourer: false,
    note: "Cladding prices labour.carpenter.hour and ignores labourer and general rows.",
  },
];
