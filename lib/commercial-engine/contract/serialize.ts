/**
 * Deterministic normalization and JSON serialization — Batch 2B.3C.
 * Locale-independent. Distinguishes null (unknown) from 0 (zero).
 * Omits undefined. Rejects non-finite numbers in canonical snapshots.
 */

import { isFiniteNumber } from "../core/money";

export class CanonicalSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalSerializationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Recursively strip undefined, sort object keys, validate finite numbers.
 * Arrays preserve order (commercially meaningful for document lines).
 */
export function canonicalizeValue(value: unknown, path = "$"): unknown {
  if (value === undefined) {
    return undefined; // caller strips
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    if (!isFiniteNumber(value)) {
      throw new CanonicalSerializationError(
        `Non-finite number at ${path}: ${String(value)}`
      );
    }
    // Avoid -0 drift
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => canonicalizeValue(item, `${path}[${i}]`));
  }
  if (isPlainObject(value) || (typeof value === "object" && value !== null)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as object).sort();
    for (const key of keys) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) continue;
      out[key] = canonicalizeValue(child, `${path}.${key}`);
    }
    return out;
  }
  throw new CanonicalSerializationError(
    `Unsupported value type at ${path}: ${typeof value}`
  );
}

/** Deterministic JSON — stable key order, no undefined, null preserved. */
export function serializeCanonical(value: unknown): string {
  const canonical = canonicalizeValue(value);
  return JSON.stringify(canonical);
}

export function parseCanonicalJson<T = unknown>(json: string): T {
  return JSON.parse(json) as T;
}

/** Round-trip helper for verification. */
export function roundTripCanonical<T>(value: T): T {
  return parseCanonicalJson<T>(serializeCanonical(value));
}
