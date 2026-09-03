/**
 * COMPANY DNA-02 — labour $/h vs productivity provenance (presentation only).
 * Does not change calculator economics or persist a new schema.
 */

import { formatLabourProductivityDisclosure } from "@/lib/company-dna/copy";
import {
  COMPANY_DNA_WORK_AREA_LABELS,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import {
  classifyRateSource,
  getRateSourceLabel,
  isCalibratedProductivitySource,
  isUserRateSource,
  type RateSourceType,
} from "@/lib/estimate/rate-source-labels";
import { inferProductivitySourceType } from "@/lib/estimate/line-item-metadata";

export function labourRateProvenanceLabel(rateSource: string): string {
  const type = classifyRateSource(rateSource);
  if (isUserRateSource(type)) return "Your rate";
  if (isCalibratedProductivitySource(type)) return "Your rate";
  if (
    type === "benchmark" ||
    type === "productivity" ||
    type === "fallback" ||
    type === "default"
  ) {
    return "Quotr benchmark";
  }
  return getRateSourceLabel(type);
}

export function productivityProvenanceLabel(params: {
  notes?: string | null;
  productivitySourceType?: RateSourceType;
}): string | null {
  const type =
    params.productivitySourceType ??
    inferProductivitySourceType(params.notes);
  if (!type) return null;
  if (isCalibratedProductivitySource(type)) {
    return "Your calibrated productivity";
  }
  if (type === "user_rate") return "Your rate";
  if (
    type === "benchmark" ||
    type === "productivity" ||
    type === "fallback" ||
    type === "default"
  ) {
    return "Quotr benchmark";
  }
  return getRateSourceLabel(type);
}

export function labourProductivityDisclosureFromLines(
  items: readonly {
    category?: string;
    notes?: string | null;
    productivitySourceType?: RateSourceType;
    workAreaName?: string | null;
    includedInTotal?: boolean;
  }[]
): string | null {
  const labour = items.filter(
    (item) => item.category === "labour" && item.includedInTotal !== false
  );
  if (labour.length === 0) return null;

  const withProductivity = labour.filter(
    (item) => productivityProvenanceLabel(item) != null
  );
  const pool = withProductivity.length > 0 ? withProductivity : labour;
  const calibrated = pool.filter(
    (item) =>
      productivityProvenanceLabel(item) === "Your calibrated productivity"
  );

  const names = calibrated
    .map((item) => item.workAreaName?.trim())
    .filter((name): name is string => Boolean(name));
  const dominant = names[0] ?? null;
  const knownLabel =
    dominant &&
    (Object.values(COMPANY_DNA_WORK_AREA_LABELS) as string[]).includes(
      dominant
    )
      ? dominant
      : dominant && dominant.toLowerCase() in COMPANY_DNA_WORK_AREA_LABELS
        ? COMPANY_DNA_WORK_AREA_LABELS[dominant.toLowerCase() as CompanyDnaWorkAreaType]
        : dominant;

  return formatLabourProductivityDisclosure({
    calibratedLabourCount: calibrated.length,
    labourCount: pool.length,
    dominantWorkAreaLabel: knownLabel,
  });
}
