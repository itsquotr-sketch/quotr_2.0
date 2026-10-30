/**
 * Project-level preliminaries.
 *
 * One identity per shared task. Not a markup, and not a copy inside each
 * work area. Provisional is a status, not a cost category.
 * Duration, visits and dollar amounts are never invented.
 */

import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { round2 } from "@/lib/estimate/facts";
import { buildAmounts } from "@/lib/estimate/line-items";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import {
  APPRENTICE_LABOUR_RATE_KEY,
  CARPENTER_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "@/lib/estimate/labour-trade-mapping";
import { quotrFallbackSellFromCost, resolveLabourRate } from "@/lib/estimate/rates";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
  LineItemCategory,
} from "@/lib/estimate/types";
import type { CalculatorResult } from "@/lib/estimate/types";

export const PRELIMINARIES_WORK_AREA_TYPE = "preliminaries" as const;
export const PRELIMINARIES_WORK_AREA_NAME = "Preliminaries" as const;
export const PRELIMINARIES_FACT_KEY = "preliminaries.plan" as const;

export const PRELIMINARY_CATALOGUE = [
  {
    id: "site_establishment",
    label: "Site establishment",
    description: "Set up the site for this project.",
  },
  {
    id: "common_area_protection",
    label: "Common-area protection",
    description: "Protect shared or common areas while the work is underway.",
  },
  {
    id: "daily_cleaning",
    label: "Daily cleaning",
    description: "Clean the work area at the end of each working day.",
  },
  {
    id: "final_cleaning",
    label: "Final cleaning",
    description: "Clean the finished work before handover.",
  },
  {
    id: "deliveries",
    label: "Deliveries",
    description: "Deliver materials or plant to the site.",
  },
  {
    id: "supervision",
    label: "Supervision",
    description: "Supervise the work on site.",
  },
  {
    id: "stair_protection",
    label: "Stair protection",
    description: "Protect stairs that the work uses or passes.",
  },
] as const;

export type CataloguePreliminaryId = (typeof PRELIMINARY_CATALOGUE)[number]["id"];
export type PreliminaryTreatment = "requested" | "included" | "excluded";
export type PreliminaryBasis =
  | "unresolved"
  | "fixed"
  | "labour_hours"
  | "occurrences"
  | "recurring_labour";
export type PreliminaryRole = "carpenter" | "labourer" | "apprentice";

export type PreliminaryItem = {
  id: string;
  label: string;
  description: string;
  treatment: PreliminaryTreatment;
  provisional: boolean;
  basis: PreliminaryBasis;
  fixedCost: number | null;
  materialCost: number | null;
  labourCost: number | null;
  hours: number | null;
  role: PreliminaryRole | null;
  occurrences: number | null;
  occurrenceUnit: string | null;
  unitCost: number | null;
  hoursPerOccurrence: number | null;
  hourlyCostOverride: number | null;
  overlapAcknowledged: boolean;
};

export type PreliminaryIdentityReview = {
  id: "cleaning_identity" | "protection_identity";
  label: string;
  detail: string;
  /** True only after someone decides the other mention is a different service. */
  separate: boolean;
};

export type PreliminaryDescription = {
  role: "project" | "trade";
  text: string;
};

export type PreliminariesPlan = {
  items: PreliminaryItem[];
  /** Absent on plans saved before identity review. */
  reviews?: PreliminaryIdentityReview[];
  deliveryWindow: string | null;
};

const CATALOGUE_BY_ID = new Map(
  PRELIMINARY_CATALOGUE.map((row) => [row.id, row])
);

/**
 * Another line overlaps only when its stable identity is one of these.
 * A similar label is not enough, and an occupied-site labour modifier is not.
 */
const OVERLAP_IDENTITIES: Record<string, readonly string[]> = {
  site_establishment: ["project.site_setup"],
  common_area_protection: ["project.protection.allowance"],
  daily_cleaning: ["project.setup_cleanup"],
  final_cleaning: ["project.final_cleaning"],
  deliveries: ["project.delivery.cost", "logistics.delivery"],
  supervision: ["project.supervision.allowance"],
  stair_protection: ["project.stair_protection.allowance"],
};

