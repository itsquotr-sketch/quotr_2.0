/**
 * Legacy flat ceiling package: $75/m² materials and 0.9 h/m² installation.
 * Neither rate is an owner-approved workbook rate. A client Quote needs an
 * explicit Pricing decision for this pair. Named linings and nested portions
 * never use these component keys.
 */

import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";

export const CEILING_PROVISIONAL_MATERIALS_KEY = "ceilings.provisional.materials";
export const CEILING_PROVISIONAL_INSTALL_KEY = "ceilings.provisional.install";
export const CEILING_PROVISIONAL_MATERIALS_PER_M2 = 75;
export const CEILING_PROVISIONAL_INSTALL_HOURS_PER_M2 = 0.9;
export const CEILING_PROVISIONAL_SOURCE = "Provisional allowance";

export const CEILING_PROVISIONAL_SCOPE = {
  heading: "Provisional ceiling package",
  statement:
    "Flat ceiling area with no named lining. This is not a plasterboard sheet takeoff and not a complete specified assembly.",
  includes: [
    "Materials allowance of $75 per m² of the ceiling area. No product, thickness, or sheet count.",
    "Installation allowance of 0.9 person-hours per m² of the same area. This fallback has no workbook row. It is not the approved plasterboard rate of 0.4167 hours per sheet.",
  ],
  excludes: [
    "Named sheet or board supply",
    "Fixings",
    "Stopping or plastering",
    "Insulation",
    "Painting",
    "New framing, battens, or edge lining",
    "Demolition",
  ],
  excludesNote: "Those are included only when they appear as their own lines.",
  remains:
    "Use this provisional package for this job, or replace it with a specified lining and price.",
} as const;

export const CEILING_PROVISIONAL_MATERIALS_NOTE =
  "Provisional materials package at $75/m² for an unspecified ceiling. It is not a named lining, not a sheet takeoff, and not a company material rate. Source: Provisional allowance. Excludes named sheet or board supply, fixings, stopping, insulation, painting, new framing, battens, edge lining, and demolition unless those are their own lines. Review or replace it in Pricing.";

export const CEILING_PROVISIONAL_INSTALL_NOTE =
  "Provisional installation at 0.9 person-hours/m² for an unspecified ceiling. It has no workbook row. It is not the approved plasterboard rate of 0.4167 hours per sheet. Source: Provisional allowance. Stopping, fixings, insulation, and new framing are separate and are included only when selected.";

export const CEILING_PROVISIONAL_UNCONFIRMED_BLOCK =
  "Confirm the provisional ceiling package for this job, or replace it with a specified price, before creating a Quote.";

export const CEILING_PROVISIONAL_MISMATCH_BLOCK =
  "These ceiling lines no longer match the provisional package. Price the ceiling scope before creating a Quote.";

export const CEILING_PROVISIONAL_CONFIRM_LABEL =
  "Use this provisional package for this job";

export const CEILING_PROVISIONAL_REPLACE_HINT =
  "To price a specified lining, replace these lines in Pricing. Mark as reviewed does not confirm this package.";

export const CEILING_PROVISIONAL_CONFIRM_DENIED =
  "You do not have permission to confirm this Pricing draft.";

export const CEILING_PROVISIONAL_OTHER_ORG =
  "You cannot confirm Pricing for another organisation.";

export type CeilingProvisionalPricingLine = {
  id: string;
  componentKey: string | null;
  quantity: number | null;
  unit: string | null;
  description: string;
  totalCost: number;
  totalSell: number;
  visible: boolean;
  source: string;
  productivityRate: number | null;
  labourHours: number | null;
};

export type CeilingProvisionalConfirmation = {
  confirmedAt: string;
  confirmedBy: string;
  orgId: string;
  fingerprint: string;
};

export function isCeilingProvisionalComponentKey(
  componentKey: string | null | undefined
): boolean {
  return (
    componentKey === CEILING_PROVISIONAL_MATERIALS_KEY ||
    componentKey === CEILING_PROVISIONAL_INSTALL_KEY
  );
}

export function ceilingProvisionalAssumption(): string {
  return [
    CEILING_PROVISIONAL_SCOPE.statement,
    ...CEILING_PROVISIONAL_SCOPE.includes,
    `Not included: ${CEILING_PROVISIONAL_SCOPE.excludes.join("; ")}.`,
    CEILING_PROVISIONAL_SCOPE.excludesNote,
    CEILING_PROVISIONAL_SCOPE.remains,
  ].join(" ");
}

