/**
 * Canonical Quality / specification-level edit entry point.
 * Quick Estimate Edit and the Quality card "Change spec" action must both
 * invoke this same flow — do not introduce a second editor.
 */
export const QUALITY_SPEC_EDIT_FLOW = "beginQualitySpecEdit" as const;

export type BeginQualitySpecEditOptions = {
  setEditing: (editing: boolean) => void;
  scrollTarget?: { current: HTMLElement | null } | null;
};

export function beginQualitySpecEdit(
  options: BeginQualitySpecEditOptions
): typeof QUALITY_SPEC_EDIT_FLOW {
  options.setEditing(true);
  const node = options.scrollTarget?.current;
  if (node && typeof node.scrollIntoView === "function") {
    node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  return QUALITY_SPEC_EDIT_FLOW;
}
