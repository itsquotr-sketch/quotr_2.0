import { isSupplierFactLabel } from "@/lib/rfqs/draft-privacy";

export type DraftFact = {
  id: string;
  field: "scope" | "measurements";
  source: string;
  text: string;
  uncertain: boolean;
};

export type DraftSource = {
  field: "scope" | "measurements";
  source: string;
  text: string;
  uncertain: boolean;
};

export function factIsSafe(key: string, label: string): boolean {
  return isSupplierFactLabel(key, label);
}

export function composeJobDraft(facts: DraftFact[], preferredOrder: string[] = []): {
  requestedScope: string;
  measurementNotes: string;
  sources: DraftSource[];
  missing: string[];
} {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const seen = new Set<string>();
  const ordered: DraftFact[] = [];
  for (const id of preferredOrder) {
    const fact = byId.get(id);
    if (!fact || seen.has(fact.id)) continue;
    seen.add(fact.id);
    ordered.push(fact);
  }
  for (const fact of facts) {
    if (seen.has(fact.id)) continue;
    ordered.push(fact);
  }
  const scope = ordered.filter((fact) => fact.field === "scope");
  const measurements = ordered.filter((fact) => fact.field === "measurements");
  const missing: string[] = [];
  if (measurements.length === 0) {
    missing.push("No measured quantity is recorded. Review the measurements before sending.");
  }
  if (measurements.some((fact) => fact.uncertain)) {
    missing.push("A recorded quantity is uncertain. Check it before sending.");
  }
  const measurementLines = measurements.map((fact) =>
    fact.uncertain ? `${fact.text} (check this quantity)` : fact.text
  );
  return {
    requestedScope: scope.map((fact) => fact.text).join("\n\n"),
    measurementNotes: measurementLines.join("\n"),
    sources: ordered.map((fact) => ({
      field: fact.field,
      source: fact.source,
      text: fact.text,
      uncertain: fact.uncertain,
    })),
    missing,
  };
}