function blankItem(
  id: string,
  label: string,
  description: string
): PreliminaryItem {
  return {
    id,
    label,
    description,
    treatment: "requested",
    provisional: false,
    basis: "unresolved",
    fixedCost: null,
    materialCost: null,
    labourCost: null,
    hours: null,
    role: null,
    occurrences: null,
    occurrenceUnit: null,
    unitCost: null,
    hoursPerOccurrence: null,
    hourlyCostOverride: null,
    overlapAcknowledged: false,
  };
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function catalogueItem(id: string): PreliminaryItem | null {
  const row = CATALOGUE_BY_ID.get(id as CataloguePreliminaryId);
  if (!row) return null;
  return blankItem(row.id, row.label, row.description);
}

export function parsePreliminaryItem(value: unknown): PreliminaryItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = textOrNull(row.id);
  const label = textOrNull(row.label);
  if (!id || !label) return null;
  const catalogue = catalogueItem(id);
  const treatment = row.treatment;
  const basis = row.basis;
  const role = row.role;
  return {
    id,
    label,
    description: textOrNull(row.description) ?? catalogue?.description ?? label,
    treatment:
      treatment === "included" || treatment === "excluded" || treatment === "requested"
        ? treatment
        : "requested",
    provisional: row.provisional === true,
    basis:
      basis === "fixed" ||
      basis === "labour_hours" ||
      basis === "occurrences" ||
      basis === "recurring_labour" ||
      basis === "unresolved"
        ? basis
        : "unresolved",
    fixedCost: finiteOrNull(row.fixedCost),
    materialCost: finiteOrNull(row.materialCost),
    labourCost: finiteOrNull(row.labourCost),
    hours: finiteOrNull(row.hours),
    role:
      role === "carpenter" || role === "labourer" || role === "apprentice"
        ? role
        : null,
    occurrences: finiteOrNull(row.occurrences),
    occurrenceUnit: textOrNull(row.occurrenceUnit),
    unitCost: finiteOrNull(row.unitCost),
    hoursPerOccurrence: finiteOrNull(row.hoursPerOccurrence),
    hourlyCostOverride: finiteOrNull(row.hourlyCostOverride),
    overlapAcknowledged: row.overlapAcknowledged === true,
  };
}

export function parsePreliminariesPlan(value: unknown): PreliminariesPlan | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.items)) return null;
  const items: PreliminaryItem[] = [];
  const seen = new Set<string>();
  for (const entry of row.items) {
    const item = parsePreliminaryItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return {
    items,
    reviews: parseIdentityReviews(row.reviews),
    deliveryWindow: textOrNull(row.deliveryWindow),
  };
}

function parseIdentityReviews(value: unknown): PreliminaryIdentityReview[] {
  if (!Array.isArray(value)) return [];
  const reviews: PreliminaryIdentityReview[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = row.id === "cleaning_identity" || row.id === "protection_identity" ? row.id : null;
    if (!id || reviews.some((review) => review.id === id)) continue;
    reviews.push({
      id,
      label: textOrNull(row.label) ?? (id === "cleaning_identity" ? "Cleaning identity" : "Protection identity"),
      detail:
        textOrNull(row.detail) ??
        "This mention may be the same service. Confirm it is different before charging it.",
      separate: row.separate === true,
    });
  }
  return reviews;
}

export function emptyPreliminariesPlan(): PreliminariesPlan {
  return { items: [], reviews: [], deliveryWindow: null };
}

function normaliseBrief(brief: string): string {
  return brief.toLowerCase().replace(/\s+/g, " ");
}

