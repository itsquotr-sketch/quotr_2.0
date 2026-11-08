/**
 * INTERNAL-WALLS-CORRECT-01B — same-product lining faces must SUM commercially.
 *
 * Calculator emits one priced line per lined face. Hosted estimate generation
 * then runs overlap exclusive-winner on overlapGroup|scopeKey. Same product
 * on Side A and Side B shares that identity, so Side B was discarded.
 *
 * Physical requirements stay face-specific (variantKey includes side).
 * Commercial grouping aggregates identical lining product lines and adds
 * quantities. Do not treat the second face as a duplicate of the first.
 */

import { aggregateSameIdentityCommercialLines } from "@/lib/estimate/commercial-aggregation";
import { presentAreaM2, round2 } from "@/lib/estimate/facts";
import { INTERNAL_WALLS_OPENING_AREA_PROVISIONAL } from "@/lib/estimate/internal-walls-scope";
import { isInternalWallsLiningComponentKey } from "@/lib/estimate/internal-walls-identities";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export function liningCommercialAggregateKey(
  item: Pick<
    EstimateLineItemInput,
    "workAreaId" | "overlapGroup" | "scopeKey" | "componentKey"
  >
): string | null {
  if (!isInternalWallsLiningComponentKey(item.componentKey)) return null;
  const scope = item.scopeKey ?? item.componentKey;
  if (!item.overlapGroup || !scope) return null;
  return `${item.workAreaId}::${item.overlapGroup}::${scope}`;
}

/**
 * Exclusive-winner quantity the hosted overlap pass used to keep.
 * Test-only proof of the CORRECT-01 hosted collapse.
 */
export function exclusiveOverlapWinnerItems(
  items: readonly EstimateLineItemInput[]
): EstimateLineItemInput[] {
  const winners = new Map<string, EstimateLineItemInput>();
  for (const item of items) {
    if (item.includedInTotal === false) continue;
    const key = liningCommercialAggregateKey(item);
    if (!key) continue;
    if (!winners.has(key)) winners.set(key, item);
  }
  return [...winners.values()];
}

export function aggregateInternalWallsLiningCommercialLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItemInput[] {
  return aggregateSameIdentityCommercialLines(items, {
    isEligible: (item) =>
      liningCommercialAggregateKey(item) != null &&
      item.includedInTotal !== false,
    groupingKey: liningCommercialAggregateKey,
    merge: mergeLiningCommercialLines,
  });
}

function mergeLiningCommercialLines(
  members: readonly EstimateLineItemInput[]
): EstimateLineItemInput {
  const first = members[0]!;
  const quantity = round2(
    members.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
  );
  const labourHours = round2(
    members.reduce((sum, item) => sum + Number(item.labourHours ?? 0), 0)
  );
  const supporting = mergeLiningSupporting(members);
  const labour = (first.componentKey ?? "").endsWith(".install");
  return {
    ...first,
    label: liningAggregateLabel(first.label, labour),
    quantity: labour ? labourHours : quantity,
    labourHours: labour ? labourHours : first.labourHours,
    recommendedCost: round2(
      members.reduce((sum, item) => sum + Number(item.recommendedCost ?? 0), 0)
    ),
    recommendedSell: round2(
      members.reduce((sum, item) => sum + Number(item.recommendedSell ?? 0), 0)
    ),
    grossProfit: round2(
      members.reduce((sum, item) => sum + Number(item.grossProfit ?? 0), 0)
    ),
    costLow: round2(
      members.reduce((sum, item) => sum + Number(item.costLow ?? 0), 0)
    ),
    costHigh: round2(
      members.reduce((sum, item) => sum + Number(item.costHigh ?? 0), 0)
    ),
    sellLow: round2(
      members.reduce((sum, item) => sum + Number(item.sellLow ?? 0), 0)
    ),
    sellHigh: round2(
      members.reduce((sum, item) => sum + Number(item.sellHigh ?? 0), 0)
    ),
    identitySummary: supporting,
    notes: supporting,
  };
}

function liningAggregateLabel(label: string, labour: boolean): string {
  if (labour) {
    return label.replace(/ — Side [AB] lining labour$/i, " — lining labour");
  }
  return label.replace(/ — Side [AB] lining$/i, " — lining");
}

function firstMatch(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function mergeLiningSupporting(
  members: readonly EstimateLineItemInput[]
): string {
  const texts = members.map(
    (item) => item.identitySummary ?? item.notes ?? ""
  );
  const installed = texts.reduce(
    (sum, text) => sum + firstMatch(text, /(\d+) sheets installed/),
    0
  );
  const purchase = texts.reduce(
    (sum, text) => sum + firstMatch(text, /(\d+) sheets incl\. waste/),
    0
  );
  const faceGross = texts.map((text) => firstMatch(text, /([\d.]+) m² gross/));
  const faceNet = texts.map((text) => firstMatch(text, /([\d.]+) m² net/));
  const faceOpening = texts.map((text) =>
    firstMatch(text, /([\d.]+) m² opening deduction/)
  );
  const sameFaces =
    texts.length > 1 &&
    faceGross.every((value) => value === faceGross[0]) &&
    faceNet.every((value) => value === faceNet[0]) &&
    faceOpening.every((value) => value === faceOpening[0]);
  const gross = faceGross.reduce((sum, value) => sum + value, 0);
  const net = faceNet.reduce((sum, value) => sum + value, 0);
  const opening = faceOpening.reduce((sum, value) => sum + value, 0);
  const hours = round2(
    members.reduce((sum, item) => sum + Number(item.labourHours ?? 0), 0)
  );
  const first = texts[0] ?? "";
  const productParts = first
    .split(" · ")
    .filter(
      (part) =>
        !/\d+ sheets installed/.test(part) &&
        !/\d+ sheets incl\. waste/.test(part) &&
        !/m² gross/.test(part) &&
        !/m² net/.test(part) &&
        !/m² opening deduction/.test(part) &&
        !/ × .+ m$/.test(part) &&
        !/sheets installed/.test(part)
    );
  if ((members[0]?.componentKey ?? "").endsWith(".install")) {
    return [
      "Both sides",
      installed > 0 ? `${installed} sheets installed` : null,
      hours > 0 ? `${hours} person-hours` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const provisional = texts.some((text) =>
    text.includes(INTERNAL_WALLS_OPENING_AREA_PROVISIONAL)
  );
  return [
    ...productParts.slice(0, 3),
    "Both sides",
    installed > 0 ? `${installed} sheets installed` : null,
    purchase > 0 ? `${purchase} sheets incl. waste` : null,
    sameFaces && (faceGross[0] ?? 0) > 0
      ? `${presentAreaM2(faceGross[0]!)} m² gross per face`
      : gross > 0
        ? `${presentAreaM2(gross)} m² gross`
        : null,
    sameFaces && (faceOpening[0] ?? 0) > 0
      ? `${presentAreaM2(faceOpening[0]!)} m² opening deduction per face`
      : opening > 0
        ? `${presentAreaM2(opening)} m² opening deduction`
        : null,
    sameFaces && (faceNet[0] ?? 0) > 0
      ? `${presentAreaM2(faceNet[0]!)} m² net per face`
      : net > 0
        ? `${presentAreaM2(net)} m² net`
        : null,
    provisional ? INTERNAL_WALLS_OPENING_AREA_PROVISIONAL : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