export function ceilingProvisionalLineFromPricingItem(item: {
  id: string;
  component_key?: string | null;
  quantity?: number | null;
  unit?: string | null;
  client_label?: string | null;
  internal_label?: string | null;
  client_description?: string | null;
  notes_internal?: string | null;
  total_cost?: number | null;
  total_sell?: number | null;
  visible_on_quote?: boolean | null;
  productivity_rate?: number | null;
  calculated_quantity?: number | null;
}): CeilingProvisionalPricingLine {
  const parsed = parseLineItemNotes(item.notes_internal);
  const label = (item.client_label || item.internal_label || "").trim();
  const description = [label, item.client_description, parsed.displayNotes]
    .filter((part) => part && part.trim())
    .join(" ")
    .trim();
  return {
    id: item.id,
    componentKey: item.component_key ?? null,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    description,
    totalCost: Number(item.total_cost ?? 0),
    totalSell: Number(item.total_sell ?? 0),
    visible: item.visible_on_quote !== false,
    source: provisionalSource(description),
    productivityRate: item.productivity_rate ?? null,
    labourHours: item.calculated_quantity ?? null,
  };
}

export function parseCeilingProvisionalConfirmation(
  value: unknown
): CeilingProvisionalConfirmation | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record) return null;
  const confirmedAt = text(record.confirmedAt);
  const confirmedBy = text(record.confirmedBy);
  const orgId = text(record.orgId);
  const fingerprint = text(record.fingerprint);
  if (!confirmedAt || !confirmedBy || !orgId || !fingerprint) return null;
  return { confirmedAt, confirmedBy, orgId, fingerprint };
}

export function ceilingProvisionalConfirmDenied(input: {
  canEdit: boolean;
  actorOrgId: string;
  documentOrgId: string;
}): string | null {
  if (input.actorOrgId !== input.documentOrgId) {
    return CEILING_PROVISIONAL_OTHER_ORG;
  }
  if (!input.canEdit) return CEILING_PROVISIONAL_CONFIRM_DENIED;
  return null;
}

export function ceilingProvisionalDecision(input: {
  lines: readonly CeilingProvisionalPricingLine[];
  confirmation: CeilingProvisionalConfirmation | null;
  documentOrgId: string;
}): {
  active: CeilingProvisionalPricingLine[];
  confirmable: boolean;
  confirmed: boolean;
  fingerprint: string;
  block: string | null;
} {
  const active = input.lines.filter(
    (line) => line.visible && isCeilingProvisionalComponentKey(line.componentKey)
  );
  const fingerprint = ceilingProvisionalFingerprint(active);
  const confirmable = canonicalProvisionalPair(active);
  const confirmed =
    confirmable &&
    confirmationIsCurrent(input.confirmation, fingerprint, input.documentOrgId);
  let block: string | null = null;
  if (active.length > 0 && !confirmable) {
    block = CEILING_PROVISIONAL_MISMATCH_BLOCK;
  } else if (active.length > 0 && !confirmed) {
    block = CEILING_PROVISIONAL_UNCONFIRMED_BLOCK;
  }
  return { active, confirmable, confirmed, fingerprint, block };
}

export function ceilingProvisionalStateAfterLineChange(input: {
  previousConfirmation: CeilingProvisionalConfirmation | null;
  lines: readonly CeilingProvisionalPricingLine[];
  documentOrgId: string;
  status: "draft" | "reviewed";
  regenerated?: boolean;
}): {
  confirmation: CeilingProvisionalConfirmation | null;
  status: "draft" | "reviewed";
  block: string | null;
} {
  const decision = ceilingProvisionalDecision({
    lines: input.lines,
    confirmation: input.previousConfirmation,
    documentOrgId: input.documentOrgId,
  });
  const drop =
    input.previousConfirmation != null &&
    (input.regenerated === true || !decision.confirmed);
  if (!drop) {
    return {
      confirmation: input.previousConfirmation,
      status: input.status,
      block: decision.block,
    };
  }
  const next = ceilingProvisionalDecision({
    lines: input.lines,
    confirmation: null,
    documentOrgId: input.documentOrgId,
  });
  return {
    confirmation: null,
    status: "draft",
    block: next.block,
  };
}

