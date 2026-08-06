/**
 * Stage 3.1B.7C — Site constraint presentation categories.
 * Does not change extraction or eligibility.
 */

export const CONSTRAINT_PRESENTATION_CATEGORIES = [
  "access_movement",
  "site_operations",
  "height_levels",
  "storage_deliveries",
  "environmental",
  "security_working",
  "other",
] as const;

export type ConstraintPresentationCategory =
  (typeof CONSTRAINT_PRESENTATION_CATEGORIES)[number];

export const CONSTRAINT_CATEGORY_LABELS: Record<
  ConstraintPresentationCategory,
  string
> = {
  access_movement: "Access and Movement",
  site_operations: "Site Operations",
  height_levels: "Height and Levels",
  storage_deliveries: "Storage and Deliveries",
  environmental: "Environmental Controls",
  security_working: "Security and Working Restrictions",
  other: "Other",
};

const KEY_CATEGORY: Readonly<Record<string, ConstraintPresentationCategory>> =
  Object.freeze({
    site_access: "access_movement",
    material_carry_distance: "access_movement",
    waste_bin_access: "storage_deliveries",
    floor_level: "height_levels",
    occupied_site: "site_operations",
    working_hours: "security_working",
    services_isolated: "site_operations",
  });

export function classifyConstraintPresentationCategory(
  key: string,
  label = ""
): ConstraintPresentationCategory {
  if (KEY_CATEGORY[key]) return KEY_CATEGORY[key]!;
  const hay = `${key} ${label}`.toLowerCase();
  if (/access|carry|crane|scaffold|movement/.test(hay)) return "access_movement";
  if (/occupied|services|operation/.test(hay)) return "site_operations";
  if (/level|height|floor|storey/.test(hay)) return "height_levels";
  if (/waste|bin|storage|deliver/.test(hay)) return "storage_deliveries";
  if (/dust|noise|weather|environment/.test(hay)) return "environmental";
  if (/hours|security|restriction|curfew/.test(hay)) return "security_working";
  return "other";
}

export function groupConstraintsByPresentationCategory<
  T extends { key: string; label: string },
>(items: readonly T[]): readonly {
  category: ConstraintPresentationCategory;
  label: string;
  items: readonly T[];
}[] {
  const buckets = new Map<ConstraintPresentationCategory, T[]>();
  for (const cat of CONSTRAINT_PRESENTATION_CATEGORIES) {
    buckets.set(cat, []);
  }
  for (const item of items) {
    const cat = classifyConstraintPresentationCategory(item.key, item.label);
    buckets.get(cat)!.push(item);
  }
  return CONSTRAINT_PRESENTATION_CATEGORIES.flatMap((category) => {
    const list = buckets.get(category) ?? [];
    if (list.length === 0) return [];
    return [
      {
        category,
        label: CONSTRAINT_CATEGORY_LABELS[category],
        items: list,
      },
    ];
  });
}