export function recognisePreliminaries(brief: string): PreliminariesPlan {
  const text = normaliseBrief(brief);
  const items: PreliminaryItem[] = [];
  const add = (id: CataloguePreliminaryId) => {
    if (items.some((row) => row.id === id)) return;
    const row = catalogueItem(id);
    if (row) items.push(row);
  };
  if (/\bsite establishment\b/.test(text)) add("site_establishment");
  if (
    /\bprotection of common areas\b|\bcommon-area protection\b|\bcommon area protection\b/.test(text) ||
    /\bcommon areas?\b[^.]*\bprotect/.test(text) ||
    /\bprotect(?:ion|ed|ing)?\b[^.]*\bcommon areas?\b/.test(text)
  ) {
    add("common_area_protection");
  }
  if (
    /\bdaily cleaning\b|\bdaily cleanup\b|\bclean up daily\b|\bclean up each day\b/.test(text) ||
    /\bclean\b[^.]*\bend of (?:each|every) (?:working )?day\b/.test(text) ||
    /\bend of (?:each|every) (?:working )?day\b[^.]*\bclean/.test(text)
  ) {
    add("daily_cleaning");
  }
  if (/\bfinal cleaning\b/.test(text)) add("final_cleaning");
  if (/\bsupervision\b/.test(text)) add("supervision");
  if (/\bprotect(?:ion)?\b[^.]*\bstairs?\b|\bstairs?\b[^.]*\bprotect/.test(text)) {
    add("stair_protection");
  }
  const deliveryWindow = /\b(?:booked )?delivery windows?\b|\bgoods lift\b/.test(text)
    ? "Delivery is limited to booked windows. That restriction is not a delivery charge."
    : null;
  const asksForDeliveryService =
    /\bdeliveries\b/.test(text) || /\bdelivery service\b/.test(text);
  if (asksForDeliveryService) add("deliveries");
  return { items, reviews: [], deliveryWindow };
}

const CLEANING_IDS = new Set<string>(["daily_cleaning", "final_cleaning"]);
const PROTECTION_IDS = new Set<string>(["common_area_protection", "stair_protection"]);

function descriptionSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function uncertainFamilies(sentence: string): Array<"cleaning" | "protection"> {
  if (recognisePreliminaries(sentence).items.length > 0) return [];
  const families: Array<"cleaning" | "protection"> = [];
  if (/\bclean(?:ing|up|ed)?\b|\bclean up\b/i.test(sentence)) families.push("cleaning");
  if (/\bprotect(?:ion|ed|ing|s)?\b/i.test(sentence)) families.push("protection");
  return families;
}

function familyNeedsReview(
  family: "cleaning" | "protection",
  specific: { project: Set<string>; trade: Set<string> },
  uncertain: { project: Set<"cleaning" | "protection">; trade: Set<"cleaning" | "protection"> }
): boolean {
  const ids = family === "cleaning" ? CLEANING_IDS : PROTECTION_IDS;
  const projectSpecific = [...specific.project].some((id) => ids.has(id));
  const tradeSpecific = [...specific.trade].some((id) => ids.has(id));
  const projectUncertain = uncertain.project.has(family);
  const tradeUncertain = uncertain.trade.has(family);
  if (projectUncertain && tradeSpecific) return true;
  if (tradeUncertain && projectSpecific) return true;
  if (projectUncertain && tradeUncertain && !projectSpecific && !tradeSpecific) return true;
  return false;
}

function identityReview(
  id: "cleaning_identity" | "protection_identity"
): PreliminaryIdentityReview {
  const cleaning = id === "cleaning_identity";
  return {
    id,
    label: cleaning ? "Cleaning identity" : "Protection identity",
    detail: cleaning
      ? "Cleaning is mentioned in the project and in a trade description, and it is not clear they are the same service. Confirm it is different before charging both."
      : "Protection is mentioned in the project and in a trade description, and it is not clear they are the same service. Confirm it is different before charging both.",
    separate: false,
  };
}

/**
 * One item per specific service. The same daily cleaning or protection
 * named in the project and in a trade stays one item. Daily and final
 * cleaning stay separate, as do stair and common-area protection.
 * An uncertain second mention is a review, not a second charge.
 */
