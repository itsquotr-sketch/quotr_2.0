import { isSubcontractorWorkAreaType } from "@/lib/subcontractors/work-areas";

/** Units a builder can confirm. A lump-sum response may only use lump_sum. */
export const SUBCONTRACTOR_RATE_UNITS = ["lump_sum", "m2", "m", "item", "hour"] as const;

export type SubcontractorRateUnit = (typeof SUBCONTRACTOR_RATE_UNITS)[number];

export const SUBCONTRACTOR_RATE_UNIT_LABELS: Record<SubcontractorRateUnit, string> = {
  lump_sum: "Lump sum",
  m2: "m²",
  m: "m",
  item: "item",
  hour: "hour",
};

/** Writing prompts only. They are not prices and do not describe a job. */
export const RATE_SCOPE_PROMPTS: Record<string, readonly string[]> = {
  bathroom: ["Supply and install wall tiles", "Waterproof wet areas", "Supply and install sanitary fixtures"],
  kitchen: ["Supply and install a splashback", "Supply and install cabinetry"],
  deck: ["Supply and install decking", "Supply and install a balustrade"],
  fence: ["Supply and install fencing", "Supply and install gates"],
  painting: ["Prepare and paint interior walls", "Prepare and paint exterior cladding"],
  flooring: ["Supply and install flooring", "Prepare the subfloor"],
  plastering: ["Stop and plaster internal walls", "Sand and finish plaster"],
};

export function scopePromptsFor(workAreaType: string): readonly string[] {
  return RATE_SCOPE_PROMPTS[workAreaType] ?? [];
}

/** Fills an empty scope, or adds a prompt once. A prompt already present is left as it is. */
export function applyScopePrompt(current: string, prompt: string): string {
  const trimmed = current.trim();
  if (!trimmed) return prompt;
  if (trimmed.includes(prompt)) return trimmed;
  return `${trimmed} ${prompt}`;
}

export function rateCostLabel(unit: string): string {
  switch (unit) {
    case "m2":
      return "Cost ex GST per m²";
    case "m":
      return "Cost ex GST per m";
    case "item":
      return "Cost ex GST per item";
    case "hour":
      return "Cost ex GST per hour";
    case "lump_sum":
      return "Lump sum cost ex GST";
    default:
      return "Cost ex GST";
  }
}

export type RateRecordStatus = "current" | "upcoming" | "expired" | "retired";

export function rateRecordStatus(
  rate: Pick<StoredRateVersion, "retired" | "effectiveFrom" | "effectiveUntil">,
  today: string
): RateRecordStatus {
  if (rate.retired) return "retired";
  const from = dateOnly(rate.effectiveFrom);
  const until = rate.effectiveUntil ? dateOnly(rate.effectiveUntil) : null;
  if (until && until < today) return "expired";
  if (from > today) return "upcoming";
  return "current";
}

/**
 * The rate book stores NZD only. A non-NZD preference must be confirmed as an
 * NZD figure before save. Nothing here converts currencies.
 */
export function rateBookCurrencyGate(input: {
  countryCode: string | null;
  preferredCurrency: string | null;
}): { needsNzdConfirmation: boolean; notice: string | null } {
  const currency = (input.preferredCurrency ?? "").trim().toUpperCase();
  const foreign = input.countryCode === "AU" || (currency !== "" && currency !== "NZD");
  if (!foreign) return { needsNzdConfirmation: false, notice: null };
  return {
    needsNzdConfirmation: true,
    notice: "Reusable rates are stored in New Zealand dollars only. An amount in another currency is not saved and is not converted.",
  };
}

export type SubcontractorRateSource = "builder" | "rfq_response" | "rate_schedule_document";

