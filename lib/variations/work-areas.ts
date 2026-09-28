/**
 * Client-facing Variation scope grouping.
 * Names are compared without case or surrounding whitespace.
 * This does not price a Variation or change accepted contract money.
 */

export type VariationScopeGroup = {
  name: string;
  description: string | null;
  items: string[];
};

export function variationWorkAreaNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function variationWorkAreaNamesConflict(left: string, right: string): boolean {
  const key = variationWorkAreaNameKey(left);
  return key.length > 0 && key === variationWorkAreaNameKey(right);
}

export function groupVariationScope(
  rows: readonly {
    workAreaName?: string | null;
    workAreaDescription?: string | null;
    clientDescription: string;
    sortOrder?: number;
  }[]
): VariationScopeGroup[] {
  const groups: VariationScopeGroup[] = [];
  const index = new Map<string, VariationScopeGroup>();
  const ordered = [...rows].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  for (const row of ordered) {
    const name = row.workAreaName?.trim() ?? "";
    if (!name) continue;
    const key = variationWorkAreaNameKey(name);
    let group = index.get(key);
    if (!group) {
      group = {
        name,
        description: row.workAreaDescription?.trim() || null,
        items: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    const description = row.clientDescription.trim();
    if (description) group.items.push(description);
  }
  return groups;
}
