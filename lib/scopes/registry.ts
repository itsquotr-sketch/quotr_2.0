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

/**
 * Catalogue / discovery canonical ids → question-template Work Area types.
 * Stored WA `type` is not renamed; question lookup must resolve aliases so
 * baseline/catalogue identities still drive Scope Details (7F-R6-R1).
 */
export const QUESTION_TEMPLATE_TYPE_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    partitions: "internal_walls",
    linings: "plastering",
    wall_linings: "plastering",
    strip_out: "demolition",
    soft_strip: "demolition",
  });

export function resolveQuestionTemplateType(type: string): string {
  const normalized = type.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return QUESTION_TEMPLATE_TYPE_ALIASES[normalized] ?? normalized;
}

export function getScopeDefinition(type: string): ScopeDefinition | undefined {
  return scopeByType.get(resolveQuestionTemplateType(type));
}

export function getScopeQuestions(type: string): ScopeQuestionTemplate[] {
  return getScopeDefinition(type)?.questions ?? [];
}
