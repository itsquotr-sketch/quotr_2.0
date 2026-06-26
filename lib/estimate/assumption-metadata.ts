/** Structured metadata for calculator-assumed dimensions (internal only). */

export type AssumptionSeverity = "critical" | "warning" | "info";

export type DefaultedFactEntry = {
  key: string;
  label: string;
  assumedValue: number | string;
  unit?: string;
  reason: string;
  severity?: AssumptionSeverity;
  workAreaId?: string;
};

export type AssumptionMetadata = {
  assumptionSeverity?: AssumptionSeverity;
  defaultedFacts: DefaultedFactEntry[];
};

export function createAssumptionMetadata(): AssumptionMetadata {
  return { defaultedFacts: [] };
}

export function recordDefaultedDimension(
  metadata: AssumptionMetadata,
  entry: DefaultedFactEntry & { severity?: AssumptionSeverity }
): number | string {
  const severity = entry.severity ?? "critical";
  metadata.defaultedFacts.push({ ...entry, severity });
  metadata.assumptionSeverity = maxSeverity(
    metadata.assumptionSeverity,
    severity
  );
  return entry.assumedValue;
}

export function recordDefaultedNumber(
  metadata: AssumptionMetadata,
  entry: Omit<DefaultedFactEntry, "assumedValue"> & {
    assumedValue: number;
    severity?: AssumptionSeverity;
  }
): number {
  return Number(
    recordDefaultedDimension(metadata, entry)
  );
}

function maxSeverity(
  current: AssumptionSeverity | undefined,
  next: AssumptionSeverity
): AssumptionSeverity {
  const rank: Record<AssumptionSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3,
  };
  if (!current) return next;
  return rank[next] > rank[current] ? next : current;
}

export function mergeAssumptionMetadata(
  items: AssumptionMetadata[]
): AssumptionMetadata {
  const merged = createAssumptionMetadata();
  for (const item of items) {
    for (const fact of item.defaultedFacts) {
      merged.defaultedFacts.push(fact);
      merged.assumptionSeverity = maxSeverity(
        merged.assumptionSeverity,
        fact.severity ?? "critical"
      );
    }
  }
  return merged;
}

export function formatDefaultedFactWarning(fact: DefaultedFactEntry): string {
  const unitSuffix = fact.unit ? fact.unit : "";
  return `Assumed ${fact.label.toLowerCase()}: ${fact.assumedValue}${unitSuffix} — confirm before pricing.`;
}

export function defaultedFactWarnings(metadata: AssumptionMetadata): string[] {
  return metadata.defaultedFacts
    .filter((fact) => (fact.severity ?? "critical") === "critical")
    .map(formatDefaultedFactWarning);
}

export function confidencePenaltyForAssumptions(
  metadata: AssumptionMetadata
): number {
  const criticalCount = metadata.defaultedFacts.filter(
    (fact) => (fact.severity ?? "critical") === "critical"
  ).length;
  const warningCount = metadata.defaultedFacts.filter(
    (fact) => fact.severity === "warning"
  ).length;
  return criticalCount * 12 + warningCount * 5;
}
