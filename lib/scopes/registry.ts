import type { ScopeDefinition, ScopeQuestionTemplate } from "@/lib/scopes/types";
import { bathroomScope } from "@/lib/scopes/templates/bathroom";
import { ceilingsScope } from "@/lib/scopes/templates/ceilings";
import { deckScope } from "@/lib/scopes/templates/deck";
import { demolitionScope } from "@/lib/scopes/templates/demolition";
import { doorsScope } from "@/lib/scopes/templates/doors";
import { externalStairsScope } from "@/lib/scopes/templates/external-stairs";
import { fenceScope } from "@/lib/scopes/templates/fence";
import { flooringScope } from "@/lib/scopes/templates/flooring";
import { internalWallsScope } from "@/lib/scopes/templates/internal-walls";
import { kitchenScope } from "@/lib/scopes/templates/kitchen";
import { paintingScope } from "@/lib/scopes/templates/painting";
import { pergolaScope } from "@/lib/scopes/templates/pergola";
import { plasteringScope } from "@/lib/scopes/templates/plastering";
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
  internalWallsScope,
  ceilingsScope,
  doorsScope,
  flooringScope,
  paintingScope,
  plasteringScope,
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
