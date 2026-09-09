/**
 * Immediate answer-control contract.
 *
 * Click/tap paints selection locally. Persistence is background. A stale
 * committed value must not overwrite a newer optimistic selection.
 */

export type OptimisticSelectValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

function normalised(value: OptimisticSelectValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return [...value].map((item) => String(item).trim()).sort().join("\u0001");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

export function optionSelectValuesEqual(
  a: OptimisticSelectValue,
  b: OptimisticSelectValue
): boolean {
  return normalised(a) === normalised(b);
}

export function displayedOptionSelectValue(params: {
  readonly optimistic: OptimisticSelectValue | undefined;
  readonly committed: OptimisticSelectValue;
  readonly persistFailed?: boolean;
}): OptimisticSelectValue {
  if (params.persistFailed) return params.committed;
  if (params.optimistic !== undefined) return params.optimistic;
  return params.committed;
}

export function shouldClearOptimisticSelect(params: {
  readonly optimistic: OptimisticSelectValue | undefined;
  readonly committed: OptimisticSelectValue;
  readonly persistFailed?: boolean;
}): boolean {
  if (params.optimistic === undefined) return false;
  if (params.persistFailed) return true;
  return optionSelectValuesEqual(params.optimistic, params.committed);
}

export function nextSingleSelectValue(option: string): string {
  return option;
}

export function nextMultiSelectValue(
  selected: readonly string[],
  option: string,
  optionSelected: boolean
): string[] {
  if (optionSelected) {
    return selected.filter((item) => item !== option);
  }
  return [...selected, option];
}
