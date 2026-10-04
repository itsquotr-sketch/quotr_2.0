export type DashboardWorkTab = "attention" | "activity";

/**
 * Which tab is selected when the Dashboard panel first renders.
 * Attention wins whenever any attention record exists. Activity is the
 * default only when attention is empty and activity exists. When both are
 * empty, attention stays selected so its empty state is what people see.
 */
export function defaultDashboardWorkTab(
  attentionCount: number,
  activityCount: number
): DashboardWorkTab {
  if (attentionCount > 0) return "attention";
  if (activityCount > 0) return "activity";
  return "attention";
}
