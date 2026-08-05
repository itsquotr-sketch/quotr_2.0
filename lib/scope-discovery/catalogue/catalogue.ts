import { deepFreeze } from "../immutability";
import { BATHROOM_RELATIONSHIPS } from "./relationships/bathroom";
import { COMMERCIAL_FITOUT_RELATIONSHIPS } from "./relationships/commercial-fitout";
import { DECK_RELATIONSHIPS } from "./relationships/deck";
import type { ScopeRelationship } from "./types";
import { validateCatalogueRelationships } from "./validation";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "./version";

export const SCOPE_RELATIONSHIP_CATALOGUE: readonly ScopeRelationship[] =
  deepFreeze([
    ...DECK_RELATIONSHIPS,
    ...BATHROOM_RELATIONSHIPS,
    ...COMMERCIAL_FITOUT_RELATIONSHIPS,
  ]);

const validation = validateCatalogueRelationships(SCOPE_RELATIONSHIP_CATALOGUE);

/**
 * Throws only if the shipped catalogue is malformed — caught by verification.
 * Public callers should prefer `getCatalogueValidation()` / `getActiveRelationships()`.
 */
export function assertCatalogueValid(): void {
  if (!validation.ok) {
    const detail = validation.issues
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid scope relationship catalogue: ${detail}`);
  }
}

export function getCatalogueValidation() {
  return validation;
}

export function getActiveRelationships(): readonly ScopeRelationship[] {
  assertCatalogueValid();
  return SCOPE_RELATIONSHIP_CATALOGUE.filter((r) => r.active);
}

export function getRelationshipsByParent(
  parentScopeType: string
): readonly ScopeRelationship[] {
  return getActiveRelationships().filter(
    (r) => r.parentScopeType === parentScopeType
  );
}

export { SCOPE_RELATIONSHIP_CATALOGUE_VERSION };
