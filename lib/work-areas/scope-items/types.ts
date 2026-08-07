/**
 * User-authored work-area scope items (3.1B.7F-R2).
 * Not discovery suggestions — origin is always user.
 */

export type ManualScopeItemOrigin = "user";

export type ManualScopeItemDecisionType = "INCLUDE" | "EXCLUDE";

export type ManualScopeItemState = "INCLUDED" | "NOT_REQUIRED";

export type ManualScopeItemView = {
  readonly id: string;
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly identity: string;
  readonly title: string;
  readonly description: string | null;
  readonly scopeItemType: string | null;
  readonly origin: ManualScopeItemOrigin;
  readonly state: ManualScopeItemState;
  readonly pricingRequired: true;
  readonly addedByYou: true;
};

export function manualScopeItemIdentity(params: {
  readonly workAreaId: string;
  readonly title: string;
}): string {
  const normalised = params.title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return `user:${params.workAreaId}:${normalised}`;
}
