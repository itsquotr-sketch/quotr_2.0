/**
 * Overview pricing notice.
 * Ownership comes from the unresolved requirement's Work Area type.
 * A single shared Ceiling sentence is not the fallback.
 */
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

const NOTICE_NAME_BY_TYPE: Record<string, string> = {
  cladding: "Cladding",
  ceilings: "Ceiling",
  flooring: "Flooring",
  doors: "Doors",
};

export function pricingNoticeForWorkAreaTypes(
  types: readonly string[]
): string | null {
  const unique = [
    ...new Set(types.map((type) => type.trim()).filter((type) => type.length > 0)),
  ];
  if (unique.length === 0) return null;
  if (unique.length > 1) return "Some items still require pricing.";
  const name = noticeName(unique[0]!);
  if (!name) return "Some items still require pricing.";
  return `Some ${name} items still require pricing.`;
}

function noticeName(type: string): string | null {
  if (NOTICE_NAME_BY_TYPE[type]) return NOTICE_NAME_BY_TYPE[type];
  const matches = SCOPE_CATALOGUE.filter((row) => row.type === type);
  if (matches.length !== 1) return null;
  return matches[0]?.label ?? null;
}