export type RateDraftFromResponse = {
  workAreaType: string | null;
  scope: string;
  unit: SubcontractorRateUnit | null;
  unitLocked: boolean;
  costExGst: number | null;
  currency: "NZD";
  inclusions: string;
  exclusions: string;
  suggestedEffectiveUntil: string | null;
  effectiveFrom: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isSubcontractorRateUnit(value: string): value is SubcontractorRateUnit {
  return (SUBCONTRACTOR_RATE_UNITS as readonly string[]).includes(value);
}

/**
 * Map a submitted response into a draft. Scope and the start date stay blank.
 * A lump sum locks the unit. An itemised total does not become a measured rate.
 */
export function draftRateFromRfqResponse(input: {
  pricingStructure: string | null;
  priceExGst: number | null;
  includedScope: string | null;
  excludedScope: string | null;
  validUntil: string | null;
  workAreaType: string | null;
}): RateDraftFromResponse {
  const lumpSum = input.pricingStructure === "lump_sum";
  const cost = input.priceExGst != null && Number.isFinite(input.priceExGst) && input.priceExGst >= 0
    ? Math.round(input.priceExGst * 100) / 100
    : null;
  const workArea = input.workAreaType && isSubcontractorWorkAreaType(input.workAreaType)
    ? input.workAreaType
    : null;
  const until = input.validUntil && DATE.test(input.validUntil) ? input.validUntil : null;
  return {
    workAreaType: workArea,
    scope: "",
    unit: lumpSum ? "lump_sum" : null,
    unitLocked: lumpSum,
    costExGst: cost,
    currency: "NZD",
    inclusions: (input.includedScope ?? "").trim(),
    exclusions: (input.excludedScope ?? "").trim(),
    suggestedEffectiveUntil: until,
    effectiveFrom: "",
  };
}

export type StoredRateVersion = {
  rateId: string;
  versionId: string;
  versionNumber: number;
  subcontractorId: string;
  tradingName: string;
  subcontractorArchived: boolean;
  retired: boolean;
  workAreaType: string;
  scope: string;
  unit: string;
  costExGst: number;
  currency: string;
  minimumCharge: number | null;
  quantityBandMin: number | null;
  quantityBandMax: number | null;
  inclusions: string;
  exclusions: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  lastConfirmedOn: string | null;
  source: string;
  originResponseId: string | null;
  informingResponseId: string | null;
  sourceAmountExGst: number | null;
  internalNotes: string;
};

export type JobRateContext = {
  workAreaType: string;
  specification: string | null;
  quantityUnit: string | null;
  quantity: number | null;
};

export type RateSuggestion = StoredRateVersion & {
  fit: "applicable" | "reference";
  reasons: string[];
  overlaps: boolean;
};

function normaliseSpec(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function rateIsCurrent(rate: Pick<StoredRateVersion, "effectiveFrom" | "effectiveUntil">, today: string): boolean {
  const from = dateOnly(rate.effectiveFrom);
  const until = rate.effectiveUntil ? dateOnly(rate.effectiveUntil) : null;
  return from <= today && (until == null || until >= today);
}

function rangesOverlap(
  left: Pick<StoredRateVersion, "effectiveFrom" | "effectiveUntil">,
  right: Pick<StoredRateVersion, "effectiveFrom" | "effectiveUntil">
): boolean {
  const leftEnd = left.effectiveUntil ?? "9999-12-31";
  const rightEnd = right.effectiveUntil ?? "9999-12-31";
  return dateOnly(left.effectiveFrom) <= rightEnd && dateOnly(right.effectiveFrom) <= leftEnd;
}

/**
 * Active rates for one work area. A specification or unit that does not match
 * stays visible as a reference. Expired, retired, archived, and other work areas are omitted.
 */
export function suggestRatesForWorkArea(
  rates: readonly StoredRateVersion[],
  job: JobRateContext,
  today: string
): RateSuggestion[] {
  const latest = new Map<string, StoredRateVersion>();
  for (const rate of rates) {
    const current = latest.get(rate.rateId);
    if (!current || rate.versionNumber > current.versionNumber) latest.set(rate.rateId, rate);
  }
  const included: RateSuggestion[] = [];
  for (const rate of latest.values()) {
    if (rate.retired || rate.subcontractorArchived) continue;
    if (rate.workAreaType !== job.workAreaType) continue;
    if (!rateIsCurrent(rate, today)) continue;
    const reasons: string[] = [];
    const jobSpec = normaliseSpec(job.specification);
    const rateSpec = normaliseSpec(rate.scope);
    if (!jobSpec || jobSpec !== rateSpec) {
      reasons.push(jobSpec
        ? "The job specification does not match this rate's scope. This is a reference only."
        : "This job has no specification to match this rate's scope. This is a reference only.");
    }
    if (job.quantityUnit && job.quantityUnit !== rate.unit) {
      reasons.push(rate.unit === "lump_sum"
        ? "This lump sum is not a measured rate for the job unit. This is a reference only."
        : "The job unit does not match this rate. This is a reference only.");
    } else if (!job.quantityUnit && rate.unit !== "lump_sum") {
      reasons.push("No job unit is selected, so this measured rate is a reference only.");
    }
    if (job.quantity != null && rate.quantityBandMin != null && job.quantity < rate.quantityBandMin) {
      reasons.push("The quantity is below this rate's band. This is a reference only.");
    }
    if (job.quantity != null && rate.quantityBandMax != null && job.quantity > rate.quantityBandMax) {
      reasons.push("The quantity is above this rate's band. This is a reference only.");
    }
    included.push({
      ...rate,
      fit: reasons.length === 0 ? "applicable" : "reference",
      reasons,
      overlaps: false,
    });
  }
  return included.map((rate) => {
    const overlaps = included.some((other) =>
      other.rateId !== rate.rateId
      && other.subcontractorId === rate.subcontractorId
      && other.workAreaType === rate.workAreaType
      && rangesOverlap(rate, other)
    );
    return { ...rate, overlaps };
  });
}

export type RateCostPreview = {
  amountExGst: number | null;
  extended: boolean;
  statement: string;
};

/** Cost preview only. Quantity never converts a lump sum, and nothing is stored. */
export function previewRateCost(input: {
  unit: string;
  costExGst: number;
  minimumCharge: number | null;
  quantity: number | null;
  jobUnit: string | null;
}): RateCostPreview {
  if (input.unit === "lump_sum" || (input.jobUnit != null && input.jobUnit !== input.unit)) {
    return {
      amountExGst: input.unit === "lump_sum" ? round2(input.costExGst) : null,
      extended: false,
      statement: input.unit === "lump_sum"
        ? "Lump sum cost ex GST. Quantity is not applied. Estimate and Pricing are unchanged."
        : "The units differ, so this cost is not extended. Estimate and Pricing are unchanged.",
    };
  }
  if (input.quantity == null || !Number.isFinite(input.quantity) || input.quantity < 0) {
    return {
      amountExGst: null,
      extended: false,
      statement: "Enter a quantity to preview this cost. Nothing is saved to Estimate or Pricing.",
    };
  }
  const extended = round2(input.costExGst * input.quantity);
  const minimum = input.minimumCharge != null ? round2(input.minimumCharge) : null;
  const amount = minimum != null && minimum > extended ? minimum : extended;
  return {
    amountExGst: amount,
    extended: true,
    statement: minimum != null && minimum > extended
      ? "Preview uses the minimum charge. Estimate and Pricing are unchanged."
      : "Cost preview ex GST for this job only. Estimate and Pricing are unchanged.",
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
