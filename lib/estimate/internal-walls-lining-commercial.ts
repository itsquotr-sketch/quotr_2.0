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

import { round2 } from "@/lib/estimate/facts";
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
  const seen = new Set<string>();
  const groups = new Map<string, EstimateLineItemInput[]>();
  for (const item of items) {
    const key = liningCommercialAggregateKey(item);
    if (!key || item.includedInTotal === false) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const out: EstimateLineItemInput[] = [];
  for (const item of items) {
    const key = liningCommercialAggregateKey(item);
    if (!key || item.includedInTotal === false) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const members = groups.get(key) ?? [item];
    out.push(members.length === 1 ? item : mergeLiningCommercialLines(members));
  }
  return out;
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
  const gross = round2(
    texts.reduce(
      (sum, text) => sum + firstMatch(text, /([\d.]+) m² gross/),
      0
    )
  );
  const net = round2(
    texts.reduce((sum, text) => sum + firstMatch(text, /([\d.]+) m² net/), 0)
  );
  const opening = round2(
    texts.reduce(
      (sum, text) => sum + firstMatch(text, /([\d.]+) m² opening deduction/),
      0
    )
  );
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
  return [
    ...productParts.slice(0, 3),
    "Both sides",
    installed > 0 ? `${installed} sheets installed` : null,
    purchase > 0 ? `${purchase} sheets incl. waste` : null,
    gross > 0 ? `${gross} m² gross` : null,
    opening > 0 ? `${opening} m² opening deduction` : null,
    net > 0 ? `${net} m² net` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
