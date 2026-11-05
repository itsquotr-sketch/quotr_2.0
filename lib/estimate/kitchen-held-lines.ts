export const KITCHEN_HELD_SCOPE_KEYS = new Set([
  "kitchen.replacement_request",
  "kitchen.package_labour",
  "kitchen.materials_package",
]);

export function kitchenHeldLineVisible(item: {
  includedInTotal?: boolean;
  scopeKey?: string | null;
}): boolean {
  return (
    item.includedInTotal === false &&
    item.scopeKey != null &&
    KITCHEN_HELD_SCOPE_KEYS.has(item.scopeKey)
  );
}