export function confirmCeilingProvisionalDraft<T>(input: {
  lines: readonly CeilingProvisionalPricingLine[];
  confirmation: CeilingProvisionalConfirmation | null;
  documentOrgId: string;
  actorOrgId: string;
  actorId: string;
  canEdit: boolean;
  now: string;
  issuedQuote: T;
  acceptedSnapshot: T;
  variation: T;
}): {
  error?: string;
  confirmation: CeilingProvisionalConfirmation | null;
  issuedQuote: T;
  acceptedSnapshot: T;
  variation: T;
} {
  const denied = ceilingProvisionalConfirmDenied(input);
  if (denied) {
    return {
      error: denied,
      confirmation: input.confirmation,
      issuedQuote: input.issuedQuote,
      acceptedSnapshot: input.acceptedSnapshot,
      variation: input.variation,
    };
  }
  const decision = ceilingProvisionalDecision({
    lines: input.lines,
    confirmation: input.confirmation,
    documentOrgId: input.documentOrgId,
  });
  if (!decision.confirmable) {
    return {
      error: decision.block ?? CEILING_PROVISIONAL_MISMATCH_BLOCK,
      confirmation: input.confirmation,
      issuedQuote: input.issuedQuote,
      acceptedSnapshot: input.acceptedSnapshot,
      variation: input.variation,
    };
  }
  if (decision.confirmed && input.confirmation) {
    return {
      confirmation: input.confirmation,
      issuedQuote: input.issuedQuote,
      acceptedSnapshot: input.acceptedSnapshot,
      variation: input.variation,
    };
  }
  return {
    confirmation: {
      confirmedAt: input.now,
      confirmedBy: input.actorId,
      orgId: input.documentOrgId,
      fingerprint: decision.fingerprint,
    },
    issuedQuote: input.issuedQuote,
    acceptedSnapshot: input.acceptedSnapshot,
    variation: input.variation,
  };
}

function ceilingProvisionalFingerprint(
  lines: readonly CeilingProvisionalPricingLine[]
): string {
  return [...lines]
    .sort((a, b) =>
      `${a.componentKey}:${a.id}`.localeCompare(`${b.componentKey}:${b.id}`)
    )
    .map((line) =>
      [
        line.id,
        line.componentKey,
        round2(line.quantity ?? 0),
        normalizeUnit(line.unit),
        line.description.trim(),
        round2(line.totalCost),
        round2(line.totalSell),
        line.visible ? "1" : "0",
        line.source,
        line.productivityRate == null ? "" : round2(line.productivityRate),
        line.labourHours == null ? "" : round2(line.labourHours),
      ].join("|")
    )
    .join("\n");
}

function canonicalProvisionalPair(
  active: readonly CeilingProvisionalPricingLine[]
): boolean {
  const materials = active.filter(
    (line) => line.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY
  );
  const install = active.filter(
    (line) => line.componentKey === CEILING_PROVISIONAL_INSTALL_KEY
  );
  if (materials.length !== 1 || install.length !== 1) return false;
  return (
    canonicalMaterials(materials[0]!) && canonicalInstall(install[0]!)
  );
}

function canonicalMaterials(line: CeilingProvisionalPricingLine): boolean {
  if (!isAreaUnit(line.unit) || !positive(line.quantity)) return false;
  if (!near(line.totalCost / line.quantity!, CEILING_PROVISIONAL_MATERIALS_PER_M2)) {
    return false;
  }
  if (line.source !== CEILING_PROVISIONAL_SOURCE) return false;
  return (
    line.description.includes("Provisional materials package") &&
    line.description.includes("not a sheet takeoff")
  );
}

function canonicalInstall(line: CeilingProvisionalPricingLine): boolean {
  if (!isAreaUnit(line.unit) || !positive(line.quantity)) return false;
  const hoursPerM2 =
    line.productivityRate ??
    (line.labourHours != null ? line.labourHours / line.quantity! : null);
  if (hoursPerM2 == null || !near(hoursPerM2, CEILING_PROVISIONAL_INSTALL_HOURS_PER_M2)) {
    return false;
  }
  if (line.source !== CEILING_PROVISIONAL_SOURCE) return false;
  return (
    line.description.includes("Provisional installation") &&
    line.description.includes("not the approved plasterboard rate")
  );
}

function confirmationIsCurrent(
  confirmation: CeilingProvisionalConfirmation | null,
  fingerprint: string,
  documentOrgId: string
): boolean {
  return (
    confirmation != null &&
    confirmation.orgId === documentOrgId &&
    confirmation.fingerprint === fingerprint
  );
}

function provisionalSource(description: string): string {
  return description.includes(CEILING_PROVISIONAL_SOURCE)
    ? CEILING_PROVISIONAL_SOURCE
    : "other";
}

function isAreaUnit(unit: string | null): boolean {
  const normalized = normalizeUnit(unit);
  return normalized === "m²" || normalized === "m2" || normalized === "sqm";
}

function normalizeUnit(unit: string | null): string {
  return (unit ?? "").replace(/\s/g, "").toLowerCase();
}

function positive(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function near(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Math.abs(actual - expected) < 0.02;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
