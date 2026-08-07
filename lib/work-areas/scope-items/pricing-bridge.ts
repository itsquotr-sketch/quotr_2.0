/**
 * Bridge user-authored scope items into Estimate Review / Final Pricing
 * without inventing calculated money (3.1B.7F-R2).
 */

export const MANUAL_SCOPE_PRICING_REQUIRED_NOTE =
  "Pricing required — added by you. Enter a rate or lump sum before issuing to clients.";

export function isManualScopePricingRequiredNote(
  notes: string | null | undefined
): boolean {
  if (!notes) return false;
  return (
    notes.includes("Pricing required — added by you") ||
    notes.includes("__quotr_manual_scope_pricing_required__")
  );
}

export function buildManualScopePricingNotes(params: {
  readonly title: string;
  readonly description?: string | null;
}): string {
  const desc = params.description?.trim();
  const parts = [
    MANUAL_SCOPE_PRICING_REQUIRED_NOTE,
    `__quotr_manual_scope_pricing_required__:true`,
  ];
  if (desc) {
    parts.push(desc);
  }
  return parts.join("\n");
}
