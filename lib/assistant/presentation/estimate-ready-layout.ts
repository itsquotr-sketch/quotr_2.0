/**
 * Estimate-ready layout.
 *
 * The commercial summary lives in the main overview. A second column would
 * repeat the Assistant, so estimate-ready stays one column at every width.
 * Estimate Basis starts open from the desktop breakpoint and closed below it.
 */

export const ESTIMATE_BASIS_DESKTOP_MIN_PX = 1024;
export const ESTIMATE_BASIS_DESKTOP_QUERY = "(min-width: 1024px)";

export type AssistantLayoutMode = "planning" | "estimate_ready" | "edit_job";

export function estimateBasisStartsExpanded(matchesDesktop: boolean): boolean {
  return matchesDesktop;
}

export function estimateBasisExpandedAt(widthPx: number): boolean {
  return estimateBasisStartsExpanded(widthPx >= ESTIMATE_BASIS_DESKTOP_MIN_PX);
}

export function estimateReadySidebarPolicy(mode: AssistantLayoutMode): {
  readonly mountsCommercialSidebar: boolean;
  readonly singleColumn: boolean;
} {
  const mountsCommercialSidebar = mode === "planning";
  return {
    mountsCommercialSidebar,
    singleColumn: !mountsCommercialSidebar,
  };
}

/** Widths the Assistant is checked at. Estimate-ready never adds a sidebar. */
export function estimateReadyLayoutAt(widthPx: number): {
  readonly columns: 1;
  readonly commercialSidebar: false;
  readonly estimateBasisExpanded: boolean;
} {
  return {
    columns: 1,
    commercialSidebar: false,
    estimateBasisExpanded: estimateBasisExpandedAt(widthPx),
  };
}

export function estimateBasisWorkAreas(names: readonly string[]): string[] {
  return names.map((name) => name.trim()).filter((name) => name.length > 0);
}

export function estimateBasisBrief(
  briefText: string | null | undefined,
  projectBrief: string | null | undefined
): string | null {
  const text = (briefText || projectBrief || "").trim();
  return text.length > 0 ? text : null;
}

export function unpricedLabourStatus(quantity: number | null, unit: string | null): string {
  const amount =
    quantity != null && Number.isFinite(quantity) && quantity > 0
      ? String(quantity)
      : null;
  return [amount, unit?.trim() || null, "Pricing Required"].filter(Boolean).join(" ");
}
