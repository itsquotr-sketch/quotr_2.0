/**
 * Deep immutability helper — Batch 2B.3C.
 * Freezes objects and arrays recursively. Primitives returned as-is.
 * Always recurses into children even if the parent is already frozen.
 */

export function deepFreeze<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  const obj = value as object;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
  } else {
    for (const key of Reflect.ownKeys(obj)) {
      const child = (obj as Record<string | symbol, unknown>)[key as string];
      if (child !== null && typeof child === "object") {
        deepFreeze(child);
      }
    }
  }

  if (!Object.isFrozen(obj)) {
    Object.freeze(obj);
  }

  return value;
}

/**
 * Attempt mutation for verification. Returns true if the value appears frozen
 * (assignment threw or had no lasting effect under strict semantics).
 */
export function assertFrozenMutationBlocked(
  target: object,
  key: string,
  probe: unknown
): boolean {
  const before = (target as Record<string, unknown>)[key];
  try {
    (target as Record<string, unknown>)[key] = probe;
  } catch {
    return true;
  }
  const after = (target as Record<string, unknown>)[key];
  if (after !== before) {
    try {
      (target as Record<string, unknown>)[key] = before;
    } catch {
      /* ignore */
    }
    return false;
  }
  return Object.isFrozen(target);
}
