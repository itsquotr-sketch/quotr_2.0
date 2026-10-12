/**
 * A saved deck draft can still carry a spacing-layout count after the
 * brief's pile count became authoritative. This compares the saved lines
 * with that count and describes the change. It does not write an estimate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { newSubstructureIncluded } from "@/lib/estimate/deck-scope-2c";
import {
  deckHoleStampsDiffer,
  describeDeckHoleStamp,
  planDeckHoleExcavation,
} from "@/lib/estimate/deck-hole-excavation";
import { getNumberFact, round2 } from "@/lib/estimate/facts";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import type { DeckHoleDraftStamp } from "@/lib/estimate/line-item-metadata";
import type { EstimateFact } from "@/lib/estimate/types";

export type DeckSavedLine = {
  readonly label?: string | null;
  readonly componentKey?: string | null;
  readonly quantity?: number | null;
  readonly unit?: string | null;
  readonly labourHours?: number | null;
  readonly holeDraft?: DeckHoleDraftStamp | null;
};

export type DeckQuantityChange = {
  readonly label: string;
  readonly unit: string;
  readonly from: number;
  readonly to: number;
};

export type DeckStatedCountConflict = {
  readonly statedCount: number;
  readonly authoritativeCount: number;
  readonly savedCount: number;
  readonly changes: readonly DeckQuantityChange[];
  readonly summary: string;
};

const INSTALL_KEY = "deck.posts.install";
const HOLE_KEY = "deck.hole.excavate";
const BAG_KEY = "deck.concrete.bags";
const PLACE_KEY = "deck.concrete.place";
const PILE_KEY = "deck.supports";

function close(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function line(
  lines: readonly DeckSavedLine[],
  componentKey: string,
  label: string
): DeckSavedLine | undefined {
  return lines.find(
    (item) =>
      item.componentKey === componentKey ||
      (item.label ?? "").trim() === label
  );
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function deckStatedCountConflict(input: {
  facts: readonly EstimateFact[];
  lines: readonly DeckSavedLine[];
}): DeckStatedCountConflict | null {
  const statedFact = input.facts.find(
    (fact) => fact.key === "deck.pile_or_post_count" && fact.work_area_id
  );
  const workAreaId = statedFact?.work_area_id;
  if (!workAreaId) return null;
  const facts = [...input.facts];
  if (!newSubstructureIncluded(facts, workAreaId)) return null;

  const stated = getNumberFact(facts, workAreaId, "deck.pile_or_post_count");
  if (stated == null || stated <= 0) return null;
  const bearerRows = getNumberFact(facts, workAreaId, "deck.bearer_row_count");
  const supportsPerBearer = getNumberFact(
    facts,
    workAreaId,
    "deck.supports_per_bearer"
  );
  const layoutConfirmed = bearerRows != null && supportsPerBearer != null;
  const authoritative = layoutConfirmed
    ? Math.round(bearerRows * supportsPerBearer)
    : Math.round(stated);

  const install = line(input.lines, INSTALL_KEY, "Pile/post installation");
  const savedCount = finite(install?.quantity);
  const changes: DeckQuantityChange[] = [];
  let countSummary: string | null = null;
  if (savedCount != null && !close(savedCount, authoritative)) {
  changes.push({
    label: "Pile/post installation",
    unit: "ea",
    from: savedCount,
    to: authoritative,
  });
  const holes = line(input.lines, HOLE_KEY, "Hole excavation");
  const savedHoles = finite(holes?.quantity);
  if (savedHoles != null && !close(savedHoles, authoritative)) {
    changes.push({
      label: "Hole excavation",
      unit: "hole",
      from: savedHoles,
      to: authoritative,
    });
  }
  const bagPlan = planDeckHoleExcavation({
    facts,
    workAreaId,
    holeCount: authoritative,
  });
  const nextBags = bagPlan.concrete.included ? bagPlan.concrete.bags : 0;
  const bags = line(input.lines, BAG_KEY, "Post-hole concrete");
  const savedBags = finite(bags?.quantity);
  if (savedBags != null && !close(savedBags, nextBags)) {
    changes.push({
      label: "Post-hole concrete",
      unit: "bag",
      from: savedBags,
      to: nextBags,
    });
  }
  const piles = line(input.lines, PILE_KEY, "Piles / posts");
  const savedPiles = finite(piles?.quantity);
  if (
    savedPiles != null &&
    savedCount > 0 &&
    (piles?.unit ?? "lm") === "lm"
  ) {
    const nextPiles = round2((savedPiles / savedCount) * authoritative);
    if (!close(savedPiles, nextPiles)) {
      changes.push({
        label: "Piles / posts",
        unit: "lm",
        from: savedPiles,
        to: nextPiles,
      });
    }
  }
  const place = line(input.lines, PLACE_KEY, "Concrete placement");
  const savedHours = finite(place?.labourHours);
  if (savedBags != null && savedBags > 0 && savedHours != null && nextBags > 0) {
    const nextHours = round2((savedHours / savedBags) * nextBags);
    if (!close(savedHours, nextHours)) {
      changes.push({
        label: "Concrete placement",
        unit: "h",
        from: savedHours,
        to: nextHours,
      });
    }
  }

  const detail = changes
    .map((change) => `${change.label} ${change.from} → ${change.to} ${change.unit}`)
    .join("; ");
  const reason = layoutConfirmed
    ? "The confirmed bearer layout replaces the stated pile count."
    : "The stated pile count replaces the spacing layout saved on this draft.";
  countSummary = `Recalculate this draft before Pricing. ${reason} ${detail}. Nothing is changed until you update the estimate.`;
  }

  const holes = line(input.lines, HOLE_KEY, "Hole excavation");
  const savedStamp = holes?.holeDraft ?? null;
  let holeSummary: string | null = null;
  if (savedStamp) {
    const plan = planDeckHoleExcavation({
      facts,
      workAreaId,
      holeCount: authoritative,
    });
    const next = plan.draftStamp;
    if (plan.count.reasonMissing && plan.count.typedCount != null) {
      holeSummary = `Hole count ${plan.count.typedCount} needs a short reason before it can differ from the post count ${plan.count.postCount}. Add the reason, then update the estimate. Nothing is changed until you update the estimate.`;
    } else if (next && deckHoleStampsDiffer(savedStamp, next)) {
      if (
        savedStamp.count !== next.count &&
        !changes.some((change) => change.label === "Hole excavation")
      ) {
        changes.push({
          label: "Hole excavation",
          unit: "hole",
          from: savedStamp.count,
          to: next.count,
        });
      }
      if ((savedStamp.bankM3 ?? 0) !== (next.bankM3 ?? 0)) {
        changes.push({
          label: "Post-hole spoil",
          unit: "m³",
          from: savedStamp.bankM3 ?? 0,
          to: next.bankM3 ?? 0,
        });
      }
      const nextBags = next.concreteAuthority === "none" ? 0 : next.concreteBags ?? 0;
      const bags = line(input.lines, BAG_KEY, "Post-hole concrete");
      const savedBags = finite(bags?.quantity);
      if (
        savedBags != null &&
        !close(savedBags, nextBags) &&
        !changes.some((change) => change.label === "Post-hole concrete")
      ) {
        changes.push({
          label: "Post-hole concrete",
          unit: "bag",
          from: savedBags,
          to: nextBags,
        });
      }
      const place = line(input.lines, PLACE_KEY, "Concrete placement");
      const savedHours = finite(place?.labourHours);
      if (savedBags != null && savedBags > 0 && savedHours != null && nextBags > 0) {
        const nextHours = round2((savedHours / savedBags) * nextBags);
        if (
          !close(savedHours, nextHours) &&
          !changes.some((change) => change.label === "Concrete placement")
        ) {
          changes.push({
            label: "Concrete placement",
            unit: "h",
            from: savedHours,
            to: nextHours,
          });
        }
      }
      holeSummary = `Update this estimate before Pricing. Post holes changed. Was ${describeDeckHoleStamp(savedStamp)}. Now ${describeDeckHoleStamp(next)}. Nothing is changed until you update the estimate.`;
    } else if (next?.concreteAuthority === "provisional") {
      holeSummary = `Confirm the concrete fill, post size, and embedded depth before Pricing. ${describeDeckHoleStamp(next)} The bag count is provisional. Nothing is changed until you update the estimate.`;
    } else if (next?.needsConfirmation) {
      holeSummary = `Confirm or change these before using the estimate. ${describeDeckHoleStamp(next)}. An assumed hole is not measured and is not priced until you confirm it and update the estimate.`;
    }
  }

  if (!countSummary && !holeSummary) return null;
  return {
    statedCount: Math.round(stated),
    authoritativeCount: authoritative,
    savedCount: savedCount ?? authoritative,
    changes,
    summary: [countSummary, holeSummary].filter(Boolean).join(" "),
  };
}

export function deckStatedCountConflictFromPersisted(input: {
  facts: readonly EstimateFact[];
  lines: readonly {
    label?: string | null;
    component_key?: string | null;
    notes?: string | null;
  }[];
}): DeckStatedCountConflict | null {
  return deckStatedCountConflict({
    facts: input.facts,
    lines: input.lines.map((row) => {
      const parsed = parseLineItemNotes(row.notes);
      return {
        label: row.label,
        componentKey: row.component_key,
        quantity: parsed.metadata.quantity,
        unit: parsed.metadata.unit,
        labourHours: parsed.metadata.labourHours,
        holeDraft: parsed.metadata.holeDraft,
      };
    }),
  });
}

/** Read-only. A read failure does not invent a block and does not write the estimate. */
export async function deckStatedCountPricingBlock(
  supabase: SupabaseClient,
  projectId: string,
  estimateId: string,
  orgId: string
): Promise<string | null> {
  const [factsResult, linesResult] = await Promise.all([
    supabase
      .from("project_facts")
      .select("key, work_area_id, value")
      .eq("project_id", projectId),
    supabase
      .from("estimate_line_items")
      .select("label, component_key, notes")
      .eq("estimate_id", estimateId)
      .eq("org_id", orgId),
  ]);
  if (factsResult.error || linesResult.error) return null;
  return (
    deckStatedCountConflictFromPersisted({
      facts: (factsResult.data ?? []) as EstimateFact[],
      lines: linesResult.data ?? [],
    })?.summary ?? null
  );
}

/**
 * An existing quote is opened unchanged. A new quote is refused while the
 * saved draft still disagrees with the stated count. This does not write.
 */
export function quoteCreationDecision(input: {
  existingQuoteId: string | null;
  statedCountConflict: string | null;
}):
  | { readonly action: "open_existing"; readonly quoteId: string }
  | { readonly action: "refuse"; readonly error: string }
  | { readonly action: "continue" } {
  if (input.existingQuoteId) {
    return { action: "open_existing", quoteId: input.existingQuoteId };
  }
  if (input.statedCountConflict) {
    return { action: "refuse", error: input.statedCountConflict };
  }
  return { action: "continue" };
}