export function planFromDescriptions(
  sources: readonly PreliminaryDescription[]
): PreliminariesPlan {
  const items: PreliminaryItem[] = [];
  const seen = new Set<string>();
  const specific = {
    project: new Set<string>(),
    trade: new Set<string>(),
  };
  const uncertain = {
    project: new Set<"cleaning" | "protection">(),
    trade: new Set<"cleaning" | "protection">(),
  };
  let deliveryWindow: string | null = null;
  for (const source of sources) {
    const text = source.text.trim();
    if (!text) continue;
    const recognised = recognisePreliminaries(text);
    if (!deliveryWindow && recognised.deliveryWindow) {
      deliveryWindow = recognised.deliveryWindow;
    }
    for (const item of recognised.items) {
      specific[source.role].add(item.id);
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    for (const sentence of descriptionSentences(text)) {
      for (const family of uncertainFamilies(sentence)) {
        uncertain[source.role].add(family);
      }
    }
  }
  const reviews: PreliminaryIdentityReview[] = [];
  if (familyNeedsReview("cleaning", specific, uncertain)) {
    reviews.push(identityReview("cleaning_identity"));
  }
  if (familyNeedsReview("protection", specific, uncertain)) {
    reviews.push(identityReview("protection_identity"));
  }
  return { items, reviews, deliveryWindow };
}

export function mergePreliminaries(
  saved: PreliminariesPlan | null,
  recognised: PreliminariesPlan
): PreliminariesPlan {
  const items = [...(saved?.items ?? [])];
  const seen = new Set(items.map((row) => row.id));
  for (const item of recognised.items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  const reviews = [...(saved?.reviews ?? [])];
  const recognisedIds = new Set((recognised.reviews ?? []).map((review) => review.id));
  for (const review of recognised.reviews ?? []) {
    if (reviews.some((row) => row.id === review.id)) continue;
    reviews.push(review);
  }
  return {
    items,
    reviews: reviews.filter((review) => review.separate || recognisedIds.has(review.id)),
    deliveryWindow: saved?.deliveryWindow ?? recognised.deliveryWindow,
  };
}

export function planFromFacts(
  facts: readonly EstimateFact[],
  briefText?: string | null,
  tradeDescriptions: readonly string[] = []
): PreliminariesPlan {
  const stored = facts.find(
    (fact) => fact.work_area_id == null && fact.key === PRELIMINARIES_FACT_KEY
  );
  const saved = parsePreliminariesPlan(stored?.value);
  const sources: PreliminaryDescription[] = [];
  if (briefText?.trim()) sources.push({ role: "project", text: briefText });
  for (const fact of facts) {
    if (!fact.key.endsWith(".coverage_note") || typeof fact.value !== "string") continue;
    sources.push({
      role: fact.work_area_id ? "trade" : "project",
      text: fact.value,
    });
  }
  for (const text of tradeDescriptions) {
    if (text.trim()) sources.push({ role: "trade", text });
  }
  return mergePreliminaries(saved, planFromDescriptions(sources));
}

export function additionalIdentityItem(
  review: PreliminaryIdentityReview
): PreliminaryItem {
  if (review.id === "cleaning_identity") {
    return blankItem(
      "additional_cleaning",
      "Additional cleaning",
      "A trade description mentions cleaning that may be a different service."
    );
  }
  return blankItem(
    "additional_protection",
    "Additional protection",
    "A trade description mentions protection that may be a different service."
  );
}

export function newCustomPreliminary(label: string): PreliminaryItem | null {
  const trimmed = label.trim();
  if (trimmed.length < 2) return null;
  return blankItem(`custom_${crypto.randomUUID()}`, trimmed, trimmed);
}

type LabourQuote = {
  hourlyCost: number;
  sourceLabel: string;
  sourceType: "user_rate" | "project_override";
  role: PreliminaryRole;
  itemKey: string;
};

export function preliminaryRoleItemKey(role: PreliminaryRole): string {
  if (role === "labourer") return LABOURER_LABOUR_RATE_KEY;
  if (role === "apprentice") return APPRENTICE_LABOUR_RATE_KEY;
  return CARPENTER_LABOUR_RATE_KEY;
}

export function preliminaryRoleLabel(role: PreliminaryRole): string {
  if (role === "labourer") return "Labourer";
  if (role === "apprentice") return "Apprentice";
  return "Carpenter";
}

/** The hourly cost generation will use for this role. A benchmark is not used. */
export function preliminaryLabourRate(params: {
  item: Pick<PreliminaryItem, "role" | "hourlyCostOverride">;
  rates: OrganisationRate[];
  settings: OrganisationSettings | null;
}): LabourQuote | null {
  const role = params.item.role ?? "carpenter";
  if (params.item.hourlyCostOverride != null && params.item.hourlyCostOverride > 0) {
    return {
      hourlyCost: params.item.hourlyCostOverride,
      sourceLabel: "Project hourly cost",
      sourceType: "project_override",
      role,
      itemKey: preliminaryRoleItemKey(role),
    };
  }
  const resolved = resolveLabourRate({
    rates: params.rates,
    organisationSettings: params.settings,
    trade: role === "carpenter" ? undefined : role,
  });
  if (resolved.sourceType !== "user_rate" || !(resolved.costRate > 0)) {
    return null;
  }
  return {
    hourlyCost: resolved.costRate,
    sourceLabel: resolved.sourceLabel,
    sourceType: "user_rate",
    role,
    itemKey: preliminaryRoleItemKey(role),
  };
}

export type PreliminaryQuote = {
  formula: string;
  cost: number | null;
  category: LineItemCategory;
  quantity: number | null;
  unit: string | null;
  hours: number | null;
  hourlyCost: number | null;
  sourceLabel: string;
  itemKey: string | null;
  materialCost: number | null;
  labourCost: number | null;
  unresolvedReason: string | null;
};

export function quotePreliminary(
  item: PreliminaryItem,
  rates: OrganisationRate[],
  settings: OrganisationSettings | null
): PreliminaryQuote {
  const unresolved = (reason: string): PreliminaryQuote => ({
    formula: reason,
    cost: null,
    category: "allowance",
    quantity: null,
    unit: null,
    hours: null,
    hourlyCost: null,
    sourceLabel: "Pricing required",
    itemKey: null,
    materialCost: null,
    labourCost: null,
    unresolvedReason: reason,
  });

  if (item.basis === "unresolved" || item.treatment === "requested") {
    return unresolved(
      "A quantity and rate are still required. Coverage is unresolved."
    );
  }
  if (item.basis === "fixed") {
    const material = item.materialCost;
    const labour = item.labourCost;
    if (material != null && labour != null) {
      const cost = round2(material + labour);
      return {
        formula: `Materials ${money(material)} + labour ${money(labour)} = ${money(cost)}.`,
        cost,
        category: "mixed",
        quantity: 1,
        unit: "allow",
        hours: null,
        hourlyCost: null,
        sourceLabel: "Entered amount",
        itemKey: null,
        materialCost: material,
        labourCost: labour,
        unresolvedReason: null,
      };
    }
    if (item.fixedCost == null) {
      return unresolved("A fixed cost is still required. Coverage is unresolved.");
    }
    return {
      formula: `Fixed cost ${money(item.fixedCost)}. This is a combined amount, not materials or labour.`,
      cost: item.fixedCost,
      category: "allowance",
      quantity: 1,
      unit: "allow",
      hours: null,
      hourlyCost: null,
      sourceLabel: "Entered amount",
      itemKey: null,
      materialCost: null,
      labourCost: null,
      unresolvedReason: null,
    };
  }
  const labour = preliminaryLabourRate({ item, rates, settings });
  if (item.basis === "labour_hours") {
    if (item.hours == null || item.hours <= 0) {
      return unresolved("Labour hours are still required. Coverage is unresolved.");
    }
    if (!labour) {
      return unresolved(
        "A company labour rate or a project hourly cost is still required. Coverage is unresolved."
      );
    }
    const cost = round2(item.hours * labour.hourlyCost);
    return {
      formula: `${item.hours} h × ${money(labour.hourlyCost)}/h (${labour.sourceLabel}, ${preliminaryRoleLabel(labour.role)}).`,
      cost,
      category: "labour",
      quantity: item.hours,
      unit: "h",
      hours: item.hours,
      hourlyCost: labour.hourlyCost,
      sourceLabel: labour.sourceLabel,
      itemKey: labour.itemKey,
      materialCost: null,
      labourCost: cost,
      unresolvedReason: null,
    };
  }
  if (item.basis === "occurrences") {
    if (item.occurrences == null || item.occurrences <= 0 || item.unitCost == null) {
      return unresolved(
        "The number of occurrences and a unit cost are still required. Coverage is unresolved."
      );
    }
    const unit = item.occurrenceUnit ?? "each";
    const cost = round2(item.occurrences * item.unitCost);
    return {
      formula: `${item.occurrences} ${unit} × ${money(item.unitCost)}/${unit}.`,
      cost,
      category: "allowance",
      quantity: item.occurrences,
      unit,
      hours: null,
      hourlyCost: null,
      sourceLabel: "Entered amount",
      itemKey: null,
      materialCost: null,
      labourCost: null,
      unresolvedReason: null,
    };
  }
  if (item.occurrences == null || item.occurrences <= 0 || item.hoursPerOccurrence == null || item.hoursPerOccurrence <= 0) {
    return unresolved(
      "Occurrences and hours per occurrence are still required. Coverage is unresolved."
    );
  }
  if (!labour) {
    return unresolved(
      "A company labour rate or a project hourly cost is still required. Coverage is unresolved."
    );
  }
  const hours = round2(item.occurrences * item.hoursPerOccurrence);
  const unit = item.occurrenceUnit ?? "day";
  const cost = round2(hours * labour.hourlyCost);
  return {
    formula: `${item.occurrences} ${unit} × ${item.hoursPerOccurrence} h × ${money(labour.hourlyCost)}/h (${labour.sourceLabel}, ${preliminaryRoleLabel(labour.role)}).`,
    cost,
    category: "labour",
    quantity: item.occurrences,
    unit,
    hours,
    hourlyCost: labour.hourlyCost,
    sourceLabel: labour.sourceLabel,
    itemKey: labour.itemKey,
    materialCost: null,
    labourCost: cost,
    unresolvedReason: null,
  };
}

function money(value: number): string {
  return `$${round2(value).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function overlappingIdentity(
  item: PreliminaryItem,
  siblingLines: readonly EstimateLineItemInput[]
): string | null {
  const keys = OVERLAP_IDENTITIES[item.id] ?? [];
  if (keys.length === 0) return null;
  for (const line of siblingLines) {
    const identity = line.scopeKey ?? line.componentKey ?? "";
    if (keys.includes(identity)) return identity;
  }
  return null;
}

export function calculatePreliminaries(
  context: Pick<EstimateContext, "facts" | "organisationSettings" | "rates" | "briefText"> & {
    confirmedWorkAreas?: readonly EstimateWorkArea[];
  },
  workArea: EstimateWorkArea,
  siblingLines: readonly EstimateLineItemInput[] = []
): CalculatorResult {
  const tradeDescriptions = (context.confirmedWorkAreas ?? [])
    .map((area) => area.quoteDescription?.trim() ?? "")
    .filter((text) => text.length > 0);
  const plan = planFromFacts(context.facts, context.briefText, tradeDescriptions);
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  const exclusions: string[] = [];
  let sortOrder = workArea.sort_order * 100;

  if (plan.deliveryWindow) {
    assumptions.push(plan.deliveryWindow);
  }
  if (plan.items.length > 0) {
    assumptions.push(
      "Occupied-site labour adjustments are not payment for protection, supervision or daily cleaning."
    );
  }

  const reviews = plan.reviews ?? [];
  const heldUntilSeparate = new Set(
    reviews
      .filter((review) => !review.separate)
      .map((review) => additionalIdentityItem(review).id)
  );
  for (const review of reviews) {
    if (review.separate) continue;
    missingInfo.push(review.detail);
    lineItems.push(
      unresolvedLine(
        workArea,
        blankItem(review.id, review.label, review.detail),
        review.detail,
        sortOrder++
      )
    );
  }

  for (const item of plan.items) {
    if (heldUntilSeparate.has(item.id)) continue;
    if (item.treatment === "excluded") {
      exclusions.push(`${item.label} is excluded from this job.`);
      continue;
    }
    const overlap = overlappingIdentity(item, siblingLines);
    const quote = quotePreliminary(item, context.rates, context.organisationSettings);
    const blockedByOverlap = overlap != null && !item.overlapAcknowledged;
    const unresolved = quote.unresolvedReason != null || blockedByOverlap || item.treatment === "requested";
    const reason = blockedByOverlap
      ? `${item.label} may overlap ${overlap}. Confirm whether this is the same cost before pricing it. Coverage is unresolved.`
      : quote.unresolvedReason ??
        "A quantity and rate are still required. Coverage is unresolved.";
    if (unresolved) {
      missingInfo.push(`${item.label} is requested. ${reason}`);
      lineItems.push(
        unresolvedLine(workArea, item, reason, sortOrder++)
      );
      continue;
    }
    const cost = quote.cost ?? 0;
    const sell = quotrFallbackSellFromCost(cost, context.organisationSettings);
    const status = item.provisional ? "Provisional." : "Included.";
    const notes = [item.description, quote.formula, status].join(" ");
    lineItems.push({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: item.label,
      category: quote.category,
      quantity: quote.quantity ?? 1,
      unit: quote.unit ?? "allow",
      labourHours: quote.hours ?? undefined,
      itemKey: quote.itemKey ?? undefined,
      productivityRate:
        item.basis === "recurring_labour" ? item.hoursPerOccurrence ?? undefined : undefined,
      productivityUnit: item.basis === "recurring_labour" ? quote.unit ?? undefined : undefined,
      costRate: quote.hourlyCost ?? (quote.quantity ? round2(cost / quote.quantity) : cost),
      sellRate: quote.quantity ? round2(sell / quote.quantity) : sell,
      rateSource: item.provisional
        ? `${quote.sourceLabel} · provisional`
        : quote.sourceLabel,
      rateSourceType: quote.sourceLabel === "Entered amount" ? "default" : "user_rate",
      sellDerivedFromMargin: true,
      sellAuthority: "derived_from_gross_margin",
      notes,
      identitySummary: `${item.label}. ${quote.formula}`,
      scopeKey: `preliminaries.${item.id}`,
      componentKey: `preliminaries.${item.id}`,
      includedInTotal: true,
      clientVisible: true,
      provisional: item.provisional,
      quantityBasis: {
        sourceFact: `preliminaries.${item.id}`,
        sourceLabel: item.label,
        quantity: quote.quantity ?? 1,
        unit: quote.unit ?? "allow",
        formula: quote.formula,
        confidence: item.provisional ? "assumed" : "confirmed",
      },
      costComponents:
        quote.materialCost != null || quote.labourCost != null
          ? {
              materialCost: quote.materialCost ?? undefined,
              labourCost: quote.labourCost ?? undefined,
            }
          : undefined,
      sortOrder: sortOrder++,
      ...buildAmounts(cost, sell, context.organisationSettings),
    });
    if (item.provisional) {
      assumptions.push(`${item.label} is a provisional allowance. ${quote.formula}`);
    }
  }

  if (plan.items.some((item) => item.treatment !== "excluded")) {
    assumptions.push(
      "Preliminaries are project-wide. They are not repeated inside each work area."
    );
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: 70,
  };
}

function unresolvedLine(
  workArea: EstimateWorkArea,
  item: PreliminaryItem,
  reason: string,
  sortOrder: number
): EstimateLineItemInput {
  return {
    workAreaId: workArea.id,
    workAreaName: workArea.name,
    label: item.label,
    category: "allowance",
    quantity: 1,
    unit: "allow",
    notes: `${item.description} ${reason}`,
    identitySummary: reason,
    rateSource: "Pricing required",
    rateSourceType: "missing",
    scopeKey: `preliminaries.${item.id}`,
    componentKey: `preliminaries.${item.id}`,
    includedInTotal: false,
    clientVisible: false,
    provisional: item.provisional,
    quantityBasis: {
      sourceFact: `preliminaries.${item.id}`,
      sourceLabel: item.label,
      quantity: 1,
      unit: "allow",
      formula: reason,
    },
    sortOrder,
    ...buildAmounts(0, 0, null),
  };
}

export function customerScopeFromPreliminaryLines(
  lines: readonly { label: string; notes: string | null }[]
): string | null {
  const included: string[] = [];
  const provisional: string[] = [];
  const unresolved: string[] = [];
  for (const line of lines) {
    const parsed = parseLineItemNotes(line.notes);
    const scope = parsed.metadata.scopeKey ?? "";
    if (!scope.startsWith("preliminaries.")) continue;
    if (parsed.metadata.includedInTotal === false) unresolved.push(line.label);
    else if (parsed.metadata.provisional === true) provisional.push(line.label);
    else included.push(line.label);
  }
  const parts = [
    included.length > 0 ? `Included preliminaries: ${included.join(", ")}.` : "",
    provisional.length > 0 ? `Provisional preliminaries: ${provisional.join(", ")}.` : "",
    unresolved.length > 0
      ? `Requested and not yet priced: ${unresolved.join(", ")}.`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
