export function formatProposalValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

export function formatProposalSource(source: string | null | undefined): string {
  if (!source) return "";
  if (source === "user") return "answered";
  if (source === "ai_extracted") return "from brief analysis";
  return source.replace(/_/g, " ");
}
