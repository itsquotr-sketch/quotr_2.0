/**
 * CLADDING-04B — carpenter hourly COST lookup.
 *
 * Reads the existing labour catalogue benchmark. This module does not
 * store a dollar figure.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import type { OrganisationRate } from "@/components/setup/types";
import { CLADDING_CARPENTER_LABOUR_RATE_KEY } from "@/lib/estimate/cladding-identities";
import {
  resolveCladdingCarpenterHourlyAuthority,
  type CladdingAuthorityResolution,
} from "@/lib/estimate/cladding-authority";

export function resolveCladdingCarpenterHourlyCost(params: {
  rates?: readonly OrganisationRate[];
  allowBenchmarkRates?: boolean;
}): CladdingAuthorityResolution {
  const entry = getCatalogueEntry(CLADDING_CARPENTER_LABOUR_RATE_KEY);
  const quotr =
    entry?.rate_type === "labour" && entry.defaultCostRate != null
      ? entry.defaultCostRate
      : null;
  return resolveCladdingCarpenterHourlyAuthority({
    rates: params.rates,
    allowBenchmarkRates: params.allowBenchmarkRates,
    quotrCarpenterCost: quotr,
  });
}
