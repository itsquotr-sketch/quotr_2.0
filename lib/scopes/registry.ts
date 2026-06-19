import type { ScopeDefinition, ScopeQuestionTemplate } from "@/lib/scopes/types";
import { bathroomScope } from "@/lib/scopes/templates/bathroom";
import { deckScope } from "@/lib/scopes/templates/deck";
import { demolitionScope } from "@/lib/scopes/templates/demolition";
import { externalStairsScope } from "@/lib/scopes/templates/external-stairs";
import { fenceScope } from "@/lib/scopes/templates/fence";
import { kitchenScope } from "@/lib/scopes/templates/kitchen";
import { pergolaScope } from "@/lib/scopes/templates/pergola";
import { retainingWallScope } from "@/lib/scopes/templates/retaining-wall";

export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  deckScope,
  retainingWallScope,
  bathroomScope,
  kitchenScope,
  fenceScope,
  pergolaScope,
  externalStairsScope,
  demolitionScope,
];

const scopeByType = new Map(
  SCOPE_DEFINITIONS.map((definition) => [definition.type, definition])
);

export function getScopeDefinition(type: string): ScopeDefinition | undefined {
  return scopeByType.get(type);
}

export function getScopeQuestions(type: string): ScopeQuestionTemplate[] {
  return getScopeDefinition(type)?.questions ?? [];
}
