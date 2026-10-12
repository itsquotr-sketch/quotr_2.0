/**
 * Deck details that must be answered before "Details captured" or a first estimate.
 * The Post holes editor and this list are the same decisions.
 */
import { getBooleanFact, getNumberFact, getStringFact } from "@/lib/estimate/facts";
import { planDeckHoleExcavation } from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_POST_HOLE_FINISH,
  deckPostHoleFinishItems,
} from "@/lib/estimate/deck-post-hole-result";
import { newSubstructureIncluded } from "@/lib/estimate/deck-scope-2c";
import type { EstimateFact } from "@/lib/estimate/types";

export type DeckDetailGap = {
  readonly id: string;
  readonly label: string;
};

export function deckPostsInScope(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return newSubstructureIncluded([...facts], workAreaId);
}

function postCount(facts: readonly EstimateFact[], workAreaId: string): number | null {
  const rows = getNumberFact([...facts], workAreaId, "deck.bearer_row_count");
  const per = getNumberFact([...facts], workAreaId, "deck.supports_per_bearer");
  if (rows != null && per != null) return Math.round(rows * per);
  const stated = getNumberFact([...facts], workAreaId, "deck.pile_or_post_count");
  return stated != null ? Math.round(stated) : null;
}

function spoilChoice(facts: readonly EstimateFact[], workAreaId: string): string {
  const destination = getStringFact([...facts], workAreaId, "deck.spoil_destination") ?? "";
  if (destination) return destination;
  const legacy = facts.find(
    (fact) => fact.key === "deck.spoil_leaves_site" && fact.work_area_id === workAreaId
  );
  if (legacy?.value === true) return "off_site";
  if (legacy?.value === false) return "on_site";
  return "";
}

export function deckDetailGaps(
  facts: readonly EstimateFact[],
  workAreaId: string
): DeckDetailGap[] {
  const rows = [...facts];
  const postsInScope = deckPostsInScope(rows, workAreaId);
  const concrete = getBooleanFact(rows, workAreaId, "deck.concrete_to_supports");
  if (!postsInScope && concrete !== true) return [];

  const gaps: DeckDetailGap[] = [];
  const posts = postCount(rows, workAreaId);
  if (posts == null) {
    gaps.push({ id: "posts", label: "Enter the number of posts" });
  }
  const holeCount = getNumberFact(rows, workAreaId, "deck.hole_count");
  const reason = getStringFact(rows, workAreaId, "deck.hole_count_reason") ?? "";
  if (
    posts != null &&
    holeCount != null &&
    Math.round(holeCount) !== posts &&
    !reason.trim()
  ) {
    gaps.push({ id: "hole_reason", label: "Add a reason for a different hole count" });
  }

  const plan = planDeckHoleExcavation({
    facts: rows,
    workAreaId,
    holeCount: posts ?? holeCount ?? 1,
  });
  const ground = getStringFact(rows, workAreaId, "deck.hole_ground") ?? "";
  const method = getStringFact(rows, workAreaId, "deck.hole_method") ?? "";
  const spoil = spoilChoice(rows, workAreaId);
  if (concrete == null && postsInScope) {
    gaps.push({ id: "concrete", label: "Confirm concrete footings" });
  }
  const finish = deckPostHoleFinishItems({
    sizeConfirmed: plan.draftStamp?.sizeConfirmed ?? false,
    ground,
    method,
    spoil,
    concreteOn: concrete === true,
    fill: getStringFact(rows, workAreaId, "deck.concrete_fill") ?? "",
    fillDepthMm: getNumberFact(rows, workAreaId, "deck.concrete_fill_depth_mm"),
    postSection: getStringFact(rows, workAreaId, "deck.support_section") ?? "",
    embedmentMm: getNumberFact(rows, workAreaId, "deck.post_embedment_mm"),
  });
  for (const id of finish) {
    gaps.push({ id, label: DECK_POST_HOLE_FINISH[id] });
  }
  return gaps;
}

export function deckDetailGapsForAreas(
  facts: readonly EstimateFact[],
  workAreas: readonly { id: string; type: string }[]
): DeckDetailGap[] {
  return workAreas
    .filter((area) => area.type === "deck")
    .flatMap((area) => deckDetailGaps(facts, area.id));
}

export function deckDetailGapCopy(gaps: readonly DeckDetailGap[]): string {
  const labels = gaps.map((gap) => gap.label);
  if (labels.length === 0) return "Complete the Deck details.";
  return `Complete Deck details: ${labels.join(", ")}.`;
}

/** Stage cards use only this. The longer explanation stays in the workspace. */
export function quantityConflictStageStatus(
  detail: string | null | undefined
): "Needs details" | "Needs updating" | null {
  const text = detail?.trim() ?? "";
  if (!text) return null;
  if (
    /provisional|before using the estimate|Confirm the concrete|Confirm or change/i.test(
      text
    )
  ) {
    return "Needs details";
  }
  return "Needs updating";
}
